// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The single source of truth for the IDE's desktop keyboard shortcuts.
 *
 * This module is intentionally free of React/store dependencies so it can be
 * unit tested and reused by every consumer: the global handler
 * ({@link ../app/useGlobalShortcuts}), the toolbar tooltips/menu hints
 * ({@link ../components/Toolbar}), and the docs guide.
 *
 * `Mod` means Ctrl on Windows/Linux and Cmd on macOS. Matching keeps the app's
 * existing "Ctrl or Cmd" approach (either fires a `Mod` binding); display is
 * platform-aware (⌘⌥⇧ on macOS, Ctrl/Alt/Shift elsewhere).
 *
 * Combos are keyed by {@link KeyboardEvent.code} (the physical key, e.g.
 * `KeyN`, `Comma`, `F5`) rather than `key`, so matching is layout- and
 * Shift-independent. See `docs/guide/keyboard-shortcuts.md` for the rendered
 * table.
 */

export type ShortcutId =
  | 'file.new'
  | 'file.open'
  | 'file.save'
  | 'file.import'
  | 'file.export'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.find'
  | 'edit.outline'
  | 'edit.renumber'
  | 'edit.breakpoint'
  | 'run.play'
  | 'run.stop'
  | 'run.step'
  | 'run.continue'
  | 'run.reset'
  | 'run.mute'
  | 'view.ai'
  | 'view.settings'
  | 'view.docs'
  | 'view.keyboard'
  | 'view.watcher'
  | 'view.controller'
  | 'view.escape';

export type ShortcutCategory = 'File' | 'Edit' | 'Run' | 'View';

/** One key chord. `code` is a {@link KeyboardEvent.code} value. */
export interface Combo {
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  code: string;
}

export interface Shortcut {
  id: ShortcutId;
  label: string;
  category: ShortcutCategory;
  /** Accepted chords; the first is the primary one shown in compact UI. */
  keys: Combo[];
  /** Only active while the current dialect is debuggable and paused. */
  debugOnly?: boolean;
  /** Handled natively by the browser/CodeMirror/emulator — listed for display
   * only, never dispatched by the global handler. */
  native?: boolean;
}

const c = (code: string, mods: Omit<Combo, 'code'> = {}): Combo => ({
  code,
  ...mods,
});

export const SHORTCUTS: readonly Shortcut[] = [
  // File
  {
    id: 'file.new',
    label: 'New',
    category: 'File',
    keys: [c('KeyN', { mod: true, alt: true })],
  },
  {
    id: 'file.open',
    label: 'Open',
    category: 'File',
    keys: [c('KeyO', { mod: true })],
  },
  {
    id: 'file.save',
    label: 'Save',
    category: 'File',
    keys: [c('KeyS', { mod: true })],
  },
  {
    id: 'file.import',
    label: 'Import',
    category: 'File',
    keys: [c('KeyI', { mod: true, alt: true })],
  },
  {
    id: 'file.export',
    label: 'Export',
    category: 'File',
    keys: [c('KeyE', { mod: true, alt: true })],
  },

  // Edit
  {
    id: 'edit.undo',
    label: 'Undo',
    category: 'Edit',
    keys: [c('KeyZ', { mod: true })],
    native: true,
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    category: 'Edit',
    keys: [c('KeyZ', { mod: true, shift: true })],
    native: true,
  },
  {
    id: 'edit.cut',
    label: 'Cut',
    category: 'Edit',
    keys: [c('KeyX', { mod: true })],
    native: true,
  },
  {
    id: 'edit.copy',
    label: 'Copy',
    category: 'Edit',
    keys: [c('KeyC', { mod: true })],
    native: true,
  },
  {
    id: 'edit.paste',
    label: 'Paste',
    category: 'Edit',
    keys: [c('KeyV', { mod: true })],
    native: true,
  },
  {
    id: 'edit.find',
    label: 'Find/Replace',
    category: 'Edit',
    keys: [c('KeyF', { mod: true })],
  },
  {
    id: 'edit.outline',
    label: 'Outline',
    category: 'Edit',
    keys: [c('KeyO', { mod: true, shift: true })],
  },
  {
    id: 'edit.renumber',
    label: 'Renumber line',
    category: 'Edit',
    keys: [c('KeyR', { mod: true, alt: true })],
    native: true,
  },
  {
    id: 'edit.breakpoint',
    label: 'Toggle breakpoint',
    category: 'Edit',
    keys: [c('F9')],
    native: true,
  },

  // Run / debug
  {
    id: 'run.play',
    label: 'Run',
    category: 'Run',
    keys: [c('F5'), c('Enter', { mod: true })],
  },
  {
    id: 'run.stop',
    label: 'Stop',
    category: 'Run',
    keys: [c('F5', { shift: true })],
  },
  {
    id: 'run.step',
    label: 'Step',
    category: 'Run',
    keys: [c('F10')],
    debugOnly: true,
  },
  {
    id: 'run.continue',
    label: 'Continue',
    category: 'Run',
    keys: [c('F8')],
    debugOnly: true,
  },
  {
    id: 'run.reset',
    label: 'Reset machine',
    category: 'Run',
    keys: [c('F5', { mod: true, shift: true })],
  },
  {
    id: 'run.mute',
    label: 'Mute audio',
    category: 'Run',
    keys: [c('KeyM', { mod: true, alt: true })],
  },

  // View / panels
  {
    id: 'view.ai',
    label: 'AI panel',
    category: 'View',
    keys: [c('KeyA', { mod: true, alt: true })],
  },
  {
    id: 'view.settings',
    label: 'Settings',
    category: 'View',
    keys: [c('Comma', { mod: true })],
  },
  {
    id: 'view.docs',
    label: 'Documentation',
    category: 'View',
    keys: [c('F1')],
  },
  {
    id: 'view.keyboard',
    label: 'On-screen keyboard',
    category: 'View',
    keys: [c('KeyK', { mod: true, alt: true })],
  },
  {
    id: 'view.watcher',
    label: 'Variable watcher',
    category: 'View',
    keys: [c('KeyW', { mod: true, alt: true })],
  },
  {
    id: 'view.controller',
    label: 'Game controller',
    category: 'View',
    keys: [c('KeyG', { mod: true, alt: true })],
  },
  {
    id: 'view.escape',
    label: 'Release emulator / close panel',
    category: 'View',
    keys: [c('Escape')],
    native: true,
  },
];

/** Look up a shortcut by id (throws in dev if the id is unknown). */
export function getShortcut(id: ShortcutId): Shortcut {
  const s = SHORTCUTS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown shortcut id: ${id}`);
  return s;
}

/** True on macOS, where modifiers render as ⌘⌥⇧ rather than Ctrl/Alt/Shift. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaPlatform = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData?.platform;
  const platform = uaPlatform || navigator.platform || '';
  return /mac/i.test(platform);
}

/** Does a keyboard event satisfy any of a shortcut's chords? */
export function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  const mod = e.ctrlKey || e.metaKey;
  return s.keys.some(
    (k) =>
      e.code === k.code &&
      !!k.mod === mod &&
      !!k.shift === e.shiftKey &&
      !!k.alt === e.altKey,
  );
}

/** Human label for a physical `code` (e.g. `KeyN` → `N`, `Comma` → `,`). */
function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  switch (code) {
    case 'Comma':
      return ',';
    case 'Enter':
      return 'Enter';
    case 'Escape':
      return 'Esc';
    default:
      return code; // function keys (F5, F10, …) render as-is
  }
}

/** Render a single chord as a platform-appropriate string. */
function formatCombo(k: Combo, mac: boolean): string {
  const key = codeLabel(k.code);
  if (mac) {
    // Conventional macOS order: ⌃⌥⇧⌘ then the key, concatenated with no plus.
    return (k.alt ? '⌥' : '') + (k.shift ? '⇧' : '') + (k.mod ? '⌘' : '') + key;
  }
  const parts: string[] = [];
  if (k.mod) parts.push('Ctrl');
  if (k.alt) parts.push('Alt');
  if (k.shift) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

/** The primary chord of a shortcut, formatted for the current platform. */
export function formatShortcut(s: Shortcut, mac = isMac()): string {
  return formatCombo(s.keys[0]!, mac);
}

/** Every chord of a shortcut, formatted and joined (e.g. `F5 / Ctrl+Enter`). */
export function formatAllShortcuts(s: Shortcut, mac = isMac()): string {
  return s.keys.map((k) => formatCombo(k, mac)).join(mac ? ' / ' : ' / ');
}
