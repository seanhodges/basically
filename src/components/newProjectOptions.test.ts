import { describe, expect, it } from 'vitest';
import {
  AI_UNCONFIGURED_NOTE,
  isStartingPointAvailable,
  projectFileName,
  startingDocument,
} from './newProjectOptions';
import { getDialect } from '../dialects/registry';
import { materializeSampleBlocks } from '../app/sampleBlocks';

const zx81 = getDialect('zx81');
const c64 = getDialect('commodore64');

const sample = (id: string, name: string) =>
  getDialect(id).samples.find((s) => s.name === name)!;

describe('starting-point availability', () => {
  it('offers blank and sample regardless of the assistant', () => {
    expect(isStartingPointAvailable('blank', false)).toBe(true);
    expect(isStartingPointAvailable('sample', false)).toBe(true);
  });

  it('offers describe-it only once the assistant has a key', () => {
    expect(isStartingPointAvailable('describe', false)).toBe(false);
    expect(isStartingPointAvailable('describe', true)).toBe(true);
  });

  it('explains what to do, without promising a round trip', () => {
    // The note is a statement, not a link - the dialog does not send the user
    // to settings and bring them back.
    expect(AI_UNCONFIGURED_NOTE).toMatch(/settings/i);
  });
});

describe('the document a choice produces', () => {
  it('starts blank for a blank project', () => {
    expect(startingDocument(zx81, 'blank', undefined)).toEqual({
      source: '',
      blocks: [],
    });
  });

  it('starts blank for describe-it - the program arrives from the assistant', () => {
    expect(
      startingDocument(zx81, 'describe', sample('zx81', 'hello.bas')),
    ).toEqual({ source: '', blocks: [] });
  });

  it('installs a chosen sample text', () => {
    const hello = sample('zx81', 'hello.bas');
    expect(startingDocument(zx81, 'sample', hello).source).toBe(hello.text);
  });

  it('materializes the blocks a sample bundles', () => {
    const kaleido = sample('commodore64', 'kaleido.bas');
    const expected = materializeSampleBlocks(c64, kaleido);
    expect(expected.length).toBeGreaterThan(0);
    expect(startingDocument(c64, 'sample', kaleido).blocks).toEqual(expected);
  });

  it('falls back to blank when there is no sample to install', () => {
    expect(startingDocument(zx81, 'sample', undefined)).toEqual({
      source: '',
      blocks: [],
    });
  });
});

describe('naming a new project', () => {
  it('leaves a blank name untitled', () => {
    expect(projectFileName('', zx81)).toBe('untitled.txt');
    expect(projectFileName('   ', zx81)).toBe('untitled.txt');
  });

  it('gives a bare name the machine default extension', () => {
    expect(projectFileName('mygame', zx81)).toBe(
      `mygame${zx81.fileExtensions[0]}`,
    );
  });

  it('keeps an extension the user typed', () => {
    expect(projectFileName('mygame.bas', zx81)).toBe('mygame.bas');
  });

  it('trims surrounding whitespace', () => {
    expect(projectFileName('  mygame.bas  ', zx81)).toBe('mygame.bas');
  });
});
