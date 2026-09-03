# Dialect implementation plans

Generated, per-dialect staged plans - one file per target id (e.g.
`bbcmaster.md`). Each is produced by the `adding-a-target-system` skill, which
audits the existing dialects to derive the current "feature complete" baseline,
then writes a dependency-ordered, multi-stage plan to make a new (or half-built)
dialect complete.

- **One file per target**, named `<id>.md` (matching the dialect's `id`).
- **Stages run on demand.** The skill only plans and scaffolds; it does not
  implement. Each stage is a medium, single-session task for the coding agent.
  Tick the checklist and update the status legend as stages land.
- **Companion scaffolding** lives under `src/dialects/<id>/` as throwing stubs
  until each stage fills them in. The dialect is not registered in
  `src/dialects/registry.ts` until its wire-up stage.
- **A plan is deleted once its machine ships.** These files are scaffolding for
  work in flight, not a permanent record: once every stage is ✅ the shipped
  code, its tests and the reference docs are the truth, and a stale plan
  alongside them is a second, decaying account of the same machine. So this
  directory holds only unfinished plans - if a machine is in
  `src/dialects/registry.ts` and has no file here, that is the finished state,
  not a missing document. Delete the plan in the change that completes it, and
  clear the references to it in the same commit: its roadmap row, any sibling
  plan that cross-links it, and the `Stage N` pointers in the dialect's own
  source comments, which stop meaning anything once the stages are gone.

See `docs/contributing/dialect-roadmap.md` for the higher-level tiered roadmap (which machines
to add and why), `docs/contributing/adding-a-dialect.md` (how to run the skill,
the checks, and how to submit each stage), and `docs/reference/file-formats.md` /
`docs/reference/serial-protocol.md` for the transfer-format detail the stages
draw on. The plan template lives alongside the skill at
`.claude/skills/adding-a-target-system/plan-template.md`.
