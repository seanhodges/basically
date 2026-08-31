/**
 * The Philips SAA1099: six tone channels in stereo over eight octaves, two
 * noise generators, two envelope generators and per-channel amplitude.
 */
export class Saa1099 {
  write(_address: number, _value: number): void {
    throw new Error('samcoupe: not implemented');
  }

  /** One frame of mono samples, mixed down from the stereo pair. */
  drain(): Float32Array {
    throw new Error('samcoupe: not implemented');
  }
}
