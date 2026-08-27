import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
  loadAutosave,
  saveAutosave,
  clearAutosave,
  saveAutosaveScratch,
  getAiProvider,
  setAiProvider,
  getProviderApiKey,
  setProviderApiKey,
  getProviderMaxTokens,
  setProviderMaxTokens,
  getProviderEffort,
  setProviderEffort,
  hasProviderTuning,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_EFFORT,
  getDialectId,
  setDialectId,
  getLastShare,
  setLastShare,
  type PersistedMessage,
} from './settings';
import type { Block, TapeFile } from '../dialects/types';

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
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
      scratch: [],
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
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
      scratch: [],
    });
  });

  it('falls back to the localStorage backup and adopts it into the session', () => {
    localStorage.setItem('mbide.autosave.doc', '10 REM BACKUP');
    localStorage.setItem('mbide.autosave.name', 'backup.bas');
    expect(loadAutosave()).toEqual({
      name: 'backup.bas',
      text: '10 REM BACKUP',
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
      scratch: [],
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

  const BLOCK: Block = {
    id: 'blk-1',
    name: 'SPRITES',
    address: 0x8000,
    bytes: Uint8Array.from([1, 2, 3, 255, 0]),
    kind: 'memory',
    comment: 'Player sprites',
  };

  it('round-trips blocks alongside the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [BLOCK]);
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 PRINT "HI"',
      blocks: [BLOCK],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
      scratch: [],
    });
  });

  // An autosave written before files a program saves were blocks too spells a
  // block of memory `'data'`; nothing writes it now, so it can only ever have
  // meant memory.
  it("reads a stored 'data' block back as a memory block", () => {
    sessionStorage.setItem('mbide.autosave.name', 'game.bas');
    sessionStorage.setItem('mbide.autosave.doc', '10 PRINT "HI"');
    sessionStorage.setItem(
      'mbide.autosave.blocks',
      JSON.stringify([
        {
          id: 'blk-1',
          name: 'SPRITES',
          address: 0x8000,
          bytes: 'AQID/wA=',
          kind: 'data',
          comment: 'Player sprites',
        },
      ]),
    );
    sessionStorage.setItem(
      'mbide.autosave.listingmeta',
      JSON.stringify({ 0: { kind: 'data' } }),
    );
    const loaded = loadAutosave();
    expect(loaded?.blocks).toEqual([BLOCK]);
    expect(loaded?.listingBlockMeta).toEqual({ 0: { kind: 'memory' } });
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
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
      scratch: [],
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

describe('autosave tape-file persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  const TAPE: TapeFile = {
    name: 'LOADER',
    kind: 'program',
    tap: Uint8Array.from([1, 2, 3, 255, 0]),
  };

  it('round-trips tape files alongside the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [], {}, null, [TAPE]);
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 PRINT "HI"',
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [TAPE],
      bootDisc: null,
      scratch: [],
    });
  });

  it('defaults to no tape files when the fifth argument is omitted', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    expect(loadAutosave()?.tapeFiles).toEqual([]);
  });

  it('writes tape files through as base64 JSON', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [], {}, null, [TAPE]);
    const raw = sessionStorage.getItem('mbide.autosave.tapefiles');
    expect(raw).not.toBeNull();
    expect(raw).toBe(localStorage.getItem('mbide.autosave.tapefiles'));
    const parsed = JSON.parse(raw!);
    expect(typeof parsed[0].tap).toBe('string'); // base64, not raw array
  });

  it('removes the tape-files key when saving an empty list', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [], {}, null, [TAPE]);
    saveAutosave('game.bas', '10 PRINT "HI"', [], {}, null, []);
    expect(sessionStorage.getItem('mbide.autosave.tapefiles')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.tapefiles')).toBeNull();
    expect(loadAutosave()?.tapeFiles).toEqual([]);
  });

  it('clearAutosave clears the tape-files key too', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [], {}, null, [TAPE]);
    clearAutosave();
    expect(sessionStorage.getItem('mbide.autosave.tapefiles')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.tapefiles')).toBeNull();
  });

  it('defensively parses corrupt tape-file JSON as none, without losing the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"', [], {}, null, [TAPE]);
    sessionStorage.setItem('mbide.autosave.tapefiles', '{not json');
    localStorage.setItem('mbide.autosave.tapefiles', '{not json');
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 PRINT "HI"',
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
      scratch: [],
    });
  });
});

describe('autosave scratch-buffer persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  const BUFFERS = [
    { name: 'Scratch 1', text: '10 PRINT "A"' },
    { name: 'Scratch 1', text: '20 REM same name, kept apart' },
  ];

  it('round-trips scratch buffers alongside the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    saveAutosaveScratch(BUFFERS);
    expect(loadAutosave()?.scratch).toEqual(BUFFERS);
  });

  it('writes through to both storages', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    saveAutosaveScratch(BUFFERS);
    const raw = sessionStorage.getItem('mbide.autosave.scratch');
    expect(raw).not.toBeNull();
    expect(raw).toBe(localStorage.getItem('mbide.autosave.scratch'));
  });

  it('removes the scratch key when saving an empty list', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    saveAutosaveScratch(BUFFERS);
    saveAutosaveScratch([]);
    expect(sessionStorage.getItem('mbide.autosave.scratch')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.scratch')).toBeNull();
    expect(loadAutosave()?.scratch).toEqual([]);
  });

  it('clearAutosave clears the scratch key too', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    saveAutosaveScratch(BUFFERS);
    clearAutosave();
    expect(sessionStorage.getItem('mbide.autosave.scratch')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.scratch')).toBeNull();
  });

  it('defensively parses corrupt scratch JSON as none, without losing the document', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    saveAutosaveScratch(BUFFERS);
    sessionStorage.setItem('mbide.autosave.scratch', '{not json');
    localStorage.setItem('mbide.autosave.scratch', '{not json');
    expect(loadAutosave()?.text).toBe('10 PRINT "HI"');
    expect(loadAutosave()?.scratch).toEqual([]);
  });

  it('drops entries that are not a name/text pair', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    sessionStorage.setItem(
      'mbide.autosave.scratch',
      JSON.stringify([{ name: 'Kept', text: 'ok' }, { name: 'No text' }, 7]),
    );
    expect(loadAutosave()?.scratch).toEqual([{ name: 'Kept', text: 'ok' }]);
  });

  it('defensively parses a non-array scratch value as none', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    sessionStorage.setItem(
      'mbide.autosave.scratch',
      JSON.stringify({ oops: true }),
    );
    expect(loadAutosave()?.scratch).toEqual([]);
  });
});

describe('autosave boot-disc persistence', () => {
  beforeEach(() => {
    installStorages();
  });

  const DISC = Uint8Array.from({ length: 32 }, (_, i) => (i * 3) & 0xff);

  it('round-trips a boot-disc image alongside the document', () => {
    saveAutosave('game.bas', '10 REM loader', [], {}, null, [], DISC);
    const loaded = loadAutosave();
    expect(loaded?.bootDisc).not.toBeNull();
    expect(Array.from(loaded!.bootDisc!)).toEqual(Array.from(DISC));
  });

  it('defaults to no boot disc when the seventh argument is omitted', () => {
    saveAutosave('game.bas', '10 PRINT "HI"');
    expect(loadAutosave()?.bootDisc).toBeNull();
  });

  it('writes the boot disc through as base64', () => {
    saveAutosave('game.bas', '10 REM loader', [], {}, null, [], DISC);
    const raw = sessionStorage.getItem('mbide.autosave.bootdisc');
    expect(raw).not.toBeNull();
    expect(raw).toBe(localStorage.getItem('mbide.autosave.bootdisc'));
    expect(raw).not.toContain(','); // base64, not a raw array
  });

  it('removes the boot-disc key when saving without one', () => {
    saveAutosave('game.bas', '10 REM loader', [], {}, null, [], DISC);
    saveAutosave('game.bas', '10 REM loader', [], {}, null, [], null);
    expect(sessionStorage.getItem('mbide.autosave.bootdisc')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.bootdisc')).toBeNull();
    expect(loadAutosave()?.bootDisc).toBeNull();
  });

  it('clearAutosave clears the boot-disc key too', () => {
    saveAutosave('game.bas', '10 REM loader', [], {}, null, [], DISC);
    clearAutosave();
    expect(sessionStorage.getItem('mbide.autosave.bootdisc')).toBeNull();
    expect(localStorage.getItem('mbide.autosave.bootdisc')).toBeNull();
  });

  it('defensively parses a corrupt boot-disc value as none', () => {
    saveAutosave('game.bas', '10 REM loader', [], {}, null, [], DISC);
    sessionStorage.setItem('mbide.autosave.bootdisc', '!!! not base64 !!!');
    localStorage.setItem('mbide.autosave.bootdisc', '!!! not base64 !!!');
    expect(loadAutosave()?.bootDisc).toBeNull();
    expect(loadAutosave()?.text).toBe('10 REM loader');
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

describe('per-provider AI tuning', () => {
  beforeEach(() => {
    installStorages();
  });

  it('falls back to the shared default when nothing is stored', () => {
    expect(getProviderMaxTokens('anthropic')).toBe(DEFAULT_AI_MAX_TOKENS);
    expect(getProviderEffort('anthropic')).toBe(DEFAULT_AI_EFFORT);
    expect(hasProviderTuning('anthropic')).toEqual({
      maxTokens: false,
      effort: false,
    });
  });

  it('round-trips an override', () => {
    setProviderMaxTokens('anthropic', 32000);
    setProviderEffort('anthropic', 'high');
    expect(getProviderMaxTokens('anthropic')).toBe(32000);
    expect(getProviderEffort('anthropic')).toBe('high');
    expect(hasProviderTuning('anthropic')).toEqual({
      maxTokens: true,
      effort: true,
    });
  });

  // The whole reason these are per-provider: the ceilings and the meaning of
  // "effort" differ, so tuning one backend and trying another must not lose it.
  it('keeps the tuning of each provider separate', () => {
    setProviderMaxTokens('anthropic', 32000);
    setProviderMaxTokens('openai', 8000);

    expect(getProviderMaxTokens('anthropic')).toBe(32000);
    expect(getProviderMaxTokens('openai')).toBe(8000);
    // Untouched, so still on the default rather than on either neighbour's value.
    expect(getProviderMaxTokens('gemini')).toBe(DEFAULT_AI_MAX_TOKENS);
  });

  it('survives switching away and back', () => {
    setProviderEffort('anthropic', 'max');
    setAiProvider('openai');
    setAiProvider('anthropic');
    expect(getProviderEffort('anthropic')).toBe('max');
  });

  it('clearing one override leaves the other alone', () => {
    setProviderMaxTokens('anthropic', 32000);
    setProviderEffort('anthropic', 'low');

    setProviderEffort('anthropic', null);
    expect(getProviderEffort('anthropic')).toBe(DEFAULT_AI_EFFORT);
    expect(getProviderMaxTokens('anthropic')).toBe(32000);
    expect(hasProviderTuning('anthropic')).toEqual({
      maxTokens: true,
      effort: false,
    });
  });

  it('removes the entry once nothing is overridden', () => {
    setProviderMaxTokens('anthropic', 32000);
    setProviderMaxTokens('anthropic', null);
    expect(localStorage.getItem('mbide.aiTuning.anthropic')).toBeNull();
  });

  it('ignores a corrupt entry rather than failing a request', () => {
    localStorage.setItem('mbide.aiTuning.anthropic', '{not json');
    expect(getProviderMaxTokens('anthropic')).toBe(DEFAULT_AI_MAX_TOKENS);
  });

  it('ignores a stored value that is not usable as a budget', () => {
    localStorage.setItem(
      'mbide.aiTuning.anthropic',
      JSON.stringify({ maxTokens: -5, effort: 'sideways' }),
    );
    expect(getProviderMaxTokens('anthropic')).toBe(DEFAULT_AI_MAX_TOKENS);
    expect(getProviderEffort('anthropic')).toBe(DEFAULT_AI_EFFORT);
  });
});
