# Contributing to Basically

Thanks for helping out. This page covers setup, the bar a change has to clear,
and how to get it merged. For what Basically is and does, see the
[README](https://github.com/seanhodges/basically#readme).

Adding a whole new machine is a bigger job with its own guide: read
[Adding a dialect](/contributing/adding-a-dialect) and the
[dialect plans](/contributing/dialect-plans/README).

## Ways to contribute

Bug fixes, dialect improvements (tokenizer accuracy, samples, emulator
fidelity), documentation, and clear bug reports are all welcome. Start small —
a focused PR is the fastest way to learn the codebase.

Open a GitHub issue before starting anything large, so we can agree on the
approach before you invest the time.

## Getting set up

You need a recent Node.js LTS and git.

```bash
git clone https://github.com/<your-username>/basically.git
cd basically
npm install
npm run dev        # IDE at http://localhost:5173
npm run docs:dev   # docs site at http://localhost:5173/docs/
```

Confirm the checkout works before you change anything: in the IDE choose
**File ▸ New project**, pick the **Breakout** sample, press **Create project**,
then **▶ Run** (Ctrl+Enter). For the AI panel, click **✦ AI** and enter an API
key for your provider — it stays in your browser.

## The one mental model

The app only talks to the `Dialect` interface (`src/dialects/types.ts`) and the
`MachineEmulator` it returns — never to a machine's specifics directly. Each
machine lives in `src/dialects/<name>/`, and that seam is what keeps new
machines pluggable. Get comfortable with it before making cross-cutting
changes.

The [architecture overview](/contributing/architecture) has the full layer
breakdown and data-flow diagrams; `CLAUDE.md` at the repository root is the
quick-reference map of where things live.

## Spec-driven changes (OpenSpec)

Feature and behaviour changes go through
[OpenSpec](https://github.com/Fission-AI/OpenSpec). Baseline capability specs
live in `openspec/specs/`, in-flight changes in `openspec/changes/`;
`npx openspec list --specs` and `npx openspec validate --specs` are the CLI you
need. Specs say **what** the product guarantees, the architecture overview says
**how** — keep implementation detail out of specs. Refactors get no spec delta,
and planning a whole new target system stays with the dialect plans.

## Conventions

- **Respect the seam.** If supporting one machine means touching the editor,
  transfer dialog, status bar or emulator pane, the seam is being bypassed —
  keep machine-specific code in `src/dialects/<name>/`.
- **Strict TypeScript.** Unused symbols fail the build. Avoid `any`.
- **Errors, not throws.** The tokenizer collects `TokenizeError[]` for inline
  display rather than throwing.
- **Tests live next to the code**, as colocated `*.test.ts` — especially for
  tokenizer, emulator and charset changes. Emulator tests may boot the real
  ROMs under `public/roms/`.
- **One logical change per PR.** Faster to review, cleaner history.

`CLAUDE.md` carries the rest: naming, store patterns, comment and UI-label
style.

### Don't touch

Vendored emulator cores and the bundled ROMs are third-party — don't hand-edit
or relicense them. Fix an emulation bug in the machine adapter that wraps the
core, and never commit a ROM you don't have the right to distribute. `CLAUDE.md`
lists the vendored paths; `public/roms/ATTRIBUTION.md` covers ROM provenance.

## Before you open a PR

```bash
npm run typecheck
npm test
npm run lint
npm run format:check   # `npm run format` to auto-fix
```

For changes that affect the running app (UI, emulator, transfer), also run the
end-to-end tests. The `e2e/` folders mirror the `openspec/specs/` capabilities,
so you can run just the area you touched:

```bash
npm run e2e:chromium -- e2e/<capability>   # one capability, Chromium only
npm run e2e                                # the full cross-browser matrix
```

CI runs all of these plus `npm run docs:build`, so a docs change that breaks the
VitePress build fails there. If you changed behaviour, add or update a test that
would have caught the bug.

## Raising a PR

Basically uses the standard fork-and-pull-request model. Fork the repository,
branch off the latest `main`, and make focused commits with short imperative
summary lines. Run the checks above, then open a PR against
`seanhodges/basically:main` explaining **what** changed and **why**, linking any
related issue and including a screenshot or short clip for UI changes.

Push follow-up commits to the same branch to address review — the PR updates
automatically. Don't force-push over review history unless asked.

## Licensing

Basically is GPL-3.0-or-later (see `LICENSE`); by contributing you agree your
contribution is licensed under the same terms. Before adding a dependency —
especially an emulator core — check its licence is compatible and add
attribution where required.

## Questions

Open a GitHub issue, or start a draft PR early and ask. We'd rather help you get
the approach right than have you guess. The
[Discord](/contributing/community) is good for a quicker back-and-forth.
