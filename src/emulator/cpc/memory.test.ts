import { describe, expect, it } from 'vitest';
import { CpcMemory, CPC_ROM_SIZE, SCREEN_BASE } from './memory';

/** A 32K ROM whose lower half is 0xAA and upper half is 0x55, for overlay tests. */
function testRom(): Uint8Array {
  const rom = new Uint8Array(CPC_ROM_SIZE);
  rom.fill(0xaa, 0x0000, 0x4000); // lower / OS
  rom.fill(0x55, 0x4000, 0x8000); // upper / BASIC
  return rom;
}

describe('CpcMemory ROM image size', () => {
  // Without this guard a short image loads in part - a prefix of the lower ROM,
  // the rest and all of BASIC left zeroed - and boots to a dead machine with
  // nothing to explain it. Supplying one 16K half of the 32K pair is the
  // likeliest way to get here.
  it('refuses an image that is not the full 32K', () => {
    expect(() => new CpcMemory(new Uint8Array(0x4000))).toThrow(
      /must be 32768 bytes, got 16384/,
    );
    expect(() => new CpcMemory(new Uint8Array(CPC_ROM_SIZE + 1))).toThrow(
      /must be 32768 bytes/,
    );
  });

  // The documented "no firmware to run" state (see CpcMachine's ROM note),
  // which the CPC suites fall back to when the un-redistributable image is
  // absent, so it stays constructible.
  it('accepts an empty image as the absent-firmware state', () => {
    expect(() => new CpcMemory(new Uint8Array(0))).not.toThrow();
  });
});

describe('CpcMemory ROM overlay', () => {
  it('reads the lower ROM over &0000–&3FFF while enabled', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0x0000] = 0x11;
    mem.ram[0x3fff] = 0x22;
    expect(mem.read(0x0000)).toBe(0xaa);
    expect(mem.read(0x3fff)).toBe(0xaa);
    // &4000 is always RAM.
    mem.ram[0x4000] = 0x33;
    expect(mem.read(0x4000)).toBe(0x33);
  });

  it('reads the upper ROM over &C000–&FFFF while enabled', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0xc000] = 0x11;
    mem.ram[0xffff] = 0x22;
    expect(mem.read(0xc000)).toBe(0x55);
    expect(mem.read(0xffff)).toBe(0x55);
  });

  it('falls through to RAM once an overlay is disabled', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0x0000] = 0x11;
    mem.ram[0xc000] = 0x22;
    mem.setRomEnables(false, false); // both overlays off
    expect(mem.read(0x0000)).toBe(0x11);
    expect(mem.read(0xc000)).toBe(0x22);
  });

  it('enables each overlay independently', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0x0000] = 0x11;
    mem.ram[0xc000] = 0x22;
    mem.setRomEnables(false, true); // lower off, upper on
    expect(mem.read(0x0000)).toBe(0x11); // RAM
    expect(mem.read(0xc000)).toBe(0x55); // ROM
  });
});

describe('CpcMemory writes', () => {
  it('writes through to RAM even where a ROM overlay is active', () => {
    const mem = new CpcMemory(testRom());
    // BASIC ROM is paged in over the screen, but the firmware still writes it.
    mem.write(SCREEN_BASE, 0x99);
    expect(mem.readScreen(SCREEN_BASE)).toBe(0x99); // landed in RAM
    expect(mem.read(SCREEN_BASE)).toBe(0x55); // read still returns ROM
    mem.setRomEnables(true, false); // page BASIC out
    expect(mem.read(SCREEN_BASE)).toBe(0x99); // now the RAM write shows through
  });

  it('round-trips words little-endian', () => {
    const mem = new CpcMemory(testRom());
    mem.writeWord(0x8000, 0x1234);
    expect(mem.ram[0x8000]).toBe(0x34);
    expect(mem.ram[0x8001]).toBe(0x12);
    expect(mem.readWord(0x8000)).toBe(0x1234);
  });
});

describe('CpcMemory reset + paging', () => {
  it('re-enables both overlays on resetPaging', () => {
    const mem = new CpcMemory(testRom());
    mem.setRomEnables(false, false);
    mem.resetPaging();
    expect(mem.read(0x0000)).toBe(0xaa);
    expect(mem.read(0xc000)).toBe(0x55);
  });

  it('clears RAM without disturbing the ROMs', () => {
    const mem = new CpcMemory(testRom());
    mem.ram.fill(0x7f);
    mem.clearRam();
    expect(mem.ram[0x4000]).toBe(0x00);
    expect(mem.read(0x0000)).toBe(0xaa); // lower ROM intact
  });

  it('records reads and writes only while activity is enabled', () => {
    const mem = new CpcMemory(testRom());
    mem.read(0x4000);
    mem.write(0x4001, 1);
    expect(mem.activity.hits[0x4000]).toBe(0); // off by default
    mem.activity.enabled = true;
    mem.read(0x4000);
    mem.write(0x4001, 1);
    expect(mem.activity.hits[0x4000]! & 1).toBe(1); // read bit
    expect(mem.activity.hits[0x4001]! & 2).toBe(2); // write bit
  });
});

describe('CpcMemory 6128 RAM banking', () => {
  const mem6128 = () => {
    const m = new CpcMemory(testRom(), '6128');
    m.setRomEnables(false, false); // read RAM, not the overlays
    return m;
  };

  it('boots in configuration 0, the flat base 64K', () => {
    const mem = mem6128();
    expect(mem.ramConfiguration).toBe(0);
    mem.write(0x4000, 0x11);
    expect(mem.ram[0x4000]).toBe(0x11);
    expect(mem.read(0x4000)).toBe(0x11);
    // Nothing has touched the expansion bank.
    expect(mem.expansionRam.every((b) => b === 0)).toBe(true);
  });

  it('fits a second 64K only on the 6128', () => {
    expect(new CpcMemory(testRom(), '6128').expansionRam.length).toBe(0x10000);
    expect(new CpcMemory(testRom(), '464').expansionRam.length).toBe(0);
    // The 664 is a 64K machine like the 464 - the disc drive is what it added,
    // not memory - so it gets the flat base RAM and nothing to bank.
    expect(new CpcMemory(testRom(), '664').expansionRam.length).toBe(0);
  });

  it('writes through a banked window without disturbing the base RAM', () => {
    const mem = mem6128();
    mem.write(0x4000, 0x11); // base bank 1
    mem.setRamConfig(0xc4); // config 4: bank 4 at &4000
    expect(mem.ramConfiguration).toBe(4);
    expect(mem.read(0x4000)).toBe(0x00); // a fresh expansion bank
    mem.write(0x4000, 0x99);
    expect(mem.ram[0x4000]).toBe(0x11); // base untouched
    expect(mem.expansionRam[0x0000]).toBe(0x99);

    mem.setRamConfig(0xc0); // back to the flat 64K
    expect(mem.read(0x4000)).toBe(0x11);
  });

  it('keeps each expansion bank distinct across configurations 4-7', () => {
    const mem = mem6128();
    for (let cfg = 4; cfg <= 7; cfg++) {
      mem.setRamConfig(0xc0 | cfg);
      mem.write(0x4000, 0xa0 | cfg);
    }
    for (let cfg = 4; cfg <= 7; cfg++) {
      mem.setRamConfig(0xc0 | cfg);
      expect(mem.read(0x4000), `config ${cfg}`).toBe(0xa0 | cfg);
    }
    // Each landed in its own 16K bank of the expansion RAM.
    for (let bank = 0; bank < 4; bank++) {
      expect(mem.expansionRam[bank * 0x4000]).toBe(0xa4 + bank);
    }
  });

  it('maps all four expansion banks in configuration 2', () => {
    const mem = mem6128();
    mem.setRamConfig(0xc2);
    for (let w = 0; w < 4; w++) mem.write(w * 0x4000, 0x40 + w);
    for (let w = 0; w < 4; w++) {
      expect(mem.expansionRam[w * 0x4000], `window ${w}`).toBe(0x40 + w);
    }
    expect(mem.ram.every((b) => b === 0)).toBe(true);
  });

  it('remaps base banks within the 64K in configurations 1 and 3', () => {
    const mem = mem6128();
    mem.ram[0x0000] = 0xb0; // bank 0
    mem.ram[0x4000] = 0xb1; // bank 1
    mem.ram[0x8000] = 0xb2; // bank 2
    mem.ram[0xc000] = 0xb3; // bank 3

    // Config 1 is banks 0,1,2,7: only &C000 leaves the base RAM.
    mem.setRamConfig(0xc1);
    expect(mem.read(0x0000)).toBe(0xb0);
    expect(mem.read(0x4000)).toBe(0xb1);
    expect(mem.read(0x8000)).toBe(0xb2);
    expect(mem.read(0xc000)).toBe(0x00); // expansion bank 7

    // Config 3 is banks 0,3,2,7: base bank 3 appears at &4000.
    mem.setRamConfig(0xc3);
    expect(mem.read(0x4000)).toBe(0xb3);
    mem.write(0x4000, 0xcc);
    expect(mem.ram[0xc000]).toBe(0xcc); // wrote through to bank 3

    mem.setRamConfig(0xc0);
    expect(mem.read(0x4000)).toBe(0xb1);
  });

  it('ignores the configuration bits above 0-2', () => {
    const mem = mem6128();
    mem.setRamConfig(0x3c); // &7Fxx value with the &C0 group bits stripped
    expect(mem.ramConfiguration).toBe(4);
  });

  it.each(['464', '664'] as const)(
    'is inert on the %s, which has no second bank fitted',
    (model) => {
      const mem = new CpcMemory(testRom(), model);
      mem.setRomEnables(false, false);
      mem.write(0x4000, 0x11);
      mem.setRamConfig(0xc2); // "all expansion" - nothing to switch to
      expect(mem.ramConfiguration).toBe(0);
      expect(mem.read(0x4000)).toBe(0x11);
    },
  );

  it('returns to configuration 0 on a paging reset', () => {
    const mem = mem6128();
    mem.setRamConfig(0xc2);
    mem.resetPaging();
    expect(mem.ramConfiguration).toBe(0);
    expect(mem.read(0x4000)).toBe(0x00);
  });

  it('clears the expansion RAM with the base RAM', () => {
    const mem = mem6128();
    mem.setRamConfig(0xc2);
    mem.write(0x4000, 0x5a);
    mem.clearRam();
    expect(mem.expansionRam.every((b) => b === 0)).toBe(true);
  });

  it('leaves the display and BASIC pointer reads on the base 64K', () => {
    // On the real 6128 the CRTC always fetches from the first 64K, whatever
    // the CPU has configured - so the renderer and the variable watcher must
    // not follow the banked window.
    const mem = mem6128();
    mem.ram[SCREEN_BASE] = 0x3c;
    mem.writeWord(0xae85, 0x1234);
    mem.setRamConfig(0xc2); // every window on the expansion bank
    expect(mem.readScreen(SCREEN_BASE)).toBe(0x3c);
    expect(mem.readWord(0xae85)).toBe(0x1234);
  });
});
