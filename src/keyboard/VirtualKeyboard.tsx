import { useEffect, useMemo, useRef, useState } from 'react';
import type { MachineEmulator } from '../dialects/types';
import type {
  EditorKeyAction,
  EditorModeDef,
  GraphicEntry,
  KeyDef,
  KeyboardLayout,
  LayerDef,
} from './layoutSchema';
import { KeyboardInputEngine } from './inputEngine';
import {
  inEditorLetterCase,
  isRepeatable,
  modePinnedLayerId,
  resolveEditorAction,
} from './editorActions';
import { inLetterCase, isWordLegend } from './legendKit';
import { pickableKeys } from './controllerConfig';
import { pinsModeOnlyLayer, rowsWithoutCaseKey } from './caseAffordance';
import { GlyphSvg } from './GlyphSvg';
import { ControlChipSvg } from './ControlChipSvg';
import './VirtualKeyboard.css';

/**
 * Where key presses go. Callers must keep the object identity stable
 * (useMemo) or the engine - and its sticky-modifier state - resets.
 */
export type KeyboardTarget =
  | {
      kind: 'machine';
      getMachine(): MachineEmulator | null;
      /** Lets the emulator's rAF tick drive engine.onFrame(). Must be stable. */
      registerFrameHook(cb: (() => void) | null): void;
    }
  | { kind: 'editor'; apply(action: EditorKeyAction): void };

interface VirtualKeyboardProps {
  layout: KeyboardLayout;
  target: KeyboardTarget;
  /** When false the keyboard greys out and ignores input. */
  enabled: boolean;
  sound: boolean;
  haptics: boolean;
  /** Keycap legends: the layered view (the letter, the one marking the
   *  current mode selects, and the symbol hint) or only the active mode's
   *  character, centered and larger ('compact'). */
  keyDisplay: 'layered' | 'compact';
  /** When set, the keyboard acts as a key picker: a tap on a matrix-driving
   *  key reports its id instead of typing into the target. */
  onPickKey?: (keyId: string) => void;
  /**
   * The machine offers no letter case to shift into and the reader has asked to
   * be held to that (Strict characters), so the shift keycap is withdrawn while
   * the keyboard types into the editor. See {@link ./caseAffordance} for what
   * that must not take with it. Machine-specific knowledge stays at the call
   * site: this is a fact handed down, not one the keyboard works out.
   */
  hideCaseKey?: boolean;
}

/** Pointer id used for activation via the physical keyboard (a11y path). */
const KEYBOARD_POINTER_ID = -1;

/** Hold-to-repeat timing for editor actions (backspace, cursor moves). */
const REPEAT_DELAY_MS = 450;
const REPEAT_INTERVAL_MS = 60;

/** How far a finger may travel and still count as a tap on a palette cell.
    The palette scrolls, so a press there is only an insert once the pointer
    lifts without having panned - otherwise flicking through the characters
    would type every cell it started on. */
const TAP_SLOP_PX = 10;

interface RepeatTimer {
  timeout?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

/**
 * How a palette cell names itself: the character, then how the machine reaches
 * it - the key it is printed on, or its character code where the machine had no
 * graphics keys.
 */
function graphicAriaLabel(entry: GraphicEntry): string {
  // A control cell inserts an escape, not a character: name it by what the
  // code does, which is also what its chip draws.
  if (entry.chip)
    return `Insert ${entry.chip.title}, character code ${entry.code}`;
  if (entry.key === undefined)
    return `Insert ${entry.char}, character code ${entry.code}`;
  const key = entry.modifier ? `${entry.modifier} + ${entry.key}` : entry.key;
  return `Insert ${entry.char}, key ${key}`;
}

function keyAriaLabel(
  def: KeyDef,
  layout: KeyboardLayout,
  activeLayerId: string,
): string {
  const activeIdx = layout.layers.findIndex((l) => l.id === activeLayerId);
  const label =
    def.labels[activeIdx] ?? def.labels.find((l) => l !== null) ?? null;
  return label?.text ?? (label?.glyph ? `graphic ${label.glyph}` : def.id);
}

export function VirtualKeyboard({
  layout,
  target,
  enabled,
  sound,
  haptics,
  keyDisplay,
  onPickKey,
  hideCaseKey = false,
}: VirtualKeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;

  // In pick mode, the set of key ids a tap may report (matrix-driving keys).
  const pickableIds = useMemo(
    () => new Set(pickableKeys(layout).map((k) => k.id)),
    [layout],
  );

  const keyById = useMemo(() => {
    const map = new Map<string, KeyDef>();
    for (const row of layout.rows) for (const k of row) map.set(k.id, k);
    for (const k of layout.functionKeys ?? []) map.set(k.id, k);
    return map;
  }, [layout]);

  // Top-strip input modes (the ZX81 K/F/G cursor as a selector bar). Each mode
  // pins a layer. Shown for both targets: the pinned layer picks the legend,
  // and a legend may carry its own matrix tokens, which is how CURSOR mode
  // presses the machine's cursor keys rather than the letters underneath.
  const editorModes = layout.editorModes ?? [];
  // A palette mode produces editor inserts and nothing else, so it has nothing
  // to do while the keyboard drives the machine (there the machine's own
  // graphics mode and its modifier keys do the job). The tab stays in the strip
  // - the mode list must not shuffle as focus moves - but greys out.
  const paletteUnavailable = (m: EditorModeDef): boolean =>
    !!m.palette && target.kind !== 'editor';
  const [modeId, setModeId] = useState<string | null>(null);
  useEffect(() => setModeId(null), [layout]);
  const selected =
    editorModes.find((m) => m.id === modeId) ?? editorModes[0] ?? null;
  // Losing the editor (the emulator takes focus) drops a palette mode back to
  // the first one, so the keyboard never sits in a mode it cannot honour.
  const mode =
    selected && paletteUnavailable(selected) ? editorModes[0]! : selected;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Which of the SYM mode's two symbol pages shows. Component state, never a
  // machine modifier: flipping pages must press nothing on the machine.
  const [symPage2, setSymPage2] = useState(false);
  const symPage2Ref = useRef(symPage2);
  symPage2Ref.current = symPage2;
  useEffect(() => setSymPage2(false), [layout, modeId]);

  // Top-strip function keys (the C64's f1/f3/f5/f7, the BBC's f0–f9). When a
  // layout has both modes and function keys the strip shows one at a time
  // behind an icon toggle.
  const functionKeys = useMemo(() => layout.functionKeys ?? [], [layout]);
  const hasModes = editorModes.length > 0;
  const hasFnKeys = functionKeys.length > 0;
  const hasToggle = hasModes && hasFnKeys;
  const [stripView, setStripView] = useState<'modes' | 'fn'>('modes');
  useEffect(() => setStripView('modes'), [layout]);
  const showModeTabs = hasModes && (!hasToggle || stripView === 'modes');
  const showFnKeys = hasFnKeys && (!hasToggle || stripView === 'fn');

  const baseLayer = useMemo(
    () =>
      layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0]!,
    [layout],
  );
  const baseLayerRef = useRef(baseLayer);
  baseLayerRef.current = baseLayer;

  /** Action resolved by the engine's key-down callback, for repeat setup. */
  const lastActionRef = useRef<EditorKeyAction | null>(null);

  // Rebuilt on machine/dialect swap (layout identity changes). Callbacks go
  // through refs so the engine never holds stale closures.
  const targetKind = target.kind;
  const engine = useMemo(() => {
    if (targetKind === 'machine') {
      return new KeyboardInputEngine(layout, {
        kind: 'machine',
        getMachine: () => {
          const t = targetRef.current;
          return t.kind === 'machine' ? t.getMachine() : null;
        },
      });
    }
    return new KeyboardInputEngine(layout, {
      kind: 'editor',
      onKeyPress: (key: KeyDef, activeLayer: LayerDef, letterCase) => {
        const m = modeRef.current;
        // In the base (ABC) mode the engine's layer applies (shift works);
        // other modes pin the layer (with their optional second page).
        const layerId =
          modePinnedLayerId(
            layout,
            m,
            baseLayerRef.current.id,
            activeLayer,
            symPage2Ref.current,
          ) ?? activeLayer.id;
        // The case latch decides what an *unshifted* letter key types; a
        // shifted or moded legend is the machine's own and says what it says.
        // Composed here rather than inside the lookup, which stays pure.
        const resolved = resolveEditorAction(layout, key, layerId);
        const action =
          layerId === baseLayerRef.current.id
            ? inEditorLetterCase(resolved, letterCase)
            : resolved;
        lastActionRef.current = action;
        const t = targetRef.current;
        if (action && t.kind === 'editor') t.apply(action);
      },
    });
  }, [layout, targetKind]);
  useEffect(() => () => engine.cancelAll(), [engine]);

  const [, setVersion] = useState(0);
  useEffect(() => {
    engine.onChange = () => setVersion((v) => v + 1);
    return () => {
      engine.onChange = null;
    };
  }, [engine]);

  useEffect(() => {
    if (target.kind !== 'machine') return;
    target.registerFrameHook(() => engine.onFrame());
    return () => target.registerFrameHook(null);
  }, [engine, target]);

  // ---- hold-to-repeat (editor target only) --------------------------------

  const repeatTimers = useRef(new Map<number, RepeatTimer>());
  /**
   * Pointers that went down on a function key. The strip scrolls sideways, so
   * the browser owns a drag there: hit-testing the slide would press the row's
   * keys into the live matrix during the slop before the pan is recognised.
   */
  const stripPointers = useRef(new Set<number>());

  /** Key currently under each pointer, to detect slides for repeat resets. */
  const pointerKey = useRef(new Map<number, string | null>());

  const stopRepeat = (pointerId: number) => {
    const timer = repeatTimers.current.get(pointerId);
    if (!timer) return;
    if (timer.timeout !== undefined) clearTimeout(timer.timeout);
    if (timer.interval !== undefined) clearInterval(timer.interval);
    repeatTimers.current.delete(pointerId);
  };

  const stopAllRepeats = () => {
    for (const id of [...repeatTimers.current.keys()]) stopRepeat(id);
  };
  const stopAllRepeatsRef = useRef(stopAllRepeats);
  stopAllRepeatsRef.current = stopAllRepeats;

  const startRepeat = (pointerId: number, action: EditorKeyAction) => {
    stopRepeat(pointerId);
    const apply = () => {
      const t = targetRef.current;
      if (t.kind === 'editor') t.apply(action);
    };
    const timeout = setTimeout(() => {
      const interval = setInterval(apply, REPEAT_INTERVAL_MS);
      repeatTimers.current.set(pointerId, { interval });
    }, REPEAT_DELAY_MS);
    repeatTimers.current.set(pointerId, { timeout });
  };

  /** Consume the action captured by the engine callback during a key-down. */
  const takeLastAction = (): EditorKeyAction | null => {
    const action = lastActionRef.current;
    lastActionRef.current = null;
    return action;
  };

  useEffect(() => () => stopAllRepeatsRef.current(), []);

  useEffect(() => {
    if (!enabled) {
      engine.cancelAll();
      stopAllRepeatsRef.current();
    }
  }, [enabled, engine]);

  // Sticky state must not leak across input modes.
  useEffect(() => {
    engine.cancelAll();
    stopAllRepeatsRef.current();
  }, [modeId, engine]);

  // Landscape: the keyboard centres and the top strip relocates into the left
  // gutter as a vertical bar. Driven by viewport orientation, not the keyboard's
  // own box (the overlay is always wider than tall, so the element can't tell).
  const [landscape, setLandscape] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const update = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // The graphics palette: a grid of the machine's block-graphics characters,
  // shown instead of the keys while a mode selects it. Cells are not keys -
  // they carry no matrix tokens - so they bypass the input engine and apply
  // their insert straight to the editor, exactly as a key's insert would.
  const palette = layout.graphicsPalette;
  const showPalette =
    !onPickKey &&
    !!palette &&
    mode?.palette === 'graphics' &&
    target.kind === 'editor';
  const paletteEntries = useMemo(
    () => (palette ? palette.sections.flatMap((s) => s.entries) : []),
    [palette],
  );
  const paletteRef = useRef<HTMLDivElement>(null);

  // The shift keycap goes only while the keyboard is typing into the editor:
  // at the machine it is the machine's own key, and the combinations it makes
  // there (BREAK on the Sinclairs is SHIFT+SPACE) are not this setting's to
  // take away. A pinned mode-only layer keeps it too - there it is the SYM
  // page toggle, not the shift.
  const hideShift =
    hideCaseKey &&
    target.kind === 'editor' &&
    !onPickKey &&
    !pinsModeOnlyLayer(layout, mode);
  const displayRows = useMemo(
    () => rowsWithoutCaseKey(layout.rows, hideShift),
    [layout.rows, hideShift],
  );
  const gridCols = layout.gridColumns;

  // modeOnly layers never decorate keycaps outside their mode, so they are
  // not offerable as the layered view's secondary legend either.
  const secondaryLayers = useMemo(
    () => layout.layers.filter((l) => l !== baseLayer && !l.modeOnly),
    [layout, baseLayer],
  );
  const legendLayerId =
    layout.options?.compactDefaultLayer ?? secondaryLayers[0]?.id;

  // Any path that can lose pointers clears all matrix state (R5).
  useEffect(() => {
    const cancelAll = () => {
      engine.cancelAll();
      stopAllRepeatsRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAll();
    };
    window.addEventListener('blur', cancelAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancelAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [engine]);

  const activePointers = useRef(new Set<number>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    },
    [],
  );

  const pressFeedback = () => {
    if (hapticsRef.current) navigator.vibrate?.(8);
    if (!soundRef.current || typeof AudioContext === 'undefined') return;
    // Created lazily inside a pointerdown so iOS unlocks it.
    audioCtxRef.current ??= new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1700;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  };

  /** Type a palette character, the same insert a key legend would produce. */
  const applyGraphic = (entry: GraphicEntry | undefined) => {
    const t = targetRef.current;
    if (!entry || t.kind !== 'editor') return;
    t.apply({ insert: entry.char });
    pressFeedback();
  };

  /**
   * A tap on the shift flank while a mode pins a modeOnly layer: the page
   * toggle when the mode has a second page, inert when it does not. Either
   * way the tap must never reach the engine - an engaged shift's held
   * tokens would bleed into symbol combinations that do not include it.
   * Only the flanked shift carries a label on the pinned layer; other
   * modifiers (a bottom-row SymShift, CTRL) keep working normally.
   */
  const handleModeOnlyShift = (keyId: string): boolean => {
    const m = modeRef.current;
    if (!m) return false;
    const pinnedIdx = layout.layers.findIndex((l) => l.id === m.layer);
    if (!layout.layers[pinnedIdx]?.modeOnly) return false;
    const def = keyById.get(keyId);
    if (!def?.modifier || def.labels[pinnedIdx] == null) return false;
    if (m.shiftedLayer) {
      setSymPage2((p) => !p);
      pressFeedback();
    }
    return true;
  };

  /** The palette cell a pointer went down on, until it taps or pans away. */
  const paletteTap = useRef<{
    pointerId: number;
    idx: number;
    x: number;
    y: number;
  } | null>(null);

  /** Index of the palette cell at a point, or null if there is none there. */
  const graphicIdxAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-graphic]');
    if (!el || !containerRef.current?.contains(el)) return null;
    return Number(el.getAttribute('data-graphic'));
  };

  const keyIdAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    const keyEl = el?.closest('[data-keyid]');
    if (!keyEl || !containerRef.current?.contains(keyEl)) return null;
    return keyEl.getAttribute('data-keyid');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Load-bearing (R4): stops the tap from stealing focus from the canvas
    // or the editor, so physical-keyboard input keeps working.
    e.preventDefault();
    if (!enabled) return;
    const cell = (e.target as Element).closest('[data-graphic]');
    if (cell) {
      // Remembered, not typed: the palette is a scroller, so the insert waits
      // for the lift (see onPointerUp) and a pan cancels it instead.
      const idx = Number(cell.getAttribute('data-graphic'));
      setFocusIdx(idx);
      paletteTap.current = {
        pointerId: e.pointerId,
        idx,
        x: e.clientX,
        y: e.clientY,
      };
      return;
    }
    paletteTap.current = null;
    const keyId = (e.target as Element)
      .closest('[data-keyid]')
      ?.getAttribute('data-keyid');
    // Pick mode: a tap on a matrix key reports its id and does nothing else -
    // never drive the engine, machine, repeat, or pointer capture.
    if (onPickKey) {
      if (keyId && pickableIds.has(keyId)) onPickKey(keyId);
      return;
    }
    if (!keyId) return;
    if (handleModeOnlyShift(keyId)) return;
    if ((e.target as Element).closest('.vk-fn-row'))
      stripPointers.current.add(e.pointerId);
    // Capture on the container: pointermove keeps firing here while we
    // hit-test slides with elementFromPoint.
    containerRef.current?.setPointerCapture(e.pointerId);
    activePointers.current.add(e.pointerId);
    pointerKey.current.set(e.pointerId, keyId);
    engine.pointerDown(keyId, e.pointerId);
    const action = takeLastAction();
    if (action && isRepeatable(action)) startRepeat(e.pointerId, action);
    pressFeedback();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const tap = paletteTap.current;
    if (tap && tap.pointerId === e.pointerId) {
      // Past the slop the gesture is a scroll, not a tap on a character.
      if (
        Math.abs(e.clientX - tap.x) > TAP_SLOP_PX ||
        Math.abs(e.clientY - tap.y) > TAP_SLOP_PX
      )
        paletteTap.current = null;
      return;
    }
    if (!enabled || !activePointers.current.has(e.pointerId)) return;
    // A drag that began on the strip is the row scrolling. The key stays held
    // until the lift, or until the browser takes the pan and cancels it.
    if (stripPointers.current.has(e.pointerId)) return;
    const keyId = keyIdAt(e.clientX, e.clientY);
    const prev = pointerKey.current.get(e.pointerId);
    engine.pointerEnter(keyId, e.pointerId);
    if (keyId !== prev) {
      pointerKey.current.set(e.pointerId, keyId);
      stopRepeat(e.pointerId);
      const action = takeLastAction();
      if (action && isRepeatable(action)) startRepeat(e.pointerId, action);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const tap = paletteTap.current;
    if (tap && tap.pointerId === e.pointerId) {
      paletteTap.current = null;
      // Still over the cell it went down on: the grid can have scrolled under
      // a finger that itself barely moved, and then this is a different
      // character - typing it would be typing something nobody aimed at.
      if (enabled && graphicIdxAt(e.clientX, e.clientY) === tap.idx)
        applyGraphic(paletteEntries[tap.idx]);
      return;
    }
    if (!activePointers.current.delete(e.pointerId)) return;
    stripPointers.current.delete(e.pointerId);
    pointerKey.current.delete(e.pointerId);
    stopRepeat(e.pointerId);
    engine.pointerUp(e.pointerId);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    // A pan the browser took over cancels the pointer; drop the pending tap.
    if (paletteTap.current?.pointerId === e.pointerId)
      paletteTap.current = null;
    if (!activePointers.current.delete(e.pointerId)) return;
    stripPointers.current.delete(e.pointerId);
    pointerKey.current.delete(e.pointerId);
    stopRepeat(e.pointerId);
    engine.cancel(e.pointerId);
  };

  // Roving focus: the whole keyboard is one tab stop; arrows move between
  // keys, Enter/Space presses the focused key.
  const flatKeys = useMemo(
    () =>
      [...displayRows.flat(), ...(showFnKeys ? functionKeys : [])].filter(
        (k) => k.emits.length > 0 || k.modifier,
      ),
    [displayRows, showFnKeys, functionKeys],
  );
  const [focusIdx, setFocusIdx] = useState(0);
  // The palette and the key grid are separate roving-focus sets; swapping
  // between them must not leave the cursor past the end of the new one.
  useEffect(() => setFocusIdx(0), [showPalette, modeId]);

  /** Columns the palette grid currently renders, for up/down arrow moves. */
  const paletteColumns = (): number => {
    const el = paletteRef.current;
    if (!el) return 1;
    const cols = getComputedStyle(el).gridTemplateColumns.trim();
    return cols === '' || cols === 'none' ? 1 : cols.split(/\s+/).length;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!enabled) return;
    if (showPalette) {
      const move = (delta: number) => {
        setFocusIdx(
          (i) =>
            (i + delta + paletteEntries.length) % (paletteEntries.length || 1),
        );
        e.preventDefault();
      };
      if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowDown') move(paletteColumns());
      else if (e.key === 'ArrowUp') move(-paletteColumns());
      else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        applyGraphic(paletteEntries[focusIdx]);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      setFocusIdx((i) => (i + dir + flatKeys.length) % flatKeys.length);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const rowLen = displayRows[0]?.length ?? 1;
      setFocusIdx(
        (i) => (i + dir * rowLen + flatKeys.length) % flatKeys.length,
      );
      e.preventDefault();
    } else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      const key = flatKeys[focusIdx];
      if (key && !handleModeOnlyShift(key.id)) {
        engine.pointerDown(key.id, KEYBOARD_POINTER_ID);
        takeLastAction(); // no hold-to-repeat on the a11y path
        pressFeedback();
      }
      e.preventDefault();
    }
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      engine.pointerUp(KEYBOARD_POINTER_ID);
      e.preventDefault();
    }
  };

  const pressed = engine.getPressedKeyIds();
  const activeLayer = engine.getActiveLayer();
  // The engine resolves a modifier-driven layer itself, but a mode-pinned one
  // is this component's state, so push it down: it decides both which legend a
  // key shows and which tokens it presses.
  useEffect(() => {
    engine.setPinnedLayer(
      modePinnedLayerId(layout, mode, baseLayer.id, activeLayer, symPage2),
    );
  }, [engine, layout, mode, baseLayer.id, activeLayer, symPage2]);
  const focusKeyId = flatKeys[focusIdx]?.id;

  // Roving focus is a class rather than DOM focus, so the browser will not
  // bring an arrowed-to key into view - and the strip is the one row that can
  // have keys past its edge.
  useEffect(() => {
    if (focusKeyId === undefined) return;
    containerRef.current
      ?.querySelector(`.vk-fn-row [data-keyid="${CSS.escape(focusKeyId)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [focusKeyId]);
  // A non-base editor mode pins the highlighted layer (honouring its second
  // page); otherwise an engaged modifier decides it.
  const modeLayerId = modePinnedLayerId(
    layout,
    mode,
    baseLayer.id,
    activeLayer,
    symPage2,
  );
  const highlightLayerId = modeLayerId ?? activeLayer.id;
  // The one secondary legend a layered keycap prints follows the same choice.
  // For the editor target in the base mode, show the modifier-driven layer
  // (its legends are the only secondaries reachable without a mode change).
  const modifierLayer = layout.layers.find((l) => l.activeWhen.length > 0);
  const visibleSecondaryId =
    modeLayerId ??
    (activeLayer.id !== baseLayer.id
      ? activeLayer.id
      : (modifierLayer?.id ?? legendLayerId));

  // Compact display: one larger centered legend per key - the active mode's
  // character. Keys with no legend for the active mode fall back to a dimmed
  // base (main) legend so the layout stays recognisable.
  const baseIdx = layout.layers.indexOf(baseLayer);
  // The case a letter keycap shows, and types: the layout's power-on case,
  // flipped by every case-lock press since the keyboard was built. A keycap
  // that showed one case while typing the other would be the whole of what
  // this is for.
  const letterCase = engine.getLetterCase();
  const activeLabelIdx = layout.layers.findIndex(
    (l) => l.id === highlightLayerId,
  );
  const highlightLayer = layout.layers[activeLabelIdx];
  // The legend shown on a key in single (Compact) display: the active mode's
  // label, falling back to the dimmed base label when the mode has none.
  const resolveSingleLabel = (def: KeyDef) => {
    const active = activeLabelIdx >= 0 ? def.labels[activeLabelIdx] : null;
    return active ?? def.labels[baseIdx] ?? null;
  };
  // Drive every key's font size from the longest legend visible in the active
  // mode so all keys render at one uniform size (short words don't grow back to
  // the cap while long words shrink). Word legends are excluded: they take the
  // fixed word size wherever they appear, so one CTRL keycap must not shrink
  // every letter on the board.
  const maxSingleLen =
    keyDisplay === 'compact'
      ? displayRows.reduce(
          (max, row) =>
            row.reduce((m, def) => {
              const label = resolveSingleLabel(def);
              if (!label || label.glyph || !label.text) return m;
              if (isWordLegend(label.text)) return m;
              return Math.max(m, label.text.length);
            }, max),
          1,
        )
      : 1;
  const renderSingleLabel = (def: KeyDef) => {
    const active = activeLabelIdx >= 0 ? def.labels[activeLabelIdx] : null;
    const label = resolveSingleLabel(def);
    if (!label) return null;
    const isFallback = !active;
    const cls = [
      'vk-label',
      'vk-single-label',
      `vk-layer-${isFallback ? baseLayer.id : highlightLayerId}`,
    ];
    if (isFallback) cls.push('vk-single-fallback');
    else cls.push('vk-active');
    if (!label.glyph && isWordLegend(label.text ?? '')) cls.push('vk-word');
    return (
      <span className={cls.join(' ')}>
        {label.glyph ? (
          <GlyphSvg glyph={layout.glyphs[label.glyph]} />
        ) : isFallback || activeLabelIdx === baseIdx ? (
          inLetterCase(label.text ?? '', letterCase)
        ) : (
          label.text
        )}
      </span>
    );
  };

  // The shift-driven layer and the base layer form a case pair on keys where
  // they carry the same letter in two cases (the Spectrum's q/Q, the PMD 85's
  // Q/q). Such a key shows one centred letter whose case follows the shift
  // key - pressed or locked - as a phone keyboard's do, never both cases at
  // once.
  //
  // The base half is read through the latch, so a machine whose case lock and
  // shift both reach the other case (the BBC, the CPC) shows one letter rather
  // than two identical ones while they agree.
  const modifierLayerIdx = modifierLayer
    ? layout.layers.indexOf(modifierLayer)
    : -1;
  const baseLetter = (def: KeyDef): string | undefined => {
    const text = def.labels[baseIdx]?.text;
    return text === undefined ? undefined : inLetterCase(text, letterCase);
  };
  const casePairOf = (def: KeyDef): { off: string; on: string } | null => {
    if (modifierLayerIdx < 0) return null;
    const off = baseLetter(def);
    const on = def.labels[modifierLayerIdx]?.text;
    if (!off || !on || off.length !== 1 || on.length !== 1) return null;
    return off.toUpperCase() === on.toUpperCase() ? { off, on } : null;
  };
  const shiftEngaged = activeLayer.id === modifierLayer?.id;

  // The layered view's symbol hint: the key's page-1 SYM cell, small in the
  // top-right corner in the theme's own ink - a reminder of what the SYM mode
  // holds there, exactly as a phone keyboard prints its long-press hints.
  const symHintIdx = layout.layers.findIndex(
    (l) => l.modeOnly && l.id === 'symbols',
  );
  const renderSymHint = (def: KeyDef) => {
    const label = symHintIdx >= 0 ? def.labels[symHintIdx] : null;
    // Blank cells and the page toggle (editor: null) hint nothing.
    if (!label?.text || !label.editor || !('insert' in label.editor))
      return null;
    return <span className="vk-label vk-sym-hint">{label.text}</span>;
  };

  /** The single label a pinned modeOnly layer draws on a key it covers. */
  const renderExclusiveLabel = (def: KeyDef) => {
    const label = def.labels[activeLabelIdx];
    if (!label) return null;
    // The key's only legend, so it sits centred whatever corner the layer
    // uses when its legends share a keycap (the cursor overlays' 'br').
    const word =
      !label.glyph && isWordLegend(label.text ?? '') ? ' vk-word' : '';
    return (
      <span
        className={`vk-label vk-pos-center vk-layer-${highlightLayerId} vk-active${word}`}
      >
        {label.glyph ? (
          <GlyphSvg glyph={layout.glyphs[label.glyph]} />
        ) : (
          label.text
        )}
      </span>
    );
  };

  const renderKey = (def: KeyDef, inStrip = false) => {
    const modState = def.modifier
      ? engine.getModifierState(def.modifier)
      : 'off';
    const classes = ['vk-key'];
    if (pressed.has(def.id)) classes.push('vk-pressed');
    if (modState === 'held' || modState === 'sticky')
      classes.push('vk-mod-engaged');
    if (modState === 'locked') classes.push('vk-mod-locked');
    if (def.style) classes.push(`vk-style-${def.style}`);
    if (def.id === focusKeyId) classes.push('vk-focus');
    if (
      target.kind === 'editor' &&
      !def.modifier &&
      def.emits.length > 0 &&
      resolveEditorAction(layout, def, highlightLayerId) === null
    )
      classes.push('vk-noaction');
    return (
      <div
        key={def.id}
        data-keyid={def.id}
        className={classes.join(' ')}
        style={{
          // In the landscape left strip, function keys lay out in a 2-column
          // grid (one cell each); everywhere else they span their grid width.
          gridColumn: inStrip && landscape ? 'auto' : `span ${def.spanX}`,
        }}
        role="button"
        tabIndex={-1}
        aria-label={keyAriaLabel(def, layout, highlightLayerId)}
        aria-pressed={
          def.modifier ? modState !== 'off' : pressed.has(def.id) || undefined
        }
      >
        <span className="vk-keycap" aria-hidden="true">
          {keyDisplay === 'compact' && !inStrip
            ? renderSingleLabel(def)
            : highlightLayer?.modeOnly && def.labels[activeLabelIdx] != null
              ? // A pinned modeOnly layer owns the keys it labels outright: the
                // key shows that label alone (blank where the label is empty),
                // never its other legends underneath.
                renderExclusiveLabel(def)
              : (() => {
                  const pair = casePairOf(def);
                  return (
                    <>
                      {layout.layers.map((layer, layerIdx) => {
                        const label = def.labels[layerIdx];
                        if (!label) return null;
                        if (layer.modeOnly && layer.id !== highlightLayerId)
                          return null;
                        // A case pair renders as one letter on the base slot,
                        // in the case the shift key currently gives.
                        if (pair && layerIdx === modifierLayerIdx) return null;
                        // One secondary legend at a time: the rest of the
                        // machine's markings are reached by changing mode.
                        if (
                          layer !== baseLayer &&
                          layer.id !== visibleSecondaryId
                        )
                          return null;
                        const cls = [
                          'vk-label',
                          `vk-pos-${layer.position}`,
                          `vk-layer-${layer.id}`,
                        ];
                        if (layer.id === highlightLayerId)
                          cls.push('vk-active');
                        const text =
                          layerIdx === baseIdx
                            ? pair
                              ? shiftEngaged
                                ? pair.on
                                : pair.off
                              : inLetterCase(label.text ?? '', letterCase)
                            : label.text;
                        // A word takes one fixed size wherever it is printed;
                        // a character is sized from the keycap it sits on.
                        if (!label.glyph && isWordLegend(text ?? ''))
                          cls.push('vk-word');
                        return (
                          <span key={layer.id} className={cls.join(' ')}>
                            {label.glyph ? (
                              <GlyphSvg glyph={layout.glyphs[label.glyph]} />
                            ) : (
                              text
                            )}
                          </span>
                        );
                      })}
                      {renderSymHint(def)}
                    </>
                  );
                })()}
        </span>
      </div>
    );
  };

  const hasStrip = showModeTabs || showFnKeys;
  // Whether the strip has more function keys than the board is wide, which is
  // a fact about the layout rather than about the rendered box: the strip's
  // tracks are the key rows' own, so it holds exactly a row's worth of keys.
  const stripOverflows =
    showFnKeys &&
    functionKeys.reduce((n, k) => n + k.spanX, 0) > layout.gridColumns;

  return (
    <div
      ref={containerRef}
      className={`virtual-keyboard ${layout.theme}${enabled ? '' : ' vk-disabled'}${keyDisplay === 'compact' ? ' vk-single' : ''}${landscape ? ' vk-landscape' : ' vk-portrait'}${onPickKey ? ' vk-pickmode' : ''}`}
      style={
        {
          '--vk-max-len': maxSingleLen,
          // The strip sizes its keys off the key rows' grid, and a strip whose
          // keys run past the edge reserves the height of its scrollbar.
          '--vk-grid-cols': gridCols,
          ...(stripOverflows ? { '--vk-strip-bar': '6px' } : {}),
        } as React.CSSProperties
      }
      role="group"
      aria-label={`${layout.name} on-screen keyboard`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // A held key registers as a long-press on touch browsers (Chrome mobile),
      // which fire a contextmenu that steals the pointer and aborts the hold.
      // Suppress it so keys can be held (repeat, sticky modifiers) uninterrupted.
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => engine.pointerUp(KEYBOARD_POINTER_ID)}
    >
      {hasStrip && (
        <div className={`vk-strip${stripOverflows ? ' vk-fn-overflow' : ''}`}>
          {hasToggle && (
            <button
              className="vk-strip-toggle"
              aria-label={
                stripView === 'modes' ? 'Show function keys' : 'Show modes'
              }
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault(); // keep editor/canvas focus (R4)
                setStripView((v) => (v === 'modes' ? 'fn' : 'modes'));
              }}
            >
              {stripView === 'modes' ? 'ƒ' : '⌨'}
            </button>
          )}
          {showModeTabs && (
            <div
              className="vk-mode-bar"
              role="radiogroup"
              aria-label="Input mode"
            >
              {editorModes.map((m) => (
                <button
                  key={m.id}
                  className={`vk-legend-btn${m.id === mode?.id ? ' active' : ''}`}
                  role="radio"
                  aria-checked={m.id === mode?.id}
                  disabled={paletteUnavailable(m)}
                  title={
                    paletteUnavailable(m)
                      ? 'The graphics palette types into the editor - focus the editor to use it'
                      : undefined
                  }
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    e.preventDefault(); // keep editor focus (R4)
                    setModeId(m.id);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
          {showFnKeys && (
            <div className="vk-fn-row">
              {functionKeys.map((k) => renderKey(k, true))}
            </div>
          )}
        </div>
      )}
      {showPalette ? (
        <div
          ref={paletteRef}
          className="vk-palette"
          role="group"
          aria-label="Graphics characters"
        >
          {palette!.sections.map((section, sectionIdx) => (
            <div
              key={section.title ?? sectionIdx}
              className="vk-palette-section"
              role="group"
              aria-label={section.title}
            >
              {section.title && (
                <div className="vk-palette-title" aria-hidden="true">
                  {section.title}
                </div>
              )}
              {section.note && (
                <div className="vk-palette-note">{section.note}</div>
              )}
              <div className="vk-palette-grid">
                {section.entries.map((entry) => {
                  const idx = paletteEntries.indexOf(entry);
                  const classes = ['vk-graphic'];
                  if (entry.chip) classes.push('vk-graphic-control');
                  if (idx === focusIdx) classes.push('vk-focus');
                  return (
                    <div
                      key={entry.code}
                      data-graphic={idx}
                      className={classes.join(' ')}
                      role="button"
                      tabIndex={-1}
                      aria-label={graphicAriaLabel(entry)}
                    >
                      <span className="vk-graphic-key" aria-hidden="true">
                        {entry.key === undefined ? (
                          entry.code
                        ) : (
                          <>
                            {entry.modifier ? `${entry.modifier} ` : ''}
                            {entry.key}
                          </>
                        )}
                      </span>
                      <span className="vk-graphic-char" aria-hidden="true">
                        {entry.chip ? (
                          <ControlChipSvg chip={entry.chip} />
                        ) : (
                          entry.char
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vk-rows">
          {displayRows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="vk-row"
              style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
            >
              {row.map((k) => renderKey(k))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
