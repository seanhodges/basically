# Cross-browser QA test plan

A manual end-to-end test plan for verifying Basically across browsers and
devices. Run it before releases that touch platform-facing code (audio,
files, clipboard, storage, layout), or after browser-compatibility changes.

## Browser & device matrix

Test the **Tier 1** set fully; spot-check Tier 2 with the smoke pass.

| Tier | Browser          | Platform        | Notes                                          |
| ---- | ---------------- | --------------- | ---------------------------------------------- |
| 1    | Chrome (latest)  | Windows / macOS | Reference browser; WebSerial + FS Access API   |
| 1    | Firefox (latest) | Windows / macOS | No WebSerial, no FS Access API                 |
| 1    | Safari (latest)  | macOS           | Strictest autoplay policy; prefixed CSS quirks |
| 1    | Safari           | iOS / iPadOS    | Touch layouts, PWA add-to-home, no vibration   |
| 1    | Chrome           | Android phone   | Touch layouts, haptics, PWA install            |
| 2    | Edge (latest)    | Windows         | Chromium — expect Chrome behaviour             |
| 2    | Firefox ESR      | Windows / Linux | Older API surface (e.g. clipboard `readText`)  |
| 2    | Chrome / Firefox | Linux           | Serial permissions differ (udev)               |

Where a behaviour is expected to differ by design, it's called out as
**Expected difference** — those are not bugs.

### Expected differences (by design)

| Feature                    | Chrome / Edge                              | Firefox                                                 | Safari                        |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------- | ----------------------------- |
| **Send via serial bridge** | Enabled                                    | Disabled + tooltip                                      | Disabled + tooltip            |
| **Open / Save dialogs**    | Native FS pickers (can overwrite in place) | Classic file input / download to Downloads              | Classic file input / download |
| **Edit ▸ Paste**           | Permission prompt, then pastes             | FF ≥ 125: paste prompt; older: alert pointing at Ctrl+V | Prompts, then pastes          |
| **Key press haptics**      | Android: vibrates                          | Android: vibrates                                       | No vibration (API missing)    |
| **PWA install**            | Install prompt/icon                        | No install (desktop)                                    | iOS: Add to Home Screen       |

## 0. Setup

1. Use a fresh profile (or clear site data) for at least one run per browser
   so first-run behaviour (welcome dialog, sample program) is covered.
2. Note browser + OS versions in the results sheet (template at the end).
3. Serve over **https** (or `localhost`) — most runs. One run of §9 covers
   plain-http degradation.

## 1. Boot, storage & first run

| #   | Step                                                                                                                         | Expected                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1.1 | Load the app in a fresh profile                                                                                              | Welcome dialog shows; ZX81 sample program in editor; no console errors                                  |
| 1.2 | Dismiss welcome, reload                                                                                                      | Welcome stays dismissed; document and dialect restored (autosave)                                       |
| 1.3 | Edit code, reload mid-edit                                                                                                   | Edits survive the reload                                                                                |
| 1.4 | Private/incognito window                                                                                                     | App loads and works; settings persist within the session                                                |
| 1.5 | Block cookies/site data for the site (Firefox: Enhanced Tracking Protection ▸ custom; Chrome: Site settings ▸ block), reload | App still loads and is fully usable; settings simply don't persist across reloads — **no white screen** |
| 1.6 | Switch target machine, reload                                                                                                | Selected dialect restored                                                                               |

## 2. Editor & keyboard shortcuts

Run on each desktop browser; repeat 2.5–2.7 on macOS specifically (⌘ vs Ctrl).

| #   | Step                                                                                                                    | Expected                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Type a small program; use keyword completion                                                                            | Completions appear; accepted text tokenizes; errors underline live                                                                    |
| 2.2 | Auto line numbering: press Enter at end of a numbered line                                                              | Next number inserted per increment setting                                                                                            |
| 2.3 | Undo/redo via shortcut and Edit menu                                                                                    | Both work identically                                                                                                                 |
| 2.4 | Edit ▸ Copy / Cut with and without a selection                                                                          | No selection: whole line copied/cut. Cut never deletes if the copy failed                                                             |
| 2.5 | Edit ▸ Paste                                                                                                            | Chrome/Safari/FF≥125: pastes (after permission prompt). Older Firefox: an explanatory alert pointing at Ctrl+V/⌘V — no silent failure |
| 2.6 | Ctrl+F / ⌘F find, replace, Escape closes                                                                                | Search panel opens in-editor (not the browser's find)                                                                                 |
| 2.7 | F5 runs, Shift+F5 stops, Ctrl+, opens settings, F1 opens docs                                                           | Browser defaults (reload, help) are suppressed                                                                                        |
| 2.8 | **Non-US layout (Windows):** switch to German/French/Spanish layout and type AltGr characters (€ @ { [ \) in the editor | Characters are typed; no Export/Import/other dialog pops open                                                                         |
| 2.9 | Toggle breakpoint (F9 / gutter click), Outline (Ctrl+Shift+O)                                                           | Breakpoint marker toggles; outline dialog lists procedures                                                                            |

## 3. Emulator — every dialect

For **each** machine in the Target dropdown: load a sample (File ▸ sample or
type one), Run, interact, Stop.

| #   | Step                                                                             | Expected                                                                                          |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 3.1 | Run the bundled sample                                                           | Screen boots and renders; loading spinner clears; status shows "running"                          |
| 3.2 | Inspect the screen at various window sizes                                       | Pixels stay sharp (no smoothing/blur) in all browsers, including Firefox and Safari               |
| 3.3 | Click the screen, type into the running program (e.g. `INPUT`)                   | Keys reach the machine; Escape releases focus back to the page                                    |
| 3.4 | Sound-capable machines: run a beeping program                                    | Sound plays after the Run click; volume slider and mute (Ctrl+Alt+M) work; no crackle at 1× speed |
| 3.5 | Change emulator speed (0.25×–8×)                                                 | Fast-forward mutes rather than pitch-shifts; UI stays responsive                                  |
| 3.6 | Debug (where supported): breakpoint, Step (F10), Continue (F8), variable watcher | Pauses on the line; watcher shows values; keys release while paused                               |
| 3.7 | Background the tab ~30s, return                                                  | Emulator resumes cleanly; no runaway catch-up or audio glitch loop                                |

## 4. Touch: virtual keyboard & game controller

On iOS/iPadOS Safari and Android Chrome (plus one desktop touch screen if
available).

| #   | Step                                                                      | Expected                                                                                            |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 4.1 | Enable the on-screen keyboard; tap keys while a program runs              | Key presses register; canvas/editor focus is not stolen                                             |
| 4.2 | Slide a finger across keys                                                | Highlight follows the finger (pointer capture works); releasing outside cancels cleanly             |
| 4.3 | Multi-touch: hold Shift + tap a key; two-finger chords                    | Both contacts register independently                                                                |
| 4.4 | Key sound toggle                                                          | Click sound on first tap (audio unlocks from the tap itself)                                        |
| 4.5 | Haptics toggle                                                            | Android: short vibration per tap. iOS: no vibration, no error (**expected difference**)             |
| 4.6 | Enable the game controller; use d-pad and fire buttons in a joystick game | Directions and fire register, diagonals via 8-way geometry; page does not scroll/zoom while playing |
| 4.7 | Rotate the device portrait ⇄ landscape                                    | Layout switches (tabs ⇄ landscape overlay); keyboard/controller reposition; nothing unreachable     |
| 4.8 | Double-tap and long-press on keys                                         | No iOS zoom, callout menu, or text selection                                                        |

## 5. Files: open & save

| #   | Step                                                     | Expected                                                                                                                                 |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | File ▸ Save (Ctrl+S) on a new document                   | Chromium: native save dialog with `.bas` enforced. Firefox/Safari: file downloads. Filename lands in the status bar; dirty marker clears |
| 5.2 | File ▸ Open a `.bas` file                                | Loads into the editor; dialect syntax check runs                                                                                         |
| 5.3 | Cancel each dialog (open and save)                       | No error, no state change — in every browser                                                                                             |
| 5.4 | Import ▸ binary image (`.P`/`.TAP`/`.prg`/… per dialect) | Detokenizes into the editor with a `.bas` name                                                                                           |
| 5.5 | Export ▸ native binary download                          | File downloads with correct name/extension; re-importing round-trips                                                                     |

## 6. Cassette audio import (microphone)

Machines with a decoder (e.g. ZX81/ZX80/Spectrum). Test in Chrome, Firefox and
Safari on desktop, plus one mobile.

| #   | Step                                                                                                        | Expected                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 6.1 | Import ▸ "Listen for tape" — first time                                                                     | Mic permission prompt; after grant, level meter moves with room noise                                      |
| 6.2 | **Safari specifically:** grant permission slowly (wait on the prompt several seconds), then play tape audio | Recording still captures signal (context is resumed after the prompt) — not a silent, never-ending capture |
| 6.3 | Play a `.wav` exported from the Export dialog into the mic                                                  | Program decodes and loads; auto-stop kicks in after trailing silence                                       |
| 6.4 | Stop / Cancel mid-listen                                                                                    | Mic indicator (browser tab) turns off; no dangling capture                                                 |
| 6.5 | Import ▸ "Import .wav recording"                                                                            | Same program decodes from the file path                                                                    |
| 6.6 | Device picker                                                                                               | Lists inputs (labels appear after permission); selecting a specific device works                           |

## 7. Export / transfer to hardware

| #   | Step                                         | Expected                                                                                                                      |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Export with unsaved changes                  | Dialog asks to save first                                                                                                     |
| 7.2 | "Play through speakers"                      | Cassette tone plays **in every browser, from the first click** (Safari: no hang on "Playing…"); duration shown; Stop halts it |
| 7.3 | Start playback while the emulator is running | Emulator stops first, then the tone plays (no mixed audio)                                                                    |
| 7.4 | "Download .wav"                              | WAV downloads; plays in a media player at the right pitch/speed                                                               |
| 7.5 | "Send via serial bridge" — Chrome/Edge       | Port picker appears; transfer progresses block by block (with bridge hardware), or fails with a clear message                 |
| 7.6 | Same button — Firefox/Safari                 | Button disabled with "WebSerial needs Chrome or Edge" tooltip (**expected difference**)                                       |
| 7.7 | Robust mode checkbox                         | Longer duration reported; still decodes via §6                                                                                |

## 8. AI assistant

| #   | Step                                          | Expected                                                                                           |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 8.1 | Configure an API key; ask for a small program | Response streams token by token in all browsers (no buffering until the end)                       |
| 8.2 | "Replace + Run" from a response               | Code lands in the editor and runs; a runtime error is fed back to the panel                        |
| 8.3 | Reload mid-stream                             | Conversation restores; the cut-off answer is marked incomplete, app remains stable                 |
| 8.4 | Key storage                                   | Key survives reload (except blocked-storage mode §1.5); switching provider keeps per-provider keys |

## 9. Insecure context (plain http over LAN)

Serve a production build over `http://<lan-ip>` (not localhost) and load it in
each Tier-1 desktop browser. This simulates hobbyist self-hosting.

| #   | Step                        | Expected                                                             |
| --- | --------------------------- | -------------------------------------------------------------------- |
| 9.1 | App boots and runs programs | Works — core IDE has no secure-context dependency                    |
| 9.2 | Edit ▸ Copy / Cut           | Still copies (legacy fallback path)                                  |
| 9.3 | Edit ▸ Paste                | Explanatory alert (no async clipboard here); Ctrl+V still pastes     |
| 9.4 | Mic import                  | Clear error message ("needs a secure (https) context") — not a crash |
| 9.5 | PWA/service worker          | Not registered (expected); app still fully works online              |

## 10. PWA & offline

| #    | Step                                                                                            | Expected                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 10.1 | Load over https twice (so the SW precaches), then go offline and reload                         | App shell loads offline                                                                    |
| 10.2 | Offline: run a machine whose ROM was previously loaded                                          | Runs (ROM came from runtime cache)                                                         |
| 10.3 | Offline: run a machine never loaded before                                                      | Clear failure loading the ROM, not a wedged UI                                             |
| 10.4 | Install: Chrome/Edge desktop (install icon), Android (install prompt), iOS (Add to Home Screen) | Standalone window with app icon; keyboard shortcuts and audio still work inside it         |
| 10.5 | Deploy check after a release                                                                    | New version activates on reload (autoUpdate) without stale-asset errors                    |
| 10.6 | Visit `/docs/` and go offline                                                                   | Docs shell serves from its own service worker; app and docs don't hijack each other's URLs |

## 11. Responsive layout sweep

Use real devices where possible; DevTools emulation as a fallback.

| #    | Viewport                                         | Expected                                                                                 |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 11.1 | Desktop ≥ 1200px                                 | Split editor/emulator with draggable divider; drag never selects text                    |
| 11.2 | Narrow window < 768px                            | Tabbed mobile layout (Editor/Preview); tab bar reachable                                 |
| 11.3 | Phone landscape (coarse pointer, height < 600px) | Rail + workspace layout; keyboard floats as overlay; ⌨ toggle aligned to the fire button |
| 11.4 | Tablet landscape                                 | Bottom-half keyboard overlay never covers the screen (50% cap)                           |
| 11.5 | iOS safe areas (notch devices)                   | No controls hidden under the notch/home indicator, portrait and landscape                |
| 11.6 | Browser zoom 50%–200%                            | Layout intact, text legible, nothing clipped                                             |

## 12. Docs site

| #    | Step                                                | Expected                                                        |
| ---- | --------------------------------------------------- | --------------------------------------------------------------- |
| 12.1 | Browse guide/reference pages in each Tier-1 browser | Rendered correctly; local search works; Mermaid diagrams render |
| 12.2 | In-app F1 / Documentation button                    | Docs drawer opens on the relevant topic                         |
| 12.3 | Mobile: docs navigation                             | Sidebar/hamburger usable on touch                               |

## Smoke pass (Tier 2 / quick regression)

A 10-minute subset when a full pass isn't warranted:
1.1, 1.5, 2.5, 2.8, 3.1–3.4 (two dialects: one Z80 e.g. ZX81, one 6502 e.g.
BBC or C64), 5.1–5.3, 7.2, 7.6, 11.2.

## Results template

Copy per browser/device:

```
Browser/version:        e.g. Firefox 128 ESR / Windows 11
Date / build (commit):
Sections run:           e.g. full pass | smoke pass
Failures:               section # — what happened — console errors attached?
Expected differences hit (not failures):
Notes (perf, visual nits):
```

## Known browser-specific implementation notes

Background for testers on why certain flows behave differently — see the
matching code if a regression is suspected:

- **Audio unlock**: every `AudioContext` is created inside a user gesture and
  resumed if suspended (`src/transfer/audioPlayer.ts`,
  `src/transfer/audioRecorder.ts`, `src/audio/emulatorAudio.ts`,
  `src/keyboard/VirtualKeyboard.tsx`). Safari is the strictest; if cassette
  playback hangs or recording is silent there, suspect this first.
- **Clipboard**: menu copy/cut fall back to `execCommand` when the async
  Clipboard API is missing; menu paste degrades to an instructional alert
  (`src/components/CodeMirrorHost.tsx`).
- **Storage**: blocked `localStorage` is replaced by an in-memory shim at boot
  (`src/storage/safeStorage.ts`) — the app must never white-screen over it.
- **File pickers**: `showOpenFilePicker`/`showSaveFilePicker` are
  Chromium-only; other browsers use `<input type=file>` and `<a download>`
  (`src/storage/files.ts`).
- **WebSerial**: Chromium-only; the UI gates on `webSerialSupported()`
  (`src/transfer/webserial.ts`).
- **AltGr**: shortcuts ignore chords where the AltGraph modifier is active
  (`src/app/shortcuts.ts`).
- **Pixel scaling**: the canvas uses `image-rendering: pixelated` with a
  `crisp-edges` fallback for older Firefox
  (`src/components/EmulatorPane.module.css`).
