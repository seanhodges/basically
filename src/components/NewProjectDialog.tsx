// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useDismiss } from '../app/useDismiss';
import { getDialect } from '../dialects/registry';
import { useRunnableMachines } from '../app/machineAvailability';
import { useAiStore } from '../ai/aiStore';
import { buildUserMessage, loadSystemPromptFor } from '../ai/promptBuilder';
import { aiCredentials, hasAiKey } from '../ai/credentials';
import {
  AI_UNCONFIGURED_NOTE,
  projectFileName,
  startingDocument,
  type StartingPoint,
} from './newProjectOptions';
import { MachinePickerDialog } from './MachinePickerDialog';
import { MachineTrigger } from './MachineTrigger';
import { TARGET_MACHINE_ROLE } from './machinePicker';
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
  // Mounted only while it is open, so every open starts from the state
  // constructors below rather than from a reset effect. The effect that used to
  // do the resetting ran after the dialog had already painted, so Ctrl+N and a
  // fast Enter could submit the *previous* visit's choice - creating the sample
  // last used instead of the blank program the keyboard path promises.
  return open ? <NewProjectForm /> : null;
}

function NewProjectForm() {
  const setOpen = useIdeStore((s) => s.setNewProjectOpen);
  const activeDialectId = useIdeStore((s) => s.dialect.id);

  // "The machine you're on, and a blank program", every time.
  const [machineId, setMachineId] = useState(activeDialectId);
  const [name, setName] = useState('');
  const [startingPoint, setStartingPoint] = useState<StartingPoint>('blank');
  const [sampleName, setSampleName] = useState(
    () => getDialect(activeDialectId).samples[0]?.name ?? '',
  );
  const [request, setRequest] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // The narrowing and the arrangement are the store's, not this dialog's: the
  // toolbar's picker shows the same list, and both survive a reload.
  const pickerQuery = useIdeStore((s) => s.machinePickerQuery);
  const pickerSort = useIdeStore((s) => s.machinePickerSort);
  const setPickerQuery = useIdeStore((s) => s.setMachinePickerQuery);
  const setPickerSort = useIdeStore((s) => s.setMachinePickerSort);

  // The assistant cannot be configured while this modal is up, so key presence
  // is settled for the dialog's lifetime - read it when it opens.
  const [aiReady] = useState(hasAiKey);

  const machine = getDialect(machineId);
  // The offerable machines: anything whose ROM is missing cannot start, so it
  // is not a choice. `machineId` is kept so the trigger and the list agree even
  // when the document is already on such a machine.
  const machines = useRunnableMachines(machineId);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cancel = () => setOpen(false);
  // While the machine picker is up it owns dismissal. The picker renders inside
  // this form, so an outside-click test already reads "inside", but Escape must
  // close only the picker - suspending this hook keeps exactly one modal
  // closing at a time. `useDismiss` re-arms in an effect after commit, so the
  // very keypress that closed the picker can never reach it.
  const ref = useDismiss<HTMLFormElement>(!pickerOpen, cancel);

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

  const create = async () => {
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
      system: await loadSystemPromptFor(machine, creds.providerId),
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
            role={TARGET_MACHINE_ROLE}
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
          machines={machines}
          selectedId={machineId}
          query={pickerQuery}
          sort={pickerSort}
          onQueryChange={setPickerQuery}
          onSortChange={setPickerSort}
          onChoose={chooseMachine}
          onDismiss={closePicker}
        />
      </form>
    </div>
  );
}
