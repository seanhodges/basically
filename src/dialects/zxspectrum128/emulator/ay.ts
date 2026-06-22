/**
 * Stub — filled in by Stage 2 (register file) / Stage 5 (audio) of
 * docs/dialect-plans/zxspectrum128.md.
 *
 * AY-3-8912 PSG: a 16-register file selected on port 0xFFFD and read/written on
 * port 0xBFFD (three square-wave channels + noise + envelope). BASIC's PLAY and
 * the 128 BEEP drive it. Stage 2 needs only the register file so the I/O writes
 * are absorbed and PLAY runs; actual sound *output* is Stage 5 and requires a
 * new audio-out seam on MachineEmulator (the contract has none today — neither
 * the 48K beeper nor the AY is audible).
 */
export class Ay38912 {
  writeRegister(_reg: number, _value: number): void {
    throw new Error('zxspectrum128: AY not implemented');
  }
  readRegister(_reg: number): number {
    throw new Error('zxspectrum128: AY not implemented');
  }
}
