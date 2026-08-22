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
import { isRepeatable, resolveEditorAction } from './editorActions';
import { pickableKeys } from './controllerConfig';
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
  /** Keycap legends: every legend ('authentic') or only the active mode's
   *  character, centered and larger ('compact'). */
  keyDisplay: 'authentic' | 'compact';
  /** When set, the keyboard acts as a key picker: a tap on a matrix-driving
   *  key reports its id instead of typing into the target. */
  onPickKey?: (keyId: string) => void;
}

/** Pointer id used for activation via the physical keyboard (a11y path). */
const KEYBOARD_POINTER_ID = -1;

/** Below this container width there isn't room for every legend at once. */
const COMPACT_MAX_WIDTH = 520;

/** Below this viewport height keys shrink too far for every legend (must
    match the landscape media query in VirtualKeyboard.css). */
const COMPACT_MAX_VIEWPORT_HEIGHT = 560;

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
 * The layer a non-base editor mode pins, or null when the mode's layer is the
 * base layer (there the engaged modifier drives the layer instead). A mode with
 * a `shiftedLayer` switches to it while SHIFT is engaged, so one mode can carry
 * two legend sets (e.g. the C64's C= / SHIFT graphics).
 */
function modePinnedLayerId(
  mode: EditorModeDef | null,
  baseLayerId: string,
  activeLayer: LayerDef,
): string | null {
  if (!mode || mode.layer === baseLayerId) return null;
  if (mode.shiftedLayer && activeLayer.activeWhen.includes('shift'))
    return mode.shiftedLayer;
  return mode.layer;
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
      onKeyPress: (key: KeyDef, activeLayer: LayerDef) => {
        const m = modeRef.current;
        // In the base (ABC) mode the engine's layer applies (shift works);
        // other modes pin the layer (with their optional shifted variant).
        const layerId =
          modePinnedLayerId(m, baseLayerRef.current.id, activeLayer) ??
          activeLayer.id;
        const action = resolveEditorAction(layout, key, layerId);
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

  // Compact mode: too narrow to render every legend without overlap, so
  // show the base layer plus one selectable secondary layer per key.
  const [compact, setCompact] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.innerWidth < 600 ||
        window.innerHeight < COMPACT_MAX_VIEWPORT_HEIGHT),
  );
  // Landscape: the keyboard centres and the top strip relocates into the left
  // gutter as a vertical bar. Driven by viewport orientation, not the keyboard's
  // own box (the overlay is always wider than tall, so the element can't tell).
  const [landscape, setLandscape] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setCompact(
        el.clientWidth < COMPACT_MAX_WIDTH ||
          window.innerHeight < COMPACT_MAX_VIEWPORT_HEIGHT,
      );
      setLandscape(window.innerWidth > window.innerHeight);
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
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

  const displayRows = layout.rows;
  const gridCols = layout.gridColumns;

  const secondaryLayers = useMemo(
    () => layout.layers.filter((l) => l !== baseLayer),
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
      if (key) {
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
    engine.setPinnedLayer(modePinnedLayerId(mode, baseLayer.id, activeLayer));
  }, [engine, mode, baseLayer.id, activeLayer]);
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
  // A non-base editor mode pins the highlighted layer (honouring its shifted
  // variant); otherwise an engaged modifier decides it.
  const modeLayerId = modePinnedLayerId(mode, baseLayer.id, activeLayer);
  const highlightLayerId = modeLayerId ?? activeLayer.id;
  // In compact mode the displayed secondary legends follow the same choice.
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
  const activeLabelIdx = layout.layers.findIndex(
    (l) => l.id === highlightLayerId,
  );
  // The legend shown on a key in single (Compact) display: the active mode's
  // label, falling back to the dimmed base label when the mode has none.
  const resolveSingleLabel = (def: KeyDef) => {
    const active = activeLabelIdx >= 0 ? def.labels[activeLabelIdx] : null;
    return active ?? def.labels[baseIdx] ?? null;
  };
  // Drive every key's font size from the longest legend visible in the active
  // mode so all keys render at one uniform size (short words don't grow back to
  // the cap while long words shrink). Wide keys (SHIFT/SPACE/NEW LINE) keep
  // their own fixed fonts, so they're excluded.
  const maxSingleLen =
    keyDisplay === 'compact'
      ? displayRows.reduce(
          (max, row) =>
            row.reduce((m, def) => {
              if (def.style === 'shift' || def.style === 'small-main') return m;
              const label = resolveSingleLabel(def);
              if (!label || label.glyph || !label.text) return m;
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
    return (
      <span className={cls.join(' ')}>
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
            : layout.layers.map((layer, layerIdx) => {
                const label = def.labels[layerIdx];
                if (!label) return null;
                if (
                  compact &&
                  layer !== baseLayer &&
                  layer.id !== visibleSecondaryId
                )
                  return null;
                const cls = [
                  'vk-label',
                  `vk-pos-${layer.position}`,
                  `vk-layer-${layer.id}`,
                ];
                if (layer.id === highlightLayerId) cls.push('vk-active');
                return (
                  <span key={layer.id} className={cls.join(' ')}>
                    {label.glyph ? (
                      <GlyphSvg glyph={layout.glyphs[label.glyph]} />
                    ) : (
                      label.text
                    )}
                  </span>
                );
              })}
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
      className={`virtual-keyboard ${layout.theme}${enabled ? '' : ' vk-disabled'}${compact ? ' vk-compact' : ''}${keyDisplay === 'compact' ? ' vk-single' : ''}${landscape ? ' vk-landscape' : ' vk-portrait'}${onPickKey ? ' vk-pickmode' : ''}`}
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
