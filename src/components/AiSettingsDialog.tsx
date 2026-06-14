import { useIdeStore } from '../app/store';
import { SettingsForm } from './SettingsForm';
import dialog from './Dialog.module.css';

export function AiSettingsDialog() {
  const open = useIdeStore((s) => s.settingsOpen);
  const setOpen = useIdeStore((s) => s.setSettingsOpen);

  if (!open) return null;

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <SettingsForm />
        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
