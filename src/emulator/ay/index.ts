/**
 * Shared AY-3-8912 PSG core. The chip is driven identically by the ZX Spectrum
 * 128K/+2 (through ports 0xFFFD/0xBFFD) and the Amstrad CPC (through the 8255
 * PPI), so its register file and synthesis live here rather than inside one
 * dialect. Consumers latch a register with {@link Ay38912.selectRegister} (or
 * write one directly with {@link Ay38912.writeRegister}) and pull one 50Hz
 * frame of mono samples with {@link Ay38912.render}.
 */
export { Ay38912, AY_SAMPLE_RATE, AY_CLOCK_128K, AY_CLOCK_CPC } from './ay';
