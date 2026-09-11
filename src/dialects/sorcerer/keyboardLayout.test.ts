// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sorcererKeyboardLayout as layout } from './keyboardLayout';
import { sorcererCharset } from './charset';
import { sorcererGraphics } from './graphics';
import { SORCERER_GRAPHIC_CODES, plainChar } from './charset';
import {
  resolveEditorAction,
  resolveEmits,
} from '../../keyboard/editorActions';
import {
  SORCERER_KEY_TOKENS,
  tokensForHostCode,
} from '../../emulator/sorcerer/keyboard';
import { SorcererMachine } from '../../emulator/sorcerer/sorcererMachine';
import { splitRomImage } from './romImage';
import { FLANK_SPAN, GRID_COLUMNS } from '../../keyboard/templateRows';

const allKeys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])];
const byId = new Map(allKeys.map((k) => [k.id, k]));

const ROM_PATH = join(__dirname, '../../../public/roms/sorcerer/sorcerer.rom');
const hasRom = existsSync(ROM_PATH);

describe('sorcerer keyboard layout', () => {
  it('takes its geometry from the shared template rows', () => {
    expect(layout.gridColumns).toBe(GRID_COLUMNS);
    expect(layout.rows).toHaveLength(5);
    layout.rows.forEach((row, i) => {
      const total = row.reduce((n, k) => n + k.spanX, 0);
      expect(total, `row ${i}`).toBe(GRID_COLUMNS);
    });
    const flanked = layout.rows[3]!.filter((k) => k.emits.length > 0);
    expect(flanked[0]!.spanX).toBe(FLANK_SPAN);
    expect(flanked.at(-1)!.spanX).toBe(FLANK_SPAN);
  });

  it('labels are index-aligned with the layers', () => {
    for (const k of allKeys) {
      if (k.style === 'spacer') continue;
      expect(k.labels.length, k.id).toBe(layout.layers.length);
    }
  });

  it('offers ABC, SYM, CURSOR and GRAPHICS modes', () => {
    expect((layout.editorModes ?? []).map((m) => m.id)).toEqual([
      'abc',
      'sym',
      'cursor',
      'graphic',
    ]);
    expect(
      layout.editorModes!.find((m) => m.palette === 'graphics'),
    ).toBeDefined();
  });

  it('reaches every emulator key token by keycap or host key', () => {
    // A matrix cell no keycap presses and no host key reaches is a key the
    // machine has and this app does not: the numeric keypad and the four
    // Sorcerer-only keys are the ones that can only be typed.
    const reachable = new Set<string>();
    for (const key of allKeys) {
      for (const token of key.emits) reachable.add(token);
      for (const label of key.labels) {
        for (const token of label?.emits ?? []) reachable.add(token);
      }
    }
    const unreachable = SORCERER_KEY_TOKENS.filter(
      (token) => !reachable.has(token) && tokensForHostCode(token).length === 0,
    );
    expect(unreachable).toEqual([]);
  });

  it('presses only cells the matrix actually has', () => {
    const known = new Set(SORCERER_KEY_TOKENS);
    for (const key of allKeys) {
      for (const token of key.emits)
        expect(known.has(token), key.id).toBe(true);
      for (const label of key.labels) {
        for (const token of label?.emits ?? [])
          expect(known.has(token), `${key.id} ${label?.text}`).toBe(true);
      }
    }
  });

  it("gives the CURSOR arrows the Monitor's own control diamond", () => {
    // CTRL + W/A/S/Z, not the numeric keypad: the keypad's 4 and 8 type `4`
    // and `8` on this machine, and nothing else moves the cursor at all.
    const idx = layout.layers.findIndex((l) => l.id === 'cursor');
    const found = new Map<string, string[] | undefined>();
    for (const key of layout.rows.flat()) {
      const label = key.labels[idx];
      if (label?.text) found.set(label.text, label.emits);
    }
    expect(found.get('↑')).toEqual(['Control', 'KeyW']);
    expect(found.get('←')).toEqual(['Control', 'KeyA']);
    expect(found.get('→')).toEqual(['Control', 'KeyS']);
    expect(found.get('↓')).toEqual(['Control', 'KeyZ']);
    expect(resolveEditorAction(layout, byId.get('KeyW')!, 'cursor')).toEqual({
      action: 'up',
    });
    // A letter outside the diamond is blank and inert in CURSOR mode.
    expect(resolveEditorAction(layout, byId.get('KeyF')!, 'cursor')).toBeNull();
    expect(resolveEmits(layout, byId.get('KeyF')!, 'cursor')).toEqual([]);
  });

  it('spot checks the bottom-row editor actions', () => {
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'base')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'base')).toEqual({
      insert: ' ',
    });
    // The quote keycap is the machine's own SHIFT+2 pair.
    expect(resolveEditorAction(layout, byId.get('Quote')!, 'base')).toEqual({
      insert: '"',
    });
    expect(byId.get('Quote')!.emits).toEqual(['Shift', 'Digit2']);
  });

  it('makes the delete flank the cursor-left this machine takes back with', () => {
    // No key on the Sorcerer erases: BASIC reads the line back off the screen,
    // so the machine's "undo that character" is moving over it. The editor,
    // which has a line buffer instead, backspaces.
    const del = byId.get('Backspace')!;
    expect(del.emits).toEqual(['Control', 'KeyA']);
    expect(resolveEditorAction(layout, del, 'base')).toEqual({
      action: 'backspace',
    });
  });

  it('types letters in the case the machine starts in', () => {
    expect(layout.powerOnCase).toBe('lower');
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'base')).toEqual({
      insert: 'a',
    });
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'shift')).toEqual({
      insert: 'A',
    });
  });

  it('reaches the graphics characters through GRAPHIC + a keycap', () => {
    const palette = layout.graphicsPalette!;
    const entries = palette.sections.flatMap((s) => s.entries);
    expect(entries).toEqual([...sorcererGraphics]);
    for (const entry of entries) {
      const where = `0x${entry.code.toString(16)}`;
      // Every cell says which key it is printed on, and holds GRAPHIC to get
      // it - SHIFT + GRAPHIC would type the user-definable band instead.
      expect(entry.key, where).toBeTruthy();
      expect(entry.modifier, where).toBe('GRAPHIC');
      expect([...sorcererCharset.toMachine(entry.char)], where).toEqual([
        entry.code,
      ]);
    }
    expect(new Set(entries.map((e) => e.code)).size).toBe(entries.length);
  });

  it('offers every standard graphics code the charset can spell, once', () => {
    // The palette and the charset are the same table read two ways, so the
    // only codes missing from it are the ones with no character at all.
    const offered = new Set(sorcererGraphics.map((e) => e.code));
    const spellable = SORCERER_GRAPHIC_CODES.filter(
      (code) => plainChar(code) !== undefined,
    );
    expect([...offered].sort((a, b) => a - b)).toEqual(spellable);
  });

  it('binds the controller to the four keys the Monitor moves with', () => {
    expect(layout.controller!.bindings).toEqual({
      up: 'KeyW',
      down: 'KeyZ',
      left: 'KeyA',
      right: 'KeyS',
      fire1: 'Space',
      fire2: 'Enter',
    });
    for (const id of Object.values(layout.controller!.bindings)) {
      expect(byId.has(id!), id).toBe(true);
    }
  });

  (hasRom ? it : it.skip)(
    'takes the cursor back over what was typed, on the real ROM',
    () => {
      // The family this machine is in cannot be reached by the registry-driven
      // cursor-key battery, so its legend is proved here: press the ← cell's
      // own tokens and the next character overwrites the last one.
      const machine = new SorcererMachine(
        splitRomImage(new Uint8Array(readFileSync(ROM_PATH))),
      );
      machine.bootToReady();
      const tap = (tokens: readonly string[]) => {
        for (const token of tokens) machine.setKey(token, true);
        for (let i = 0; i < 6; i++) machine.runFrame();
        for (const token of tokens) machine.setKey(token, false);
        for (let i = 0; i < 6; i++) machine.runFrame();
      };
      tap(['KeyA']);
      tap(['KeyA']);
      tap(resolveEmits(layout, byId.get('Backspace')!, 'base'));
      tap(['KeyB']);
      for (let i = 0; i < 10; i++) machine.runFrame();
      const text = machine.readScreenText()!.lines.join('\n');
      expect(text).toContain('ab');
      expect(text).not.toContain('aab');
      machine.dispose();
    },
  );
});
