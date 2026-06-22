import { fake6502, type Cpu6502 } from 'jsbeeb/src/fake6502.js';
import { findModel } from 'jsbeeb/src/models.js';
import { Video } from 'jsbeeb/src/video.js';
import { FakeSoundChip } from 'jsbeeb/src/soundchip.js';
import * as utils from 'jsbeeb/src/utils.js';
import type { MachineEmulator } from '../../dialects/types';
import {
  AtomHostKeyboard,
  isToggleKey,
  matrixForToken,
  stringToMatrix,
} from './keyboard';

/** jsbeeb's Video renders into a fixed 1024×625 RGBA framebuffer… */
const FB_WIDTH = 1024;
const FB_HEIGHT = 625;
/**
 * …of which the Atom's MC6847 active picture is a 512×384 rectangle (256×192
 * logical pixels, drawn two framebuffer lines per pixel row) sitting roughly
 * centred at the origin below — measured from the non-black bounding box of a
 * screen-filling program booted on the real ROM. Cropping it and downscaling by
 * exactly ½ yields the native 256×192 the dialect advertises.
 */
const ATOM_FB_X = 288;
const ATOM_FB_Y = 80;
const ATOM_FB_WIDTH = 512;
const ATOM_FB_HEIGHT = 384;

/** Native display the dialect advertises (the classic MC6847 256×192). */
export const ATOM_DISPLAY_WIDTH = 256;
export const ATOM_DISPLAY_HEIGHT = 192;

const CPU_HZ = 1_000_000; // the Atom runs its 6502 at 1 MHz
const CYCLES_PER_FRAME = CPU_HZ / 50;

/**
 * Cycles from hard reset to the `>` ready prompt with the cursor up. The Atom
 * kernel clears memory and runs a short self-test before BASIC is usable;
 * 1.6M cycles (~1.6s of emulated time) clears it with headroom.
 */
const BOOT_CYCLES = 1_600_000;

/**
 * Auto-RUN is typed through the key matrix (the OS keyboard buffer layout is
 * ROM-specific). Each key is held across several keyboard scans so the ROM
 * registers it, then released; both spans stay under the auto-repeat delay so
 * each key registers exactly once.
 */
const KEY_DOWN_CYCLES = 70_000;
const KEY_UP_CYCLES = 40_000;

/**
 * Acorn Atom BASIC zero-page layout. Program text lives from {@link TEXT_START}
 * (`#2900`); the ROM keeps the address of the byte *after* the program's
 * `0D FF` end marker ("top of text") in the two-byte cell at {@link TOP_OF_TEXT}
 * (`#0D/#0E`), little-endian — confirmed by booting the real ROM, entering a
 * program and reading zero page back. Fixing that pointer after poking an image
 * is what makes BASIC's RUN see the loaded program.
 */
const TEXT_START = 0x2900;
const TOP_OF_TEXT = 0x0d;

// In the browser, jsbeeb fetches 'roms/…' relative to this base; the Atom ROM
// set is committed under public/roms/atom/ in the layout jsbeeb expects.
if (typeof window !== 'undefined') {
  utils.setBaseUrl(import.meta.env.BASE_URL);
}

/** Point jsbeeb's ROM loader at its package root when running under node. */
export function configureNodeRomPath(jsbeebRoot: string): void {
  utils.setNodeBasePath(jsbeebRoot);
}

/**
 * An Acorn Atom wrapped around the jsbeeb emulator
 * (https://github.com/mattgodbolt/jsbeeb, GPL-3.0-or-later), built from the
 * `Atom-Tape-FP` model (kernel + floating-point + BASIC ROMs). A sibling of
 * {@link import('../bbc/bbcMachine').BbcMachine} rather than a reuse: the Atom
 * has its own 6502 variant (`AtomCpu6502`), an MC6847 VDG instead of the BBC
 * video ULA + CRTC, and an 8255 PPIA keyboard in place of the SysVia. Loading a
 * program is: boot the ROM, poke the (barely-tokenised) image at `#2900`, fix
 * the top-of-text pointer, then type `RUN` through the PPIA key matrix.
 */
export class AtomMachine implements MachineEmulator {
  readonly displayWidth = ATOM_DISPLAY_WIDTH;
  readonly displayHeight = ATOM_DISPLAY_HEIGHT;

  private readonly cpu: Cpu6502;
  private readonly hostKeyboard: AtomHostKeyboard;
  private readonly fb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
  /** Snapshot of the last complete frame, copied at paint time. */
  private readonly completeFb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);

  private readonly ready: Promise<void>;
  private initialised = false;
  private injecting = false;
  private loadGeneration = 0;
  private loadError = '';
  private speed = 1;
  private disposed = false;

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor() {
    const model = findModel('Atom-Tape-FP');
    if (!model) throw new Error('jsbeeb has no Atom-Tape-FP model');
    const fb32 = new Uint32Array(this.fb8.buffer);
    const video = new Video(
      false,
      fb32,
      () => {
        // Snapshot now — jsbeeb clears fb32 for the next frame after painting.
        this.completeFb8.set(this.fb8);
      },
      { isAtom: true },
    );
    this.cpu = fake6502(model, { video, soundChip: new FakeSoundChip() });
    if (!this.cpu.atomppia) throw new Error('Atom CPU has no PPIA');
    // The Atom keyboard hangs off the PPIA, not the SysVia.
    this.hostKeyboard = new AtomHostKeyboard(this.cpu.atomppia);
    this.ready = this.cpu.initialise().then(() => {
      this.initialised = true;
    });
    this.ready.catch((e) => {
      this.loadError = e instanceof Error ? e.message : String(e);
    });
  }

  /** Resolves once the ROMs are loaded and the machine can run (for tests). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Direct CPU access for tests and debugging. */
  get processor(): Cpu6502 {
    return this.cpu;
  }

  /** The Atom PPIA, which owns the key matrix and tape/speaker ports. */
  private get ppia(): NonNullable<Cpu6502['atomppia']> {
    return this.cpu.atomppia!;
  }

  reset(): void {
    this.loadGeneration++;
    this.loadError = '';
    void this.ready.then(() => {
      if (!this.disposed) this.cpu.reset(true);
    });
  }

  runFrame(): void {
    if (!this.initialised || this.injecting || this.disposed) return;
    this.cpu.execute(Math.round(CYCLES_PER_FRAME * this.speed));
  }

  /**
   * Inject an Atom BASIC program image (line records from `#2900`). ROM loading
   * is async, so the work is queued; frames render the machine booting in the
   * meantime and the program starts as soon as the pipeline lands it.
   */
  loadProgram(image: Uint8Array): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed) return;
        this.injecting = true;
        try {
          this.ppia.clearKeys();
          this.cpu.reset(true);
          this.cpu.execute(BOOT_CYCLES);
          for (let i = 0; i < image.length; i++) {
            this.cpu.writemem(TEXT_START + i, image[i]!);
          }
          // Top-of-text points just past the program so BASIC accepts it.
          const end = TEXT_START + image.length;
          this.cpu.writemem(TOP_OF_TEXT, end & 0xff);
          this.cpu.writemem(TOP_OF_TEXT + 1, (end >>> 8) & 0xff);
          this.typeViaMatrix('RUN\r');
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('Atom loadProgram failed:', e);
        }
      }
    })();
  }

  /**
   * Type a short command by driving the key matrix one key at a time with the
   * CPU running in between, so the OS keyboard scan picks each up. SHIFT and
   * caps-LOCK arrive as toggle keys (press-and-hold / release); every other key
   * is a momentary press. Used to auto-RUN a freshly loaded program.
   */
  private typeViaMatrix(text: string): void {
    for (const pos of stringToMatrix(text)) {
      if (isToggleKey(pos)) {
        this.ppia.keyToggleRaw(pos);
        this.cpu.execute(KEY_UP_CYCLES);
        continue;
      }
      this.ppia.keyDownRaw(pos);
      this.cpu.execute(KEY_DOWN_CYCLES);
      this.ppia.keyUpRaw(pos);
      this.cpu.execute(KEY_UP_CYCLES);
    }
    // Drop any modifier left held by a trailing toggle.
    this.ppia.clearKeys();
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = FB_WIDTH;
      this.backCanvas.height = FB_HEIGHT;
      this.backImageData = new ImageData(FB_WIDTH, FB_HEIGHT);
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.completeFb8);
    backCtx.putImageData(this.backImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      ATOM_FB_X,
      ATOM_FB_Y,
      ATOM_FB_WIDTH,
      ATOM_FB_HEIGHT,
      0,
      0,
      this.displayWidth,
      this.displayHeight,
    );
    if (this.loadError) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, this.displayHeight - 18, this.displayWidth, 18);
      ctx.fillStyle = '#ff6666';
      ctx.font = '10px monospace';
      ctx.fillText(this.loadError, 4, this.displayHeight - 6);
    }
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    // F12 acts as the BREAK key (reset line), as in jsbeeb itself.
    if (e.key === 'F12' || e.key === 'Pause') {
      this.cpu.setReset(down);
      return true;
    }
    if (e.metaKey || e.key === 'F11') return false;
    return this.hostKeyboard.handleKey(e, down);
  }

  setKey(token: string, down: boolean): void {
    if (token === 'Break') {
      this.cpu.setReset(down);
      return;
    }
    const pos = matrixForToken(token);
    if (!pos) return;
    if (down) this.ppia.keyDownRaw(pos);
    else this.ppia.keyUpRaw(pos);
  }

  releaseAllKeys(): void {
    this.ppia.clearKeys();
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
    this.ppia.clearKeys();
    this.backCanvas = null;
    this.backImageData = null;
  }
}
