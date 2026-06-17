import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { openBinaryFile } from '../storage/files';
import {
  listAudioInputs,
  startRecording,
  decodeWavFile,
  type AudioInputDevice,
  type RecordingSession,
} from '../transfer/audioRecorder';
import dialog from './Dialog.module.css';
import styles from './ImportDialog.module.css';

export function ImportDialog() {
  const open = useIdeStore((s) => s.importOpen);
  const setOpen = useIdeStore((s) => s.setImportOpen);
  const dialect = useIdeStore((s) => s.dialect);
  const dirty = useIdeStore((s) => s.dirty);
  const replaceDocument = useIdeStore((s) => s.replaceDocument);

  const [status, setStatus] = useState('');
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<RecordingSession | null>(null);

  const audio = dialect.audio;
  const canDecode = !!audio?.decodeSamples;

  // Populate the input list when the dialog opens (labels fill in once mic
  // permission has been granted, so we also refresh after recording starts).
  useEffect(() => {
    if (!open || !canDecode) return;
    listAudioInputs().then(setDevices, () => undefined);
  }, [open, canDecode]);

  if (!open) return null;

  const guard = (fn: () => void | Promise<void>) => () => {
    setStatus('');
    Promise.resolve(fn()).catch((e: unknown) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
  };

  const confirmDiscard = () =>
    !dirty || window.confirm('Discard unsaved changes?');

  const close = () => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setListening(false);
    setLevel(0);
    setOpen(false);
  };

  const loadProgram = (programName: string, source: string) => {
    if (!confirmDiscard()) return;
    replaceDocument(source, (programName.trim() || 'PROGRAM') + '.bas');
    setStatus(`Imported "${programName.trim() || 'PROGRAM'}".`);
    close();
  };

  const importBinary = (fmt: { extension: string; label: string }) =>
    guard(async () => {
      if (!confirmDiscard()) return;
      const opened = await openBinaryFile(fmt.extension);
      if (!opened) return;
      const text = dialect.detokenize(opened.bytes);
      const ext = new RegExp(`\\${fmt.extension}$`, 'i');
      replaceDocument(text, opened.name.replace(ext, '.bas'));
      setStatus(`Imported ${opened.name}.`);
      close();
    });

  const decode = (samples: Float32Array, sampleRate: number) => {
    const { programName, source } = audio!.decodeSamples!(samples, sampleRate);
    loadProgram(programName, source);
  };

  const listen = guard(async () => {
    const session = await startRecording({
      deviceId: deviceId || undefined,
      onLevel: setLevel,
    });
    sessionRef.current = session;
    setListening(true);
    setStatus('Listening… start the tape now.');
    // Permission is granted now, so device labels are available.
    listAudioInputs().then(setDevices, () => undefined);

    const { samples, sampleRate } = await session.done;
    sessionRef.current = null;
    setListening(false);
    setLevel(0);
    if (samples.length === 0) {
      setStatus('Stopped — nothing captured.');
      return;
    }
    setStatus('Decoding…');
    decode(samples, sampleRate);
  });

  const stopListening = () => sessionRef.current?.stop();

  const importWav = guard(async () => {
    const opened = await openBinaryFile('.wav');
    if (!opened) return;
    setStatus('Decoding…');
    const { samples, sampleRate } = await decodeWavFile(opened.bytes);
    decode(samples, sampleRate);
  });

  return (
    <div className={dialog.modalBackdrop} onClick={close}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Import a program</h2>

        {dialect.binaryImports && dialect.binaryImports.length > 0 && (
          <div className={styles.group}>
            <h3>From a file</h3>
            <p>Load a saved program image back into the editor.</p>
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              {dialect.binaryImports.map((fmt) => (
                <button key={fmt.extension} onClick={importBinary(fmt)}>
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {canDecode && (
          <div className={styles.group}>
            <h3>From cassette audio</h3>
            <p>
              Listen for a saved program — either with this device&apos;s
              microphone near the speaker, or with an aux/line-in lead from the
              machine&apos;s tape output. {audio!.saveInstructions}
            </p>
            <label>
              Audio input
              <select
                className={styles.device}
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                disabled={listening}
              >
                <option value="">Default input</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.meter} role="meter" aria-label="Input level">
              <div
                className={styles.meterFill}
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              {listening ? (
                <button onClick={stopListening}>■ Stop listening</button>
              ) : (
                <button onClick={listen}>● Listen for tape</button>
              )}
              <button onClick={importWav} disabled={listening}>
                Import .wav recording
              </button>
            </div>
          </div>
        )}

        {status && <p className={styles.status}>{status}</p>}
        <div className={dialog.modalActions}>
          <button onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}
