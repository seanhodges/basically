import { useMemo } from 'react';
import {
  useIdeStore,
  selectActiveSource,
  selectVisibleProfile,
  selectVisibleTiming,
} from '../app/store';
import { outlineCapabilities } from '../editor/programOutline';
import {
  lineAllocations,
  lineShares,
  routineAllocations,
  routineShares,
  totalAllocated,
  type MemoryProfile,
} from '../app/runProfile';
import { formatTiming, TIMING_ENDINGS, type RunTiming } from '../app/runTiming';
import { canProfileRun } from '../ai/machineObservability';
import dialog from './Dialog.module.css';
import styles from './RunProfileDialog.module.css';

/**
 * Edit ▸ Run profile - where the last run's time and memory went.
 *
 * The per-line costs are drawn in the editor gutter, which is where a slow line
 * is actually found; this is the reading that a gutter cannot give - the totals
 * rolled up by routine, the memory account across the run, and which lines took
 * that memory. Clicking a line moves the editor to it, exactly as the outline
 * does.
 *
 * Time is reported as shares and memory in bytes. A cycle count means nothing
 * without the machine's clock rate, so "where did the time go" can only be
 * answered as a proportion; a byte needs no such conversion, and "how much
 * memory" is asked in bytes and answered in them.
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

/**
 * How long the run took, and how that timing ended.
 *
 * The ending is never dropped, however the run went: the same number means a
 * measurement of the program under one ending and nothing about the program at
 * all under another, and a duration that really means "until you pressed stop"
 * read as a completion time is the one mistake a stopwatch must not invite.
 */
function Timing({ timing, machine }: { timing: RunTiming; machine: string }) {
  return (
    <p className={styles.summary}>
      {formatTiming(timing.seconds)} of {machine} time -{' '}
      {TIMING_ENDINGS[timing.ending]}.
      {!timing.observesFinish &&
        ` The ${machine} cannot tell whether a BASIC program is still running, so it never reports one finishing: a timing on it ends when you stop the run or when execution pauses.`}
    </p>
  );
}

export function RunProfileDialog() {
  const open = useIdeStore((s) => s.runProfileOpen);
  const setOpen = useIdeStore((s) => s.setRunProfileOpen);
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore(selectActiveSource);
  const profile = useIdeStore(selectVisibleProfile);
  const timing = useIdeStore(selectVisibleTiming);
  const requestJumpToLine = useIdeStore((s) => s.requestJumpToLine);

  const shares = useMemo(() => lineShares(profile?.lines ?? []), [profile]);
  const caps = useMemo(
    () => outlineCapabilities(dialect.keywords),
    [dialect.keywords],
  );
  const routines = useMemo(
    () => routineShares(source, caps, shares),
    [source, caps, shares],
  );
  const memoryAccount = profile?.allocations ?? null;
  const taken = useMemo(
    () => lineAllocations(memoryAccount?.lines ?? []),
    [memoryAccount],
  );
  const takenByRoutine = useMemo(
    () => routineAllocations(source, caps, memoryAccount?.lines ?? []),
    [source, caps, memoryAccount],
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

        {/* The stopwatch first, and on every machine: how long a run took is
            the machine's frame rate and nothing else, so a machine that cannot
            say which line it is executing can still be timed. */}
        {timing ? (
          <Timing timing={timing} machine={dialect.name} />
        ) : (
          <p className={styles.empty}>Run this program to measure it.</p>
        )}

        {!canProfile ? (
          <p className={styles.empty}>
            The {dialect.name} does not report which BASIC line it is executing,
            so a run on it cannot be broken down line by line.
          </p>
        ) : !profile ? null : (
          <>
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
              <h3 className={styles.heading}>Memory use over time</h3>
              {profile.memory ? (
                <>
                  <MemoryChart memory={profile.memory} />
                  <p className={styles.summary}>
                    Peak: {profile.memory.peakUsed.toLocaleString()} /{' '}
                    {bytes(profile.memory.totalBytes)}
                    {profile.memory.partial &&
                      '. The chart covers the end of the run only; the peak is the whole run’s.'}
                  </p>
                </>
              ) : (
                <p className={styles.empty}>
                  The {dialect.name} does not report its BASIC memory figures.
                </p>
              )}
            </div>

            {/* Which line took it, which the chart above cannot say. Three
                readings, and they are three different answers: no figure was
                ever read, a figure was read and nothing moved, or here is where
                it went - measured where the machine priced the lines itself,
                and spread over them where it could not. */}
            <div className={styles.section}>
              <h3 className={styles.heading}>Where the memory went</h3>
              {!memoryAccount ? (
                <p className={styles.empty}>No memory readings</p>
              ) : taken.length > 0 ? (
                <>
                  {memoryAccount.accuracy === 'approximate' && (
                    // Above the list, so it is read before the figures are.
                    <p className={styles.summary}>
                      Approximate. The {dialect.name} never left a line while
                      memory was moving, so nothing could be charged to the line
                      that took it; each rise is spread over the lines running
                      at the time, in proportion to their share of the run’s
                      time. The line at the top may not be the line that took
                      the memory.
                    </p>
                  )}
                  {taken.slice(0, MAX_LINES).map((a) => (
                    <button
                      key={a.line}
                      className={styles.item}
                      onClick={() => jump(a.line)}
                    >
                      <span className={styles.lineNo}>{a.line}</span>
                      <span className={styles.bar}>
                        <span
                          className={`${styles.barFill} ${styles.barFillMemory}`}
                          style={{ width: `${a.share * 100}%` }}
                        />
                      </span>
                      <span className={styles.bytes}>
                        {a.bytes.toLocaleString()}
                      </span>
                    </button>
                  ))}
                  <p className={styles.summary}>
                    {bytes(totalAllocated(memoryAccount.lines))} taken in all.
                    {/* The flat accounting describes charging, so it belongs
                        only to a reading that charged: saying a line is charged
                        what it took itself, under figures that were spread over
                        the lines by their time, would contradict the note
                        above. What holds of both is the gross count. */}
                    {memoryAccount.accuracy === 'measured'
                      ? ' A line is charged what it took itself, never what the routines it calls took, and memory'
                      : ' Memory'}{' '}
                    BASIC reclaimed afterwards is not subtracted - so a line
                    that builds strings and lets them go still reads as having
                    taken them.
                  </p>
                </>
              ) : (
                <p className={styles.empty}>
                  No memory was taken over this run.
                </p>
              )}
            </div>

            {takenByRoutine.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.heading}>Memory by routine</h3>
                {takenByRoutine.map((r) => (
                  <button
                    key={r.lineNo}
                    className={styles.item}
                    onClick={() => jump(r.lineNo)}
                  >
                    <span className={styles.lineNo}>{r.lineNo}</span>
                    <span className={styles.title}>{r.title}</span>
                    <span className={styles.bytes}>
                      {r.bytes.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
