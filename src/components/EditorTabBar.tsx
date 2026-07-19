// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useState } from 'react';
import { useIdeStore, useBlocks } from '../app/store';
import { useDismiss } from '../app/useDismiss';
import { useLongPress } from './useLongPress';
import styles from './EditorTabBar.module.css';

/** An open tab context menu: which block, anchored where (viewport px). */
interface TabMenu {
  blockId: string;
  x: number;
  y: number;
}

/** Keep the fixed-position menu inside the viewport's right edge. */
const MENU_WIDTH_PX = 160;

/**
 * The editor pane's tab strip: the BASIC source plus one tab per memory
 * block, then a plus button that creates a new block. Always visible for a
 * dialect with the `memoryBlocks` capability (every current dialect), so
 * block creation is discoverable on a pure-BASIC document. Lives inside
 * `.editorPane`, above the editor, so it composes with the mobile pane
 * switcher unchanged.
 *
 * Right-clicking or long-pressing a block tab opens a context menu with
 * "Settings" (the block-metadata dialog) and "Delete" (the confirm-delete
 * dialog). The BASIC tab has no context menu - the main program can never be
 * deleted.
 */
export function EditorTabBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useBlocks();
  const activeBlockId = useIdeStore((s) => s.activeBlockId);
  const setActiveBlock = useIdeStore((s) => s.setActiveBlock);
  const addBlock = useIdeStore((s) => s.addBlock);
  const requestRemoveBlock = useIdeStore((s) => s.requestRemoveBlock);
  const openBlockSettings = useIdeStore((s) => s.openBlockSettings);
  const asmErrorBlocks = useIdeStore((s) => s.asmErrorBlocks);

  const [menu, setMenu] = useState<TabMenu | null>(null);
  const openMenu = (blockId: string, pos: { x: number; y: number }) =>
    setMenu({
      blockId,
      x: Math.min(pos.x, window.innerWidth - MENU_WIDTH_PX),
      y: pos.y,
    });
  const menuRef = useDismiss<HTMLDivElement>(menu !== null, () =>
    setMenu(null),
  );
  const longPress = useLongPress<string>(openMenu);

  if (!dialect.memoryBlocks) return null;

  return (
    <div className={styles.tabBar} role="tablist" aria-label="Editor content">
      <button
        role="tab"
        aria-selected={activeBlockId === null}
        aria-label="BASIC"
        className={activeBlockId === null ? 'active' : ''}
        onClick={() => setActiveBlock(null)}
      >
        BASIC
      </button>
      {blocks.map((block) => (
        <button
          key={block.id}
          role="tab"
          aria-selected={block.id === activeBlockId}
          aria-label={block.name}
          title={
            (block.kind === 'code'
              ? `${block.name} - machine code block`
              : `${block.name} - data block`) +
            ' (right-click or long-press for options)'
          }
          className={block.id === activeBlockId ? 'active' : ''}
          onClick={() => {
            // Swallow the click that follows a completed long-press so the
            // tab doesn't also activate under the context menu.
            if (!longPress.consumeFired()) setActiveBlock(block.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu(block.id, { x: e.clientX, y: e.clientY });
          }}
          {...longPress.bind(block.id)}
        >
          <span className={styles.kindGlyph} aria-hidden="true">
            {block.kind === 'code' ? '⚙' : '▤'}
          </span>
          <span className={styles.tabName}>{block.name}</span>
          {asmErrorBlocks.has(block.id) && (
            <span
              className={styles.errorDot}
              role="img"
              aria-label="does not assemble"
            />
          )}
        </button>
      ))}
      <button
        className={styles.addTab}
        aria-label="New block"
        title="New machine code block"
        onClick={addBlock}
      >
        +
      </button>
      {menu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label="Block actions"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setMenu(null);
              openBlockSettings(menu.blockId);
            }}
          >
            Settings…
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(null);
              requestRemoveBlock(menu.blockId);
            }}
          >
            Delete…
          </button>
        </div>
      )}
    </div>
  );
}
