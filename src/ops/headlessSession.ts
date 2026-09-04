/**
 * The machine session over a machine a headless run owns.
 *
 * What the browser's session reads from the pane, the canvas and the store,
 * this reads from the machine it is handed, a painter over it, and the
 * measurements the run has been folding. The painter and the PNG encoder are
 * handed in rather than imported, because the headless canvas compresses
 * through node and this layer imports nothing of node's.
 */

import { createMachineControl } from '../app/machineControl';
import type { MachineSession } from '../app/machineSession';
import type { RunMeasurements } from '../app/runMeasurements';
import { canProfileRun } from '../ai/machineObservability';
import { outlineCapabilities } from '../editor/programOutline';
import type { Dialect, MachineEmulator } from '../dialects/types';
import { encodeBytes } from './bytes';
import type { PaintedFrame } from './types';

export interface HeadlessSessionDeps {
  machine: MachineEmulator;
  dialect: Dialect;
  /** Advance one frame, folding whatever the run folds per frame. */
  step: () => void;
  /** The program being run, for summing a profile over its routines. */
  source: string;
  /** The run's measurements, or null when the run is not measuring. */
  measurements: RunMeasurements | null;
  /** Paint the display now. */
  paint: () => PaintedFrame;
  encodePng: (
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
  ) => Uint8Array;
}

export function createHeadlessSession(
  deps: HeadlessSessionDeps,
): MachineSession {
  const { machine, dialect, measurements } = deps;
  const control = createMachineControl({
    machine,
    layout: dialect.keyboardLayout,
    // Through the machine's own port where it declares one, and as the
    // mapped keys where it does not - the same fallback the on-screen
    // controller makes, so a schedule reaches a program exactly as a person
    // playing it would.
    gamepadMode: dialect.joystickModes?.[0] ?? 'keymapped',
    fireButtons: dialect.joystickFireButtons ?? 1,
    step: deps.step,
  });
  return {
    ...control,
    capture: () => {
      const frame = deps.paint();
      return {
        width: frame.width,
        height: frame.height,
        png: encodeBytes(deps.encodePng(frame.rgba, frame.width, frame.height)),
      };
    },
    measurements: () => ({
      canProfile: canProfileRun(dialect.id),
      profile: measurements?.profile() ?? null,
      source: deps.source,
      capabilities: outlineCapabilities(dialect.keywords),
    }),
    timing: () => measurements?.timing() ?? null,
    variables: () => machine.readVariables?.() ?? null,
  };
}
