# Contributing to Basically

Thanks for wanting to help! This page is the practical
starting point for contributors: how to set up, how the project is laid
out, the quality bar a change has to clear, and how to get it reviewed and
merged.

If you are adding a whole new machine, read this page first, then jump to
[Adding a dialect](/contributing/adding-a-dialect) and the
[dialect plans](/contributing/dialect-plans/README).

## Ways to contribute

- **Fix a bug or rough edge** — start small; a focused PR is the best way to
  learn the codebase.
- **Improve a dialect** — better tokenizer accuracy, keyword docs, samples, or
  emulator fidelity for a machine you know well.
- **Add a new target machine** — a BASIC dialect, emulator, and virtual
  keyboard. This is a larger effort; see [Adding a dialect](/contributing/adding-a-dialect).
- **Improve the docs** — these pages live under `docs/` and are always welcome.
- **Report issues** — a clear bug report with steps to reproduce is a real
  contribution.

If you are planning something large, please open a GitHub issue to discuss it
first so we can agree on the approach before you invest the time.

## Getting set up

You need a recent **Node.js LTS** and **git**. The IDE is TypeScript + React +
Vite.

1. **Fork** the repository on GitHub
   ([seanhodges/basically](https://github.com/seanhodges/basically)) to your own
   account.
2. **Clone your fork** and add the original as an `upstream` remote so you can
   keep up to date:

   ```bash
   git clone https://github.com/<your-username>/basically.git
   cd basically
   git remote add upstream https://github.com/seanhodges/basically.git
   ```

3. **Install and run:**

   ```bash
   npm install        # install dependencies
   npm run dev        # Vite dev server at http://localhost:5173
   ```

Open <http://localhost:5173>, pick a sample from **File → SAMPLES**, and press
**▶ Run** to confirm everything works before you change anything.

To work on these docs, use `npm run docs:dev` (VitePress dev server).

## How the project fits together

The one mental model: **the app only talks to the `Dialect` interface**
(`src/dialects/types.ts`) and the `MachineEmulator` it returns — never to a
machine's specifics directly. Each machine lives in `src/dialects/<name>/`, and
that seam is what keeps new machines pluggable. Get comfortable with it before
making cross-cutting changes.

| Path                       | Role                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `src/dialects/types.ts`    | The `Dialect` / `MachineEmulator` contracts — the app's only seam     |
| `src/dialects/registry.ts` | Registers the available dialects (`getDialect(id)`)                   |
| `src/dialects/<name>/`     | One folder per dialect (tokenizer, charset, keywords, samples, …)     |
| `src/emulator/`            | Vendored/third-party CPU cores and large machine wrappers             |
| `src/editor/`              | Generic CodeMirror builders: language, completions, lint              |
| `src/keyboard/`            | The data-driven virtual keyboard (no per-machine logic)               |
| `src/app/`                 | Zustand store (`store.ts`) and app-level hooks                        |
| `src/components/`          | React UI: `Workspace`, `EmulatorPane`, `AiPanel`, `Toolbar`           |
| `src/ai/`                  | AI client, prompt builder, code extractor/merge                       |
| `src/transfer/`            | Hardware export: WAV cassette, native images, WebSerial               |
| `docs/`                    | This documentation site (VitePress)                                   |

For the full architecture and data-flow diagrams, see the project's `CLAUDE.md`
at the repository root — it is the most detailed map of the codebase.

## Conventions and best practices

- **Strict TypeScript.** `noUnusedLocals`, `noUnusedParameters`, and
  `noFallthroughCasesInSwitch` are on; unused symbols fail the build. Avoid
  `any`.
- **Respect the seam.** A change that touches the editor, transfer dialog,
  status bar, or emulator pane to support one machine usually means the seam is
  being bypassed — keep machine-specific code inside `src/dialects/<name>/`.
- **Errors, not throws.** The tokenizer collects `TokenizeError[]` (1-based
  line, 0-based column) for inline display rather than throwing.
- **State.** A single Zustand store; components subscribe via narrow selectors
  (`useIdeStore((s) => s.source)`). Async work is requested by bumping a counter
  that a `useEffect` watches, not by calling across modules.
- **Naming.** Components `PascalCase`, functions/vars `camelCase`, hardware
  constants `SCREAMING_SNAKE_CASE` (e.g. `TSTATES_PER_FRAME`).
- **Tests live next to code.** Add or update colocated `*.test.ts` files,
  especially for tokenizer, emulator, and charset changes — don't rely on
  manual checking alone. Emulator tests may read the real ROMs under
  `public/roms/`.
- **Keep changes focused.** One logical change per PR makes review faster and
  history cleaner.

### Don't touch

Some code is vendored or third-party and must not be hand-edited or relicensed:

- `src/emulator/z80/` — vendored Z80 core (fix bugs in the machine adapter
  instead).
- `src/emulator/6502/cpu6502.js` — vendored build output.
- `src/emulator/c64/viciious/` — vendored viciious C64 core.
- The **jsbeeb** npm package — wrap it in `src/emulator/bbc/`, don't fork it.
- `public/roms/**` — third-party ROMs (see `public/roms/ATTRIBUTION.md`). Never
  commit a ROM you don't have the right to distribute.

## Before you open a PR

Run the full local check suite and make sure it is green. CI runs the same
gates, so checking locally first saves a round-trip:

```bash
npm run typecheck      # tsc -b, no bundle
npm test               # vitest run (all unit tests)
npm run lint           # ESLint
npm run format:check   # Prettier check (use `npm run format` to auto-fix)
```

For changes that affect the running app (UI, emulator, transfer), also run the
end-to-end / visual tests:

```bash
npm run e2e            # Playwright (specs in e2e/)
```

If you changed behaviour, add or update a test that would have caught the bug.

## Git workflow: fork, branch, and raise a PR

Basically uses the standard **fork-and-pull-request** model. You don't push to
the main repository directly — you propose changes from your fork and they get
reviewed on GitHub before merging.

1. **Sync your fork** with upstream so you branch from the latest `main`:

   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create a topic branch** with a descriptive name:

   ```bash
   git checkout -b fix/spectrum-tokenizer-edge-case
   ```

3. **Make your change**, with focused commits and clear messages (a short
   imperative summary line, e.g. _"Make C64 breakout keys case-insensitive"_).

4. **Run the checks** above and make sure they pass.

5. **Push to your fork** and open a pull request against
   `seanhodges/basically:main`:

   ```bash
   git push -u origin fix/spectrum-tokenizer-edge-case
   ```

   GitHub will offer a "Compare & pull request" button. In the PR description,
   explain **what** changed and **why**, link any related issue, and include
   screenshots or a short clip for UI changes.

6. **Respond to review.** A maintainer will review your PR. Push follow-up
   commits to the same branch to address feedback — the PR updates
   automatically. Keep the discussion focused and don't force-push over review
   history unless asked.

Once approved and green, a maintainer will merge it. 🎉

## Licensing

Basically is licensed under **GPL-3.0-or-later** (see `LICENSE`). This is partly
because some emulator cores it builds on are themselves GPL (e.g. jsbeeb). By
contributing, you agree your contribution is licensed under the same terms.
Before adding a new dependency — especially an emulator core — check its license
is compatible, and add attribution where required.

## Questions

If you're unsure about anything, open a GitHub issue or start a draft PR early
and ask. We'd rather help you get the approach right than have you guess.
