// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useDismiss } from '../app/useDismiss';
import { getDialect } from '../dialects/registry';
import { useAiStore } from '../ai/aiStore';
import { buildSystemPrompt, buildUserMessage } from '../ai/promptBuilder';
import { aiCredentials, hasAiKey } from '../ai/credentials';
import {
  AI_UNCONFIGURED_NOTE,
  projectFileName,
  startingDocument,
  type StartingPoint,
} from './newProjectOptions';
import { MachinePickerDialog } from './MachinePickerDialog';
import { MachineTrigger } from './MachineTrigger';
import dialog from './Dialog.module.css';
import styles from './NewProjectDialog.module.css';

/**
 * The New-project dialog - the single place a program starts. Choose the
 * machine, a name and what to start from (blank, a bundled sample, or a
 * description handed to the assistant), then create it in one go.
 *
 * Opened by File ▸ New (`newDocument`, which runs the discard guard first so
 * its `window.confirm` never lands under this modal) and by the first-launch
 * welcome's "Start coding" card. It never calls `setDialect`: the machine is
 * part of the choice, so `createProject` installs everything atomically rather
 * than raising the target-switch dialog or swapping in a sample nobody picked.
 */
export function NewProjectDialog() {
  const open = useIdeStore((s) => s.newProjectOpen);
  const setOpen = useIdeStore((s) => s.setNewProjectOpen);
  const activeDialectId = useIdeStore((s) => s.dialect.id);

  const [machineId, setMachineId] = useState(activeDialectId);
  const [name, setName] = useState('');
  const [startingPoint, setStartingPoint] = useState<StartingPoint>('blank');
  const [sampleName, setSampleName] = useState('');
  const [request, setRequest] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // The assistant cannot be configured while this modal is up, so key presence
  // is settled for the dialog's lifetime - read it when it opens.
  const [aiReady, setAiReady] = useState(false);

  const machine = getDialect(machineId);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Reset to "the machine you're on, and a blank program" each time it opens,
  // so Ctrl+N then Enter reproduces the old instant-blank behaviour.
  useEffect(() => {
    if (!open) return;
    setMachineId(activeDialectId);
    setName('');
    setStartingPoint('blank');
    setSampleName(getDialect(activeDialectId).samples[0]?.name ?? '');
    setRequest('');
    setPickerOpen(false);
    setAiReady(hasAiKey());
  }, [open, activeDialectId]);

  const cancel = () => setOpen(false);
  // While the machine picker is up it owns dismissal. The picker renders inside
  // this form, so an outside-click test already reads "inside", but Escape must
  // close only the picker - suspending this hook keeps exactly one modal
  // closing at a time. `useDismiss` re-arms in an effect after commit, so the
  // very keypress that closed the picker can never reach it.
  const ref = useDismiss<HTMLFormElement>(open && !pickerOpen, cancel);

  if (!open) return null;

  const samples = machine.samples;
  const sample = samples.find((s) => s.name === sampleName);
  const canDescribe = aiReady;

  /** Switching machine re-points the sample list at that machine's own samples. */
  const chooseMachine = (id: string) => {
    setMachineId(id);
    setSampleName(getDialect(id).samples[0]?.name ?? '');
    closePicker();
  };

  /** Hand focus back to the trigger, so the keyboard does not lose its place. */
  const closePicker = () => {
    setPickerOpen(false);
    triggerRef.current?.focus();
  };

  const create = () => {
    const { source, blocks } = startingDocument(machine, startingPoint, sample);
    useIdeStore.getState().createProject({
      dialectId: machine.id,
      source,
      fileName: projectFileName(name, machine),
      blocks,
    });
    setOpen(false);

    if (startingPoint !== 'describe') return;
    // Same hand-off as the docs drawer's compare actions: reveal the panel,
    // then ask. The option is disabled without a key, so this normally
    // resolves; keep the guard for the race where the key vanished.
    const creds = aiCredentials();
    if (!creds) return;
    useIdeStore.getState().showAiPanel();
    void useAiStore.getState().send({
      ...creds,
      maxTokens: machine.aiProfile.maxTokens,
      system: buildSystemPrompt(machine),
      userContent: buildUserMessage(request, '', []),
      displayRequest: request,
      // A description, not an edit: the assistant is shown no program.
      baseSource: '',
    });
  };

  const describeDisabled = !canDescribe;
  const createDisabled = startingPoint === 'describe' && request.trim() === '';

  return (
    <div
      className={dialog.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
    >
      {/* A form so Enter submits from any field - the keyboard path to a blank
          program stays Ctrl+N then Enter. */}
      <form
        ref={ref}
        className={dialog.modal}
        onSubmit={(e) => {
          e.preventDefault();
          if (!createDisabled) create();
        }}
      >
        <h2 id="new-project-title">Start a new project</h2>

        <h3>Machine</h3>
        <div className={styles.machineField}>
          <MachineTrigger
            ref={triggerRef}
            dialect={machine}
            onClick={() => setPickerOpen(true)}
            artSize={28}
            showYear
            className={styles.machineTrigger}
          />
        </div>
        <p className={styles.blurb}>{machine.blurb}</p>

        <label>
          Name
          <input
            autoFocus
            value={name}
            placeholder="untitled"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <h3>Start from</h3>
        <label className={dialog.inline}>
          <input
            type="radio"
            name="starting-point"
            checked={startingPoint === 'blank'}
            onChange={() => setStartingPoint('blank')}
          />
          Blank program
        </label>

        <label className={dialog.inline}>
          <input
            type="radio"
            name="starting-point"
            checked={startingPoint === 'sample'}
            disabled={samples.length === 0}
            onChange={() => setStartingPoint('sample')}
          />
          Sample
          <select
            aria-label="Sample program"
            value={sampleName}
            disabled={samples.length === 0}
            onChange={(e) => {
              setSampleName(e.target.value);
              setStartingPoint('sample');
            }}
          >
            {samples.map((s) => (
              <option key={s.name} value={s.name}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <label className={dialog.inline}>
          <input
            type="radio"
            name="starting-point"
            checked={startingPoint === 'describe'}
            disabled={describeDisabled}
            onChange={() => setStartingPoint('describe')}
          />
          Describe it
          <input
            aria-label="Describe the program"
            className={styles.request}
            value={request}
            placeholder="a snake game"
            disabled={describeDisabled}
            onChange={(e) => {
              setRequest(e.target.value);
              setStartingPoint('describe');
            }}
          />
        </label>
        {describeDisabled && (
          <p className={dialog.modalNote}>{AI_UNCONFIGURED_NOTE}</p>
        )}

        <div className={dialog.modalActions}>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button type="submit" disabled={createDisabled}>
            Create project
          </button>
        </div>

        {/* Inside the form on purpose: the form's own `useDismiss` closes on any
            pointerdown outside its subtree, and the picker's overlay would
            otherwise count as outside and take this dialog down with it. Its
            `position: fixed` still covers the viewport - nothing above it
            establishes a containing block. */}
        <MachinePickerDialog
          open={pickerOpen}
          selectedId={machineId}
          onChoose={chooseMachine}
          onDismiss={closePicker}
        />
      </form>
    </div>
  );
}
