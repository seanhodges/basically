// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useState } from 'react';
import { useIdeStore, useBlocks } from '../app/store';
import { useDismiss } from '../app/useDismiss';
import { useLongPress } from './useLongPress';
import { asmEngineFor } from '../asm/registry';
import { downloadBlob, openBinaryFile, withExtension } from '../storage/files';
import { loadBytes } from '../app/byteEdit';
import type { MemoryBlock } from '../dialects/types';
import styles from './EditorTabBar.module.css';

/**
 * Which tab a context menu belongs to: the BASIC source tab, a memory block by
 * id, or a scratch buffer by id.
 */
type TabTarget =
  | { kind: 'basic' }
  | { kind: 'block'; blockId: string }
  | { kind: 'scratch'; scratchId: string };

/** An open tab context menu: which tab, anchored where (viewport px). */
interface TabMenu {
  target: TabTarget;
  x: number;
  y: number;
}

/** Keep the fixed-position menu inside the viewport's right edge. */
const MENU_WIDTH_PX = 160;

/**
 * The editor pane's tab strip: the BASIC source, one tab per memory block, then
 * one per scratch buffer, then a plus button whose menu creates either. Always
 * rendered - scratch buffers are dialect-independent, so the strip is not gated
 * on the `memoryBlocks` capability (only the block tabs and the new-block menu
 * item are). Lives inside `.editorPane`, above the editor, so it composes with
 * the mobile pane switcher unchanged.
 *
 * Right-clicking or long-pressing a tab opens a context menu. The BASIC tab
 * offers "Download .bas" (the single-file export that used to be File → Save's
 * plain-text listing). A block tab offers "Download .bin" (its bytes),
 * "Load bytes…" (the inbound half of that download) and, for a code block,
 * "Download .asm" (its assembly source), plus "Settings" (the block-metadata
 * dialog) and "Delete" (the confirm-delete dialog) - the main program can never
 * be deleted. A scratch tab offers "Rename", "Download .bas" and "Close";
 * closing is unconfirmed, since a scratch buffer is disposable by definition.
 */
export function EditorTabBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useBlocks();
  const activeTab = useIdeStore((s) => s.activeTab);
  const scratchBuffers = useIdeStore((s) => s.scratchBuffers);
  const setActiveTab = useIdeStore((s) => s.setActiveTab);
  const addBlock = useIdeStore((s) => s.addBlock);
  const addScratchBuffer = useIdeStore((s) => s.addScratchBuffer);
  const renameScratchBuffer = useIdeStore((s) => s.renameScratchBuffer);
  const closeScratchBuffer = useIdeStore((s) => s.closeScratchBuffer);
  const requestRemoveBlock = useIdeStore((s) => s.requestRemoveBlock);
  const openBlockSettings = useIdeStore((s) => s.openBlockSettings);
  const asmErrorBlocks = useIdeStore((s) => s.asmErrorBlocks);

  const [menu, setMenu] = useState<TabMenu | null>(null);
  // The plus button's menu (new scratch buffer / new block), anchored under the
  // button rather than at a pointer position.
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  // The scratch buffer being renamed in place, or null. The tab becomes a text
  // input for the duration; there is no dialog for a name nothing resolves by.
  const [renaming, setRenaming] = useState<string | null>(null);

  const openMenu = (target: TabTarget, pos: { x: number; y: number }) =>
    setMenu({
      target,
      x: Math.min(pos.x, window.innerWidth - MENU_WIDTH_PX),
      y: pos.y,
    });
  const menuRef = useDismiss<HTMLDivElement>(menu !== null, () =>
    setMenu(null),
  );
  const addMenuRef = useDismiss<HTMLDivElement>(addMenu !== null, () =>
    setAddMenu(null),
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

  /** Download a scratch buffer's text as `<name>.bas`. */
  const downloadScratch = (id: string) => {
    const buffer = useIdeStore
      .getState()
      .scratchBuffers.find((b) => b.id === id);
    if (!buffer) return;
    downloadBlob(
      new Blob([buffer.text], { type: 'text/plain' }),
      withExtension(buffer.name, '.bas'),
    );
  };

  /** Download a block's raw bytes as `<name>.bin`. */
  const downloadBin = (block: MemoryBlock) => {
    downloadBlob(
      new Blob([block.bytes as BlobPart], { type: 'application/octet-stream' }),
      `${block.name}.bin`,
    );
  };

  /**
   * Replace a block's bytes from a file - the inbound counterpart to the `.bin`
   * download beside it. The block keeps its own address, name and kind; only
   * what it holds changes.
   */
  const loadBin = async (block: MemoryBlock) => {
    const file = await openBinaryFile('.bin');
    if (!file) return;
    const outcome = loadBytes(
      { bytes: block.bytes, address: block.address },
      file.bytes,
    );
    const store = useIdeStore.getState();
    if (!outcome.ok) {
      store.setStatusNotice(outcome.message);
      return;
    }
    if (store.dialect.memoryBlocks?.inListing) {
      store.commitListingBlockBytes(block.id, outcome.edit.bytes);
    } else {
      store.upsertBlock({ ...block, bytes: outcome.edit.bytes });
    }
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

  let menuBlock: MemoryBlock | null = null;
  if (menu && menu.target.kind === 'block') {
    const { blockId } = menu.target;
    menuBlock = blocks.find((b) => b.id === blockId) ?? null;
  }
  const menuScratchId =
    menu?.target.kind === 'scratch' ? menu.target.scratchId : null;

  return (
    <div className={styles.tabBar} role="tablist" aria-label="Editor content">
      <button
        role="tab"
        aria-selected={activeTab.kind === 'basic'}
        aria-label="BASIC"
        title="BASIC (right-click or long-press to download)"
        className={activeTab.kind === 'basic' ? 'active' : ''}
        onClick={() => {
          if (!longPress.consumeFired()) setActiveTab({ kind: 'basic' });
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
          aria-selected={
            activeTab.kind === 'block' && activeTab.id === block.id
          }
          aria-label={block.name}
          title={
            (block.kind === 'code'
              ? `${block.name} - machine code block`
              : `${block.name} - data block`) +
            ' (right-click or long-press for options)'
          }
          className={
            activeTab.kind === 'block' && activeTab.id === block.id
              ? 'active'
              : ''
          }
          onClick={() => {
            // Swallow the click that follows a completed long-press so the
            // tab doesn't also activate under the context menu.
            if (!longPress.consumeFired())
              setActiveTab({ kind: 'block', id: block.id });
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
      {scratchBuffers.map((buffer) =>
        renaming === buffer.id ? (
          <input
            key={buffer.id}
            className={styles.renameInput}
            aria-label={`Rename ${buffer.name}`}
            defaultValue={buffer.name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              renameScratchBuffer(buffer.id, e.currentTarget.value);
              setRenaming(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              // Escape abandons the rename: blur would commit what was typed.
              else if (e.key === 'Escape') setRenaming(null);
            }}
          />
        ) : (
          <button
            key={buffer.id}
            role="tab"
            aria-selected={
              activeTab.kind === 'scratch' && activeTab.id === buffer.id
            }
            aria-label={buffer.name}
            title={`${buffer.name} - scratch buffer, not part of the document (right-click or long-press for options)`}
            className={
              activeTab.kind === 'scratch' && activeTab.id === buffer.id
                ? 'active'
                : ''
            }
            onClick={() => {
              if (!longPress.consumeFired())
                setActiveTab({ kind: 'scratch', id: buffer.id });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(
                { kind: 'scratch', scratchId: buffer.id },
                { x: e.clientX, y: e.clientY },
              );
            }}
            {...longPress.bind({ kind: 'scratch', scratchId: buffer.id })}
          >
            {/* Distinct from the block glyphs (⚙ code, ▤ data) so a scratch
                buffer reads as not part of the document. */}
            <span className={styles.kindGlyph} aria-hidden="true">
              ✎
            </span>
            <span className={styles.tabName}>{buffer.name}</span>
          </button>
        ),
      )}
      <button
        className={styles.addTab}
        aria-label="New tab"
        aria-haspopup="menu"
        aria-expanded={addMenu !== null}
        title="New scratch buffer or machine code block"
        onClick={(e) => {
          if (addMenu !== null) {
            setAddMenu(null);
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setAddMenu({
            x: Math.min(rect.left, window.innerWidth - MENU_WIDTH_PX),
            y: rect.bottom,
          });
        }}
      >
        +
      </button>
      {addMenu && (
        <div
          ref={addMenuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label="New tab"
          style={{ left: addMenu.x, top: addMenu.y }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setAddMenu(null);
              addScratchBuffer();
            }}
          >
            New scratch buffer
          </button>
          {dialect.memoryBlocks && (
            <button
              role="menuitem"
              onClick={() => {
                setAddMenu(null);
                addBlock();
              }}
            >
              New machine code block
            </button>
          )}
        </div>
      )}
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
          ) : menuScratchId !== null ? (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  setRenaming(menuScratchId);
                }}
              >
                Rename…
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  downloadScratch(menuScratchId);
                }}
              >
                Download .bas
              </button>
              <div className={styles.menuSeparator} />
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  closeScratchBuffer(menuScratchId);
                }}
              >
                Close
              </button>
            </>
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
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  void loadBin(menuBlock);
                }}
              >
                Load bytes…
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
