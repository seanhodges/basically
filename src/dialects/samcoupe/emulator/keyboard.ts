/** The SAM's key matrix, and the Atari-standard joystick port beside it. */
export class SamKeyboard {
  setKey(_token: string, _down: boolean): void {
    throw new Error('samcoupe: not implemented');
  }

  releaseAll(): void {
    throw new Error('samcoupe: not implemented');
  }

  read(_rowMask: number): number {
    throw new Error('samcoupe: not implemented');
  }
}
