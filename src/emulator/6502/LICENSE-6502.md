# Vendored 6502 core

`cpu6502.js` is a vendored copy of
[cpu-6502-emulator](https://github.com/jyelewis/cpu-6502-emulator) by Jye Lewis,
released under the ISC license.

It is bundled (with esbuild, into a single ES module) from the project's
TypeScript source — `index.ts`, `CPU6502.ts`, `cpuOperations.ts`, `types.ts`,
`util.ts` — at upstream commit
`e154a827e18e1f7d052fc42f98bd6dee762ab6d3`. `cpu6502.js` is generated build
output and should not be hand-edited; the patches below were applied to the
upstream source before bundling (and are marked in-source with the comment
`micro-basic-ide patch`).

## Local modifications

1. **Synchronous `step()`** — the upstream core only runs via an internal,
   asynchronous `setTimeout`-driven clock (`executeNextInstruction`). A
   frame-driven host (an emulated machine calling `runFrame`) needs to advance
   the CPU one instruction at a time, synchronously, so a public `step()` was
   added. It services any pending interrupt, then fetches and executes exactly
   one instruction. The optional debug logging (`logInstructions` /
   `logInternalState`) applies only to the async clock path and is omitted from
   `step()`.

2. **Interrupt triggers assert the line only** — `reset()`, `triggerIRQB()` and
   `triggerNMIB()` no longer call `ensureExecutingIfNotPaused()`, i.e. they no
   longer auto-run the async clock. They now only set pending state, which is
   the correct model (asserting an interrupt line should not itself execute
   code) and is required for `step()`-driving: previously `reset()` ran
   instructions immediately, and a `BRK` (which asserts IRQ) recursed back into
   the clock. The host now drives execution explicitly via `step()`
   (synchronous) or `startClock()` (async); the pending interrupt is serviced on
   the next `step()`.

3. **`BRK` (`0x00`) made browser-safe** — the upstream handler began with
   node-only debug code (`console.log("BRK!")` followed by `process.exit(1)`),
   which crashes in a browser and left the intended `triggerIRQB(true)`
   unreachable. The debug lines were removed, restoring the intended behaviour.

### Known limitation (not a patch)

The core counts instructions, not clock cycles — there is no cycle counter. A
host that needs cycle-approximate timing (e.g. a future Commodore 64 machine)
must budget per frame by instruction count or add its own per-opcode accounting.

## Original license (ISC)

The upstream repository declares its license as `ISC` in `package.json`
(`"author": "Jye Lewis <jye@jyelewis.com>"`); it does not ship a separate
`LICENSE` file. The standard ISC license text is reproduced here:

```
ISC License

Copyright (c) Jye Lewis

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
