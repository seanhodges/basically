## Why

The porting guide promises per-machine answers — "choose a dialect to port
**from** and a dialect to port **to**… how the two **machines** differ in
language rules and hardware" — but compares **docs pages**. The IDE registers 13
machines; the guide offers 8, because five delegation dialects
(`zxspectrum128`, `bbcmaster`, `cpc6128`, `pet`, `vic20`) are folded into a
sibling's page via `docsReference`. Every multi-machine page therefore merges two
or more BASIC versions: 48K+128K, BASIC II+IV, Locomotive 1.0+1.1, and Commodore
V2+4.0.

The fold produces wrong output the user acts on:

- Porting **C64 → BBC** reports the PET-only `DLOAD`/`DIRECTORY`/`SCRATCH`/
  `HEADER` among the commands to deal with.
- Porting **BBC → CPC** says you gain `FILL`/`MASK`, true only on a 6128.
- Porting **to a VIC-20** reports free RAM as **38911** — the C64's figure. It
  is **3583**, a tenth of that, which is the difference between a program
  fitting and not.
- "Convert my program" to Locomotive BASIC always switches the IDE into a CPC
  464, never a 6128.

## What Changes

- The unit of comparison becomes the **machine**. All 13 registered dialects are
  selectable and answer for themselves.
- Reference and escape-code rows gain machine scoping, so a command that exists
  only on some machines of a family is no longer attributed to all of them.
- Porting facts are keyed by machine instead of by page, so hardware figures
  describe the machine the user chose.
- **BREAKING (shared links):** only machine ids are selectable. Docs page slugs
  leave the `?from=`/`?to=` namespace entirely, so a link shared as
  `?from=cpc&to=bbc` no longer resolves and the page opens on its default pair.
  The alternative was keeping page slugs as family selections alongside machine
  ids, but the two namespaces collide — `zxspectrum` is both the 48K machine's
  dialect id and the page its 128K sibling shares, one string with two meanings
  and no way for a URL to say which. One namespace of machine ids has no such
  case to resolve, and an unambiguous link is worth more than an old one.
- **BREAKING (internal test contract):** the `REPRESENTATIVE` page→marquee-dialect
  map in `facts-crosscheck.test.ts` is deleted, and `keyword-crosscheck.test.ts`
  stops pinning pages to family *unions*. Both are replaced by per-machine
  assertions covering all 13 dialects — strictly stronger, and they fail until
  the data is scoped correctly.
- Fixes a pre-existing gap of exactly the class this change addresses — a
  variant not represented as itself. The BBC Master's tokenizer runs BASIC IV and
  accepts `EDIT`, but `bbcmaster.keywords` was the BASIC II list, so the editor
  could neither highlight nor complete a command the machine takes, and the docs
  (whose table is pinned to that list) never documented it. The Master now
  carries its own editor keyword list, and `EDIT` gains a reference row scoped
  to it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: the comparison's unit becomes the machine rather than the
  docs page. New requirements that a command present on only some machines of a
  family is not reported as gained or lost for a machine that lacks it, that
  hardware figures describe the selected machine, and that carrying out the port
  targets the machine chosen rather than a relative. The shareable-link
  requirement is amended to state that machines are the only thing offered and
  that each is named by one string meaning only that machine.

## Non-goals

- **The machine-picker UI.** Replacing the porting guide's native `<select>`
  controls with the IDE's illustrated, manufacturer-grouped picker is a separate
  follow-up change. It is a presentation change that does not depend on this one
  and would stall this fix behind a Vue port of React components. This change
  keeps the existing selects and only changes what they offer.
- **Collapsing the shared docs reference pages.** `docs/reference/<family>.md`
  stays one page per family; only the porting comparison's data gains machine
  scoping. Splitting the reference pages is neither needed nor wanted.
- **Refactoring the delegation dialects.** The `bbcShared/` extraction flagged in
  `src/dialects/bbcmaster/index.ts` is a separate concern, triggered by a third
  BBC-family variant, and is not touched here.
- **Reworking `docsReference`.** It keeps its job of naming a dialect's docs
  page; this change stops the *porting comparison* from using it as the unit of
  comparison, nothing more.
- **New hardware or keyword research.** `Dialect.keywords` is already exact for
  all 13 machines; this change scopes existing documented rows to match and pins
  them.

## Impact

- **Docs data** (`docs/reference/data/`): `types.ts` gains machine scoping on
  `ReferenceEntry`/`EscapeEntry` and rekeys `PortingFacts`; `commodore.ts`,
  `cpc.ts`, `zxspectrum.ts`, `bbc.ts`, `escapes/*.ts`, `facts.ts` and
  `porting.ts` gain per-machine data.
- **Docs theme** (`docs/.vitepress/theme/`): `dialectCompare.ts` filters rows by
  the selected machine through `diffKeywords`, `capabilitySections`,
  `escapeSections` and `composeGuidance`; `DialectCompare.vue` and `compare.md`
  offer the 13 machines, grouped by manufacturer.
- **IDE**: `src/components/DocsDrawer.tsx` — the conversion hand-off resolves a
  machine id (`dialectForMachineId`) rather than a shared page slug, so "Convert
  my program" opens the chosen machine.
- **Tests**: `keyword-crosscheck`, `escape-crosscheck`, `facts-crosscheck` and
  `porting-crosscheck` all move to per-machine pinning; `e2e/porting-guidance/`
  gains coverage that converting to a variant lands in that variant.
- **`src/dialects/`**: one targeted fix only — the BBC Master gains its own
  editor keyword list (`bbcMasterKeywords`, BASIC II plus `EDIT`) instead of
  sharing the Model B's. No emulator changes, and the `Dialect` / `MachineEmulator`
  seam is untouched: this is a dialect declaring the keywords its own tokenizer
  already accepted.
- **Constraint respected:** the docs runtime still never imports `src/` — the
  registry pulls in every emulator core. Per-machine data stays hand-authored in
  `docs/` and is pinned by crosscheck tests, which may import `src/` freely.
