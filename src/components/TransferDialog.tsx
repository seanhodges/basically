import { useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import {
  downloadBlob,
  saveTextFile,
  programNameFromFileName,
} from '../storage/files';
import { samplesToWav } from '../transfer/wav';
import { playSamples, type AudioPlayback } from '../transfer/audioPlayer';
import { sendOverSerial, webSerialSupported } from '../transfer/webserial';
import styles from './TransferDialog.module.css';
import dialog from './Dialog.module.css';

export function TransferDialog() {
  const open = useIdeStore((s) => s.transferOpen);
  const setOpen = useIdeStore((s) => s.setTransferOpen);
  const source = useIdeStore((s) => s.source);
  const fileName = useIdeStore((s) => s.fileName);
  const dialect = useIdeStore((s) => s.dialect);
  const dirty = useIdeStore((s) => s.dirty);
  const markSaved = useIdeStore((s) => s.markSaved);

  const [robust, setRobust] = useState(false);
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const playbackRef = useRef<AudioPlayback | null>(null);

  if (!open) return null;

  const guard = (fn: () => void | Promise<void>) => () => {
    setStatus('');
    Promise.resolve(fn()).catch((e: unknown) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
  };

  // The tape header / program name is inferred from the saved filename. The
  // save-first gate below ensures this reflects a real, deliberately-named file.
  const baseName = programNameFromFileName(fileName);
  const needsSave = dirty || fileName === 'untitled.bas';

  const saveBas = guard(async () => {
    const saved = await saveTextFile(fileName, source);
    if (saved !== null) {
      markSaved(saved);
      setStatus(`Saved ${saved}.`);
    }
  });

  const buildImage = (): Uint8Array => {
    const result = dialect.tokenize(source, { programName: baseName });
    if (result.errors.length > 0) {
      throw new Error(
        `Program has ${result.errors.length} error(s) — fix them first`,
      );
    }
    if (result.image.length === 0) throw new Error('Program is empty');
    return result.image;
  };

  const runFileTarget = (targetId: string) =>
    guard(async () => {
      const target = dialect.buildTargets.find((t) => t.id === targetId);
      if (!target) throw new Error(`No ${targetId} target for ${dialect.name}`);
      const blob = await target.build(source, { programName: baseName });
      downloadBlob(
        blob,
        `${baseName.toLowerCase()}.${target.fileExtension ?? 'bin'}`,
      );
      setStatus(`${target.label} done.`);
    });

  const playAudio = guard(async () => {
    const audio = dialect.audio;
    if (!audio)
      throw new Error(`${dialect.name} has no cassette audio support`);
    const samples = audio.buildSamples(source, baseName, robust);
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
    const samples = audio.buildSamples(source, baseName, robust);
    downloadBlob(
      samplesToWav(samples, audio.sampleRate),
      `${baseName.toLowerCase()}.wav`,
    );
    setStatus('.wav downloaded — play it into the machine at high volume.');
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

        {needsSave && (
          <div className={styles.transferGroup}>
            <p>
              Save your program to a <code>.bas</code> file before exporting —
              the tape header name is taken from the filename.
            </p>
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              <button onClick={saveBas}>Save as .bas…</button>
            </div>
          </div>
        )}

        {!needsSave && dialect.audio && (
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

        {!needsSave && (
          <div className={styles.transferGroup}>
            <h3>Files &amp; serial</h3>
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              {dialect.buildTargets
                // wav is offered through the cassette section above
                .filter((t) => !(dialect.audio && t.fileExtension === 'wav'))
                .map((t) => (
                  <button key={t.id} onClick={runFileTarget(t.id)}>
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
        )}

        {status && <p className={styles.transferStatus}>{status}</p>}
        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
