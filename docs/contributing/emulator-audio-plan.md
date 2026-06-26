# Plan: Emulator audio support

A cross-cutting feature plan (a new `MachineEmulator` audio seam plus per-machine
synthesis), not a single-dialect plan — so it lives here in `docs/contributing/`
rather than under `dialect-plans/` (which is strictly one file per target id).

## Context

Basically emulates several classic micros, but **no machine produces sound** today.
The cassette-audio code in `src/transfer/` is for tape save/load only; the run-time
machines are mute. The root cause is architectural: the `MachineEmulator` contract
(`src/dialects/types.ts`) has `renderTo()` for video but **no audio sibling**. As a
result, sound chips that are otherwise present go unused:

- **BBC Micro / BBC Master / Atom** wrap jsbeeb, which already synthesizes SN76489 /
  Atom-speaker samples — but our adapters install a no-op `FakeSoundChip`.
- **C64** ticks the viciious SID every cycle, but `attachAudio` in
  `c64Machine.ts` stubs the `AudioHost` to no-ops (viciious delegates synthesis to
  the host).
- **ZX Spectrum 48K** (ULA beeper, port `0xFE` bit 4) and **128K** (beeper +
  AY-3-8912; `ay.ts` is a register-file stub) have no synthesis at all. The AY stub
  even references this work: "actual sound output is Stage 5 and requires a new
  audio-out seam on MachineEmulator."
- **ZX81 / ZX80 / TRS-80** have no standard sound hardware → **out of scope**.

**Goal:** add a small audio seam to `MachineEmulator`, build the host-side Web Audio
plumbing once (with on-by-default playback, a mute toggle, and a volume control),
and then light up each sound-capable machine behind that seam — starting with the
jsbeeb machines (near-free), then Spectrum beeper, then 128K AY, then an
approximate C64 SID.

**Decisions (confirmed with user):**
- Phasing: **seam + jsbeeb first**, the rest as follow-on stages.
- Default: **audio on by default**, with a toolbar mute toggle + volume in settings.
- C64 SID: **approximation first** (3 voices: waveform + ADSR envelope + basic mix),
  refine fidelity later.

---

## The audio seam (the one new contract)

Add optional, pull-model members to `MachineEmulator` in `src/dialects/types.ts`,
mirroring the existing "optional method detected via `typeof`" convention
(`readVariables`, `readReport`, `debugStep`):

```ts
/** Native sample rate (Hz) of the Float32 mono stream this machine produces. */
readonly audioSampleRate?: number;
/**
 * Mono samples generated since the previous call — typically one frame's worth
 * (~audioSampleRate / 50). Called once per rAF tick, right after runFrame().
 * Returns an empty array when this machine emits no audio. The host owns
 * buffering, resampling, volume and scheduling; the machine owns synthesis.
 */
readAudio?(): Float32Array;
```

Rationale: keeps the seam tiny and symmetric with `renderTo`; the host never learns
about chips. Machines accumulate into an internal ring/scratch buffer during
`runFrame()` (and `debugStep()`), and hand it over on `readAudio()`.

A machine "supports audio" iff `typeof machine.readAudio === 'function'`. No
`Dialect`-level flag is needed — detection is per-machine, like the debugger.

---

## Host-side Web Audio plumbing (built once, in Stage 1)

New module `src/audio/emulatorAudio.ts` + an AudioWorklet processor
`src/audio/ringBufferProcessor.ts` (loaded via `new URL('./ringBufferProcessor.ts',
import.meta.url)` so Vite bundles it):

- `EmulatorAudio` class: lazily creates an `AudioContext` **inside the Run gesture**,
  loads the worklet module, and wires `worklet → GainNode → destination`.
- API: `push(samples, srcRate)`, `setVolume(0..1)`, `setMuted(bool)`, `resume()`,
  `dispose()`.
- The worklet keeps a ring buffer and **linearly resamples** the machine's
  `audioSampleRate` to the `AudioContext` rate; on underrun it outputs **silence**
  (no clicks) — important because rAF (and thus sample production) pauses when the
  tab is hidden.
- Reuse the proven gesture pattern from `src/keyboard/VirtualKeyboard.tsx`
  (lazy `new AudioContext()`, `if (ctx.state === 'suspended') ctx.resume()`).

Wire into the rAF loop in `src/components/EmulatorPane.tsx`:
- In the `runRequest` effect (~line 230), after `ensureMachine()`, create/resume the
  `EmulatorAudio` (the click is the user gesture that satisfies autoplay policy).
- In `startLoop`'s `tick()` (~line 190), after `machine.runFrame()` /
  `machine.debugStep(...)`, if audio is enabled and `machine.readAudio` exists, pull
  samples and `push()` them.
- **Realtime gate:** only produce/consume audio when `speed === 1`
  (`setSpeed`/fast-forward changes the cycle budget and would pitch the audio);
  otherwise feed silence.
- On Stop / dispose / unmount, dispose the `EmulatorAudio`.

Store + settings (follow the existing `keyboardSound` pattern exactly):
- `src/app/store.ts`: add `emulatorAudio: boolean` (default **true**),
  `emulatorVolume: number` (0..1, default ~0.7), `emulatorMuted: boolean`, with
  setters.
- `src/storage/settings.ts`: persist all three under `mbide.*` keys alongside
  `keyboardSound`.

UI:
- A mute/volume **icon button in `src/components/Toolbar.tsx`** (follow the existing
  `icon-btn` toggle pattern used for the AI/settings buttons).
- A "Emulator audio" section in `src/components/SettingsForm.tsx`: enable checkbox +
  volume `range` (mirrors the existing key-click checkbox / emulation-speed select).

Cassette-audio interaction (required):
- Cassette **export/playback** (`src/transfer/audioPlayer.ts` `playSamples`, invoked
  from `src/components/TransferDialog.tsx:78`) drives the **same speaker output** as
  the new run-time emulator audio. If the emulator keeps running and sounding while a
  tape tone plays, its audio mixes into the signal and corrupts the loading routine
  on the receiving machine.
- **Requirement:** before starting cassette-audio playback, **stop the emulator**
  (dispatch the existing Stop path — the `requestStop` counter in `src/app/store.ts`,
  the same one `Toolbar`'s `stopProgram` uses), which also tears down the emulator
  `AudioContext`/graph via the `EmulatorPane` dispose wiring. Confirm the emulator is
  stopped (`emulatorStatus === 'stopped'`) before `playSamples` is called in
  `TransferDialog.tsx`. This guarantees no run-time emulator sound bleeds into the
  exported tape signal.

PWA notes (verified):
- Web Audio **output needs no permission**; only mic input (already used by the
  cassette recorder) needs `getUserMedia`.
- Autoplay policy requires a **user gesture** to start/resume the context — handled
  by creating/resuming it on the Run click.
- The worklet module is plain JS after build and matches the service-worker
  `globPatterns` (`**/*.js`), so it precaches and works offline. Confirm the
  `new URL(..., import.meta.url)` chunk is emitted and cached.
- iOS Safari: the `VirtualKeyboard` pattern already proves gesture-unlock works here.

---

## Stages

### Stage 1 — Seam + host plumbing + first machine (jsbeeb: BBC/BBC Master/Atom)
- Add the seam to `src/dialects/types.ts`.
- Build `src/audio/emulatorAudio.ts` + `ringBufferProcessor.ts`, store/settings,
  toolbar + settings UI, and the `EmulatorPane` wiring above.
- **BBC + Atom** (`src/emulator/bbc/bbcMachine.ts`, `src/emulator/atom/atomMachine.ts`):
  replace `FakeSoundChip` with jsbeeb's real `SoundChip` / `AtomSoundChip`,
  constructed with an `onBuffer` callback that appends into the machine's
  accumulation buffer. Advance the chip in lockstep with CPU cycles inside
  `runFrame()` (the chip resamples internally), expose `audioSampleRate` and
  `readAudio()` draining the buffer. BBC Micro and BBC Master share this code path.
- This proves the whole seam end-to-end with the least synthesis work.

### Stage 2 — ZX Spectrum 48K beeper
- `src/dialects/zxspectrum/emulator/spectrumMachine.ts`: intercept IO writes to port
  `0xFE`, record `(cycleWithinFrame, bit4Level)` transitions; in `readAudio()` render
  a square wave from the transition timeline, resampled to `audioSampleRate`.

### Stage 3 — ZX Spectrum 128K (beeper + AY-3-8912)
- Extend `src/dialects/zxspectrum128/emulator/ay.ts` from register-file to a real
  PSG: 3 tone counters, noise LFSR, envelope generator, 4-bit log volume table; tick
  by cycles/frame, mix to Float32. Reuse the Stage-2 beeper, sum beeper + AY in
  `readAudio()`.

### Stage 4 — Commodore 64 SID (approximation)
- `src/emulator/c64/c64Machine.ts`: replace the no-op `attachAudio` with a software
  SID renderer driven by viciious's `onRegWrite` / `setVoiceVolume` callbacks. Track
  per-voice frequency + waveform (saw/triangle/pulse/noise) and ADSR envelope
  amplitude; generate 3 voices into a Float32 buffer drained by `readAudio()`.
  Accept imperfect filter/ring-mod/sync fidelity (documented as a known limitation);
  refine later.

Each stage is independently shippable and verifiable. The seam (Stage 1) is the
prerequisite for all of them.

---

## Critical files

| File | Change |
| --- | --- |
| `src/dialects/types.ts` | Add `audioSampleRate?` + `readAudio?()` to `MachineEmulator` |
| `src/audio/emulatorAudio.ts` *(new)* | Host `AudioContext` + worklet + gain wiring |
| `src/audio/ringBufferProcessor.ts` *(new)* | AudioWorklet ring buffer + resample + underrun silence |
| `src/components/EmulatorPane.tsx` | Create/resume context on Run; pull+push audio in `tick()`; realtime gate; dispose on stop |
| `src/app/store.ts` | `emulatorAudio` / `emulatorVolume` / `emulatorMuted` + setters |
| `src/storage/settings.ts` | Persist the three audio settings (`mbide.*`) |
| `src/components/Toolbar.tsx` | Mute/volume `icon-btn` |
| `src/components/SettingsForm.tsx` | Emulator-audio enable + volume controls |
| `src/components/TransferDialog.tsx` | Stop the emulator before cassette-audio playback (`playSamples`) |
| `src/emulator/bbc/bbcMachine.ts`, `src/emulator/atom/atomMachine.ts` | Real jsbeeb `SoundChip`/`AtomSoundChip` (Stage 1) |
| `src/dialects/zxspectrum/emulator/spectrumMachine.ts` | Beeper synthesis (Stage 2) |
| `src/dialects/zxspectrum128/emulator/ay.ts` | AY-3-8912 synthesis (Stage 3) |
| `src/emulator/c64/c64Machine.ts` | Software SID renderer (Stage 4) |

## Reuse (don't reinvent)
- Gesture-unlock pattern: `src/keyboard/VirtualKeyboard.tsx` (lazy context + `resume`).
- Settings/store toggle pattern: `keyboardSound` in `src/app/store.ts` /
  `src/storage/settings.ts` / `src/components/SettingsForm.tsx`.
- Per-frame callback precedent in the rAF loop: `frameHookRef` in `EmulatorPane.tsx`.
- jsbeeb's own `SoundChip`/`AtomSoundChip` synthesis + resampling (already vendored).
- viciious SID register decode + `onRegWrite`/`setVoiceVolume` host callbacks.

## Out of scope
- ZX81, ZX80, TRS-80 (no standard sound hardware).
- Full-fidelity SID (filters/ring-mod/sync) — deferred after the approximation.
- Cassette audio is unaffected (separate `src/transfer/` path).

---

## Verification

Per stage:
1. `npm run dev`, load the dialect, run a sound program (BBC `SOUND 1,-15,100,20`;
   Spectrum `BEEP 1,0`; 128K `PLAY`; C64 SID register pokes / a SID sample) and
   confirm audible output through speakers.
2. Confirm **on-by-default** playback, the **toolbar mute** toggle silences instantly,
   and the **settings volume** slider scales level.
3. Confirm fast-forward (speed > 1) does not pitch-shift/glitch (audio gates to
   silence), and that hiding the tab then returning produces no clicks (underrun =
   silence).
4. Confirm a second Run / dialect switch / Stop cleanly tears down and rebuilds the
   audio graph (no leaked `AudioContext`, no doubled output).
5. With a program running and audible, open Transfer → **cassette audio export**:
   confirm the emulator is stopped first (`emulatorStatus === 'stopped'`, audio graph
   torn down) so only the tape tone plays and nothing bleeds into the loading signal.
6. Add/adjust colocated `*.test.ts` for any new pure synthesis logic (e.g. AY volume
   table, SID envelope, beeper square-wave generation) — these are unit-testable
   without the Web Audio host.

Whole-repo gates before finishing each stage:
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`.
