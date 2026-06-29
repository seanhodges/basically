import { useState } from 'react';
import { useIdeStore } from '../app/store';
import {
  getAiProvider,
  setAiProvider,
  getProviderApiKey,
  setProviderApiKey,
} from '../storage/settings';
import { PROVIDERS, getProvider } from '../ai/providers/registry';
import type { AiProviderId } from '../ai/providers/types';
import {
  type GamepadMode,
  effectiveGamepadMode,
} from '../keyboard/controllerConfig';
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
  const emulatorVolume = useIdeStore((s) => s.emulatorVolume);
  const setEmulatorVolume = useIdeStore((s) => s.setEmulatorVolume);
  const controllerDpadMode = useIdeStore((s) => s.controllerDpadMode);
  const setControllerDpadMode = useIdeStore((s) => s.setControllerDpadMode);
  const resetController = useIdeStore((s) => s.resetController);
  const gamepadMode = useIdeStore((s) => s.gamepadMode);
  const setGamepadMode = useIdeStore((s) => s.setGamepadMode);
  const [providerId, setProviderId] = useState<AiProviderId>(getAiProvider());
  const [key, setKey] = useState(getProviderApiKey(getAiProvider()));
  const [keySaved, setKeySaved] = useState(false);
  const provider = getProvider(providerId);

  // Switching provider persists the choice and swaps the key field to that
  // provider's stored key, so each backend's key is kept independently.
  const changeProvider = (id: AiProviderId) => {
    setProviderId(id);
    setAiProvider(id);
    setKey(getProviderApiKey(id));
    setKeySaved(false);
  };

  const saveKey = () => {
    setProviderApiKey(providerId, key.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div className={styles.settingsForm}>
      <h3>Editor</h3>
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
      <label>
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
      <label className={styles.inline}>
        <input
          type="checkbox"
          checked={fullCodeCompletion}
          onChange={(e) => setFullCodeCompletion(e.target.checked)}
        />
        Full code completion (expand keywords to blocks)
      </label>
      <h3>Monitor</h3>
      <label className={styles.inline}>
        <input
          type="checkbox"
          checked={crtEffect}
          onChange={(e) => setCrtEffect(e.target.checked)}
        />
        CRT scanline effect
      </label>
      <label className={styles.inline}>
        Emulation speed
        <select
          value={emulatorSpeed}
          onChange={(e) => setEmulatorSpeed(Number(e.target.value))}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={8}>8×</option>
        </select>
      </label>
      <h3>Emulator audio</h3>
      <label className={styles.inline}>
        <input
          type="checkbox"
          checked={emulatorAudio}
          onChange={(e) => setEmulatorAudio(e.target.checked)}
        />
        Enable emulator sound
      </label>
      <label className={styles.inline}>
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
      <h3>On-screen keyboard</h3>
      <label className={styles.inline}>
        <input
          type="checkbox"
          checked={keyboardAutoShow}
          onChange={(e) => setKeyboardAutoShow(e.target.checked)}
        />
        Show automatically on focus
      </label>
      <label className={styles.inline}>
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
      <label className={styles.inline}>
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
      <p>
        {gamepadMode !== 'keymapped' &&
        effectiveGamepadMode(dialect, gamepadMode) === 'keymapped'
          ? `${dialect.name} has no ${
              gamepadMode === 'native'
                ? 'native joystick interface'
                : 'Kempston interface'
            } — the gamepad uses Key mapped here.`
          : 'Native Interface and Kempston drive the machine’s real joystick hardware; Key mapped presses keys instead.'}
      </p>
      <label className={styles.inline}>
        D-pad directions
        <select
          value={controllerDpadMode}
          onChange={(e) =>
            setControllerDpadMode(e.target.value as '4-way' | '8-way')
          }
        >
          <option value="4-way">4-way</option>
          <option value="8-way">8-way (diagonals)</option>
        </select>
      </label>
      <p>
        Long-press a control on the on-screen gamepad to remap it. These options
        apply to the current machine ({dialect.name}).
      </p>
      <div className={`${dialog.modalActions} ${dialog.left}`}>
        <button onClick={resetController}>Reset to defaults</button>
      </div>
      <h3>AI</h3>
      <label className={styles.inline}>
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
      </p>
      <label>
        {provider.label} API key
        <input
          type="password"
          value={key}
          placeholder={provider.keyPlaceholder}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <p className={dialog.modalWarning}>
        Each provider&apos;s key is stored separately in this browser&apos;s
        localStorage and sent only to {provider.apiHost}. Don&apos;t use this on
        a shared computer.
      </p>
      <div className={`${dialog.modalActions} ${dialog.left}`}>
        <button className="primary" onClick={saveKey}>
          Save API key
        </button>
        {keySaved && <span className={styles.settingsSaved}>Saved ✓</span>}
      </div>
    </div>
  );
}
