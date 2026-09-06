## 1. Claim the scope and bootstrap trust

These are done by a person on the registry, and the workflow cannot do them: a
trusted publisher can only be configured on a package that already exists.

- [ ] 1.1 Create the `basically` organisation on the registry, so `@basically/cli`
      can be published to it
- [ ] 1.2 Publish the first version by hand with a token, publicly — a scoped
      package is private unless the publish says otherwise
- [ ] 1.3 Configure the trusted publisher on the registry against this repository
      and the release workflow's exact filename, and tag that first release
      `cli-v<version>` so the workflow has a tag to count from

## 2. A machine says whether its ROM is its own concern

- [x] 2.1 Add to the `Dialect` seam (`src/dialects/types.ts`) a way for a machine
      to declare that its ROM does not come from the product's images, documented
      on the member itself
- [x] 2.2 Set it on the three jsbeeb-backed dialects (`bbcmicro`, `bbcmaster`,
      `atom`), each beside the existing note that their emulator manages its own
      ROMs
- [x] 2.3 Make `hasRom()` in `src/dialects/bootHarness.ts` honour it alongside the
      existing file check
- [x] 2.4 Add a registry-driven test under `src/dialects/` holding every
      registered machine to the rule: a machine reported as having a ROM boots,
      and one reported without does not claim to
- [x] 2.5 Add a colocated test that `hasRom()` answers true for a jsbeeb-backed
      machine when no image is filed under the product's own ROM directory

## 3. A ROM root said once for the installation

- [x] 3.1 Read `BASICALLY_ROM_ROOT` in the client and resolve it to an absolute
      path, as `scripts/headless/cli.mts` already does for `--rom-root`
- [x] 3.2 Apply the precedence the spec states — the option on the run, then the
      variable, then `findRomRoot()`'s upward walk — and cover each step with a
      test
- [x] 3.3 Thread the resolved root into the ROM probe behind `ctx.roms` so
      `machines` and `info` answer for the ROMs the caller will run against
- [x] 3.4 Add the variable to `src/cli/usage.ts` wherever `--rom-root` is
      described

## 4. The published package

- [x] 4.1 Write `scripts/headless/package.json`: `@basically/cli`,
      `GPL-3.0-or-later`, `type: module`, `engines.node >= 22`, `files` limited to
      the bundle directory and the licence and readme, and `jsbeeb` as a runtime
      dependency pinned equal to the root's. The entry points stay named
      `basically` and `basically-server` — the commands do not take the scope
- [x] 4.2 Add a test holding the published `jsbeeb` version equal to the root
      `package.json`'s, in the manner of `src/client/thinness.test.ts`
- [x] 4.3 Emit `basically`, `basically-server` and their `.cmd` twins into the
      bundle directory from `scripts/headless/build.mjs` — the existing `scripts/`
      launchers without the staleness scan, keeping the Windows codepage handling
- [x] 4.4 Point the package's entry points at those launchers, and add a
      pre-publish step that rebuilds so bundles and build id can never be
      published from different builds
- [x] 4.5 Add a test that the emitted launcher is named what `src/client/discover.ts`
      looks for, so host discovery beside the client cannot silently regress
- [x] 4.6 Confirm with a packing dry run that the tarball carries the bundle
      directory and nothing else — no source, no ROMs, no docs

## 5. Prove it on a real installation

- [x] 5.1 Install the packed tarball into an empty directory outside the
      checkout, so the upward ROM walk finds nothing, and work from there
- [x] 5.2 `basically machines` reports the three Acorns and the three
      interpreter-backed machines as runnable, and the rest as not
- [x] 5.3 A program runs on an interpreter-backed machine and on a jsbeeb-backed
      machine; a machine needing an absent ROM reports that rather than crashing
- [x] 5.4 With `BASICALLY_ROM_ROOT` set at a checkout's ROM directory, a program
      runs on a machine that needs one; `--rom-root` on the run overrides it
- [x] 5.5 Two commands in a row reach one host rather than starting two, and the
      second finds the machine the first left running
- [x] 5.6 An editor and an agent are served by the installed toolchain and
      answered as they are from a checkout

## 6. Release

- [x] 6.1 Write the published `package.json`'s build id into it at release time,
      as a field of its own, so what is published records the build it came from
- [x] 6.2 Add a release workflow to `.github/workflows/`, on pushes to `main`,
      that builds the toolchain and compares the build id it produced against the
      one on the registry's latest version; when they match it stops, having
      published nothing. Comment in the file that its filename is matched by the
      registry and cannot be changed freely
- [x] 6.3 When they differ, settle the version against the registry rather than
      the tags: publish the newest `cli-v*` tag's version if it is ahead of what
      is published — a person asking for a minor or major — and otherwise the
      published version with its patch raised. Set it in the working tree without
      committing it
- [x] 6.4 Publish, and only once that has succeeded tag the built commit and push
      the tag, with the build id in the tag message. A tag must never exist for a
      version that is not on the registry, so nothing is tagged before the publish
      or when the gate stops the run
- [x] 6.5 Authenticate by OIDC — `id-token: write`, no token secret — and give the
      job `contents: write` for the tag. Upgrade npm on the runner past 11.5.1,
      which the pinned Node does not carry, and publish with public access
- [x] 6.6 Hold the job to one at a time, so two pushes landing together cannot
      race for the same version number
- [x] 6.7 Handle the registry having no published version yet — the gate treats an
      absent package as a difference rather than an error
- [ ] 6.8 Prove all three paths before relying on the workflow: a docs-only push
      publishes nothing and tags nothing; a push that changes the bundles
      publishes once and tags once; and a publish that fails leaves no tag behind

## 7. Documentation

- [x] 7.1 Add a guide page on installing the toolchain and on ROMs: how to
      install, which machines run with none, how to point at ROMs you already
      have. Lead with what works
- [x] 7.2 Link to it from `docs/guide/language-server.md` and
      `docs/reference/mcp-server.md`, where `basically-server` currently appears
      with no account of where it comes from
- [x] 7.3 Add an install section to `README.md`
- [x] 7.4 Update `docs/contributing/architecture.md` for the `Dialect` seam's new
      member and the emitted launchers — the rows they belong in, not new prose
- [ ] 7.5 Ask whether the new guide page should join the docs sidebar; leave
      `docs/.vitepress/config.ts` untouched unless the answer is yes

## 8. Gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npx vitest run src/client/ src/server/ src/dialects/ src/ops/ src/cli/`
      — the seam change is registry-wide, so run the full `npm test` if anything
      outside these reads `hasRom`
- [x] 8.3 `npm run lint` and `npm run format:check`
- [x] 8.4 `npm run docs:build`
- [x] 8.5 No e2e run: nothing here is app-visible — the browser IDE carries its
      own ROMs and never reaches the client, the host or the launchers. If any
      task above turns out to touch the app, run that capability's folder with
      `npm run e2e:chromium -- e2e/<capability>` and leave this unchecked until
      it passes
