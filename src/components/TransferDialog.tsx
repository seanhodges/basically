import { useRef, useState } from 'react';
import { selectBlocks, useIdeStore } from '../app/store';
import { downloadBlob, programNameFromFileName } from '../storage/files';
import { UNTITLED_FILE_NAME } from '../storage/settings';
import { samplesToWav } from '../transfer/wav';
import { playSamples, type AudioPlayback } from '../transfer/audioPlayer';
import { sendOverSerial, webSerialSupported } from '../transfer/webserial';
import { fatalErrors } from '../dialects/types';
import styles from './TransferDialog.module.css';
import dialog from './Dialog.module.css';

/**
 * Resolve once the emulator reports stopped (its audio graph torn down), or
 * after a short timeout as a backstop so a wedged machine can't block export.
 */
function waitForEmulatorStopped(timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (useIdeStore.getState().emulatorStatus === 'stopped') {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, timeoutMs);
    const unsubscribe = useIdeStore.subscribe((s) => {
      if (s.emulatorStatus === 'stopped') {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

export function TransferDialog() {
  const open = useIdeStore((s) => s.transferOpen);
  const setOpen = useIdeStore((s) => s.setTransferOpen);
  const source = useIdeStore((s) => s.source);
  const fileName = useIdeStore((s) => s.fileName);
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useIdeStore((s) => s.blocks);
  // Blocks as the user sees them: for an in-listing dialect (ZX81/ZX80) these
  // are derived from the `#BIN` records in the program, whereas `blocks` (the
  // fixed-address store field) is empty for them.
  const documentBlocks = useIdeStore(selectBlocks);
  const requestStop = useIdeStore((s) => s.requestStop);

  const [robust, setRobust] = useState(false);
  const [loader, setLoader] = useState(true);
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);

  if (!open) return null;

  // In-listing dialects (ZX81/ZX80) keep machine code inside the BASIC program
  // itself, so it always exports with the program - no target flag or loader.
  const inListing = !!dialect.memoryBlocks?.inListing;
  // Whether any file target embeds the document's fixed-address memory blocks;
  // drives the auto-loader checkbox vs the blocks-are-dropped notice below.
  const blocksSupported = dialect.buildTargets.some((t) => t.supportsBlocks);
  // Fixed-address blocks an export could silently drop (empty for in-listing
  // dialects, whose code travels inside the program image instead).
  const hasFixedBlocks = blocks.length > 0;
  // Blocks to describe in the notice - derived from the listing when in-listing.
  const displayBlocks = inListing ? documentBlocks : blocks;
  const hasBlocks = displayBlocks.length > 0;

  const guard = (fn: () => void | Promise<void>) => () => {
    setStatus('');
    Promise.resolve(fn()).catch((e: unknown) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
  };

  // The tape header / program name is inferred from the filename. An untitled
  // program has no deliberate name yet, so it exports under the neutral
  // 'PROGRAM' header rather than 'UNTITLED'.
  const baseName =
    fileName === UNTITLED_FILE_NAME
      ? 'PROGRAM'
      : programNameFromFileName(fileName);

  const buildImage = (): Uint8Array => {
    const result = dialect.tokenize(source, { programName: baseName });
    // Only fatal (framing) errors block export; statement-shape lint keeps its
    // editor squiggle but the stored bytes are complete and ROM-faithful.
    const fatal = fatalErrors(result.errors);
    if (fatal.length > 0) {
      throw new Error(`Program has ${fatal.length} error(s) - fix them first`);
    }
    if (result.image.length === 0) throw new Error('Program is empty');
    return result.image;
  };

  const runFileTarget = (targetId: string) =>
    guard(async () => {
      const target = dialect.buildTargets.find((t) => t.id === targetId);
      if (!target) throw new Error(`No ${targetId} target for ${dialect.name}`);
      const files = await target.build(source, {
        programName: baseName,
        blocks,
        loader,
      });
      for (const file of files) downloadBlob(file.blob, file.fileName);
      setStatus(
        files.length === 1
          ? `${target.label} done.`
          : `${target.label} done (${files.length} files).`,
      );
    });

  // A file target that can't carry the document's memory blocks would silently
  // export the BASIC program only, so confirm before dropping them. Block-aware
  // targets (and documents with no blocks) export straight away.
  const chooseFileTarget = (targetId: string) => () => {
    const target = dialect.buildTargets.find((t) => t.id === targetId);
    if (target && !target.supportsBlocks && hasFixedBlocks) {
      setStatus('');
      setPendingTargetId(targetId);
      return;
    }
    runFileTarget(targetId)();
  };

  const pendingTarget = pendingTargetId
    ? dialect.buildTargets.find((t) => t.id === pendingTargetId)
    : null;

  const playAudio = guard(async () => {
    const audio = dialect.audio;
    if (!audio)
      throw new Error(`${dialect.name} has no cassette audio support`);
    // Cassette playback drives the same speaker output as the run-time emulator
    // audio. If the emulator kept sounding, its output would mix into the tape
    // tone and corrupt the loading routine - so stop it first (which also tears
    // down its AudioContext via the EmulatorPane dispose wiring) and wait until
    // it confirms stopped before emitting the tone.
    if (useIdeStore.getState().emulatorStatus !== 'stopped') {
      requestStop();
      await waitForEmulatorStopped();
    }
    const samples = audio.buildSamples(source, baseName, robust, {
      blocks,
      loader,
    });
    const playback = playSamples(samples, audio.sampleRate);
    playbackRef.current = playback;
    setPlaying(true);
    setStatus(
      `Playing ${playback.durationSeconds.toFixed(0)}s of cassette audio…`,
    );
    await playback.done;
    setPlaying(false);
    setStatus('Playback finished.');
  });

  const downloadWav = guard(() => {
    const audio = dialect.audio;
    if (!audio)
      throw new Error(`${dialect.name} has no cassette audio support`);
    const samples = audio.buildSamples(source, baseName, robust, {
      blocks,
      loader,
    });
    downloadBlob(
      samplesToWav(samples, audio.sampleRate),
      `${baseName.toLowerCase()}.wav`,
    );
    setStatus('.wav downloaded - play it into the machine at high volume.');
  });

  const stopAudio = () => {
    playbackRef.current?.cancel();
    setPlaying(false);
  };

  const sendSerial = guard(async () => {
    const image = buildImage();
    setStatus('Choose the bridge serial port…');
    await sendOverSerial(image, (p) =>
      setStatus(`Sending block ${p.sentBlocks}/${p.totalBlocks}…`),
    );
    setStatus('Transfer complete.');
  });

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Run on real hardware</h2>

        {hasBlocks && (
          <div className={styles.transferGroup}>
            <h3>Memory blocks</h3>
            {inListing ? (
              <p>
                The document&apos;s {displayBlocks.length} memory{' '}
                {displayBlocks.length === 1 ? 'block is' : 'blocks are'} stored
                inside the program itself, so every export — and the serial
                bridge — carries {displayBlocks.length === 1 ? 'it' : 'them'}{' '}
                automatically.
              </p>
            ) : blocksSupported ? (
              <>
                <p>
                  The document&apos;s {displayBlocks.length} memory{' '}
                  {displayBlocks.length === 1 ? 'block is' : 'blocks are'}{' '}
                  included in the export (the serial bridge sends the BASIC
                  program only).
                </p>
                <label className={dialog.inline}>
                  <input
                    type="checkbox"
                    checked={loader}
                    onChange={(e) => setLoader(e.target.checked)}
                  />
                  Add an auto-loader (loads every block, then runs the program)
                </label>
              </>
            ) : (
              <p>
                This machine&apos;s export formats don&apos;t carry memory
                blocks yet - exports include the BASIC program only.
              </p>
            )}
          </div>
        )}

        {dialect.audio && (
          <div className={styles.transferGroup}>
            <h3>Cassette audio</h3>
            <p>
              Connect this device&apos;s headphone output to the machine&apos;s
              EAR socket and set the volume to maximum.{' '}
              {dialect.audio.loadInstructions}
            </p>
            <label className={dialog.inline}>
              <input
                type="checkbox"
                checked={robust}
                onChange={(e) => setRobust(e.target.checked)}
              />
              Robust mode (slower encoding, for temperamental hardware)
            </label>
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              {playing ? (
                <button onClick={stopAudio}>■ Stop audio</button>
              ) : (
                <button onClick={playAudio}>▶ Play through speakers</button>
              )}
              <button onClick={downloadWav}>Download .wav</button>
            </div>
          </div>
        )}

        <div className={styles.transferGroup}>
          <h3>Files &amp; serial</h3>
          <div className={`${dialog.modalActions} ${dialog.left}`}>
            {dialect.buildTargets
              // wav is offered through the cassette section above
              .filter((t) => !(dialect.audio && t.fileExtension === 'wav'))
              .map((t) => (
                <button key={t.id} onClick={chooseFileTarget(t.id)}>
                  {t.label}
                </button>
              ))}
            <button
              onClick={sendSerial}
              disabled={!webSerialSupported()}
              title={
                webSerialSupported()
                  ? 'Send to a microcontroller bridge (see docs/serial-protocol.md)'
                  : 'WebSerial needs Chrome or Edge'
              }
            >
              Send via serial bridge
            </button>
          </div>
        </div>

        {pendingTarget && (
          <div className={styles.transferGroup}>
            <p className={dialog.modalWarning}>
              {pendingTarget.label} exports the BASIC program only — the
              document&apos;s {blocks.length} memory{' '}
              {blocks.length === 1 ? 'block' : 'blocks'} won&apos;t be included.
              Export anyway?
            </p>
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              <button
                onClick={() => {
                  const id = pendingTarget.id;
                  setPendingTargetId(null);
                  runFileTarget(id)();
                }}
              >
                Export anyway
              </button>
              <button onClick={() => setPendingTargetId(null)}>Cancel</button>
            </div>
          </div>
        )}

        {status && <p className={styles.transferStatus}>{status}</p>}
        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
