import { useState } from 'react';
import { useIdeStore } from '../app/store';
import { getApiKey, setApiKey } from '../storage/settings';

export function AiSettingsDialog() {
  const open = useIdeStore((s) => s.settingsOpen);
  const setOpen = useIdeStore((s) => s.setSettingsOpen);
  const [key, setKey] = useState(getApiKey());

  if (!open) return null;

  const save = () => {
    setApiKey(key.trim());
    setOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>AI settings</h2>
        <p>
          Code generation calls the Claude API directly from your browser.
          Create an API key at{' '}
          <a href="https://platform.claude.com/" target="_blank" rel="noreferrer">
            platform.claude.com
          </a>
          .
        </p>
        <label>
          Anthropic API key
          <input
            type="password"
            value={key}
            placeholder="sk-ant-…"
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
        </label>
        <p className="modal-warning">
          The key is stored only in this browser&apos;s localStorage and sent only to
          api.anthropic.com. Don&apos;t use this on a shared computer.
        </p>
        <div className="modal-actions">
          <button onClick={() => setOpen(false)}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
