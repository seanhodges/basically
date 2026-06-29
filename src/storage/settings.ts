import type { ChatMessage } from '../ai/providers/types';
import type { AiProviderId } from '../ai/providers/types';
import {
  AI_PROVIDER_IDS,
  DEFAULT_PROVIDER_ID,
  getProvider,
} from '../ai/providers/registry';
import type {
  ControllerOverrides,
  GamepadMode,
} from '../keyboard/controllerConfig';

/**
 * Whether the on-screen keyboard is docked under the emulator. Persisted so the
 * choice sticks. The game controller is a separate, independently-preserved
 * toggle (see getControllerEnabled) rather than a third overlay value, so the
 * keyboard and gamepad preferences no longer clobber one another.
 */
export type BottomOverlay = 'none' | 'keyboard';

/**
 * A conversation message as persisted. `incomplete` marks an assistant answer
 * that was still streaming when the page was closed/reloaded — it cannot be
 * resumed (the streaming API isn't reconnectable), so it is kept as truncated.
 */
export type PersistedMessage = ChatMessage & { incomplete?: boolean };

const KEYS = {
  // Per-provider API keys are owned by the provider registry
  // (`ProviderMeta.apiKeyStorageKey`), not listed here.
  aiProvider: 'mbide.aiProvider',
  autosaveDoc: 'mbide.autosave.doc',
  autosaveName: 'mbide.autosave.name',
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
  emulatorVolume: 'mbide.emulatorVolume',
  emulatorMuted: 'mbide.emulatorMuted',
  bottomOverlay: 'mbide.bottomOverlay',
  controllerEnabled: 'mbide.controllerEnabled',
  controllerBindings: 'mbide.controllerBindings',
  controllerDpadMode: 'mbide.controllerDpadMode',
  gamepadMode: 'mbide.gamepadMode',
  hasSeenWelcome: 'mbide.hasSeenWelcome',
} as const;

export const DEFAULT_EMULATOR_VOLUME = 0.7;

export const DEFAULT_LINE_INCREMENT = 10;
export const DEFAULT_SPLIT_RATIO = 0.5;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

const EMULATOR_SPEEDS = [1, 2, 8];

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

/** Persisted target-machine dialect id, or null when never chosen. */
export function getDialectId(): string | null {
  return localStorage.getItem(KEYS.dialectId);
}

export function setDialectId(id: string): void {
  localStorage.setItem(KEYS.dialectId, id);
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
 * Whether the on-screen keyboard was last docked under the emulator. Restored on
 * load. A legacy 'controller' value (from when the keyboard and gamepad shared
 * this slot) maps to 'none' here — the gamepad preference is migrated into
 * getControllerEnabled instead. Defaults to 'none'.
 */
export function getBottomOverlay(): BottomOverlay {
  const raw = localStorage.getItem(KEYS.bottomOverlay);
  return raw === 'keyboard' ? 'keyboard' : 'none';
}

export function setBottomOverlay(v: BottomOverlay): void {
  localStorage.setItem(KEYS.bottomOverlay, v);
}

/**
 * Whether the game-controller toggle is on. Preserved independently of the
 * keyboard so the gamepad choice survives keyboard show/hide and auto-show. A
 * never-set value migrates from the legacy combined overlay ('controller').
 */
export function getControllerEnabled(): boolean {
  const raw = localStorage.getItem(KEYS.controllerEnabled);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return localStorage.getItem(KEYS.bottomOverlay) === 'controller';
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

/** Per-dialect D-pad mode (4-way / 8-way), or null when never chosen. */
export function getControllerDpadMode(
  dialectId: string,
): '4-way' | '8-way' | null {
  const raw = localStorage.getItem(`${KEYS.controllerDpadMode}.${dialectId}`);
  return raw === '4-way' || raw === '8-way' ? raw : null;
}

export function setControllerDpadMode(
  dialectId: string,
  mode: '4-way' | '8-way',
): void {
  localStorage.setItem(`${KEYS.controllerDpadMode}.${dialectId}`, mode);
}

/**
 * Preferred virtual-gamepad input mode, applied across all machines. Defaults to
 * 'keymapped' — the most widely compatible mode, since not every machine has a
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
  const n = raw === null ? 1 : parseInt(raw, 10);
  return EMULATOR_SPEEDS.includes(n) ? n : 1;
}

export function setEmulatorSpeed(n: number): void {
  localStorage.setItem(KEYS.emulatorSpeed, String(n));
}

export function loadAutosave(): { name: string; text: string } | null {
  const text = localStorage.getItem(KEYS.autosaveDoc);
  if (text === null) return null;
  return {
    name: localStorage.getItem(KEYS.autosaveName) ?? 'untitled.bas',
    text,
  };
}

export function saveAutosave(name: string, text: string): void {
  try {
    localStorage.setItem(KEYS.autosaveDoc, text);
    localStorage.setItem(KEYS.autosaveName, name);
  } catch {
    // quota exceeded — autosave is best-effort
  }
}

/**
 * Persisted AI conversation for the active program. Restored on reload so the
 * thread (and any preserved partial answer) survives orientation changes and
 * panel toggles. Cleared when a different program is loaded.
 */
export function loadAiConversation(): PersistedMessage[] {
  const raw = localStorage.getItem(KEYS.aiConversation);
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
      localStorage.removeItem(KEYS.aiConversation);
    } else {
      localStorage.setItem(KEYS.aiConversation, JSON.stringify(messages));
    }
  } catch {
    // quota exceeded — persistence is best-effort
  }
}

export function clearAiConversation(): void {
  try {
    localStorage.removeItem(KEYS.aiConversation);
  } catch {
    // best-effort
  }
}
