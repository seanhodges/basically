## Context

Letter case reaches the user through five layers — the on-screen keyboard, the
tokenizer and charset, the editor's language intelligence, the machine's display
and screen read, and the prose in `aiProfile`s and docs. The seam those layers
share (`src/dialects/types.ts`, described in `docs/contributing/architecture.md`)
carries no case concept, so each layer folds or preserves on its own reasoning.
The result is not one bug but a family of them, several of which contradict each
other on the same program.

The codebase already has the right pattern for this, applied once: `VariableLexis`
declares whether a ROM distinguishes `A` from `a`, and a hand-written table test
pins that declaration against the ROMs. It covers one of the facts, sits in the
editor rather than beside the dialects, and has a single consumer — the other
consumer of the same question folds unconditionally and disagrees with it.

**Seam impact: none.** Nothing is added to `Dialect` or `MachineEmulator`; see
the first decision below for why.

## Goals / Non-Goals

**Goals:**

- One declaration per machine of the facts that decide letter case, pinned
  against the ROMs by a registry-driven test that fails when a machine is added
  without them.
- Every layer that currently guesses reads that declaration, so two parts of the
  IDE cannot give different answers about the same program.
- A machine with lower-case hardware can type lower case on its own keyboard.
- Screen reads report the case the screen is showing.
- A reader can see that their listing would not survive being typed into the
  real machine, and can opt into being held to what the machine can store.

**Non-Goals:**

- Any change to the bytes a tokenizer emits. Export, cassette, share links and
  round trips are untouched.
- Direct browser-key-event handling for a running machine — already accurate.
- The Commodore lower-case display bank beyond the screen read — including how an
  upper-case letter should encode once a program has switched sets.
- A TRS-80 Model III or lower-case-modded Model I dialect.
- A severity on `TokenizeError`, or any change to what blocks Run, export or
  sharing.

## Decisions

### The facts live in a leaf data module, not on `Dialect`

`src/dialects/letterCase.ts`, keyed by dialect id, importing a type and nothing
else — the shape `keywordSpellings.ts` and `glyphSources.ts` already use.

*Why not the seam:* the constraint is stated in `keywordSpellings.ts` itself —
the documentation bundle renders the reference pages without a registry, so
these tables must be reachable without constructing a `Dialect`. Every consumer
of the case facts either holds the dialect id already or *is* the dialect's own
file; none holds only a `Dialect`. The one thing the seam would buy —
compiler-enforced coverage of every machine — is bought instead by a
registry-driven test, which is how the palette, memory-map and keyword-spelling
tables are already kept honest.

*Alternative considered:* a field on `Dialect`, matching `crunched`. Rejected
because `crunched` was hoisted there when no id-keyed table existed to reach
for; that is no longer the situation, and the docs-bundle constraint now argues
the other way.

### Four facts, not three, and the fourth is stated rather than derived

The three ROM facts (glyphs, keyword scan, name case) do not by themselves say
what the IDE should do, because the machine's own text encoding gets there
first. On the Sinclairs, the Apple I and the Commodores the encoding folds a
lower-case letter onto the upper-case character, so a lower-case keyword *does*
run there even though those ROMs compare characters. A rule of the form
"ROM matches by character ⇒ match case-sensitively" would stop six machines
recognising `print`, which is a regression, not a fix.

So the table states the encoding's behaviour as a fourth field. It is stated
rather than derived from the glyph fact because the Commodores disagree with the
derivation: they *have* lower-case shapes and still fold, since one stored
character draws either case depending on the set in force. A rule with an
exception is not a rule.

Two predicates sit beside the table and carry the logic, so no consumer
re-derives it:

- **folds keyword case** — the ROM accepts either case, *or* the encoding folds
  before the ROM sees it, *or* the dialect has declared leniency.
- **warns on a lower-case keyword** — the ROM matches by character *and* the
  encoding preserves.

The second picks out the Atom, the BBC pair and the PMD 85 and nothing else,
which is the Atom's existing warning generalised by derivation rather than by a
per-dialect opt-in.

### Declared leniency, so a documented deviation stays documented

The PMD 85's tokenizer deliberately accepts a lower-case keyword its ROM would
refuse, because a lower-case listing is what a reader pastes in, and it says so
where it does it. A table that pinned the ROM fact alone would contradict that
decision. The table therefore carries an explicit leniency flag: the ROM fact
stays the ROM's, the dialect's choice stays the dialect's, and the reader still
gets told the machine will not run it.

### `VariableLexis.caseSensitive` is kept, and derived

The field stays — it is the variable scanner's input shape, and removing it
would thread a second argument through the rules builder to four call sites for
no gain. It stops being *authored* per dialect and is filled from the new table
at the boundary. The self-contradiction currently in that file — one machine
described as alone in distinguishing case, another thirty lines later described
as keeping its company — disappears with the authoring.

The scanner's own rules gain one new field for whether keyword lookup folds,
because the scanner's fold is a keyword-recognition question, not a name-identity
one: it folds only to test a run against the keyword set, and emits the run as
written either way. Conflating the two would be right by accident on the BBC and
wrong on the Commodores.

### One name-identity rule, extracted from the implementation that is already correct

Three places decide whether two spellings are one name: the usages view (correct
— it consults the case fact), the variable lint (folds unconditionally), and the
porting comparison (has no case concept at all, in either its rule type or its
key function). The usages implementation is extracted to a shared module and the
other two call it. Fixing only the first two would leave the porting collision
report blind, which is the failure that report exists to catch.

The porting side needs its own rule type extended with a case field, authored
per machine in the reference facts and crosschecked against the new table — the
same crosscheck pattern already used for the other naming facts.

### The lower-case-keyword diagnostic is emitted by each tokenizer, not by a re-scan

The message text is shared so three machines say the same thing, but each
tokenizer raises it from its own scan, where the statement context lives. On the
BBC this is an upper-case retry that produces **a diagnostic only and never a
token**, preserving that tokenizer's existing invariant that its byte stream is
what the ROM would store. All such diagnostics are non-fatal, so nothing blocks
building, running or exporting.

### A case lock is a key role, not a modifier

A modifier in the input engine is a held matrix cell with a momentary effect. A
case lock on every machine here is the exact inverse: a momentary press whose
effect is latched inside the ROM. Reusing the modifier machinery's `locked`
state would mean "hold the case key down forever", which is not what any of
these machines do.

So: a new flag on a key definition marking it as flipping case, plus a
layout-level statement of the case the machine produces at power-on (which is
also the case the layout's base legends are authored in). The engine keeps a
latch, flips it on such a press, and resets it when the keyboard is rebuilt.

*Editor target:* the latch is authoritative — there is no machine to disagree —
and is applied as a transform over the resolved action, leaving the action
lookup the pure data function its tests pin.

*Emulator target:* the latch is a display mirror only. The matrix cell a keycap
presses is the same cell in either case, which is precisely why direct typing is
already accurate. The mirror can desync (a program switches the set itself, or
the user presses the host's own caps key); it resets with the keyboard rather
than being tracked.

*Alternative considered:* reading the machine's real case state through a new
optional member on `MachineEmulator`. Rejected — a new seam member for a
cosmetic gain, and the two machines that could answer it are not the only ones
that would need to.

*Alternative considered:* two extra keyboard layers. Rejected — layer indices are
load-bearing constants in the layout files, and the machine really does apply a
case transform to the same key, so a transform is the honest model.

### The Commodores cannot take a shift-layer case pair

Their shifted letters are graphics characters, not the other case; the case flip
is a character-set switch. They get a case-lock keycap or nothing, which is why
the requirement is written as "by the route the machine itself uses" rather than
"with a shift pair".

### The TRS-80 commits to the Model I it is declared as

The dialect is Model I throughout — load address, 500-baud cassette encoding,
memory map, and its own charset probe declaration. Moving it to a Model III
would drag the cassette encoding and memory map with it. So the stock machine
has no lower case, its screen read folds exactly as its display does through one
shared helper, and the *stored byte* stays preserved for round-trip exactness
from a tape written by a machine that did have it. That makes it the one machine
where a preserving encoding sits beside a display with no lower case — the
table's per-machine note is where that earns its place.

### The Commodore screen read is fixed without touching the set model

The set switch is already derived from real chip state on all three machines.
The defect is one layer down: the reader answers a text-set letter with a
graphics-set character code, and the graphics-set table has no character there,
so the letter falls through to a blank. The fix answers the text set's letters
directly and records why the round trip through the shared table cannot serve
them.

### The fold advisory cannot be a tokenizer error

The advisory must not block anything, and today nothing in the error list is
merely advisory. `countProgramErrors` counts `dialect.lint(source).length` with
no severity filter, and the Run gate refuses on any non-zero count; the share
dialog and the share-compatibility filter count the same way. The `fatal` flag
does not help — it separates "can an image be built" from "does it squiggle",
and both kinds still block Run. On top of that the lint bridge hardcodes
`severity: 'error'`, so there is no warning rendering to reach for.

So the advisory is **a derived figure, not a diagnostic** — computed beside the
program statistics the status bar already shows, exactly as the RAM readout is,
with the same severity-to-class idiom. Nothing is added to `TokenizeError` and
no gate learns a new concept.

*Alternative considered:* adding a real severity to `TokenizeError` and teaching
the four gates about it. Rejected for this change — it is a larger and riskier
edit to the error model than the feature needs, and every gate would have to be
revisited. If a genuinely non-blocking inline squiggle is wanted later, that is
the change to make, and this advisory would move into it.

*Consequence to accept:* the status bar is not rendered on a phone in landscape,
so the advisory is invisible in that one layout. It is advisory rather than
load-bearing, and the alternative — an inline squiggle — is the rejected option
above.

### Strict mode engages machinery that already exists

Every dialect's tokenizer already catches the charset's own "this machine has no
such character" throw and reports it at the position it occurred. Lower case
never reaches that throw only because the fold happens first. Strict mode is
therefore **not folding**, letting the existing path fire, rather than a new
diagnostic: the message, the position, the gating and the per-dialect wording
all already exist and are already tested.

That makes strict mode a parameter on the encode path rather than a new layer.
It follows the `runGateLint` precedent — the one existing user-facing strictness
toggle — which is threaded as an explicit function parameter rather than read
from the store deep inside, so the pure functions stay pure and testable.

### Notation is exempted structurally, not by special case

The escapes are full of lower case and it is load-bearing: the raw-byte escape
contains a literal `x`, every Commodore control escape is spelled in lower case,
the Spectrum's user-defined-graphic escapes are lower-case letters by
convention, and the Commodore shifted-letter abbreviations *require* a
lower-case prefix. Enumerating these would be a standing invitation to miss one.

Instead strict mode walks the source through the existing charset probe's
unit parser, where **a unit longer than one character is by definition
notation**. That is the same rule the program vocabulary already uses to tell
notation from text, and it exempts every escape — including ones added later —
without naming any of them.

### The Commodore set switch is honoured for the report, not for the encoding

On those machines the stored character is the same for either case: the
character that draws `A` in the graphics set draws `a` in the lower-case set.
A program that switches sets and then writes lower case is correct, so strict
mode must not report it — the switch is recognised as the machine's own listings
spell it, and lower case after it is accepted.

The rule is applied in source order, which is an approximation: it does not
trace control flow, and it does not recognise a switch made by poking the video
chip directly. Both are stated where the rule is implemented. The approximation
fails safe — it reports less, never more.

**What this change does not fix, and must say so:** after such a switch there is
no way to write an *upper-case* letter at all, because the character that would
draw it in the lower-case set is the one that draws a graphic in the default
set, and the encoder only knows the default set. This is the unmodelled
lower-case display bank the reference pages already declare. Strict mode is
careful not to imply it is solved.

### Forcing upper case needs the one hook that also catches paste

The editor has three input seams and they do not converge: the typed-input
handler does not see a paste, and the on-screen keyboard never emits key events
at all. The existing per-machine input rule — the one that expands a short
keyword spelling on `.` — solves this by implementing itself at each of three
seams, and its own comment records why.

Rather than a fourth copy of that, forcing upper case uses a transaction filter,
which is the only hook every write path passes through, including both paste
routes. There is none in the codebase today, so this introduces the pattern; it
is held in a compartment so the setting can change without rebuilding the
editor, following the existing input-mode compartment.

It must exclude the graphics palette's inserts and anything inside notation,
which would otherwise be corrupted — the same distinction the unit walk makes.

### Hiding the shift key happens at the render seam, keyed on what a key *is*

Two traps decide this:

- **A key styled like a shift is not necessarily the shift.** At least one
  machine's control key — the only way to break a running program there — is
  styled as a shift while being a different modifier. The rule keys off the
  modifier a key *is*, never off how it is drawn.
- **The symbol page toggle rides the shift flank.** On the machines with a
  second symbol page, that page's toggle is welded onto whichever bottom-row key
  is a modifier. Hiding it outright would make characters unreachable from the
  on-screen keyboard — on two machines, silently, because the symbol test
  presses the machine's keys directly and never asks whether a user could reach
  them.

So the keycap is hidden only outside the symbol mode; inside it, it presses
nothing on the machine by construction and serves purely as the page toggle.

Hiding is done where the rows are handed to the renderer, substituting a spacer
of the same width rather than removing the key from the layout data. The layout
keeps its column arithmetic, the layers keep their indices — which are
positional and load-bearing, so a removed layer would silently mis-assign every
later legend — and every existing geometry and per-dialect layout test stays
meaningful.

## Risks / Trade-offs

- **The BBC highlighter stops colouring `print`, which will read as a
  regression.** → It is the fix: that tokenizer already stores the word as
  characters and already flags the statement. Today the colour and the squiggle
  contradict each other; afterwards the word is a name in both, coloured as one,
  with a diagnostic saying why. Pin both directions in the highlighter tests.
- **The new diagnostic may newly flag bundled samples.** → Run the sample
  convention tests and each dialect's own sample tests after wiring, and add
  "no bundled sample raises a lower-case-keyword diagnostic" to the cross-dialect
  sample test so it cannot regress.
- **The keyboard claims are unverified.** That a BBC with caps lock on at boot
  gives lower case under shift, and that a CPC echoes lower case from an
  unshifted letter key, are what the layout edits rest on, and neither is checked
  anywhere today. → The booted case-key test is written *first* and the layouts
  are authored from what it reports, not the other way round.
- **The emulator-target case mirror can desync from the machine.** → Accepted
  and commented; it is cosmetic, and it resets with the keyboard.
- **Changing keyboard layouts is user-visible on machines people already use.**
  → The change only adds reachable characters and makes keycaps honest about
  what they type; no key stops working.
- **Hiding a key can make a character unreachable without any test noticing.**
  → The symbol test presses machine keys directly, so it cannot see this. Add a
  reachability test: for every machine with a second symbol page, the page
  toggle must sit on a key the renderer actually draws under the setting.
- **The advisory is invisible on a phone in landscape**, where the status bar is
  not rendered. → Accepted; it is advisory, and the inline alternative was
  rejected above. Worth revisiting if the bar gains a home in that layout.
- **Strict mode will reject programs that run correctly today**, including
  imported listings and anything the assistant generates in lower case. → It is
  off by default and its whole purpose is to refuse; the advisory covers the
  default case. Check the bundled samples and the per-dialect assistant guidance
  under the setting before shipping it.
- **A table restating the ROMs can drift from them.** → The table test carries
  behavioural arms as well as a restatement: it encodes a lower-case letter
  through the real charset, lints a lower-case keyword and a two-case name pair,
  and resolves a lower-case glyph, so a declaration that stops matching the code
  fails rather than merely disagreeing.

## Migration Plan

No data migration: no stored format, saved project or share link changes. The
work lands in dependency order — declare, then editor, then machines, then
input, then specs and docs — with the declaration's test failing on three
machines until the editor group lands, which is what specifies that group.

Rollback is per group; the declaration is inert until a consumer reads it.

Strict characters ships **off**, so its whole surface is dormant until a reader
turns it on. The fold advisory ships on and is the only part visible to every
user by default — it changes no behaviour, only what the status bar says.

If the change has to be cut down, the order is: the Commodore case keycap
first (both cases encode identically, so it is cosmetic on the editor target);
then the Commodore second glyph bank; then the case latch, leaving each
keyboard's case pair authored in its own boot case, which still makes the BBC's
own sample typable. Strict characters is separable as a whole and could ship as
its own change on top of the declaration — but the fold advisory should not be
cut, because it is what makes the silent conversion visible at all, and it is
the smallest piece of the whole change. Never cut the declaration, the Commodore
blank screen read, or the editor rewiring: those are the accuracy claims.

## Open Questions

- Whether the character-generator chip the TRS-80 draws with holds the
  lower-case shapes even though the stock machine cannot address them. The
  answer decides how the glyph provenance is split and belongs in that entry's
  note; check the datasheet before writing it.
- Whether the fold advisory should eventually become a real non-blocking
  diagnostic with an inline squiggle, which would mean giving `TokenizeError` a
  severity and revisiting all four gates that count errors. Out of scope here;
  the advisory is built so it could move.
- Whether the Commodores' second character-ROM bank should gain declared glyph
  provenance in this change or a later one. It is what would make the switchable
  declaration provable rather than asserted, and it is on the cut line.
