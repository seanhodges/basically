import type { ChatMessage } from '../ai/providers/types';
import type { AiProviderId } from '../ai/providers/types';
import {
  AI_PROVIDER_IDS,
  DEFAULT_PROVIDER_ID,
  getProvider,
} from '../ai/providers/registry';

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
  hasSeenWelcome: 'mbide.hasSeenWelcome',
} as const;

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
