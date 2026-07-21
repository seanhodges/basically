// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useState } from 'react';
import { useIdeStore, useBlocks } from '../app/store';
import { useDismiss } from '../app/useDismiss';
import { useLongPress } from './useLongPress';
import { asmEngineFor } from '../asm/registry';
import { downloadBlob, withExtension } from '../storage/files';
import type { MemoryBlock } from '../dialects/types';
import styles from './EditorTabBar.module.css';

/**
 * Which tab a context menu belongs to: the BASIC source tab, or a memory
 * block by id.
 */
type TabTarget = { kind: 'basic' } | { kind: 'block'; blockId: string };

/** An open tab context menu: which tab, anchored where (viewport px). */
interface TabMenu {
  target: TabTarget;
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
 * Right-clicking or long-pressing a tab opens a context menu. The BASIC tab
 * offers "Download .bas" (the single-file export that used to be File → Save's
 * plain-text listing). A block tab offers "Download .bin" (its bytes) and, for
 * a code block, "Download .asm" (its assembly source), plus "Settings" (the
 * block-metadata dialog) and "Delete" (the confirm-delete dialog) - the main
 * program can never be deleted.
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
  const openMenu = (target: TabTarget, pos: { x: number; y: number }) =>
    setMenu({
      target,
      x: Math.min(pos.x, window.innerWidth - MENU_WIDTH_PX),
      y: pos.y,
    });
  const menuRef = useDismiss<HTMLDivElement>(menu !== null, () =>
    setMenu(null),
  );
  const longPress = useLongPress<TabTarget>(openMenu);

  // The disassembler for the active CPU, used to reconstruct a code block's
  // .asm text for download when it has no stored asmSource (mirrors what the
  // AsmEditor shows). null for dialects with no memory-block support.
  const asmEngine = dialect.memoryBlocks
    ? asmEngineFor(dialect.memoryBlocks.cpu)
    : null;

  /** Download the BASIC source as a `.bas` named after the document. */
  const downloadBas = () => {
    const { source, fileName } = useIdeStore.getState();
    downloadBlob(
      new Blob([source], { type: 'text/plain' }),
      withExtension(fileName, '.bas'),
    );
  };

  /** Download a block's raw bytes as `<name>.bin`. */
  const downloadBin = (block: MemoryBlock) => {
    downloadBlob(
      new Blob([block.bytes as BlobPart], { type: 'application/octet-stream' }),
      `${block.name}.bin`,
    );
  };

  /** Download a code block's assembly source as `<name>.asm`. */
  const downloadAsm = (block: MemoryBlock) => {
    const asm =
      block.asmSource ??
      asmEngine
        ?.disassembleReachable(block.bytes, block.address)
        .map((l) => l.text)
        .join('\n') ??
      '';
    downloadBlob(new Blob([asm], { type: 'text/plain' }), `${block.name}.asm`);
  };

  if (!dialect.memoryBlocks) return null;

  let menuBlock: MemoryBlock | null = null;
  if (menu && menu.target.kind === 'block') {
    const { blockId } = menu.target;
    menuBlock = blocks.find((b) => b.id === blockId) ?? null;
  }

  return (
    <div className={styles.tabBar} role="tablist" aria-label="Editor content">
      <button
        role="tab"
        aria-selected={activeBlockId === null}
        aria-label="BASIC"
        title="BASIC (right-click or long-press to download)"
        className={activeBlockId === null ? 'active' : ''}
        onClick={() => {
          if (!longPress.consumeFired()) setActiveBlock(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu({ kind: 'basic' }, { x: e.clientX, y: e.clientY });
        }}
        {...longPress.bind({ kind: 'basic' })}
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
            openMenu(
              { kind: 'block', blockId: block.id },
              { x: e.clientX, y: e.clientY },
            );
          }}
          {...longPress.bind({ kind: 'block', blockId: block.id })}
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
          aria-label="Tab actions"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.target.kind === 'basic' ? (
            <button
              role="menuitem"
              onClick={() => {
                setMenu(null);
                downloadBas();
              }}
            >
              Download .bas
            </button>
          ) : menuBlock ? (
            <>
              {menuBlock.kind === 'code' && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    downloadAsm(menuBlock);
                  }}
                >
                  Download .asm
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  downloadBin(menuBlock);
                }}
              >
                Download .bin
              </button>
              <div className={styles.menuSeparator} />
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  openBlockSettings(menuBlock.id);
                }}
              >
                Settings…
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  requestRemoveBlock(menuBlock.id);
                }}
              >
                Delete…
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
