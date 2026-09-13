## 1. Spell the directive in one place

- [ ] 1.1 Add the writing half to `src/dialects/machineDirective.ts`: a function
      returning the `#MACHINE <id>` line for a machine id, beside the existing
      recogniser and parser, importing nothing new.
- [ ] 1.2 Extend `src/dialects/machineDirective.test.ts` so what the new function
      writes is read back by `readMachineDirective` as that machine, with no
      problems and nothing left in the stripped source.

## 2. Let a conversion be asked for it

- [ ] 2.1 Add the optional `declareMachine` boolean to `ConvertInput` and to
      `convertOp`'s input schema in `src/ops/convert.ts`, documented in the same
      voice as its neighbours.
- [ ] 2.2 Prepend the declaration to the returned source when it is asked for,
      naming the dialect the operation resolved, using the function from group 1.
- [ ] 2.3 Leave `describe` reporting what it reports today; the declaration is
      part of the source, not a separate finding.

## 3. Give the command line the same option

- [ ] 3.1 Add the flag to `parseConvert` in `src/cli/args.ts`, mapped to the
      operation's input property.
- [ ] 3.2 Add it to the `convert` entry in `src/cli/usage.ts`, in the shape the
      other options there use.
- [ ] 3.3 Extend `src/cli/args.test.ts`: the flag parses, its absence leaves the
      property unset, and the parsed input still validates against the schema.

## 4. Pin the behaviour

- [ ] 4.1 Extend `src/ops/convert.test.ts`: the declaration is present when asked
      for and absent when not; the declared source resolves to the same machine
      when read back; a caller-named machine is the machine declared.
- [ ] 4.2 Cover the pipeline fact the design names — a listing whose text
      declares a machine, built and then converted, comes back with no directive
      of its own, so the prepend never doubles.
- [ ] 4.3 Confirm `src/ops/parity.test.ts` still passes unchanged: this adds an
      input property, not a route, so no caller gains or loses an exemption.

## 5. Quality gates

- [ ] 5.1 `npx vitest run src/dialects/machineDirective.test.ts src/ops/convert.test.ts src/ops/parity.test.ts src/cli/args.test.ts`
- [ ] 5.2 `npm run typecheck`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check` (or `npm run format` and re-run)
- [ ] 5.5 By hand, against a real file: `./scripts/basically convert prog.p` and
      the same with the flag, checking the second differs from the first by the
      declaration alone. No e2e run: nothing here is app-visible.
