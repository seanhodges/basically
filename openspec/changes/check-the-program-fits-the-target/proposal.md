## Why

The porting guide reports every difference a port must deal with except the one
that decides whether the ported program can be loaded at all: whether it fits
the target machine's program RAM. Both numbers are already on the page — the
target's free RAM is a row of the language & hardware table, and the IDE knows
what the program tokenizes to — and nothing compares them.

The failure mode is not a rounding error. Of the 182 ordered pairs the guide can
be pointed at, 88 move to a machine with less program RAM and 52 lose more than
40% of it. The worst case scores **zero** on every difference the guide reports
today: C64 → VIC-20 is byte-identical Commodore BASIC V2 landing in 3,583 bytes
instead of 38,911. The guide currently calls that port free.

## What Changes

- **The comparison reports whether the open program fits the target machine.**
  Where the reader's own program is at hand, the guide states the size the
  program takes on the target and the target's free program RAM, and says
  whether it fits, is close to the limit, or will not load.
- **The size is measured on the target machine, not carried over from the
  source.** A program's tokenized size is not portable: the same six-line
  program measures 50 bytes on a ZX80, 71 on the Microsoft-derived machines
  (C64, PET, VIC-20, TRS-80, Altair, and the BBCs), 80 on the Sinclair machines
  that store a five-byte binary form after every numeric literal, 82 on the Atom
  and 88 on the CPC. Sizing a port from the source machine's byte count would be
  wrong by a quarter before the comparison starts.
- **The thresholds are the editor's own.** Amber at 80% of the budget and red at
  95% — the same figures the status bar's RAM readout uses, from one definition,
  so one percentage means one thing across the app.
- **A program the target cannot fully express still gets a figure.** The target's
  tokenizer will report errors for source the target has no keyword or character
  for; that is expected on a port and is not a fit failure. The program is sized
  from what does tokenize and the figure is stated as a lower bound.
- **Nothing is reported where there is no program.** Read on its own, outside
  the IDE, the guide has no program to size and says nothing about fit — as it
  already says nothing about statement layout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *Whether the program fits the
  target machine is reported* — and one modified, *The comparison narrows to the
  program the user has open*, to name the fit report among the findings that
  exist only where a program is at hand.

## Non-goals

- **Sizing anything but the program area.** Variables, arrays and string space
  are runtime facts that no static analysis of the text can answer;
  `programRamBytes` is a program-area budget and the report says so.
- **Blocking or gating the port.** The finding is reported like every other
  finding on the page. Converting the program with the assistant stays available
  whatever the fit says — a program that does not fit is exactly the program a
  reader wants help shrinking.
- **A second opinion on the source machine's size.** The status bar already
  reports what the program takes on the machine it is written for; repeating it
  here would be one number in two places.
- **Suggesting how to make it fit.** What to cut is per-machine advice the
  guide's prose already carries in other forms; this change reports the fact.
- **Changing `programRamBytes` or `freeRamBytes` for any machine.** Both are
  pinned by existing crosschecks and are taken as given.

## Impact

Affected code:

- `src/reference/compare.ts` — a pure fit calculation over the target's facts
  and a program size measured elsewhere, in the same shape as the other
  narrowed findings; and its colocated `compare.test.ts`.
- `src/reference/ramBudget.ts` (new) — the budget percentage and its two
  thresholds, as the one definition both the status bar and the guide read.
  `src/app/useProgramStats.ts` consumes it in place of its own copy.
- `src/app/programVocabulary.ts` — the reply gains the program's size as
  measured by the target's tokenizer, and whether that tokenization was clean.
- `src/components/DocsDrawer.tsx` — the vocabulary request names the target
  machine as well as the source, and the reply answers for it; pinned by
  `DocsDrawer.test.ts` as the rest of the payload is.
- `docs/.vitepress/theme/components/DialectCompare.vue` — re-requests when the
  target changes and renders the fit finding.
- `e2e/porting-guidance/` — one browser assertion that the finding reaches the
  page for a program too large for the target.

No dependency changes, no storage or share-format changes. The `Dialect` seam is
unchanged: the size comes from `Dialect.tokenize`, which every dialect already
implements and which the status bar already calls for the same purpose.
