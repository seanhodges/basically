import type { ChatMessage } from '../ai/providers/types';
import type { AiEffort, AiProviderId } from '../ai/providers/types';
import { AI_EFFORTS } from '../ai/providers/types';
import {
  AI_PROVIDER_IDS,
  DEFAULT_PROVIDER_ID,
  getProvider,
} from '../ai/providers/registry';
import type {
  ControllerOverrides,
  GamepadMode,
} from '../keyboard/controllerConfig';
import type { MemoryBlock, TapeFile } from '../dialects/types';
import {
  serializeBlocks,
  parseBlocks,
  parseListingBlockMeta,
  serializeTapeFiles,
  parseTapeFiles,
} from './projectFile';
import { bytesToBase64, base64ToBytes } from './vfs/base64';

/** Ordinal-keyed listing-block overrides (see `parseListingBlockMeta`). */
type ListingBlockMetaMap = Record<
  number,
  {
    name?: string;
    kind?: 'code' | 'data';
    comment?: string;
    asmSource?: string;
  }
>;

/**
 * A conversation message as persisted. `incomplete` marks an assistant answer
 * that was still streaming when the page was closed/reloaded - it cannot be
 * resumed (the streaming API isn't reconnectable), so it is kept as truncated.
 */
export type PersistedMessage = Omit<ChatMessage, 'image'> & {
  incomplete?: boolean;
  /**
   * The page went away mid-answer, as opposed to the user pressing Stop or the
   * provider hitting its output limit - which `incomplete` also covers. Only a
   * mid-stream write can produce it, so it says what happened rather than only
   * that something did. Absent on threads stored before it was recorded, which
   * reads correctly as "cut short, cause unknown".
   */
  interrupted?: boolean;
  /**
   * Fingerprint of the program the reply was written against, so a fragment
   * applied later can be flagged as possibly stale. Absent on threads stored
   * before it was recorded - an unknown base, which raises no warning.
   */
  baseFingerprint?: string;
  /**
   * A screen was shown to the assistant with this turn. The image itself is
   * deliberately absent - `Omit`ted from the type so it cannot be written by
   * accident: conversation storage is a few megabytes shared with the autosaved
   * program, and images belong in neither.
   */
  screenShown?: boolean;
};

/**
 * Name given to a document that hasn't been saved to disk yet. The `.txt`
 * extension is what Save writes by default (browsers can flag `.bas` as a
 * dangerous download); code checks against this constant to tell an untitled
 * draft from a deliberately-named file.
 */
export const UNTITLED_FILE_NAME = 'untitled.txt';

const KEYS = {
  // Per-provider values are not listed here: API keys are owned by the provider
  // registry (`ProviderMeta.apiKeyStorageKey`), and per-provider AI tuning is
  // keyed by provider id (see `tuningKey`).
  aiProvider: 'mbide.aiProvider',
  autosaveDoc: 'mbide.autosave.doc',
  autosaveName: 'mbide.autosave.name',
  autosaveBlocks: 'mbide.autosave.blocks',
  autosaveListingMeta: 'mbide.autosave.listingmeta',
  autosaveAutoStart: 'mbide.autosave.autostart',
  autosaveTapeFiles: 'mbide.autosave.tapefiles',
  autosaveBootDisc: 'mbide.autosave.bootdisc',
  aiConversation: 'mbide.autosave.ai',
  dialectId: 'mbide.dialectId',
  autoLineNumbering: 'mbide.autoLineNumbering',
  lineNumberIncrement: 'mbide.lineNumberIncrement',
  showLineNumberGutter: 'mbide.showLineNumberGutter',
  fullCodeCompletion: 'mbide.fullCodeCompletion',
  crtEffect: 'mbide.crtEffect',
  splitRatio: 'mbide.splitRatio',
  emulatorSpeed: 'mbide.emulatorSpeed',
  keyboardAutoShow: 'mbide.keyboardAutoShow',
  keyboardSound: 'mbide.keyboardSound',
  keyboardHaptics: 'mbide.keyboardHaptics',
  keyboardKeyDisplay: 'mbide.keyboardKeyDisplay',
  emulatorAudio: 'mbide.emulatorAudio',
  runGateLint: 'mbide.runGateLint',
  emulatorVolume: 'mbide.emulatorVolume',
  emulatorMuted: 'mbide.emulatorMuted',
  keyboardEnabled: 'mbide.keyboardEnabled',
  controllerEnabled: 'mbide.controllerEnabled',
  controllerBindings: 'mbide.controllerBindings',
  controllerDpadMode: 'mbide.controllerDpadMode',
  controllerFireButtons: 'mbide.controllerFireButtons',
  gamepadMode: 'mbide.gamepadMode',
  hasSeenWelcome: 'mbide.hasSeenWelcome',
  lastShare: 'mbide.lastShare',
} as const;

/**
 * Read a per-tab value with a shared localStorage backup: the tab's own
 * sessionStorage slot wins; a backup hit is adopted into the session slot so
 * the tab's identity is pinned at first read (persistAutosave is
 * signature-gated, so without adoption a never-edited tab would keep re-reading
 * the shared backup on every reload, which another tab may have overwritten).
 */
function readSessionFirst(key: string): string | null {
  const own = sessionStorage.getItem(key);
  if (own !== null) return own;
  const backup = localStorage.getItem(key);
  if (backup !== null) {
    try {
      sessionStorage.setItem(key, backup);
    } catch {
      // quota exceeded - adoption is best-effort
    }
  }
  return backup;
}

/**
 * Write a per-tab value: sessionStorage is authoritative, localStorage keeps a
 * best-effort backup so brand-new tabs and browser restarts (which start with
 * an empty sessionStorage) seed from the most recently edited program. The
 * backup is last-writer-wins across tabs; live tabs only ever read their own
 * session slot.
 */
function writeThrough(key: string, value: string): void {
  sessionStorage.setItem(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota exceeded - the mirror is best-effort; the session write stands
  }
}

function removeBoth(key: string): void {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

export const DEFAULT_EMULATOR_VOLUME = 0.7;

export const DEFAULT_LINE_INCREMENT = 10;
export const DEFAULT_SPLIT_RATIO = 0.5;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

const EMULATOR_SPEEDS = [0.25, 0.5, 0.75, 1, 2, 4, 8];

/** The AI backend the user has selected (defaults to Anthropic). */
export function getAiProvider(): AiProviderId {
  const raw = localStorage.getItem(KEYS.aiProvider);
  return raw !== null && (AI_PROVIDER_IDS as string[]).includes(raw)
    ? (raw as AiProviderId)
    : DEFAULT_PROVIDER_ID;
}

export function setAiProvider(id: AiProviderId): void {
  localStorage.setItem(KEYS.aiProvider, id);
}

/**
 * API key for a specific backend. Each provider persists under its own
 * localStorage key, so the user can store keys for all three and switch
 * between them without re-entering anything.
 */
export function getProviderApiKey(id: AiProviderId): string {
  return localStorage.getItem(getProvider(id).apiKeyStorageKey) ?? '';
}

export function setProviderApiKey(id: AiProviderId, key: string): void {
  const storageKey = getProvider(id).apiKeyStorageKey;
  if (key === '') localStorage.removeItem(storageKey);
  else localStorage.setItem(storageKey, key);
}

/**
 * How long an answer may be, and how hard the model thinks before writing it.
 *
 * One default for every machine: how many tokens a model may emit is a fact about
 * the model and about what the user wants, not about which microcomputer is
 * selected. These used to live on each dialect's AI profile, which meant thirteen
 * copies of one number that no dialect had a reason to differ on.
 *
 * The budget must clear the largest listing any dialect asks for (the ZX Spectrum
 * prompt's "comfortably under 20KB of source", roughly 6-7k tokens) with room left
 * for the model's own reasoning, which is spent from the same budget. It is also
 * exactly the tightest backend's ceiling, so no provider needs a smaller default.
 *
 * The effort is stated rather than left unset because unset means the model's
 * highest setting - an unbounded think against a shared budget, which is what left
 * long listings unfinished.
 */
export const DEFAULT_AI_MAX_TOKENS = 16384;
export const DEFAULT_AI_EFFORT: AiEffort = 'medium';

/**
 * Per-provider tuning, kept beside that provider's key.
 *
 * Keyed by provider id rather than by a declared name on `ProviderMeta` the way
 * `apiKeyStorageKey` is: those key names predate any scheme and cannot be derived,
 * whereas these are new and a fourth backend should cost nothing to add.
 *
 * The two backends differ in what they accept and in what "effort" even means, and
 * the user keeps a key for each - so tuning one and trying another must not lose
 * what was set for the first.
 */
function tuningKey(id: AiProviderId): string {
  return `mbide.aiTuning.${id}`;
}

function readTuning(id: AiProviderId): {
  maxTokens?: number;
  effort?: AiEffort;
} {
  const raw = localStorage.getItem(tuningKey(id));
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    // A hand-edited or half-written entry is not worth failing a request over.
    return {};
  }
}

function writeTuning(
  id: AiProviderId,
  patch: { maxTokens?: number | null; effort?: AiEffort | null },
): void {
  const next = { ...readTuning(id) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete next[k as keyof typeof next];
    else Object.assign(next, { [k]: v });
  }
  if (Object.keys(next).length === 0) localStorage.removeItem(tuningKey(id));
  else localStorage.setItem(tuningKey(id), JSON.stringify(next));
}

/** This provider's output budget, or the shared default when it has no override. */
export function getProviderMaxTokens(id: AiProviderId): number {
  const stored = readTuning(id).maxTokens;
  return typeof stored === 'number' && Number.isFinite(stored) && stored > 0
    ? stored
    : DEFAULT_AI_MAX_TOKENS;
}

/** Pass null to clear the override and go back to the shared default. */
export function setProviderMaxTokens(
  id: AiProviderId,
  maxTokens: number | null,
): void {
  writeTuning(id, { maxTokens });
}

/** This provider's effort, or the shared default when it has no override. */
export function getProviderEffort(id: AiProviderId): AiEffort {
  const stored = readTuning(id).effort;
  return stored !== undefined && AI_EFFORTS.includes(stored)
    ? stored
    : DEFAULT_AI_EFFORT;
}

/** Pass null to clear the override and go back to the shared default. */
export function setProviderEffort(
  id: AiProviderId,
  effort: AiEffort | null,
): void {
  writeTuning(id, { effort });
}

/** Whether this provider has any tuning of its own, for a "back to default" control. */
export function hasProviderTuning(id: AiProviderId): {
  maxTokens: boolean;
  effort: boolean;
} {
  const t = readTuning(id);
  return {
    maxTokens: t.maxTokens !== undefined,
    effort: t.effort !== undefined,
  };
}

/**
 * The active target-machine dialect id, or null when never chosen. Per-tab
 * (sessionStorage) so tabs can run different machines; localStorage keeps the
 * "last used machine" that seeds brand-new tabs.
 */
export function getDialectId(): string | null {
  return readSessionFirst(KEYS.dialectId);
}

export function setDialectId(id: string): void {
  writeThrough(KEYS.dialectId, id);
}

export function getAutoLineNumbering(): boolean {
  return localStorage.getItem(KEYS.autoLineNumbering) !== 'false'; // default on
}

export function setAutoLineNumbering(on: boolean): void {
  localStorage.setItem(KEYS.autoLineNumbering, on ? 'true' : 'false');
}

export function getLineNumberIncrement(): number {
  const raw = localStorage.getItem(KEYS.lineNumberIncrement);
  const n = raw === null ? DEFAULT_LINE_INCREMENT : parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_LINE_INCREMENT;
}

export function setLineNumberIncrement(n: number): void {
  localStorage.setItem(KEYS.lineNumberIncrement, String(n));
}

export function getShowLineNumberGutter(): boolean {
  return localStorage.getItem(KEYS.showLineNumberGutter) === 'true'; // default off
}

export function setShowLineNumberGutter(on: boolean): void {
  localStorage.setItem(KEYS.showLineNumberGutter, on ? 'true' : 'false');
}

export function getFullCodeCompletion(): boolean {
  return localStorage.getItem(KEYS.fullCodeCompletion) !== 'false'; // default on
}

export function setFullCodeCompletion(on: boolean): void {
  localStorage.setItem(KEYS.fullCodeCompletion, on ? 'true' : 'false');
}

export function getCrtEffect(): boolean {
  return localStorage.getItem(KEYS.crtEffect) !== 'false'; // default on
}

export function setCrtEffect(on: boolean): void {
  localStorage.setItem(KEYS.crtEffect, on ? 'true' : 'false');
}

/**
 * Whether the user has seen (and dismissed) the first-launch welcome modal.
 * Defaults to false so the modal shows once on a fresh browser.
 */
export function getHasSeenWelcome(): boolean {
  return localStorage.getItem(KEYS.hasSeenWelcome) === 'true';
}

export function setHasSeenWelcome(seen: boolean): void {
  localStorage.setItem(KEYS.hasSeenWelcome, seen ? 'true' : 'false');
}

/**
 * Whether the on-screen keyboard pops up automatically when the editor or
 * preview gains focus. null = never set; the store falls back to a touch-device
 * default.
 */
export function getKeyboardAutoShow(): boolean | null {
  const raw = localStorage.getItem(KEYS.keyboardAutoShow);
  return raw === null ? null : raw === 'true';
}

export function setKeyboardAutoShow(on: boolean): void {
  localStorage.setItem(KEYS.keyboardAutoShow, on ? 'true' : 'false');
}

export function getKeyboardSound(): boolean {
  return localStorage.getItem(KEYS.keyboardSound) === 'true'; // default off
}

export function setKeyboardSound(on: boolean): void {
  localStorage.setItem(KEYS.keyboardSound, on ? 'true' : 'false');
}

export function getKeyboardHaptics(): boolean {
  return localStorage.getItem(KEYS.keyboardHaptics) !== 'false'; // default on
}

export function setKeyboardHaptics(on: boolean): void {
  localStorage.setItem(KEYS.keyboardHaptics, on ? 'true' : 'false');
}

export function getKeyboardKeyDisplay(): 'authentic' | 'compact' {
  return localStorage.getItem(KEYS.keyboardKeyDisplay) === 'compact'
    ? 'compact'
    : 'authentic'; // default authentic
}

export function setKeyboardKeyDisplay(v: 'authentic' | 'compact'): void {
  localStorage.setItem(KEYS.keyboardKeyDisplay, v);
}

/**
 * Whether the on-screen keyboard was last enabled. Restored on load. Defaults to
 * false (hidden).
 */
export function getKeyboardEnabled(): boolean {
  return localStorage.getItem(KEYS.keyboardEnabled) === 'true';
}

export function setKeyboardEnabled(v: boolean): void {
  localStorage.setItem(KEYS.keyboardEnabled, v ? 'true' : 'false');
}

/**
 * Whether the game-controller toggle is on. Preserved independently of the
 * keyboard so the gamepad choice survives keyboard show/hide and auto-show.
 * Defaults to false.
 */
export function getControllerEnabled(): boolean {
  return localStorage.getItem(KEYS.controllerEnabled) === 'true';
}

export function setControllerEnabled(v: boolean): void {
  localStorage.setItem(KEYS.controllerEnabled, v ? 'true' : 'false');
}

/**
 * Per-dialect game-controller remaps (role → KeyDef id) over the layout
 * defaults. Stored under a dialect-scoped key so each machine keeps its own
 * mapping. Returns {} when never set or unparseable.
 */
export function getControllerBindings(dialectId: string): ControllerOverrides {
  const raw = localStorage.getItem(`${KEYS.controllerBindings}.${dialectId}`);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as ControllerOverrides)
      : {};
  } catch {
    return {};
  }
}

export function setControllerBindings(
  dialectId: string,
  bindings: ControllerOverrides,
): void {
  const key = `${KEYS.controllerBindings}.${dialectId}`;
  if (Object.keys(bindings).length === 0) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(bindings));
}

/** Reset a dialect's controller remaps back to the layout defaults. */
export function resetControllerBindings(dialectId: string): void {
  localStorage.removeItem(`${KEYS.controllerBindings}.${dialectId}`);
}

/**
 * Global virtual-gamepad D-pad mode (4-way / 8-way), applied across all
 * machines. Returns null when never chosen, so the store can fall back to the
 * 8-way default.
 */
export function getControllerDpadMode(): '4-way' | '8-way' | null {
  const raw = localStorage.getItem(KEYS.controllerDpadMode);
  return raw === '4-way' || raw === '8-way' ? raw : null;
}

export function setControllerDpadMode(mode: '4-way' | '8-way'): void {
  localStorage.setItem(KEYS.controllerDpadMode, mode);
}

/**
 * Global virtual-gamepad fire-button count (1 / 2), applied across all machines.
 * Returns null when never chosen, so the store can fall back to the 2-button
 * default. On a machine whose hardware joystick has a single fire line, a
 * 2-button layout still wires only the primary button (see rolesToJoystick).
 */
export function getControllerFireButtons(): 1 | 2 | null {
  const raw = localStorage.getItem(KEYS.controllerFireButtons);
  return raw === '1' ? 1 : raw === '2' ? 2 : null;
}

export function setControllerFireButtons(n: 1 | 2): void {
  localStorage.setItem(KEYS.controllerFireButtons, String(n));
}

/**
 * Preferred virtual-gamepad input mode, applied across all machines. Defaults to
 * 'keymapped' - the most widely compatible mode, since not every machine has a
 * joystick port (e.g. the ZX80). Users can switch to a hardware joystick mode
 * ('native'/'kempston'), which falls back to 'keymapped' at the point of use on
 * machines that can't service it.
 */
export function getGamepadMode(): GamepadMode {
  const raw = localStorage.getItem(KEYS.gamepadMode);
  if (raw === 'native') return 'native';
  if (raw === 'kempston') return 'kempston';
  return 'keymapped';
}

export function setGamepadMode(mode: GamepadMode): void {
  localStorage.setItem(KEYS.gamepadMode, mode);
}

/**
 * Whether the Run gate counts the full editor lint set (tokenizer errors plus
 * the ROM-accurate name checks). When off, only tokenizer errors block a run;
 * lint findings still squiggle in the editor. Defaults on.
 */
export function getRunGateLint(): boolean {
  return localStorage.getItem(KEYS.runGateLint) !== 'false'; // default on
}

export function setRunGateLint(on: boolean): void {
  localStorage.setItem(KEYS.runGateLint, on ? 'true' : 'false');
}

/** Master enable for run-time emulator audio. Defaults on. */
export function getEmulatorAudio(): boolean {
  return localStorage.getItem(KEYS.emulatorAudio) !== 'false'; // default on
}

export function setEmulatorAudio(on: boolean): void {
  localStorage.setItem(KEYS.emulatorAudio, on ? 'true' : 'false');
}

/** Emulator output volume, 0..1. Defaults to {@link DEFAULT_EMULATOR_VOLUME}. */
export function getEmulatorVolume(): number {
  const raw = localStorage.getItem(KEYS.emulatorVolume);
  const n = raw === null ? DEFAULT_EMULATOR_VOLUME : parseFloat(raw);
  if (!Number.isFinite(n)) return DEFAULT_EMULATOR_VOLUME;
  return Math.min(1, Math.max(0, n));
}

export function setEmulatorVolume(n: number): void {
  localStorage.setItem(KEYS.emulatorVolume, String(n));
}

/** Transient mute toggle (separate from the master enable). Defaults off. */
export function getEmulatorMuted(): boolean {
  return localStorage.getItem(KEYS.emulatorMuted) === 'true'; // default off
}

export function setEmulatorMuted(on: boolean): void {
  localStorage.setItem(KEYS.emulatorMuted, on ? 'true' : 'false');
}

export function getSplitRatio(): number {
  const raw = localStorage.getItem(KEYS.splitRatio);
  const n = raw === null ? DEFAULT_SPLIT_RATIO : parseFloat(raw);
  if (!Number.isFinite(n)) return DEFAULT_SPLIT_RATIO;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, n));
}

export function setSplitRatio(n: number): void {
  localStorage.setItem(KEYS.splitRatio, String(n));
}

export function getEmulatorSpeed(): number {
  const raw = localStorage.getItem(KEYS.emulatorSpeed);
  const n = raw === null ? 1 : parseFloat(raw);
  return EMULATOR_SPEEDS.includes(n) ? n : 1;
}

export function setEmulatorSpeed(n: number): void {
  localStorage.setItem(KEYS.emulatorSpeed, String(n));
}

/**
 * The autosaved memory blocks, or `[]` when none are stored or the stored
 * value is corrupt/unparseable (defensive: a broken autosave entry must not
 * crash boot, it just loses its blocks).
 */
function loadAutosaveBlocks(): MemoryBlock[] {
  const raw = readSessionFirst(KEYS.autosaveBlocks);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parseBlocks(parsed) : [];
  } catch {
    return [];
  }
}

/**
 * The autosaved listing-block metadata, or `{}` when none is stored or the
 * stored value is corrupt/unparseable (defensive, like
 * {@link loadAutosaveBlocks}).
 */
function loadAutosaveListingMeta(): ListingBlockMetaMap {
  const raw = readSessionFirst(KEYS.autosaveListingMeta);
  if (raw === null) return {};
  try {
    return parseListingBlockMeta(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * The autosaved auto-start line, or `null` when none is stored or the stored
 * value is not a finite integer (defensive, like {@link loadAutosaveBlocks}).
 */
function loadAutosaveAutoStart(): number | null {
  const raw = readSessionFirst(KEYS.autosaveAutoStart);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

/**
 * The autosaved preserved tape files, or `[]` when none are stored or the
 * stored value is corrupt/unparseable (defensive, like
 * {@link loadAutosaveBlocks}).
 */
function loadAutosaveTapeFiles(): TapeFile[] {
  const raw = readSessionFirst(KEYS.autosaveTapeFiles);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parseTapeFiles(parsed) : [];
  } catch {
    return [];
  }
}

/**
 * The autosaved verbatim boot-disc image, or `null` when none is stored or the
 * stored base64 is corrupt/unparseable (defensive, like
 * {@link loadAutosaveBlocks}).
 */
function loadAutosaveBootDisc(): Uint8Array | null {
  const raw = readSessionFirst(KEYS.autosaveBootDisc);
  if (raw === null) return null;
  try {
    return base64ToBytes(raw);
  } catch {
    return null;
  }
}

export function loadAutosave(): {
  name: string;
  text: string;
  blocks: MemoryBlock[];
  listingBlockMeta: ListingBlockMetaMap;
  autoStart: number | null;
  tapeFiles: TapeFile[];
  bootDisc: Uint8Array | null;
} | null {
  // Reading the doc first adopts the pair's storage into the session slot, so
  // the name/blocks reads that follow resolve from the same storage.
  const text = readSessionFirst(KEYS.autosaveDoc);
  if (text === null) return null;
  return {
    name: readSessionFirst(KEYS.autosaveName) ?? UNTITLED_FILE_NAME,
    text,
    blocks: loadAutosaveBlocks(),
    listingBlockMeta: loadAutosaveListingMeta(),
    autoStart: loadAutosaveAutoStart(),
    tapeFiles: loadAutosaveTapeFiles(),
    bootDisc: loadAutosaveBootDisc(),
  };
}

export function saveAutosave(
  name: string,
  text: string,
  blocks: readonly MemoryBlock[] = [],
  listingBlockMeta: ListingBlockMetaMap = {},
  autoStart: number | null = null,
  tapeFiles: readonly TapeFile[] = [],
  bootDisc: Uint8Array | null = null,
): void {
  try {
    writeThrough(KEYS.autosaveDoc, text);
    writeThrough(KEYS.autosaveName, name);
    if (blocks.length === 0) {
      removeBoth(KEYS.autosaveBlocks);
    } else {
      writeThrough(
        KEYS.autosaveBlocks,
        JSON.stringify(serializeBlocks(blocks)),
      );
    }
    if (Object.keys(listingBlockMeta).length === 0) {
      removeBoth(KEYS.autosaveListingMeta);
    } else {
      writeThrough(KEYS.autosaveListingMeta, JSON.stringify(listingBlockMeta));
    }
    if (autoStart === null) {
      removeBoth(KEYS.autosaveAutoStart);
    } else {
      writeThrough(KEYS.autosaveAutoStart, String(autoStart));
    }
    if (tapeFiles.length === 0) {
      removeBoth(KEYS.autosaveTapeFiles);
    } else {
      writeThrough(
        KEYS.autosaveTapeFiles,
        JSON.stringify(serializeTapeFiles(tapeFiles)),
      );
    }
    if (!bootDisc || bootDisc.length === 0) {
      removeBoth(KEYS.autosaveBootDisc);
    } else {
      writeThrough(KEYS.autosaveBootDisc, bytesToBase64(bootDisc));
    }
  } catch {
    // quota exceeded - autosave is best-effort
  }
}

/**
 * Empty the autosave slot. Used when the editor returns to a state that should
 * not be preserved across reloads - a pristine sample, a New/empty document, or
 * a pristine dialect switch - so boot falls back to the starter instead of
 * restoring stale content. Clears the per-tab slot *and* the shared
 * localStorage backup: clearing work is a deliberate return to pristine and
 * must survive a browser restart. The backup is last-writer-wins; another live
 * tab's session slot is unaffected (though it won't re-mirror until its
 * content next changes). Also clears any autosaved memory blocks and preserved
 * tape files.
 */
export function clearAutosave(): void {
  removeBoth(KEYS.autosaveDoc);
  removeBoth(KEYS.autosaveName);
  removeBoth(KEYS.autosaveBlocks);
  removeBoth(KEYS.autosaveListingMeta);
  removeBoth(KEYS.autosaveAutoStart);
  removeBoth(KEYS.autosaveTapeFiles);
  removeBoth(KEYS.autosaveBootDisc);
}

/**
 * Persisted AI conversation for the active program. Restored on reload so the
 * thread (and any preserved partial answer) survives orientation changes and
 * panel toggles. Cleared when a different program is loaded.
 */
export function loadAiConversation(): PersistedMessage[] {
  const raw = readSessionFirst(KEYS.aiConversation);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveAiConversation(messages: PersistedMessage[]): void {
  try {
    if (messages.length === 0) {
      removeBoth(KEYS.aiConversation);
    } else {
      writeThrough(KEYS.aiConversation, JSON.stringify(messages));
    }
  } catch {
    // quota exceeded - persistence is best-effort
  }
}

export function clearAiConversation(): void {
  try {
    removeBoth(KEYS.aiConversation);
  } catch {
    // best-effort
  }
}

/** A share link minted for an exact (source, dialect) pair, for dedupe. */
export interface LastShare {
  source: string;
  dialectId: string;
  url: string;
}

/**
 * The most recently minted share link, so "Publish to Web" can reuse it
 * instead of creating a new one when the source and target dialect are
 * unchanged since it was minted. Per-tab (sessionStorage) by design: a link
 * minted in another tab must not dedupe this tab's publish. Entries written to
 * localStorage by older versions are intentionally orphaned.
 */
export function getLastShare(): LastShare | null {
  const raw = sessionStorage.getItem(KEYS.lastShare);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as LastShare).source === 'string' &&
      typeof (parsed as LastShare).dialectId === 'string' &&
      typeof (parsed as LastShare).url === 'string'
    ) {
      return parsed as LastShare;
    }
    return null;
  } catch {
    return null;
  }
}

export function setLastShare(entry: LastShare): void {
  try {
    sessionStorage.setItem(KEYS.lastShare, JSON.stringify(entry));
  } catch {
    // quota exceeded - dedupe is best-effort
  }
}
