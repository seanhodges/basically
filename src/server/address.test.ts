import { describe, expect, it } from 'vitest';
import {
  addressDirectory,
  addressKey,
  hostAddress,
  type AddressEnvironment,
} from './address';

const BUILD = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OTHER = '0f9e8d7c6b5a49382716f5e4d3c2b1a0';

const posix: AddressEnvironment = {
  platform: 'linux',
  user: '1000',
  runtimeDir: '/run/user/1000',
  tmpDir: '/tmp',
};
const windows: AddressEnvironment = {
  platform: 'win32',
  user: 'ada',
  tmpDir: 'C:\\Users\\ada\\AppData\\Local\\Temp',
};

describe('the address a host is found at', () => {
  it('puts a POSIX socket in the runtime directory when there is one', () => {
    expect(hostAddress(BUILD, posix)).toBe(
      '/run/user/1000/basically/a1b2c3d4e5f6.sock',
    );
    expect(addressDirectory(posix)).toBe('/run/user/1000/basically');
  });

  it('falls back to a directory of its own under the temporary one', () => {
    const env = { ...posix, runtimeDir: undefined };
    expect(hostAddress(BUILD, env)).toBe(
      '/tmp/basically-1000/a1b2c3d4e5f6.sock',
    );
    expect(addressDirectory(env)).toBe('/tmp/basically-1000');
  });

  it('treats an empty runtime directory as none set', () => {
    const env = { ...posix, runtimeDir: '' };
    expect(addressDirectory(env)).toBe('/tmp/basically-1000');
  });

  it('names a Windows pipe rather than a path, and has no directory', () => {
    expect(hostAddress(BUILD, windows)).toBe(
      '\\\\.\\pipe\\basically-ada-a1b2c3d4e5f6',
    );
    expect(addressDirectory(windows)).toBeNull();
  });

  it('separates two builds, on either platform', () => {
    expect(hostAddress(BUILD, posix)).not.toBe(hostAddress(OTHER, posix));
    expect(hostAddress(BUILD, windows)).not.toBe(hostAddress(OTHER, windows));
  });

  it('separates two users sharing one machine', () => {
    expect(hostAddress(BUILD, posix)).not.toBe(
      hostAddress(BUILD, {
        ...posix,
        user: '1001',
        runtimeDir: '/run/user/1001',
      }),
    );
    expect(hostAddress(BUILD, windows)).not.toBe(
      hostAddress(BUILD, { ...windows, user: 'grace' }),
    );
  });

  it('keeps every POSIX socket path inside the sun_path limit', () => {
    // 104 bytes including the terminator is the smaller of the two limits
    // (macOS); anything at or under 100 clears it on every supported system.
    const deep = {
      ...posix,
      runtimeDir: `/run/user/1000/${'nested/'.repeat(20)}`,
    };
    const address = hostAddress(BUILD, deep);
    expect(address.length).toBeLessThanOrEqual(100);
    expect(address).toBe('/tmp/bsly-1000-a1b2c3d4e5f6.sock');
  });

  it('says so rather than binding an unusable path when nothing fits', () => {
    const nowhere = {
      ...posix,
      runtimeDir: undefined,
      tmpDir: `/${'x'.repeat(120)}`,
    };
    expect(() => hostAddress(BUILD, nowhere)).toThrow(/somewhere shorter/);
  });

  it('derives the key from the build alone, so both ends agree', () => {
    expect(addressKey(BUILD)).toBe('a1b2c3d4e5f6');
    expect(addressKey(BUILD)).toBe(addressKey(BUILD));
  });
});
