# Vendored 6502 core

`cpu6502.js` is a vendored copy of the cycle-exact 6502 CPU from
[6502.ts](https://github.com/6502ts/6502.ts) by Christian Speckner and
contributors, released under the MIT license.

It is bundled (with esbuild, into a single ES module) from the project's
TypeScript source at upstream commit
`9c59f7d01e316a290480dd432a41cbab4e0238a9`. `cpu6502.js` is generated build
output and should not be hand-edited — the upstream source is taken **unmodified**
(no local patches).

## What is bundled

The state-machine CPU (`src/machine/cpu/StateMachineCpu.ts`) and its dependency
tree — `src/machine/cpu/{CpuInterface,Instruction,ops}.ts` and everything under
`src/machine/cpu/statemachine/` (`Compiler`, `ResultImpl`,
`StateMachineInterface`, `ops`, and the `addressing/`, `instruction/`, `vector/`
subtrees), plus the type-only `src/machine/bus/BusInterface.ts`. The optional
random-number generator (`src/tools/rng/`) is **not** used — the CPU constructor
takes an optional `rng` which we omit, so power-on register state is a
deterministic zero and no `seedrandom` dependency is pulled in.

A tiny entry module re-exports the runtime surface, then esbuild bundles it:

```
# in a clean checkout of 6502ts/6502.ts @ 9c59f7d
# entry.ts:
#   import StateMachineCpu from './src/machine/cpu/StateMachineCpu';
#   export { StateMachineCpu };
#   // Flags / ExecutionState are upstream `const enum`s (erased by the bundler),
#   // so their numeric values are re-exported here as real runtime objects.
#   export const Flags = { c: 0x01, z: 0x02, i: 0x04, d: 0x08, b: 0x10, e: 0x20, v: 0x40, n: 0x80 };
#   export const ExecutionState = { boot: 0, fetch: 1, execute: 2 };
npx esbuild entry.ts --bundle --format=esm --platform=browser \
  --banner:js='<attribution header>' --outfile=cpu6502.js
```

The resulting module exports `StateMachineCpu`, `Flags`, and `ExecutionState`.
See `cpu6502.d.ts` for the hand-written types describing this surface.

## Why this core

The previous core ([cpu-6502-emulator](https://github.com/jyelewis/cpu-6502-emulator),
ISC) was instruction-counted and missing legal opcodes (`RTI`, `JMP (indirect)`,
`SEI`/`CLI`/`SED`/`CLV`, decimal mode). 6502.ts is cycle-exact and passes Klaus
Dormann's [6502 functional tests](https://github.com/Klaus2m5/6502_65C02_functional_tests),
implementing the full legal NMOS opcode set — a firmer foundation for the
Commodore (PET, VIC-20) machines that will drive it.

## API shape (upstream naming quirk)

Drive the CPU one clock at a time via `cycle()`; `executionState === fetch`
marks an instruction boundary. Registers live on `cpu.state`, where — note —
`state.p` is the **program counter** and `state.flags` is the **status
register** (the opposite of the classic `P`=status convention). IRQ is
level-sensitive (`setInterrupt(true)`/`setInterrupt(false)`); NMI is edge
(`nmi()`).

## Original license (MIT)

```
Copyright (c) 2014 -- 2020 Christian Speckner and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
