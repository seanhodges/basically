import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
  loadAutosave,
  saveAutosave,
  clearAutosave,
  getAiProvider,
  setAiProvider,
  getProviderApiKey,
  setProviderApiKey,
  getDialectId,
  setDialectId,
  getLastShare,
  setLastShare,
  getHasLaunched,
  setHasLaunched,
  type PersistedMessage,
} from './settings';
import type { MemoryBlock } from '../dialects/types';

const KEY = 'mbide.autosave.ai';

/** Minimal in-memory Storage for the node test environment. */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

/** Install independent localStorage + sessionStorage stand-ins. */
function installStorages() {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
}

describe('autosave persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  it('round-trips a document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 PRINT "HI"',
      blocks: [],
      autoStart: null,
    });
  });

  it('returns null when nothing is stored', () => {
    expect(loadAutosave()).toBeNull();
  });

  it('clearAutosave empties the slot', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    clearAutosave();
    expect(loadAutosave()).toBeNull();
  });

  it('writes through to both storages (session authoritative, local backup)', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    expect(sessionStorage.getItem('mbide.autosave.doc')).toBe('10 PRINT "HI"');
    expect(sessionStorage.getItem('mbide.autosave.name')).toBe('game.bas');
    expect(localStorage.getItem('mbide.autosave.doc')).toBe('10 PRINT "HI"');
    expect(localStorage.getItem('mbide.autosave.name')).toBe('game.bas');
  });

  it("prefers this tab's session slot over the shared backup", () => {
    sessionStorage.setItem('mbide.autosave.doc', '10 REM MINE');
    sessionStorage.setItem('mbide.autosave.name', 'mine.bas');
    localStorage.setItem('mbide.autosave.doc', '10 REM OTHER TAB');
    localStorage.setItem('mbide.autosave.name', 'other.bas');
    expect(loadAutosave()).toEqual({
      name: 'mine.bas',
      text: '10 REM MINE',
      blocks: [],
      autoStart: null,
    });
  });

  it('falls back to the localStorage backup and adopts it into the session', () => {
    localStorage.setItem('mbide.autosave.doc', '10 REM BACKUP');
    localStorage.setItem('mbide.autosave.name', 'backup.bas');
    expect(loadAutosave()).toEqual({
      name: 'backup.bas',
      text: '10 REM BACKUP',
      blocks: [],
      autoStart: null,
    });
    // Adopted: the tab's identity is pinned even if the backup changes later.
    expect(sessionStorage.getItem('mbide.autosave.doc')).toBe('10 REM BACKUP');
    expect(sessionStorage.getItem('mbide.autosave.name')).toBe('backup.bas');
  });

  it('clearAutosave empties both storages', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    clearAutosave();
    expect(sessionStorage.getItem('mbide.autosave.doc')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.doc')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.name')).toBeNull();
  });
});

describe('autosave block persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  const BLOCK: MemoryBlock = {
    id: 'blk-1',
    name: 'SPRITES',
    address: 0x8000,
    bytes: Uint8Array.from([1, 2, 3, 255, 0]),
    kind: 'data',
    comment: 'Player sprites',
  };

  it('round-trips blocks alongside the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 PRINT "HI"',
      blocks: [BLOCK],
      autoStart: null,
    });
  });

  it('defaults to no blocks when the third argument is omitted', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    expect(loadAutosave()?.blocks).toEqual([]);
  });

  it('writes blocks through to both storages as base64 JSON', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    const raw = sessionStorage.getItem('mbide.autosave.blocks');
    expect(raw).not.toBeNull();
    expect(raw).toBe(localStorage.getItem('mbide.autosave.blocks'));
    const parsed = JSON.parse(raw!);
    expect(parsed[0].bytes).not.toEqual([1, 2, 3, 255, 0]); // base64 string, not raw array
    expect(typeof parsed[0].bytes).toBe('string');
  });

  it('removes the blocks key when saving an empty block list', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    saveAutosave('game.bas', '10 PRINT "HI"', []);
    expect(sessionStorage.getItem('mbide.autosave.blocks')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.blocks')).toBeNull();
    expect(loadAutosave()?.blocks).toEqual([]);
  });

  it('clearAutosave clears the blocks key too', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    clearAutosave();
    expect(sessionStorage.getItem('mbide.autosave.blocks')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.blocks')).toBeNull();
  });

  it('defensively parses corrupt block JSON as no blocks, without losing the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    sessionStorage.setItem('mbide.autosave.blocks', '{not json');
    localStorage.setItem('mbide.autosave.blocks', '{not json');
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 PRINT "HI"',
      blocks: [],
      autoStart: null,
    });
  });

  it('defensively parses a non-array blocks value as no blocks', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    sessionStorage.setItem(
      'mbide.autosave.blocks',
      JSON.stringify({ oops: true }),
    );
    expect(loadAutosave()?.blocks).toEqual([]);
  });

  it('defensively parses a structurally invalid block entry as no blocks', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    sessionStorage.setItem(
      'mbide.autosave.blocks',
      JSON.stringify([{ id: 'x', name: 'B' }]), // missing address/bytes/kind
    );
    expect(loadAutosave()?.blocks).toEqual([]);
  });
});

describe('dialect id persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  it('returns null when never chosen', () => {
    expect(getDialectId()).toBeNull();
  });

  it('writes through to both storages', () => {
    setDialectId('bbc');
    expect(sessionStorage.getItem('mbide.dialectId')).toBe('bbc');
    expect(localStorage.getItem('mbide.dialectId')).toBe('bbc');
    expect(getDialectId()).toBe('bbc');
  });

  it("prefers this tab's machine over another tab's later choice", () => {
    sessionStorage.setItem('mbide.dialectId', 'zx81');
    localStorage.setItem('mbide.dialectId', 'c64');
    expect(getDialectId()).toBe('zx81');
  });

  it('seeds a new tab from the last used machine and adopts it', () => {
    localStorage.setItem('mbide.dialectId', 'c64');
    expect(getDialectId()).toBe('c64');
    expect(sessionStorage.getItem('mbide.dialectId')).toBe('c64');
  });
});

describe('AI conversation persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  it('round-trips messages', () => {
    const messages: PersistedMessage[] = [
      { role: 'user', content: 'write breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ];
    saveAiConversation(messages);
    expect(loadAiConversation()).toEqual(messages);
  });

  it('preserves the incomplete marker on a truncated answer', () => {
    const messages: PersistedMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'partial…', incomplete: true },
    ];
    saveAiConversation(messages);
    expect(loadAiConversation()).toEqual(messages);
  });

  it('returns [] when nothing is stored', () => {
    expect(loadAiConversation()).toEqual([]);
  });

  it('removes the key from both storages when saving an empty array', () => {
    saveAiConversation([{ role: 'user', content: 'x' }]);
    saveAiConversation([]);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadAiConversation()).toEqual([]);
  });

  it('clearAiConversation removes the stored thread from both storages', () => {
    saveAiConversation([{ role: 'user', content: 'x' }]);
    clearAiConversation();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadAiConversation()).toEqual([]);
  });

  it('writes through to both storages', () => {
    saveAiConversation([{ role: 'user', content: 'x' }]);
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBe(sessionStorage.getItem(KEY));
  });

  it("prefers this tab's thread over the shared backup", () => {
    saveAiConversation([{ role: 'user', content: 'mine' }]);
    localStorage.setItem(
      KEY,
      JSON.stringify([{ role: 'user', content: 'other tab' }]),
    );
    expect(loadAiConversation()).toEqual([{ role: 'user', content: 'mine' }]);
  });

  it('seeds a new tab from the backup thread', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ role: 'user', content: 'restored' }]),
    );
    expect(loadAiConversation()).toEqual([
      { role: 'user', content: 'restored' },
    ]);
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('returns [] for corrupt JSON', () => {
    sessionStorage.setItem(KEY, '{not json');
    expect(loadAiConversation()).toEqual([]);
  });

  it('returns [] for corrupt JSON in the backup', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadAiConversation()).toEqual([]);
  });

  it('returns [] for non-array JSON', () => {
    sessionStorage.setItem(KEY, '{"role":"user"}');
    expect(loadAiConversation()).toEqual([]);
  });
});

describe('AI provider settings', () => {
  beforeEach(() => {
    installStorages();
  });

  it('defaults to anthropic and round-trips the selected provider', () => {
    expect(getAiProvider()).toBe('anthropic');
    setAiProvider('gemini');
    expect(getAiProvider()).toBe('gemini');
  });

  it('falls back to anthropic for an unknown stored provider', () => {
    localStorage.setItem('mbide.aiProvider', 'bogus');
    expect(getAiProvider()).toBe('anthropic');
  });

  it('persists each provider key independently', () => {
    setProviderApiKey('anthropic', 'sk-ant-1');
    setProviderApiKey('openai', 'sk-oai-2');
    setProviderApiKey('gemini', 'AIza-3');

    expect(getProviderApiKey('anthropic')).toBe('sk-ant-1');
    expect(getProviderApiKey('openai')).toBe('sk-oai-2');
    expect(getProviderApiKey('gemini')).toBe('AIza-3');
  });

  it('reuses the legacy anthropic key location', () => {
    setProviderApiKey('anthropic', 'sk-ant-legacy');
    expect(localStorage.getItem('mbide.anthropicApiKey')).toBe('sk-ant-legacy');
  });

  it('clearing a key removes it without touching others', () => {
    setProviderApiKey('openai', 'sk-oai');
    setProviderApiKey('gemini', 'AIza');
    setProviderApiKey('openai', '');
    expect(getProviderApiKey('openai')).toBe('');
    expect(getProviderApiKey('gemini')).toBe('AIza');
  });
});

describe('has-launched flag', () => {
  beforeEach(() => {
    installStorages();
  });

  it('defaults to false on a fresh browser', () => {
    expect(getHasLaunched()).toBe(false);
  });

  it('round-trips the launched flag', () => {
    setHasLaunched(true);
    expect(getHasLaunched()).toBe(true);
    setHasLaunched(false);
    expect(getHasLaunched()).toBe(false);
  });
});

describe('last share link persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  it('returns null when nothing is stored', () => {
    expect(getLastShare()).toBeNull();
  });

  it('round-trips a share entry', () => {
    setLastShare({
      source: '10 PRINT "HI"',
      dialectId: 'zx81',
      url: 'https://example.com/play/zx81/abc123',
    });
    expect(getLastShare()).toEqual({
      source: '10 PRINT "HI"',
      dialectId: 'zx81',
      url: 'https://example.com/play/zx81/abc123',
    });
  });

  it('overwrites the previous entry on a new mint', () => {
    setLastShare({ source: 'a', dialectId: 'zx81', url: 'https://x/1' });
    setLastShare({ source: 'b', dialectId: 'bbc', url: 'https://x/2' });
    expect(getLastShare()).toEqual({
      source: 'b',
      dialectId: 'bbc',
      url: 'https://x/2',
    });
  });

  it('is per-tab: never writes or reads the shared localStorage', () => {
    setLastShare({ source: 'a', dialectId: 'zx81', url: 'https://x/1' });
    expect(localStorage.getItem('mbide.lastShare')).toBeNull();

    sessionStorage.removeItem('mbide.lastShare');
    // A localStorage-only entry (another tab / an older version) is ignored.
    localStorage.setItem(
      'mbide.lastShare',
      JSON.stringify({ source: 'a', dialectId: 'zx81', url: 'https://x/1' }),
    );
    expect(getLastShare()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    sessionStorage.setItem('mbide.lastShare', '{not json');
    expect(getLastShare()).toBeNull();
  });

  it('returns null for malformed entries', () => {
    sessionStorage.setItem('mbide.lastShare', JSON.stringify({ source: 'a' }));
    expect(getLastShare()).toBeNull();
  });
});
