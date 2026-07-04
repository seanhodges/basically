import { useEffect, useState } from 'react';
import { useIdeStore } from '../app/store';
import { downloadBlob } from '../storage/files';
import { base64ToBytes } from '../storage/vfs/base64';
import { formatHexDump } from '../storage/vfs/hexdump';
import { getVfsCollection, type VfsFileDoc } from '../storage/vfs/db';
import styles from './VfsInspectorDialog.module.css';
import dialog from './Dialog.module.css';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * "Emulator files…" — inspects the virtual filesystem where a running
 * program's data file I/O lands (Spectrum tape CODE/DATA blocks, TRS-80
 * sequential files…). Reads the RxDB mirror reactively, so entries appear
 * live while the program runs and survive a breakpoint pause; the list
 * empties whenever the emulator starts or stops.
 */
export function VfsInspectorDialog() {
  const open = useIdeStore((s) => s.vfsInspectorOpen);
  const setOpen = useIdeStore((s) => s.setVfsInspectorOpen);
  const [files, setFiles] = useState<VfsFileDoc[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let sub: { unsubscribe(): void } | null = null;
    getVfsCollection().then((col) => {
      if (cancelled) return;
      sub = col.find().$.subscribe((docs) => {
        // Sort here rather than in the query: RxDB sorts need an index and
        // the handful of files never justifies one.
        const list = docs
          .map((d) => d.toJSON() as VfsFileDoc)
          .sort((a, b) => a.updatedAt - b.updatedAt);
        setFiles(list);
      });
    });
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [open]);

  if (!open) return null;

  const selected = files.find((f) => f.name === selectedName) ?? null;

  const download = (file: VfsFileDoc) => {
    const bytes = base64ToBytes(file.dataB64);
    downloadBlob(
      new Blob([bytes], { type: 'application/octet-stream' }),
      file.name,
    );
  };

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Emulator files</h2>
        <p>
          Files the running program has saved to tape/disk/network. 
          The files are cleared each time the emulator stops.
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
                  <td className={styles.num}>{formatSize(f.size)}</td>
                  <td>{new Date(f.updatedAt).toLocaleTimeString()}</td>
                  <td className={styles.num}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        download(f);
                      }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selected && (
          <pre className={styles.hexView}>
            {formatHexDump(base64ToBytes(selected.dataB64))}
          </pre>
        )}

        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
