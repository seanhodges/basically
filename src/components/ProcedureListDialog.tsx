import { useMemo } from 'react';
import { useIdeStore } from '../app/store';
import { buildOutline, outlineCapabilities } from '../editor/programOutline';
import dialog from './Dialog.module.css';
import styles from './ProcedureListDialog.module.css';

/**
 * Edit ▸ Outline… — lists the open program's procedures, functions and the line
 * numbers GOSUB/GOTO jump to. Clicking an item moves the editor to that line.
 */
export function ProcedureListDialog() {
  const open = useIdeStore((s) => s.procedureListOpen);
  const setOpen = useIdeStore((s) => s.setProcedureListOpen);
  const source = useIdeStore((s) => s.source);
  const dialect = useIdeStore((s) => s.dialect);
  const requestJumpToLine = useIdeStore((s) => s.requestJumpToLine);

  const sections = useMemo(
    () => buildOutline(source, outlineCapabilities(dialect.keywords)),
    [source, dialect],
  );

  if (!open) return null;

  const jump = (lineNo: number) => {
    requestJumpToLine(lineNo);
    setOpen(false);
  };

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Program outline</h2>
        <div className={styles.list}>
          {sections.length === 0 ? (
            <p className={styles.empty}>
              No procedures, subroutines or jumps found.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.kind} className={styles.section}>
                <h3 className={styles.heading}>{section.heading}</h3>
                {section.items.map((item) => (
                  <button
                    key={`${item.kind}-${item.lineNo}-${item.title}`}
                    className={styles.item}
                    onClick={() => jump(item.lineNo)}
                  >
                    <span className={styles.lineNo}>{item.lineNo}</span>
                    <span className={styles.title}>{item.title}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
