// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIdeStore, useBlocks, tabKey, type ActiveTab } from '../app/store';
import { useDataBlocks } from '../app/dataBlocks';
import { decodeDataText, dataBlockFileName } from '../app/dataBlockFile';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import { useDismiss } from '../app/useDismiss';
import { useLongPress } from './useLongPress';
import { asmEngineFor } from '../asm/registry';
import { downloadBlob, openBinaryFile, withExtension } from '../storage/files';
import { loadBytes } from '../app/byteEdit';
import {
  fitTabs,
  rankOf,
  MAX_DATA_TABS,
  type StripTab,
} from '../app/tabOverflow';
import type { Block, DataBlock } from '../dialects/types';
import styles from './EditorTabBar.module.css';

/**
 * Which tab a context menu belongs to: the BASIC source tab, a memory block by
 * id, a scratch buffer by id, or a saved data file by name.
 */
type TabTarget =
  | { kind: 'basic' }
  | { kind: 'block'; blockId: string }
  | { kind: 'scratch'; scratchId: string }
  | { kind: 'data'; name: string };

/** An open tab context menu: which tab, anchored where (viewport px). */
interface TabMenu {
  target: TabTarget;
  x: number;
  y: number;
}

/** A tab as the fit rule ranks it and the overflow menu lists it. */
interface MenuTab extends StripTab {
  name: string;
  /** The kind glyph the tab wears, so the menu reads as the strip does. */
  glyph?: string;
  /** What showing it from the menu selects. */
  tab: ActiveTab;
}

/** Keep the fixed-position menu inside the viewport's right edge. */
const MENU_WIDTH_PX = 160;

/**
 * The width set aside for each of the two buttons after the tabs - the one that
 * adds a tab, and the one that lists the tabs there was no room for.
 *
 * A constant rather than a measurement: measuring the overflow button would mean
 * its width deciding whether it is drawn at all, and a border case could flip
 * between the two on every frame. Generous enough for `.addTab`'s minimum plus
 * its padding at the widest count either button shows.
 */
const TRAILING_BUTTON_PX = 56;

/** `.tabBar`'s gap, which each tab costs the strip on top of its own width. */
const TAB_GAP_PX = 2;

/**
 * The editor pane's tab strip: the BASIC source, one tab per memory block, then
 * one per scratch buffer, then a plus button whose menu creates either. Always
 * rendered - scratch buffers are dialect-independent, so the strip is not gated
 * on the `memoryBlocks` capability (only the block tabs and the new-block menu
 * item are). Lives inside `.editorPane`, above the editor, so it composes with
 * the mobile pane switcher unchanged.
 *
 * After the blocks come the files the running program has saved - the tab
 * strip's only tabs that are not part of the document at all, arriving as the
 * program writes them and gone with the next run.
 *
 * The strip does not scroll. It shows the tabs it has room for and lists the
 * rest under a count button at its end: the BASIC tab is pinned first, and the
 * width left over goes to the most recently used of the others (see
 * `src/app/tabOverflow.ts`, which holds the rule and the reason for each part of
 * it). The tabs that show keep the order below, so a tab does not move under the
 * pointer as it is used; a tab that does not show stays rendered but offstage,
 * because its width is what says whether it fits.
 *
 * Right-clicking or long-pressing a tab opens a context menu. The BASIC tab
 * offers "Download .bas" (the single-file export that used to be File → Save's
 * plain-text listing). A block tab offers "Download .bin" (its bytes),
 * "Load bytes…" (the inbound half of that download) and, for a code block,
 * "Download .asm" (its assembly source), plus "Settings" (the block-metadata
 * dialog) and "Delete" (the confirm-delete dialog) - the main program can never
 * be deleted. A scratch tab offers "Rename", "Download .bas" and "Close";
 * closing is unconfirmed, since a scratch buffer is disposable by definition.
 * A data tab offers "Download .bin" (the bytes as saved), "Download .txt" (the
 * same bytes read through the machine's own character set, which is what a
 * `PRINT#` file is) and "Delete" - unconfirmed, like a scratch buffer's Close,
 * since the file is program output and re-running produces it again.
 */
export function EditorTabBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useBlocks();
  const dataBlocks = useDataBlocks();
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
  const tabTouchedAt = useIdeStore((s) => s.tabTouchedAt);

  const [menu, setMenu] = useState<TabMenu | null>(null);
  // The plus button's menu (new scratch buffer / new block), anchored under the
  // button rather than at a pointer position.
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  // The count button's menu, listing the tabs there was no room for. Anchored
  // the same way, and the same shape - it is the tab strip's third menu, not a
  // surface of its own.
  const [overflowMenu, setOverflowMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
  const overflowMenuRef = useDismiss<HTMLDivElement>(
    overflowMenu !== null,
    () => setOverflowMenu(null),
  );
  const longPress = useLongPress<TabTarget>(openMenu);

  // What the fit is decided from: the strip's own width, and each tab's.
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(0);
  const tabEls = useRef(new Map<string, HTMLElement>());
  const [widths, setWidths] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  /** Hold each rendered tab's element, offstage ones included - they are the
   *  ones whose width would otherwise be unknowable. */
  const measureRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) tabEls.current.set(key, el);
      else tabEls.current.delete(key);
    },
    [],
  );

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    // contentRect excludes the strip's own padding, which is what the tabs
    // actually have to fit inside.
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBarWidth(entry.contentRect.width);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // After every render, and deliberately so: a tab's width changes with its own
  // name as much as with the tabs around it, and handing back the same map when
  // nothing moved is what stops that from chaining. A width already taken is
  // kept rather than re-measured, because a scratch tab mid-rename is an input
  // rather than a tab - dropping its width there would drop the buffer out of
  // the strip while it is being renamed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    setWidths((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!tabEls.current.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      for (const [key, el] of tabEls.current) {
        const width = el.offsetWidth + TAB_GAP_PX;
        // A tab not yet laid out measures nothing; leaving it unmeasured reads
        // as "shows for free", which is the right guess for the one frame.
        if (el.offsetWidth > 0 && next.get(key) !== width) {
          next.set(key, width);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

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
  const downloadBin = (block: Block) => {
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
  const loadBin = async (block: Block) => {
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

  /** Download a saved file's bytes as `<name>.bin`. */
  const downloadDataBin = (file: DataBlock) => {
    downloadBlob(
      new Blob([file.bytes as BlobPart], { type: 'application/octet-stream' }),
      dataBlockFileName(file.name, '.bin'),
    );
  };

  /** Download a saved file as text, through the machine's own character set. */
  const downloadDataText = (file: DataBlock) => {
    downloadBlob(
      new Blob([decodeDataText(file.bytes, dialect.charset)], {
        type: 'text/plain',
      }),
      dataBlockFileName(file.name, '.txt'),
    );
  };

  /**
   * Discard a saved file. A delete against the store the file lives in - there
   * is no copy of it anywhere else - and the projection follows.
   */
  const deleteDataFile = (name: string) => {
    emulatorVfs.delete(name);
    if (activeTab.kind === 'data' && activeTab.name === name) {
      setActiveTab({ kind: 'basic' });
    }
  };

  /** Download a code block's assembly source as `<name>.asm`. */
  const downloadAsm = (block: Block) => {
    const asm =
      block.asmSource ??
      asmEngine
        ?.disassembleReachable(block.bytes, block.address)
        .map((l) => l.text)
        .join('\n') ??
      '';
    downloadBlob(new Blob([asm], { type: 'text/plain' }), `${block.name}.asm`);
  };

  let menuBlock: Block | null = null;
  if (menu && menu.target.kind === 'block') {
    const { blockId } = menu.target;
    menuBlock = blocks.find((b) => b.id === blockId) ?? null;
  }
  const menuScratchId =
    menu?.target.kind === 'scratch' ? menu.target.scratchId : null;
  let menuDataFile: DataBlock | null = null;
  if (menu && menu.target.kind === 'data') {
    const { name } = menu.target;
    menuDataFile = dataBlocks.find((f) => f.name === name) ?? null;
  }
  // Every tab there is, in the order the strip draws them - carrying what the
  // overflow menu needs to list a tab as well as what the fit needs to choose
  // it. A data tab carries the time the program wrote it: that is what it ranks
  // by until the user shows it, so a file just saved appears on its own.
  const allTabs = useMemo<MenuTab[]>(
    () => [
      { key: 'basic', kind: 'basic', name: 'BASIC', tab: { kind: 'basic' } },
      ...blocks.map((b) => ({
        key: tabKey({ kind: 'block', id: b.id }),
        kind: 'block' as const,
        name: b.name,
        glyph: b.kind === 'code' ? '⚙' : '▤',
        tab: { kind: 'block' as const, id: b.id },
      })),
      ...scratchBuffers.map((b) => ({
        key: tabKey({ kind: 'scratch', id: b.id }),
        kind: 'scratch' as const,
        name: b.name,
        glyph: '✎',
        tab: { kind: 'scratch' as const, id: b.id },
      })),
      ...dataBlocks.map((f) => ({
        key: tabKey({ kind: 'data', name: f.name }),
        kind: 'data' as const,
        updatedAt: f.updatedAt,
        name: f.name,
        glyph: '🖫',
        tab: { kind: 'data' as const, name: f.name },
      })),
    ],
    [blocks, scratchBuffers, dataBlocks],
  );

  /**
   * The tabs actually rendered, which is where a program saving in a loop is
   * held in check: a tab has to be in the DOM to be measured, and the fit will
   * never show more than `MAX_DATA_TABS` files however many there are, so
   * rendering past the most recent that many - plus the one being shown, which
   * has to be somewhere - buys nothing and would let the strip's DOM grow with
   * the file store. The files past it are still named in the overflow menu,
   * which lists rather than measures.
   */
  const activeKey = tabKey(activeTab);
  const renderable = useMemo(() => {
    const files = allTabs.filter((t) => t.kind === 'data');
    if (files.length <= MAX_DATA_TABS) return allTabs;
    const keep = new Set(
      [...files]
        .sort((a, b) => rankOf(b, tabTouchedAt) - rankOf(a, tabTouchedAt))
        .slice(0, MAX_DATA_TABS)
        .map((t) => t.key),
    );
    keep.add(activeKey);
    return allTabs.filter((t) => t.kind !== 'data' || keep.has(t.key));
  }, [allTabs, tabTouchedAt, activeKey]);

  const { shown } = fitTabs({
    tabs: renderable,
    widths,
    touchedAt: tabTouchedAt,
    barWidth,
    addWidth: TRAILING_BUTTON_PX,
    overflowWidth: TRAILING_BUTTON_PX,
  });
  const shownKeys = new Set(shown.map((t) => t.key));
  // Everything not on the strip, whether it lost the fit or was never rendered
  // to compete in it.
  const hidden = allTabs.filter((t) => !shownKeys.has(t.key));
  const renderedKeys = new Set(renderable.map((t) => t.key));
  const offstage = (key: string) => !shownKeys.has(key);
  /** A tab's class list: active underline, and offstage when it did not fit. */
  const tabClass = (key: string, active: boolean) =>
    [active ? 'active' : '', offstage(key) ? styles.offstage : '']
      .filter(Boolean)
      .join(' ');
  /**
   * What takes an offstage tab out of the strip's reach without taking it out
   * of the DOM: `.offstage` already stops the pointer, and these stop the
   * keyboard and the screen reader. The overflow menu lists it instead.
   */
  const offstageProps = (key: string) =>
    offstage(key) ? { 'aria-hidden': true, tabIndex: -1 } : {};

  return (
    <div
      ref={barRef}
      className={styles.tabBar}
      role="tablist"
      aria-label="Editor content"
    >
      <button
        ref={measureRef('basic')}
        role="tab"
        aria-selected={activeTab.kind === 'basic'}
        aria-label="BASIC"
        title="BASIC - right-click or long-press to download"
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
          ref={measureRef(tabKey({ kind: 'block', id: block.id }))}
          {...offstageProps(tabKey({ kind: 'block', id: block.id }))}
          role="tab"
          aria-selected={
            activeTab.kind === 'block' && activeTab.id === block.id
          }
          aria-label={block.name}
          title={
            (block.kind === 'code'
              ? `${block.name} - machine code block`
              : `${block.name} - memory block`) +
            ' (right-click or long-press for options)'
          }
          className={tabClass(
            tabKey({ kind: 'block', id: block.id }),
            activeTab.kind === 'block' && activeTab.id === block.id,
          )}
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
              aria-label="Does not assemble"
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
            ref={measureRef(tabKey({ kind: 'scratch', id: buffer.id }))}
            {...offstageProps(tabKey({ kind: 'scratch', id: buffer.id }))}
            role="tab"
            aria-selected={
              activeTab.kind === 'scratch' && activeTab.id === buffer.id
            }
            aria-label={buffer.name}
            title={`${buffer.name} - scratch buffer, not part of the document (right-click or long-press for options)`}
            className={tabClass(
              tabKey({ kind: 'scratch', id: buffer.id }),
              activeTab.kind === 'scratch' && activeTab.id === buffer.id,
            )}
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
      {dataBlocks
        .filter((f) => renderedKeys.has(tabKey({ kind: 'data', name: f.name })))
        .map((file) => (
          <button
            key={file.name}
            ref={measureRef(tabKey({ kind: 'data', name: file.name }))}
            {...offstageProps(tabKey({ kind: 'data', name: file.name }))}
            role="tab"
            aria-selected={
              activeTab.kind === 'data' && activeTab.name === file.name
            }
            aria-label={file.name}
            title={`${file.name} - saved by the program, read-only (right-click or long-press for options)`}
            className={tabClass(
              tabKey({ kind: 'data', name: file.name }),
              activeTab.kind === 'data' && activeTab.name === file.name,
            )}
            onClick={() => {
              if (!longPress.consumeFired())
                setActiveTab({ kind: 'data', name: file.name });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(
                { kind: 'data', name: file.name },
                { x: e.clientX, y: e.clientY },
              );
            }}
            {...longPress.bind({ kind: 'data', name: file.name })}
          >
            {/* Its own glyph: not the document's (⚙ code, ▤ memory), and not the
              scratch buffer's ✎ - this is what the machine wrote. */}
            <span className={styles.kindGlyph} aria-hidden="true">
              🖫
            </span>
            <span className={styles.tabName}>{file.name}</span>
          </button>
        ))}
      {hidden.length > 0 && (
        <button
          className={styles.addTab}
          aria-haspopup="menu"
          aria-expanded={overflowMenu !== null}
          aria-label={`Show one of ${hidden.length} more tabs`}
          title={`Show one of ${hidden.length} more ${
            hidden.length === 1 ? 'tab' : 'tabs'
          } - there is no room for ${hidden.length === 1 ? 'it' : 'them'} here`}
          onClick={(e) => {
            if (overflowMenu !== null) {
              setOverflowMenu(null);
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            setOverflowMenu({
              x: Math.min(rect.left, window.innerWidth - MENU_WIDTH_PX),
              y: rect.bottom,
            });
          }}
        >
          +{hidden.length}
        </button>
      )}
      <button
        className={styles.addTab}
        aria-label="Add a tab"
        aria-haspopup="menu"
        aria-expanded={addMenu !== null}
        title="Add a tab - a scratch buffer or a machine code block"
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
          aria-label="Add a tab"
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
      {overflowMenu && (
        <div
          ref={overflowMenuRef}
          className={styles.contextMenu}
          role="menu"
          aria-label="Tabs there is no room for"
          style={{ left: overflowMenu.x, top: overflowMenu.y }}
        >
          {hidden.map((t) => (
            <button
              key={t.key}
              role="menuitem"
              onClick={() => {
                setOverflowMenu(null);
                // Showing it stamps it, and the stamp is what brings it into
                // the strip on the next render - there is no second rule making
                // room for the tab the user just chose.
                setActiveTab(t.tab);
              }}
            >
              {t.glyph && (
                <span className={styles.kindGlyph} aria-hidden="true">
                  {t.glyph}
                </span>
              )}
              <span className={styles.tabName}>{t.name}</span>
            </button>
          ))}
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
          ) : menuDataFile ? (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  downloadDataBin(menuDataFile);
                }}
              >
                Download .bin
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  downloadDataText(menuDataFile);
                }}
              >
                Download .txt
              </button>
              <div className={styles.menuSeparator} />
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  deleteDataFile(menuDataFile.name);
                }}
              >
                Delete
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
