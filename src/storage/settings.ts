const KEYS = {
  apiKey: 'mbide.anthropicApiKey',
  autosaveDoc: 'mbide.autosave.doc',
  autosaveName: 'mbide.autosave.name',
} as const;

export function getApiKey(): string {
  return localStorage.getItem(KEYS.apiKey) ?? '';
}

export function setApiKey(key: string): void {
  if (key === '') localStorage.removeItem(KEYS.apiKey);
  else localStorage.setItem(KEYS.apiKey, key);
}

export function loadAutosave(): { name: string; text: string } | null {
  const text = localStorage.getItem(KEYS.autosaveDoc);
  if (text === null) return null;
  return { name: localStorage.getItem(KEYS.autosaveName) ?? 'untitled.bas', text };
}

export function saveAutosave(name: string, text: string): void {
  try {
    localStorage.setItem(KEYS.autosaveDoc, text);
    localStorage.setItem(KEYS.autosaveName, name);
  } catch {
    // quota exceeded — autosave is best-effort
  }
}
