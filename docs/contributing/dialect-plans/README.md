# Dialect implementation plans

Generated, per-dialect staged plans — one file per target id (e.g.
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

See `docs/reference/dialect-roadmap.md` for the higher-level tiered roadmap (which machines
to add and why), and `docs/contributing/adding-a-dialect.md` (dialect folder +
virtual keyboard) / `docs/reference/file-formats.md` /
`docs/reference/serial-protocol.md` for the per-component reference detail each stage draws
on. The plan template lives alongside the skill at
`.claude/skills/adding-a-target-system/plan-template.md`.
