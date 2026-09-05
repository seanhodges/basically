/**
 * Bytes as text, so an outcome carrying a built program survives being written
 * as JSON and read back by any caller.
 *
 * Base64 through the platform's own codec, which both the browser and node
 * have. Encoded in slices because `String.fromCharCode` takes its bytes as
 * arguments, and a cassette recording is hundreds of thousands of them.
 */

const SLICE = 0x8000;

export function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let at = 0; at < bytes.length; at += SLICE) {
    binary += String.fromCharCode(...bytes.subarray(at, at + SLICE));
  }
  return btoa(binary);
}

export function decodeBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
