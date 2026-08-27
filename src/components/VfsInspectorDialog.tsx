import { useState } from 'react';
import { useIdeStore } from '../app/store';
import { useDataBlocks } from '../app/dataBlocks';
import { dataBlockFileName, decodeDataText } from '../app/dataBlockFile';
import { downloadBlob } from '../storage/files';
import { formatHexDump } from '../storage/vfs/hexdump';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import type { DataBlock } from '../dialects/types';
import styles from './VfsInspectorDialog.module.css';
import dialog from './Dialog.module.css';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * "Emulator files" - every file a running program has saved, which is the tab
 * strip's overflow surface rather than a second list of the same thing: the
 * strip shows a bounded number of them and this shows them all.
 *
 * The same projection the tabs are drawn from, so a file reads here exactly as
 * it does in its tab - the bytes the program saved, with any container the
 * machine wrapped around them already off.
 */
export function VfsInspectorDialog() {
  const open = useIdeStore((s) => s.vfsInspectorOpen);
  const setOpen = useIdeStore((s) => s.setVfsInspectorOpen);
  const setActiveTab = useIdeStore((s) => s.setActiveTab);
  const dialect = useIdeStore((s) => s.dialect);
  const files = useDataBlocks();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  if (!open) return null;

  const selected = files.find((f) => f.name === selectedName) ?? null;

  const downloadBin = (file: DataBlock) =>
    downloadBlob(
      new Blob([file.bytes as BlobPart], { type: 'application/octet-stream' }),
      dataBlockFileName(file.name, '.bin'),
    );

  const downloadText = (file: DataBlock) =>
    downloadBlob(
      new Blob([decodeDataText(file.bytes, dialect.charset)], {
        type: 'text/plain',
      }),
      dataBlockFileName(file.name, '.txt'),
    );

  /** Show the file in its own tab, which is where it is read. */
  const openInTab = (file: DataBlock) => {
    setActiveTab({ kind: 'data', name: file.name });
    setOpen(false);
  };

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Emulator files</h2>
        <p>
          Files the program has saved to tape/disk/network. They stay after the
          machine stops, and are discarded when the program is run again, the
          machine is reset, or a different program is opened.
        </p>

        {files.length === 0 ? (
          <p className={styles.empty}>
            No files. Files appear here when the running program saves data.
          </p>
        ) : (
          <table className={styles.fileTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th className={styles.num}>Size</th>
                <th>Saved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.name}
                  className={f.name === selectedName ? styles.selected : ''}
                  onClick={() =>
                    setSelectedName(f.name === selectedName ? null : f.name)
                  }
                >
                  <td className={styles.name}>{f.name}</td>
                  <td>
                    {f.kind && <span className={styles.kind}>{f.kind}</span>}
                  </td>
                  <td className={styles.num}>{formatSize(f.bytes.length)}</td>
                  <td>{new Date(f.updatedAt).toLocaleTimeString()}</td>
                  <td className={styles.num}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openInTab(f);
                      }}
                    >
                      Open
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadBin(f);
                      }}
                    >
                      .bin
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadText(f);
                      }}
                    >
                      .txt
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        emulatorVfs.delete(f.name);
                        if (selectedName === f.name) setSelectedName(null);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selected && (
          <pre className={styles.hexView}>{formatHexDump(selected.bytes)}</pre>
        )}

        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
