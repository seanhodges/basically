// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { forwardRef } from 'react';
import { MachineArt } from './machineArt';
import {
  machineSummary,
  machineTriggerLabel,
  type MachineLike,
} from './machinePicker';
import styles from './MachineTrigger.module.css';

/**
 * The collapsed machine control: a portrait of the current machine plus its
 * name, opening the shared `MachinePickerDialog`. Used by the New-project
 * dialog, by the toolbar's target switcher and by the docs' porting guide,
 * which is why the chrome comes from the caller's stylesheet - the toolbar's
 * container queries need to target their own classes.
 *
 * `role` is likewise the caller's: it names the part this machine plays, which
 * is "Target machine" in the IDE and one of "Porting from" / "Porting to" in
 * the guide, where a trigger called a target machine would be wrong rather than
 * merely terse.
 *
 * `type="button"` matters: in the New-project dialog this sits inside a
 * `<form>`, where a bare button would submit and create the project.
 */
export const MachineTrigger = forwardRef<
  HTMLButtonElement,
  {
    dialect: MachineLike;
    /** What this machine is to the caller, e.g. `'Target machine'`. */
    role: string;
    onClick: () => void;
    /** Portrait height in px. */
    artSize?: number;
    showYear?: boolean;
    className?: string;
    /** Applied to the name span, so a caller can hide it when space is tight. */
    labelClassName?: string;
  }
>(function MachineTrigger(
  {
    dialect,
    role,
    onClick,
    artSize = 24,
    showYear = false,
    className,
    labelClassName,
  },
  ref,
) {
  const label = machineTriggerLabel(role, dialect);
  return (
    <button
      ref={ref}
      type="button"
      // Stable hook for tests, and how they read back the active machine now
      // that there is no <select> to check the value of. Distinct from the
      // picker rows' `data-machine` so the two never collide on screen.
      data-target-machine={dialect.id}
      className={`${styles.trigger} ${className ?? ''}`}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <MachineArt id={dialect.id} size={artSize} />
      <span className={`${styles.name} ${labelClassName ?? ''}`}>
        {dialect.name}
        {showYear && (
          <span className={styles.summary}>{machineSummary(dialect)}</span>
        )}
      </span>
      <span className={styles.chevron} aria-hidden>
        ▾
      </span>
    </button>
  );
});
