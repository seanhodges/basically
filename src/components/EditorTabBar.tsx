// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from '../app/store';
import styles from './EditorTabBar.module.css';

/**
 * The editor pane's tab strip: the BASIC source plus one tab per memory
 * block. Rendered only when the document has blocks, so pure-BASIC documents
 * keep today's tabless editor. Lives inside `.editorPane`, above the editor,
 * so it composes with the mobile pane switcher unchanged.
 */
export function EditorTabBar() {
  const blocks = useIdeStore((s) => s.blocks);
  const activeBlockId = useIdeStore((s) => s.activeBlockId);
  const setActiveBlock = useIdeStore((s) => s.setActiveBlock);
  const asmErrorBlocks = useIdeStore((s) => s.asmErrorBlocks);

  if (blocks.length === 0) return null;

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
            block.kind === 'code'
              ? `${block.name} - machine code block`
              : `${block.name} - data block`
          }
          className={block.id === activeBlockId ? 'active' : ''}
          onClick={() => setActiveBlock(block.id)}
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
    </div>
  );
}
