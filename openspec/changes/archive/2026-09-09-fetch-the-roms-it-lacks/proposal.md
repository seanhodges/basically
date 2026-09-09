## Why

The command line can only run a machine whose ROM is already on disk, found by
walking up for a `public/` that contains `roms`. Outside a checkout there is no
such tree, so `run --keys` and `check` refuse and there is nothing the user can
do about it: the refusal names no way to obtain an image, and the only lever is
`--rom-root`, which presumes they already have one.

The share server now publishes the whole set read-only, with a manifest carrying
a `sha256` per image, so the command line can obtain what it lacks. That the
bucket is the publisher also matters for the images themselves: several of them
(`public/roms/ATTRIBUTION.md` is explicit about the Altair, the MSX, the
Commodores, the Acorns and the Apples) rest on no formal redistribution grant,
and a served set can be withdrawn where a set copied into every checkout cannot.

## What Changes

- The command line fetches the ROM images it lacks from the share server's ROM
  API, into a cache under the user's home, and runs the machine on them.
- It asks the user once before fetching anything, naming what will be
  downloaded, where it will be written, and the attribution notice those images
  travel on. Declining leaves today's behaviour exactly as it is.
- The question is asked only when a fetch would actually happen. An installation
  that already has the images — a checkout, or `--rom-root` — downloads nothing
  and is asked nothing.
- A caller with no terminal is never blocked on a prompt it cannot answer: it
  accepts in advance, through an environment variable or a `roms accept` run,
  or it is refused promptly.
- Once accepted, the set is kept current without asking again — a new machine's
  image arrives on its own, and a withdrawn one leaves.
- A new `roms` command reports where images are being read from, obtains them,
  and discards them.
- The two existing refusals ("this installation carries no ROM for …") name what
  the user can do about it.

## Capabilities

### New Capabilities

None. This extends what the command line already guarantees about ROMs.

### Modified Capabilities

- `headless-cli`: "Only running a machine requires its ROM" currently guarantees
  that every operation but running works with no ROM present, and that running
  lets the user say where ROMs are read from. It gains: obtaining an absent
  image, the consent that gates obtaining one, how a caller without a terminal
  gives that consent, and the obligation to keep an obtained set current without
  asking again.

## Non-goals

- **The web IDE.** It keeps fetching its images from its own origin, exactly as
  it does today. Moving that to the share server is a second change, and it has
  its own questions — a fallback path, the service worker's cache, the machines
  that fetch their own sets, jsbeeb's single global base. Only the shared
  reference helper this change extracts is built with that follow-up in mind.
- **Removing `public/roms/**` from the repository.** It stays committed: it is
  what the share server mirrors at synth time, what the unit suite boots, and
  what a checkout reads instead of the network.
- **Any change to `../basically-share-server`.** Its ROM routes are anonymous
  public reads and need nothing added for a node client.
- **The assistant and the language server.** Neither reads a ROM; the language
  server does not touch one at all.
- **Bundling ROMs into an installable artifact**, or any packaging change.

## Impact

- **New**, all node-only and reached only from the command line's own process:
  a ROM cache with manifest verification and refresh, a consent record and
  prompt, and the `roms` command's grammar, help and report.
- **`src/dialects/`**: one small pure helper for a ROM reference, replacing four
  hand-rolled copies of the same path-tail slice; `findRomRoot()` gains the
  cache as a candidate, which is what carries it to the runner, the MCP session
  and the ROM probe in one edit.
- **`src/ops/run.ts`, `src/ops/check.ts`**: message text only. That layer keeps
  importing neither the filesystem nor the network, so the whole of the fetching
  and all of the interaction stay in the client process — the only one with a
  terminal.
- **Docs**: `public/roms/ATTRIBUTION.md` records that the set is also published
  from the share API; `docs/contributing/architecture.md` gains the command
  line's new ROM source.
- **No new dependencies.** `fetch`, `node:crypto` and `node:readline/promises`
  are all in the runtime already.
- **Network**: the command line makes an outbound request where it previously
  made none — never without consent, never on a command that already has its
  images, and never in a way that can fail the command.
