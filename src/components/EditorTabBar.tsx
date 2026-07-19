// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from '../app/store';
import { useLongPress } from './useLongPress';
import styles from './EditorTabBar.module.css';

/**
 * The editor pane's tab strip: the BASIC source plus one tab per memory
 * block, then a plus button that creates a new block. Always visible for a
 * dialect with the `memoryBlocks` capability (every current dialect), so
 * block creation is discoverable on a pure-BASIC document. Lives inside
 * `.editorPane`, above the editor, so it composes with the mobile pane
 * switcher unchanged.
 *
 * Right-clicking or long-pressing a block tab asks to delete that block
 * (confirmed in the DeleteBlockDialog). The BASIC tab has no delete gesture -
 * the main program can never be deleted.
 */
export function EditorTabBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useIdeStore((s) => s.blocks);
  const activeBlockId = useIdeStore((s) => s.activeBlockId);
  const setActiveBlock = useIdeStore((s) => s.setActiveBlock);
  const addBlock = useIdeStore((s) => s.addBlock);
  const requestRemoveBlock = useIdeStore((s) => s.requestRemoveBlock);
  const asmErrorBlocks = useIdeStore((s) => s.asmErrorBlocks);
  const longPress = useLongPress<string>(requestRemoveBlock);

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
            ' (right-click or long-press to delete)'
          }
          className={block.id === activeBlockId ? 'active' : ''}
          onClick={() => {
            // Swallow the click that follows a completed long-press so the
            // tab doesn't also activate under the confirm dialog.
            if (!longPress.consumeFired()) setActiveBlock(block.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            requestRemoveBlock(block.id);
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
    </div>
  );
}
