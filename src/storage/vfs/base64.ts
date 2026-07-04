/**
 * Minimal base64 codec. Hand-rolled (rather than btoa/atob or Buffer) so the
 * same code runs in the browser and in Vitest's node environment, and so
 * binary payloads never round-trip through UTF-16 strings.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const REVERSE = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
  REVERSE[ALPHABET.charCodeAt(i)] = i;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out.push(ALPHABET[b0 >> 2]!);
    out.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]!);
    out.push(
      i + 1 < bytes.length ? ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]! : '=',
    );
    out.push(i + 2 < bytes.length ? ALPHABET[b2 & 0x3f]! : '=');
  }
  return out.join('');
}

export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  let end = text.length;
  while (end > 0 && text[end - 1] === '=') end--;
  const outLen = Math.floor((end * 3) / 4);
  const out = new Uint8Array(outLen);
  let acc = 0;
  let accBits = 0;
  let o = 0;
  for (let i = 0; i < end; i++) {
    const v = REVERSE[text.charCodeAt(i)] ?? -1;
    if (v < 0) throw new Error(`Invalid base64 character at index ${i}`);
    acc = (acc << 6) | v;
    accBits += 6;
    if (accBits >= 8) {
      accBits -= 8;
      out[o++] = (acc >> accBits) & 0xff;
    }
  }
  return out;
}
