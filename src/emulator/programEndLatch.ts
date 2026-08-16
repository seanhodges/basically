/**
 * `MachineEmulator.isProgramRunning` for a ROM that records no such state.
 *
 * Some ROMs keep a cell that answers the question directly - the Commodore
 * machines' cursor-blink flag, Locomotive's current-line pointer - and those
 * machines just read it. The Sinclair ROMs and Atom BASIC keep none: idling at
 * the cursor, waiting at an `INPUT` prompt and sitting after a report are the
 * same state to them, and on the ZX81 they are literally the same code path.
 *
 * What those ROMs do have is the *moment* they give up on a program: one
 * address, reached exactly once per termination and by nothing that is still
 * running. Falling off the end, `STOP`, an error and the user's own interrupt
 * key all arrive there. So the answer is latched from that address on the
 * instruction step the machine already runs, rather than polled.
 *
 * The latch describes the run the machine was handed, not the machine: a `RUN`
 * the user types afterwards is not re-armed, and the seam says so (see
 * `MachineEmulator.isProgramRunning`).
 */
export class ProgramEndLatch {
  private state: 'idle' | 'armed' | 'stopped' = 'idle';

  /**
   * Take the program: from here the next sighting of the ROM's address is this
   * run ending.
   *
   * Armed while the program is being handed over rather than once that is done,
   * because a short program starts and finishes inside the frames a
   * `loadProgram` pumps - a latch armed afterwards would miss its only signal
   * and report "not answerable" forever. Where in the hand-over is a fact about
   * each ROM, so each machine arms at its own point.
   */
  arm(): void {
    this.state = 'armed';
  }

  /** Back to "not answerable yet": a machine reset, or a disposed machine. */
  clear(): void {
    this.state = 'idle';
  }

  /**
   * The ROM reached the address at which it stops running a program.
   *
   * Ignored unless armed, so the times a ROM passes that address on its way to
   * its own prompt - booting, or completing a command the hand-over typed - are
   * not read as the program ending.
   */
  stopped(): void {
    if (this.state === 'armed') this.state = 'stopped';
  }

  /**
   * The seam's three-valued answer.
   *
   * @param started whether the machine can see BASIC executing a line yet, so
   *   the interval between being handed a program and starting it reads as "not
   *   answerable" rather than as running. A machine with no `currentLine()`
   *   passes `true` and reports running from arming: that can report a running
   *   program a fraction of a second early, which is the safe direction - it can
   *   never produce a false finish.
   */
  read(started: boolean): boolean | null {
    if (this.state === 'stopped') return false;
    if (this.state === 'idle') return null;
    return started ? true : null;
  }
}
