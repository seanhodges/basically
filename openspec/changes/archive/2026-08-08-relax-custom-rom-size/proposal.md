## Why

The custom-ROM setting accepts an image only when its size matches the machine's
own ROM exactly, and says so twice: once as a standing instruction ("The image
must be exactly 8,192 bytes") and again as a refusal when a file misses it.

That rule is stricter than the machines need. A ROM area is a fixed region of
address space, not a contract with the file the user picks: a shorter image
leaves the rest of the area unprogrammed — which on real hardware is what an
unblown EPROM reads as — and a longer file simply has more in it than the area
holds. Both are things the IDE can fit and run; neither is a reason to refuse.

The rule also blocks legitimate images. Dumps arrive with headers or trailing
padding, a hand-built image is rarely padded to the exact bank size while it is
being worked on, and the two-bank machines (the 128K Spectrum, both CPCs) refuse
a single-bank image that would otherwise boot the bank it contains. In every one
of those cases the user has an image the machine could run and the IDE will not
take it.

Nothing about the refusal makes the feature safer, either: a correctly-sized
file is no more likely to be a working ROM than a wrongly-sized one. The check
was never validation — it was a proxy for a constructor that throws on a
mismatched buffer, and fitting the image at the seam removes the reason for it.

## What Changes

- **Any file is accepted** as a machine's ROM image. Size is no longer a
  condition of installing one.
- The image is **fitted to the machine's ROM area** when it is run: a smaller
  image is padded with `0xFF` (an unprogrammed ROM), and only the leading bytes
  of a larger one are used.
- The setting **reports what it did** — the file's own size, and whether it was
  padded or trimmed — instead of stating a size the file must have. This keeps
  the diagnostic the refusal used to carry (a user who supplied one half of a
  two-bank image can still see that is what happened) without blocking the
  install.
- **The requirement text goes**: the "must be exactly N bytes" line in Settings,
  the refusal message, the "supply your own N-byte image" offers, and the
  matching passages in the user guide and `public/roms/ATTRIBUTION.md`.
- A stored image is **no longer discarded** for being the wrong size, and a
  machine the user has supplied an image for is **offered in the picker**
  whatever that image's size — it can now start.

## Capabilities

### Modified Capabilities

- `persistence`: one requirement modified — *The user can supply their own
  machine ROM* — replacing exact-size acceptance with acceptance of any image,
  fitted to the machine's ROM area, and a readout that reports the fit.

`program-execution` is **not** affected: what the user is told when a run fails
under a supplied image, or when no image is available, is unchanged in substance
(the wording drops a byte count, which the requirement never named).

`sharing-player` is **not** affected: the player honours a locally installed
image by the same mechanism the IDE does, fitting included, and share records
are untouched.

## Non-goals

- **Validating that an image is a working ROM.** Still nothing checks that, and
  removing the size rule removes the last thing that looked like it did. A
  machine that will not start on a supplied image says so and points at
  *Restore bundled ROM*, which remains the recovery route.
- **Choosing where a short image lands.** It is padded at the end, so it loads
  from the base of the ROM area. Offsets and per-bank placement (loading one
  16K half into bank 1 of a two-bank machine, say) would need slot-level
  declarations — the same future change the original feature deferred.
- **Warning that an image looks wrong.** The readout states the fit as a fact.
  Heuristics about which images are plausible are out of scope.
- **Machines that load their own ROM set.** Unchanged: they still say the image
  cannot be replaced, and offer no control that would appear to replace it.
- **The bundled image's own size check.** The fetch of a bundled ROM still
  verifies its length, because there the mismatch means a failed fetch (an SPA
  host answering with `index.html` and a 200), not a user's choice.

## Impact

Affected code:

- `src/app/romImage.ts` — a `fitRomImage` helper: pad with `0xFF`, or take the
  leading bytes. The bundled-fetch size check stays as-is.
- `src/components/EmulatorPane.tsx` — fit a supplied image before handing it to
  `createEmulator`; drop the byte count from the "supply your own" message.
- `src/storage/customRom.ts` — `loadCustomRom` returns the stored bytes rather
  than dropping them when they do not match the machine's size.
- `src/components/customRomUpload.ts` — the refusal for a wrong size goes; the
  readout gains the padded/trimmed note.
- `src/components/SettingsForm.tsx` — the "must be exactly N bytes" line becomes
  a description of the fit.
- `src/app/machineAvailability.ts` — a supplied image makes its machine
  runnable whatever its size.
- `docs/guide/getting-started.md`, `public/roms/ATTRIBUTION.md` — the passages
  stating the size requirement.

No dependency changes. No migration: an image already installed is
correctly-sized by construction and behaves exactly as before.
