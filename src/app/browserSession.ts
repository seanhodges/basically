import type { Dialect, MachineEmulator } from '../dialects/types';
import type { GamepadMode } from '../keyboard/controllerConfig';
import { canProfileRun } from '../ai/machineObservability';
import { outlineCapabilities } from '../editor/programOutline';
import { createMachineControl } from './machineControl';
import type { MachineSession } from './machineSession';
import { captureScreen } from './screenCapture';
import {
  selectActiveSource,
  selectVisibleProfile,
  selectVisibleTiming,
  useIdeStore,
} from './store';

/**
 * The machine session over the browser's live machine.
 *
 * The driver is the shared one; what this adds is read from where the IDE
 * already keeps it - the display from the pane's canvas through the screen
 * capture, the measurements and the timing from the store the user's own
 * profile report reads, and the variables from the machine. Read at call time
 * rather than captured when the session was made: the run being asked about is
 * usually the check that has only just finished, and its final measurements
 * land as the run ends.
 */
export interface BrowserSessionDeps {
  machine: MachineEmulator;
  dialect: Dialect;
  gamepadMode: GamepadMode;
  /** Advance one frame and render, so a look sees what the user would see. */
  step: () => void;
}

export function createBrowserSession(deps: BrowserSessionDeps): MachineSession {
  const { machine, dialect } = deps;
  const control = createMachineControl({
    machine,
    layout: dialect.keyboardLayout,
    gamepadMode: deps.gamepadMode,
    fireButtons: dialect.joystickFireButtons ?? 1,
    step: deps.step,
  });
  return {
    ...control,
    capture: () => {
      const shot = captureScreen();
      return shot
        ? { width: shot.width, height: shot.height, png: shot.base64 }
        : null;
    },
    measurements: () => {
      const s = useIdeStore.getState();
      return {
        canProfile: canProfileRun(s.dialect.id),
        profile: selectVisibleProfile(s),
        source: selectActiveSource(s),
        capabilities: outlineCapabilities(s.dialect.keywords),
      };
    },
    timing: () => selectVisibleTiming(useIdeStore.getState()),
    variables: () => machine.readVariables?.() ?? null,
  };
}
