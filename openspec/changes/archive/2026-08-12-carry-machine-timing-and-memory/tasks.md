# Tasks

## 1. Share one way of writing an address

- [x] 1.1 Lift the port describer's private address formatter into
      `src/reference/machineDescription.ts` as an exported helper, keeping its
      behaviour: the machine's hex prefix and four padded digits where the
      machine writes hex, the plain number where it writes decimal.
- [x] 1.2 Have `src/reference/portDescription.ts` import it rather than keep a
      copy, so the conditionally-free-memory findings and the machine
      description cannot drift apart.

## 2. Carry the boot screen a position can be checked against

- [x] 2.1 State the boot text screen's columns and rows, and the ranges a
      position must stay inside, in the screen/colour/sound section beside the
      prose summary.

## 3. Carry how long a wait takes

- [x] 3.1 Add a timing section stating the machine's own wait idiom.
- [x] 3.2 State the measured empty-loop rate where the machine has one, quoted
      as this product's emulators' and not as a claim about the original
      hardware; state none where it has not.
- [x] 3.3 Place it above the command list, which is long enough to bury
      anything after it.

## 4. Carry where things are in memory

- [x] 4.1 Take the dialect's memory layout as an optional argument to the
      machine description, as the reference tables are already taken.
- [x] 4.2 Pass the dialect's layout through from `src/ai/machineReference.ts`.
- [x] 4.3 List the addressable range, every named region with its bounds and
      note, and the user-defined-graphics base where the machine has one.
- [x] 4.4 Mark read-only memory from the region's kind rather than relying on
      its note.
- [x] 4.5 Describe a machine whose dialect declares no layout without the
      section, rather than with a partial one.

## 5. Pin it to the machines

- [x] 5.1 Registry-driven sweep: every machine states its boot screen's
      columns and rows, matching its facts entry.
- [x] 5.2 Registry-driven sweep: every machine states its wait idiom, and its
      measured rate exactly where it has one.
- [x] 5.3 Registry-driven sweep: every region a dialect's layout declares is
      named, and a dialect with no layout carries no memory section.
- [x] 5.4 Worked examples: the C64's video, sound and interface registers and
      its read-only ROM; a hex-addressed machine and a decimal-addressed one
      written each their own way; the Spectrum's user-defined-graphics base.

## 6. Quality gates

- [x] 6.1 `npm run typecheck`
- [x] 6.2 `npm test`
- [x] 6.3 `npm run lint`
- [x] 6.4 `npm run format:check`
- [x] 6.5 `npm run e2e:chromium -- e2e/ai-assistant`
