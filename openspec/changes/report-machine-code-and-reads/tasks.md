## 1. What the dialects declare

- [x] 1.1 `src/dialects/types.ts`: beside the memory-write declaration, an
      optional declaration of the machine's read forms (its PEEK-family and
      indirection-read syntax) and its machine-code call commands. Machines
      declaring neither are untouched.
- [x] 1.2 Per-dialect declarations for every machine that has the syntax,
      each beside its existing write declaration.

## 2. Reading the program

- [x] 2.1 `src/editor/pokeAddresses.ts` + its test: the read scan and the call
      scan beside the write scan, reusing its resolution and approximation
      machinery; reads and calls inside strings, comments and data are inert.
- [x] 2.2 `src/app/programVocabulary.ts`: read sites and call sites join the
      vocabulary under the write sites' collection rules, and the program's
      attached code blocks are carried — name, address, size — while their
      payload bytes remain unread. The scan's block-skipping narrows to
      payloads.
- [x] 2.3 `src/app/programVocabulary.test.ts`: a PEEK is collected with its
      address; a computed read is approximate; a call command's target is
      collected; a block contributes name, address and size and nothing from
      its payload; machines without the syntax contribute nothing.
- [x] 2.4 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new
      fields cross the boundary and the field lists agree by string.

## 3. The table entries

- [x] 3.1 `src/reference/porting.ts` + its crosschecks: the run-a-routine
      commands that differ only in spelling become an equivalence reported as
      renames; the call function that returns a value on one machine while a
      sibling runs code joins the same-word-different-meaning warnings, with
      reference rows on the machines it names.

## 4. The findings

- [x] 4.1 `src/reference/compare.ts` + `compare.test.ts`: read landings —
      the write landings' classification minus the read-only verdict (a read
      of ROM reaches something else, both sides named), plus the named-region
      naming for keyboard, clock and system-variable reads.
- [x] 4.2 Same files: the machine-code finding — call sites and blocks
      gathered, calls resolved into the blocks that contain them, produced
      whenever the program has either.
- [x] 4.3 `src/reference/portDescription.ts` + its test: read landings beside
      the write landings among the rewrites; the machine-code finding among
      the rewrites, one posed decision per routine, pointing to the pair's
      carrier-format guidance where it exists; write-landings output
      byte-for-byte unchanged for a program with no reads.
- [x] 4.4 `docs/.vitepress/theme/components/DialectCompare.vue`: both findings
      rendered with the rewrites; the layout marks include read addresses.
- [x] 4.5 `src/ai/portReport.ts` + its test: both findings join the hand-over.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint` and `npm run format:check`
- [x] 5.4 `npm run docs:build`
- [x] 5.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey: a program that PEEKs a system address reports where the read
      lands on the target. Only check off when the run passes.
