import { describe, expect, it } from 'vitest';
import { parseArgs } from '../cli/args';
import { usage } from '../cli/usage';
import {
  DRIVE_ACTIONS,
  DRIVE_SEPARATOR_RULE,
  parseDriveScript,
} from '../app/driveScript';
import { parseExpectations, parseScreenViews } from '../ai/expectations';
import { PROVIDERS } from '../ai/providers/registry';
import { getDialect } from '../dialects/registry';
import { driveOp } from './drive';
import { encodeBytes } from './bytes';
import { EXEMPTIONS, exemptionFor, reachable, type Caller } from './parity';
import { OPERATIONS, findOperation } from './registry';
import { mcpToolDefinitions } from '../mcp/tools';
import { schemaProblem, withoutUndefined } from './schema';
import { toolDefinitions } from './tools';
import { pureContext, stubSession } from './testSupport';
import type { AssistantRoute, CliRoute } from './types';

/**
 * Every caller held to one list.
 *
 * Every declared operation is reachable from the command line, from the
 * assistant and from the server, or carries a declared exemption with its
 * reason - and an exemption for an operation that is in fact reachable fails
 * too, so the table cannot decay into a list of things nobody rechecked. The
 * route each declaration names is checked against the real surface: the
 * command line's grammar and help, the assistant's tool block and its
 * fenced-block parsers, and the server's own tool listing.
 */

const CALLERS: Caller[] = ['cli', 'assistant', 'mcp'];

/** Whether the command line really has this route: the grammar takes it and the help names it. */
function cliRouteExists(route: CliRoute): boolean {
  if (route.kind === 'operation') {
    const help = parseArgs([route.name, '--help']);
    return help.operation === 'help' && help.topic === route.name;
  }
  // Parsed with a value after it, so an option that takes one is satisfied and
  // one that does not reads the value as the program's path.
  const parsed = () =>
    parseArgs([route.operation, '-m', 'zx81', route.option, 'x']);
  expect(parsed, route.option).not.toThrow();
  return usage(route.operation as 'run').includes(route.option);
}

/** Whether the assistant really has this route: the tool is offered, or the block's parser takes the line. */
function assistantRouteExists(route: AssistantRoute, name: string): boolean {
  if (route.kind === 'tool') {
    return toolDefinitions().some((t) => t.name === name);
  }
  if (route.fence === 'basic-view') {
    const views = parseScreenViews(route.example);
    return views.image || views.text || views.drive;
  }
  if (route.fence === 'basic-expect') {
    return parseExpectations(route.example).every(
      (a) => a.kind !== 'malformed',
    );
  }
  return false;
}

/** Whether the server really offers this operation: it is in what it lists. */
function mcpRouteExists(name: string): boolean {
  return mcpToolDefinitions().some((t) => t.name === name);
}

describe('capability parity', () => {
  it('reaches every operation from every caller, or declares why not', () => {
    for (const op of OPERATIONS) {
      for (const caller of CALLERS) {
        const exemption = exemptionFor(op, caller);
        if (reachable(op, caller)) {
          // The route is not merely declared: it exists on the surface.
          const exists =
            caller === 'cli'
              ? cliRouteExists(op.cli!)
              : caller === 'assistant'
                ? assistantRouteExists(op.assistant!, op.name)
                : mcpRouteExists(op.name);
          expect(exists, `${op.name} on the ${caller}`).toBe(true);
          // And wiring it up forces its exemption out.
          expect(
            exemption,
            `${op.name} is reachable from the ${caller}, so its exemption is stale`,
          ).toBeUndefined();
        } else {
          expect(
            exemption,
            `${op.name} is missing from the ${caller} with no declared reason`,
          ).toBeDefined();
          expect(exemption!.reason.length).toBeGreaterThan(40);
        }
      }
    }
  });

  it('names only operations that exist in the exemption table', () => {
    for (const e of EXEMPTIONS) {
      expect(findOperation(e.operation), e.operation).toBeDefined();
    }
  });

  it('carries no exemption for the caller that both boots a machine and holds one', () => {
    // The two absences on record are the assistant's, and both are because
    // the IDE around it runs the program on the user's own machine. A caller
    // with no IDE is not described by that reason, so nothing is withheld
    // here - and the emptiness is the assertion, because an operation this
    // caller could not serve would have to say why.
    expect(EXEMPTIONS.filter((e) => e.caller === 'mcp')).toEqual([]);
    expect(OPERATIONS.every((op) => reachable(op, 'mcp'))).toBe(true);
  });

  it('reads a provider without tools as a property of the provider, not of any operation', () => {
    // The gate exists, and it is on the whole surface.
    expect(PROVIDERS.some((p) => !p.supportsTools)).toBe(true);
    // The tool set is rendered from nothing a provider could vary: no
    // provider is an argument, and no exemption names one.
    expect(toolDefinitions.length).toBe(0);
    for (const e of EXEMPTIONS) {
      for (const p of PROVIDERS) {
        expect(e.reason.toLowerCase(), e.operation).not.toContain(p.id);
        expect(e.reason, e.operation).not.toContain(p.label);
      }
    }
  });
});

describe('the schedule vocabulary', () => {
  it('lists every action the parser accepts, and no other', () => {
    expect(new Set(DRIVE_ACTIONS.map((a) => a.kind))).toEqual(
      new Set(['press', 'joystick', 'wait', 'waitFor', 'waitEnd', 'expect']),
    );
    for (const action of DRIVE_ACTIONS) {
      expect(parseDriveScript(action.example).map((a) => a.kind)).toEqual([
        action.kind,
      ]);
    }
  });

  it('is described to the shell and to a model identically, separators included', () => {
    const toModel = driveOp.description!;
    // The help wraps a meaning over two lines; the words are what must agree.
    const toShell = usage('run').replace(/\s+/g, ' ');
    for (const action of DRIVE_ACTIONS) {
      expect(toModel, action.kind).toContain(action.syntax);
      expect(toShell, action.kind).toContain(action.syntax);
      expect(toModel, action.kind).toContain(action.meaning);
      expect(toShell, action.kind).toContain(action.meaning);
    }
    expect(toModel).toContain(DRIVE_SEPARATOR_RULE);
    expect(toShell).toContain('separated by ";"');
    // A schedule written on one shell line reads the same to the assistant.
    expect(
      parseDriveScript('WAIT FOR "GO"; PRESS A; WAIT END').map((a) => a.kind),
    ).toEqual(['waitFor', 'press', 'waitEnd']);
  });
});

describe('inputs and outcomes', () => {
  const SOURCE = '10 PRINT "HI"\n';
  const CONVERT_BASE64 = encodeBytes(getDialect('zx81').tokenize(SOURCE).image);

  it("accepts the input the command line's parser produces for each operation", () => {
    const argv: Record<string, string[]> = {
      machines: ['machines'],
      info: ['info', 'zx81'],
      lint: ['lint', 'prog.bas', '-m', 'zx81'],
      build: ['build', 'prog.bas', '-m', 'zx81', '-o', '/tmp/prog.p'],
      check: ['check', 'prog.bas', '-m', 'zx81', '-e', 'checks.txt'],
      convert: ['convert', 'prog.p', '-m', 'zx81'],
      run: [
        'run',
        'prog.bas',
        '-m',
        'zx81',
        '--keys',
        'PRESS A',
        '--frames',
        '3',
        '--screenshot',
        'a.png',
        '--profile',
        '--time',
        '--variables',
      ],
      // The operations that act on the machine a `run --hold` left up. None
      // names a machine or reads a program: the machine is the one that is
      // already there.
      drive: ['drive', 'PRESS A'],
      look: ['look'],
      screenshot: ['screenshot', 'a.png'],
      profile: ['profile'],
      time: ['time'],
      variables: ['variables'],
      expect: ['expect', 'checks.txt'],
    };
    for (const op of OPERATIONS) {
      if (op.cli?.kind !== 'operation') continue;
      const args = parseArgs(argv[op.name]!);
      if (
        args.operation === 'help' ||
        args.operation === 'lsp' ||
        args.operation === 'mcp' ||
        args.operation === 'server'
      ) {
        throw new Error(`${op.name} did not parse as itself`);
      }
      // The texts an operation reads from a file are read by the shim; here
      // they stand in for themselves.
      const input = withoutUndefined({
        ...args.input,
        ...('program' in args ? { source: SOURCE } : {}),
        ...('expectations' in args ? { expectations: 'EXPECT "HI"' } : {}),
        ...('file' in args ? { base64: CONVERT_BASE64 } : {}),
      });
      expect(schemaProblem(op.input, input), op.name).toBeNull();
    }
  });

  it('survives being written as JSON and read back unchanged', async () => {
    const session = stubSession({
      timing: () => ({ bufferId: null, seconds: 1, ending: 'finished' }),
      variables: () => [{ name: 'A', kind: 'number', value: '1' }],
      capture: () => ({ width: 1, height: 1, png: 'AA==' }),
    });
    const ctx = pureContext({ session, defaultMachine: 'zx81' });
    const inputs: Record<string, unknown> = {
      machines: {},
      info: {},
      lint: { source: SOURCE },
      build: { source: SOURCE },
      convert: { base64: CONVERT_BASE64, machine: 'zx81' },
      drive: { script: 'PRESS A' },
      look: {},
      screenshot: {},
      profile: {},
      time: {},
      variables: {},
      expect: { expectations: 'EXPECT VAR A = 1' },
    };
    for (const op of OPERATIONS) {
      // Running and checking boot a machine, and are proved to round-trip
      // where each is run.
      if (op.name === 'run' || op.name === 'check') continue;
      const outcome = await op.run(inputs[op.name], ctx);
      expect(JSON.parse(JSON.stringify(outcome)), op.name).toEqual(outcome);
    }
  });
});
