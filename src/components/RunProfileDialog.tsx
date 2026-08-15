import { useMemo } from 'react';
import {
  useIdeStore,
  selectActiveSource,
  selectVisibleProfile,
} from '../app/store';
import { outlineCapabilities } from '../editor/programOutline';
import {
  lineShares,
  routineShares,
  type MemoryProfile,
} from '../app/runProfile';
import { canProfileRun } from '../ai/machineObservability';
import dialog from './Dialog.module.css';
import styles from './RunProfileDialog.module.css';

/**
 * Edit ▸ Run profile - where the last run's time and memory went.
 *
 * The per-line costs are drawn in the editor gutter, which is where a slow line
 * is actually found; this is the reading that a gutter cannot give - the totals
 * rolled up by routine, the memory account across the run, and the statement of
 * what the figures mean. Clicking a line moves the editor to it, exactly as the
 * outline does.
 *
 * Reports the buffer on screen, because that is what the gutter is marking; a
 * profile taken on another buffer is not shown against this one's lines.
 */

/** Hottest lines listed before the list becomes a wall of incidental ones. */
const MAX_LINES = 12;

/** Width and height the memory chart is drawn in, in its own SVG units. */
const CHART_W = 560;
const CHART_H = 120;

function percent(share: number): string {
  return `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`;
}

function bytes(n: number): string {
  return `${n.toLocaleString()} bytes`;
}

/**
 * The memory account as a filled line: BASIC RAM in use against the run's own
 * elapsed machine time.
 *
 * Scaled to the RAM the machine fitted rather than to the highest sample, so the
 * height of the line means "how full is memory" rather than "how does this
 * compare with itself" - a program using a tenth of the machine should look like
 * it, not fill the chart.
 */
function MemoryChart({ memory }: { memory: MemoryProfile }) {
  const { samples, totalBytes } = memory;
  if (samples.length < 2 || totalBytes <= 0) return null;
  const first = samples[0]!.at;
  const span = Math.max(1e-6, samples[samples.length - 1]!.at - first);
  const x = (at: number) => ((at - first) / span) * CHART_W;
  const y = (used: number) => CHART_H - (used / totalBytes) * CHART_H;
  const line = samples.map((s) => `${x(s.at)},${y(s.used)}`).join(' ');
  const area = `0,${CHART_H} ${line} ${CHART_W},${CHART_H}`;
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`BASIC RAM in use across the run, peaking at ${bytes(
        memory.peakUsed,
      )}`}
    >
      <polygon className={styles.chartArea} points={area} />
      <polyline className={styles.chartLine} points={line} />
    </svg>
  );
}

export function RunProfileDialog() {
  const open = useIdeStore((s) => s.runProfileOpen);
  const setOpen = useIdeStore((s) => s.setRunProfileOpen);
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore(selectActiveSource);
  const profile = useIdeStore(selectVisibleProfile);
  const requestJumpToLine = useIdeStore((s) => s.requestJumpToLine);

  const shares = useMemo(() => lineShares(profile?.lines ?? []), [profile]);
  const routines = useMemo(
    () => routineShares(source, outlineCapabilities(dialect.keywords), shares),
    [source, dialect, shares],
  );

  if (!open) return null;

  const jump = (lineNo: number) => {
    requestJumpToLine(lineNo);
    setOpen(false);
  };

  const canProfile = canProfileRun(dialect.id);
  const measured = shares.length > 0;

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Where the run went</h2>

        {!canProfile ? (
          <p className={styles.empty}>
            The {dialect.name} does not report which BASIC line it is executing,
            so a run on it cannot be timed line by line.
          </p>
        ) : !profile ? (
          <p className={styles.empty}>
            Run this program to measure it. Every run is measured; there is
            nothing to switch on.
          </p>
        ) : (
          <>
            <p className={styles.summary}>
              {profile.elapsed.toFixed(1)}s of {dialect.name} time.
            </p>

            {measured ? (
              <div className={styles.section}>
                <h3 className={styles.heading}>Hottest lines</h3>
                {shares.slice(0, MAX_LINES).map((s) => (
                  <button
                    key={s.line}
                    className={styles.item}
                    onClick={() => jump(s.line)}
                  >
                    <span className={styles.lineNo}>{s.line}</span>
                    <span className={styles.bar}>
                      <span
                        className={styles.barFill}
                        style={{ width: `${s.share * 100}%` }}
                      />
                    </span>
                    <span className={styles.share}>{percent(s.share)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>
                No line of this program has spent measurable time yet.
              </p>
            )}

            {routines.length > 0 && measured && (
              <div className={styles.section}>
                <h3 className={styles.heading}>By routine</h3>
                {routines.map((r) => (
                  <button
                    key={r.lineNo}
                    className={styles.item}
                    onClick={() => jump(r.lineNo)}
                  >
                    <span className={styles.lineNo}>{r.lineNo}</span>
                    <span className={styles.title}>{r.title}</span>
                    <span className={styles.share}>{percent(r.share)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.section}>
              <h3 className={styles.heading}>Memory across the run</h3>
              {profile.memory ? (
                <>
                  <MemoryChart memory={profile.memory} />
                  <p className={styles.summary}>
                    Peak {bytes(profile.memory.peakUsed)} of{' '}
                    {bytes(profile.memory.totalBytes)} fitted.
                    {profile.memory.partial &&
                      ' The chart covers the end of the run only; the peak is the whole run’s.'}
                  </p>
                </>
              ) : (
                <p className={styles.empty}>
                  The {dialect.name} does not report its BASIC memory figures.
                </p>
              )}
            </div>

            <p className={dialog.modalNote}>
              Times are the {dialect.name}’s own — what the program would take
              on the hardware — not time spent in the browser, so the emulation
              speed does not change them. A line’s cost is the time spent on
              that line alone: time inside a routine it calls is charged to that
              routine’s own lines, so a GOSUB reads as cheap however much work
              it sets off.
            </p>
          </>
        )}

        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
