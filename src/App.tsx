import { useEffect } from 'react';
import { useIdeStore } from './app/store';
import { Toolbar } from './components/Toolbar';
import { CodeMirrorHost } from './components/CodeMirrorHost';
import { EmulatorPane } from './components/EmulatorPane';
import { AiPanel } from './components/AiPanel';
import { AiSettingsDialog } from './components/AiSettingsDialog';
import { TransferDialog } from './components/TransferDialog';
import { StatusBar } from './components/StatusBar';
import { saveAutosave } from './storage/settings';

export default function App() {
  const dialect = useIdeStore((s) => s.dialect);
  const docOverride = useIdeStore((s) => s.docOverride);
  const setSource = useIdeStore((s) => s.setSource);
  const aiPanelOpen = useIdeStore((s) => s.aiPanelOpen);
  const requestRun = useIdeStore((s) => s.requestRun);

  // Autosave the document every 2s while dirty
  useEffect(() => {
    const interval = setInterval(() => {
      const { dirty, fileName, source } = useIdeStore.getState();
      if (dirty) saveAutosave(fileName, source);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Ctrl/Cmd+Enter = run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        requestRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestRun]);

  return (
    <div className="app">
      <Toolbar />
      <div className={`workspace ${aiPanelOpen ? 'with-ai' : ''}`}>
        <div className="editor-pane">
          <CodeMirrorHost dialect={dialect} override={docOverride} onChange={setSource} />
        </div>
        <EmulatorPane />
        {aiPanelOpen && <AiPanel />}
      </div>
      <StatusBar />
      <AiSettingsDialog />
      <TransferDialog />
    </div>
  );
}
