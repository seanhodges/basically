import { useEffect, useMemo, useState } from 'react';
import { useIdeStore } from '../app/store';
import { dialects, getDialect } from '../dialects/registry';
import { groupMachinesByManufacturer } from './machinePicker';
import {
  getAiProvider,
  setAiProvider,
  getProviderApiKey,
  setProviderApiKey,
  getProviderMaxTokens,
  setProviderMaxTokens,
  getProviderEffort,
  setProviderEffort,
  hasProviderTuning,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_EFFORT,
} from '../storage/settings';
import { PROVIDERS, getProvider } from '../ai/providers/registry';
import { AI_EFFORTS } from '../ai/providers/types';
import type { AiEffort, AiProviderId } from '../ai/providers/types';
import {
  type GamepadMode,
  effectiveGamepadMode,
} from '../keyboard/controllerConfig';
import { openBinaryFile } from '../storage/files';
import { localStorageIsPersistent } from '../storage/safeStorage';
import { romUploadError, romInUseLabel } from './customRomUpload';
import styles from './SettingsForm.module.css';
import dialog from './Dialog.module.css';

export function SettingsForm() {
  const dialect = useIdeStore((s) => s.dialect);
  const autoLineNumbering = useIdeStore((s) => s.autoLineNumbering);
  const lineNumberIncrement = useIdeStore((s) => s.lineNumberIncrement);
  const showLineNumberGutter = useIdeStore((s) => s.showLineNumberGutter);
  const fullCodeCompletion = useIdeStore((s) => s.fullCodeCompletion);
  const setAutoLineNumbering = useIdeStore((s) => s.setAutoLineNumbering);
  const setLineNumberIncrement = useIdeStore((s) => s.setLineNumberIncrement);
  const setShowLineNumberGutter = useIdeStore((s) => s.setShowLineNumberGutter);
  const setFullCodeCompletion = useIdeStore((s) => s.setFullCodeCompletion);
  const crtEffect = useIdeStore((s) => s.crtEffect);
  const setCrtEffect = useIdeStore((s) => s.setCrtEffect);
  const keyboardAutoShow = useIdeStore((s) => s.keyboardAutoShow);
  const setKeyboardAutoShow = useIdeStore((s) => s.setKeyboardAutoShow);
  const keyboardSound = useIdeStore((s) => s.keyboardSound);
  const setKeyboardSound = useIdeStore((s) => s.setKeyboardSound);
  const keyboardHaptics = useIdeStore((s) => s.keyboardHaptics);
  const setKeyboardHaptics = useIdeStore((s) => s.setKeyboardHaptics);
  const keyboardKeyDisplay = useIdeStore((s) => s.keyboardKeyDisplay);
  const setKeyboardKeyDisplay = useIdeStore((s) => s.setKeyboardKeyDisplay);
  const emulatorSpeed = useIdeStore((s) => s.emulatorSpeed);
  const setEmulatorSpeed = useIdeStore((s) => s.setEmulatorSpeed);
  const emulatorAudio = useIdeStore((s) => s.emulatorAudio);
  const setEmulatorAudio = useIdeStore((s) => s.setEmulatorAudio);
  const runGateLint = useIdeStore((s) => s.runGateLint);
  const setRunGateLint = useIdeStore((s) => s.setRunGateLint);
  const emulatorVolume = useIdeStore((s) => s.emulatorVolume);
  const setEmulatorVolume = useIdeStore((s) => s.setEmulatorVolume);
  const controllerDpadMode = useIdeStore((s) => s.controllerDpadMode);
  const setControllerDpadMode = useIdeStore((s) => s.setControllerDpadMode);
  const controllerFireButtons = useIdeStore((s) => s.controllerFireButtons);
  const setControllerFireButtons = useIdeStore(
    (s) => s.setControllerFireButtons,
  );
  const gamepadMode = useIdeStore((s) => s.gamepadMode);
  const setGamepadMode = useIdeStore((s) => s.setGamepadMode);
  const customRoms = useIdeStore((s) => s.customRoms);
  const setCustomRom = useIdeStore((s) => s.setCustomRom);
  const clearCustomRom = useIdeStore((s) => s.clearCustomRom);
  const [romError, setRomError] = useState('');
  const settingsOpen = useIdeStore((s) => s.settingsOpen);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const [providerId, setProviderId] = useState<AiProviderId>(getAiProvider());
  const [key, setKey] = useState(getProviderApiKey(getAiProvider()));
  const [keySaved, setKeySaved] = useState(false);
  const [maxTokens, setMaxTokens] = useState(() =>
    getProviderMaxTokens(getAiProvider()),
  );
  const [effort, setEffort] = useState<AiEffort>(() =>
    getProviderEffort(getAiProvider()),
  );
  const provider = getProvider(providerId);
  const tab = useIdeStore((s) => s.settingsTab);
  const setTab = useIdeStore((s) => s.setSettingsTab);
  const tuned = hasProviderTuning(providerId);

  // Switching provider persists the choice and swaps every per-provider field to
  // that provider's own values, so each backend's key and tuning are kept
  // independently - the ceilings and the meaning of "effort" differ between them.
  const changeProvider = (id: AiProviderId) => {
    setProviderId(id);
    setAiProvider(id);
    setKey(getProviderApiKey(id));
    setMaxTokens(getProviderMaxTokens(id));
    setEffort(getProviderEffort(id));
    setKeySaved(false);
  };

  // Written through on change rather than behind a Save button: unlike the key,
  // there is nothing here worth losing to a closed dialog, and a number that
  // silently didn't apply is exactly the confusion this setting exists to end.
  const changeMaxTokens = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    const bounded = Math.min(Math.max(n, 1), provider.maxOutputTokens);
    setMaxTokens(bounded);
    setProviderMaxTokens(providerId, bounded);
  };

  const changeEffort = (next: AiEffort) => {
    setEffort(next);
    setProviderEffort(providerId, next);
  };

  const resetTuning = () => {
    setProviderMaxTokens(providerId, null);
    setProviderEffort(providerId, null);
    setMaxTokens(getProviderMaxTokens(providerId));
    setEffort(getProviderEffort(providerId));
  };

  const saveKey = () => {
    setProviderApiKey(providerId, key.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  /**
   * Which machine's ROM this section is about.
   *
   * Its own choice rather than the IDE's current machine, because the two
   * questions genuinely differ: the machine you are programming, and the machine
   * whose firmware you are installing. They were the same control until a
   * machine appeared whose image ships with nobody - the Altair - which the
   * picker hides until one is supplied (see `app/machineAvailability.ts`). With
   * no way to select that machine there was no way to reach its ROM settings
   * either, so the only route in was a self-hosted drop-in.
   *
   * It still *opens* on the current machine every time the settings are shown,
   * which is what makes the common case ("replace the ROM of the thing I am
   * looking at") a no-op.
   */
  const [romMachineId, setRomMachineId] = useState(dialect.id);
  const romShowing = settingsOpen || mobileTab === 'settings';
  useEffect(() => {
    // Both surfaces are covered: the desktop dialog unmounts when closed, but
    // the mobile layout keeps this form mounted behind a hidden tab, so
    // "opened" has to mean the tab as well as the dialog.
    if (romShowing) setRomMachineId(dialect.id);
  }, [romShowing, dialect.id]);
  const romDialect = getDialect(romMachineId);
  const customRom = customRoms[romDialect.id] ?? null;
  // The picker's own grouping, so the two lists name and order the machines
  // the same way. Every registered machine is listed, including the six whose
  // emulator loads its own ROM set: picking one answers "why can't I replace
  // this?" where leaving it out would only raise the question.
  const romMachineGroups = useMemo(
    () => groupMachinesByManufacturer(dialects),
    [],
  );

  const uploadRom = async () => {
    setRomError('');
    const picked = await openBinaryFile('.rom');
    if (!picked) return; // cancelled - not a failure, say nothing
    const problem = romUploadError(romDialect);
    if (problem) {
      setRomError(problem);
      return;
    }
    const result = setCustomRom(romDialect.id, picked.name, picked.bytes);
    if (!result.ok) setRomError(result.message);
  };

  const restoreRom = () => {
    setRomError('');
    clearCustomRom(romDialect.id);
  };

  const tabs = [
    { id: 'editor', label: 'Editor' },
    { id: 'emulator', label: 'Emulator' },
    { id: 'input', label: 'Input' },
    { id: 'ai', label: 'AI' },
  ] as const;

  return (
    <div className={styles.settingsForm}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.active : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'editor' && (
        <div role="tabpanel" className={styles.tabPanel}>
          <h3>Line numbering</h3>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={showLineNumberGutter}
              onChange={(e) => setShowLineNumberGutter(e.target.checked)}
            />
            Show line number gutter
          </label>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={autoLineNumbering}
              onChange={(e) => setAutoLineNumbering(e.target.checked)}
            />
            Automatic line numbering
          </label>
          <label className={styles.field}>
            Line number increment
            <input
              type="number"
              min={1}
              max={1000}
              value={lineNumberIncrement}
              disabled={!autoLineNumbering}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setLineNumberIncrement(Number.isFinite(n) && n >= 1 ? n : 10);
              }}
            />
          </label>
          <h3>Code completion</h3>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={fullCodeCompletion}
              onChange={(e) => setFullCodeCompletion(e.target.checked)}
            />
            Full code completion (expand keywords to blocks)
          </label>
        </div>
      )}

      {tab === 'emulator' && (
        <div role="tabpanel" className={styles.tabPanel}>
          <h3>Behaviour</h3>
          <label className={styles.field}>
            Emulation speed
            <select
              value={emulatorSpeed}
              onChange={(e) => setEmulatorSpeed(Number(e.target.value))}
            >
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
              <option value={8}>8×</option>
            </select>
          </label>
          <label
            className={styles.inline}
            title="When off, only tokenizer errors block Run; lint findings still underline in the editor"
          >
            <input
              type="checkbox"
              checked={runGateLint}
              onChange={(e) => setRunGateLint(e.target.checked)}
            />
            Block Run on editor lint errors
          </label>
          <h3>Graphics</h3>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={crtEffect}
              onChange={(e) => setCrtEffect(e.target.checked)}
            />
            CRT scanline effect
          </label>
          <h3>Audio</h3>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={emulatorAudio}
              onChange={(e) => setEmulatorAudio(e.target.checked)}
            />
            Enable emulator sound
          </label>
          <label className={styles.field}>
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={emulatorVolume}
              disabled={!emulatorAudio}
              onChange={(e) => setEmulatorVolume(Number(e.target.value))}
            />
          </label>
          <h3>Machine ROM</h3>
          <label className={styles.field}>
            Machine
            <select
              data-rom-machine
              value={romMachineId}
              onChange={(e) => {
                setRomError('');
                setRomMachineId(e.target.value);
              }}
            >
              {romMachineGroups.map((group) => (
                <optgroup key={group.manufacturer} label={group.manufacturer}>
                  {group.machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {romDialect.romBytes === undefined ? (
            <p>
              The {romDialect.name} emulator loads its own ROM set, so it
              can&apos;t be replaced here.
            </p>
          ) : (
            <>
              <p>{romInUseLabel(romDialect, customRom)}</p>
              <div className={styles.buttonRow}>
                <button type="button" onClick={() => void uploadRom()}>
                  Upload ROM image…
                </button>
                {/* Nothing to restore on a machine that bundles no image -
                    the button would offer to remove the only ROM it has. */}
                {romDialect.romBundled !== false && (
                  <button
                    type="button"
                    onClick={restoreRom}
                    disabled={!customRom}
                  >
                    Restore bundled ROM
                  </button>
                )}
              </div>
              {romError && (
                <p role="alert" className={styles.settingsError}>
                  {romError}
                </p>
              )}
              <p>
                The image is kept in this browser only, is never uploaded
                anywhere, and is not included in programs you publish.
              </p>
              {romDialect.romBundled === false && (
                <p>
                  Until you supply one, the {romDialect.name} is not offered in
                  the machine picker.
                </p>
              )}
              {!localStorageIsPersistent() && (
                <p role="alert" className={styles.settingsError}>
                  This browser is blocking site data, so a ROM you upload will
                  only last for this session.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'input' && (
        <div role="tabpanel" className={styles.tabPanel}>
          <h3>On-screen keyboard</h3>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={keyboardAutoShow}
              onChange={(e) => setKeyboardAutoShow(e.target.checked)}
            />
            Show automatically on focus
          </label>
          <label className={styles.field}>
            Key layout
            <select
              value={keyboardKeyDisplay}
              onChange={(e) =>
                setKeyboardKeyDisplay(e.target.value as 'authentic' | 'compact')
              }
            >
              <option value="authentic">Authentic</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={keyboardSound}
              onChange={(e) => setKeyboardSound(e.target.checked)}
            />
            Key click sound
          </label>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={keyboardHaptics}
              onChange={(e) => setKeyboardHaptics(e.target.checked)}
            />
            Haptic feedback
          </label>
          <h3>Virtual gamepad</h3>
          <label className={styles.field}>
            Input mode
            <select
              value={gamepadMode}
              onChange={(e) => setGamepadMode(e.target.value as GamepadMode)}
            >
              <option value="keymapped">Key mapped</option>
              <option value="native">Native Interface</option>
              <option value="kempston">Kempston</option>
            </select>
          </label>
          {gamepadMode !== 'keymapped' &&
            effectiveGamepadMode(dialect, gamepadMode) === 'keymapped' && (
              <p>
                {`${dialect.name} has no ${
                  gamepadMode === 'native'
                    ? 'native joystick interface'
                    : 'Kempston interface'
                } - the gamepad uses Key mapped here.`}
              </p>
            )}
          <label className={styles.field}>
            Gamepad layout
            <select
              value={`${controllerDpadMode}/${controllerFireButtons}`}
              onChange={(e) => {
                const [dpad, fire] = e.target.value.split('/');
                setControllerDpadMode(dpad as '4-way' | '8-way');
                setControllerFireButtons(Number(fire) as 1 | 2);
              }}
            >
              <option value="4-way/1">4-way, 1 button</option>
              <option value="8-way/1">8-way, 1 button</option>
              <option value="4-way/2">4-way, 2 buttons</option>
              <option value="8-way/2">8-way, 2 buttons</option>
            </select>
          </label>
          <p>
            Long-press a control on the on-screen gamepad to remap it to a
            different key.
          </p>
        </div>
      )}

      {tab === 'ai' && (
        <div role="tabpanel" className={styles.tabPanel}>
          <label className={styles.field}>
            AI provider
            <select
              value={providerId}
              onChange={(e) => changeProvider(e.target.value as AiProviderId)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            Code generation calls the {provider.label} API directly from your
            browser. Create an API key at{' '}
            <a href={provider.consoleUrl} target="_blank" rel="noreferrer">
              {provider.consoleLabel}
            </a>
            .
            <br />
            <br />
            The API key is stored separately in this browser&apos;s localStorage
            and sent only to {provider.apiHost}. Don&apos;t use this on a shared
            computer.
          </p>
          <label className={styles.field}>
            <span>{provider.label} API key</span>
            <input
              type="password"
              value={key}
              placeholder={provider.keyPlaceholder}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <div className={`${dialog.modalActions} ${dialog.left}`}>
            <button className="primary" onClick={saveKey}>
              Save API key
            </button>
            {keySaved && <span className={styles.settingsSaved}>Saved ✓</span>}
          </div>
          <label className={styles.field}>
            Maximum tokens
            <input
              type="number"
              min={1}
              max={provider.maxOutputTokens}
              step={1024}
              value={maxTokens}
              onChange={(e) => changeMaxTokens(e.target.value)}
            />
          </label>
          {provider.supportsEffort && (
            <label className={styles.field}>
              Thinking effort
              <select
                value={effort}
                onChange={(e) => changeEffort(e.target.value as AiEffort)}
              >
                {AI_EFFORTS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(tuned.maxTokens || tuned.effort) && (
            <div className={`${dialog.modalActions} ${dialog.left}`}>
              <button onClick={resetTuning}>
                Reset to defaults ({DEFAULT_AI_MAX_TOKENS} tokens
                {provider.supportsEffort ? `, ${DEFAULT_AI_EFFORT} effort` : ''}
                )
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
