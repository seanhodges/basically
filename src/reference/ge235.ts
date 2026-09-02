// Reference table data for the Dartmouth BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// Every row is a word in src/dialects/ge235/keywords.ts, which was read off the
// February 1965 compiler source rather than inferred from a later BASIC;
// keyword-crosscheck.test.ts holds the two in exact agreement in both
// directions. The table is the shortest BASIC one here for a reason: this is
// the first BASIC there was, and almost everything a reader expects to find
// arrives in a later edition.
//
// The rows follow the keyword table's own order - the statements as the
// compiler's jump table decodes them, then the clause words, then the library,
// then the operators - so a reader with the source open finds them in the same
// place.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

const ge235Table: BasicReferenceTableData = {
  title: 'Dartmouth BASIC',
  machines: ['GE-235'],
  placeholders: [
    // Two slots no other page needs, because no other page has a BASIC this
    // small. A comparison is not a value here - relations exist only between
    // IF and THEN - and there is no string type for `<expr>` to cover, so what
    // PRINT takes is a number or a literal and nothing in between.
    {
      id: 'relation',
      meaning: 'one of = < > <= >= <>, and only between IF and THEN',
    },
    { id: 'item', meaning: 'a numeric expression, or a literal in quotes' },
  ],
  entries: [
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Constants for READ to take in turn, gathered from the whole program in line order before it runs. They are numbers: there is nothing else to hold. The pointer only moves forwards — this BASIC has no RESTORE to wind it back — and a program may carry 128 constants in all.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'DEF FN<name>(<numvar>) = <number>',
      description:
        'Defines a one-line function of one argument. The name is FN followed by a variable name, and unlike the later BASICs that copied it the definition need not have run before the call: the compiler collects every DEF before anything executes, so a function may be defined at the foot of the program and used at the top.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <letter>(<number>[, <number>])',
      description:
        'Declares an array bigger than the 11 by 11 any subscripted letter gets for free. Subscripts count from 0, so DIM A(20) has twenty-one elements, and several arrays may be declared in one statement, separated by commas. The bounds must be plain constants — nothing is evaluated here.',
    },
    {
      name: 'END',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'END',
      description:
        'Ends the program. It is not optional and it is not merely conventional: the compiler refuses a program without one, and refuses one whose END is not the highest-numbered line.',
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs to the matching NEXT. STEP sets the increment, which may be negative or fractional; left out it is 1. Thirteen loops may be open at once, and the loop variable is a plain variable that keeps its value after the loop ends.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, remembering the line to come back to. Calls may nest 162 deep — the return stack is whatever the run-time leaves free — and RETURN comes back.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOTO <line>',
      description:
        'Jumps to a line number. Blanks are deleted before the line is read, so GO TO written as two words is the same statement.',
    },
    {
      name: 'IF',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'IF <number> <relation> <number> THEN <line>',
      description:
        'Compares two numbers and jumps when the comparison holds. The line number is the whole of what THEN may take: there is no THEN followed by a statement and no ELSE, so a two-way choice is a jump over a jump.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT <numvar>[, <numvar>]…',
      description:
        'Prints a question mark and waits for numbers to be typed at the teletype, one per variable, separated by commas. It takes no prompt string — PRINT the wording on the line before — and it reads numbers only. This is the only way a program can read the keyboard.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <numvar> = <number>',
      description:
        'Assigns a value, to a variable or to an array element. The keyword is mandatory here and in no later BASIC: a line opening with a letter reaches no statement at all, so 10 A=1 is rejected as a bad instruction.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'NEXT <numvar>',
      description:
        'Adds the step, tests the limit, and goes back to the FOR when the loop is not finished. The variable must be named and must be the innermost open loop, so loops cannot be closed out of order or several at once.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<item>][;|,]…',
      description:
        'Prints numbers and quoted literals on the paper. A comma moves to the next of five fifteen-column zones; a semicolon adds nothing at all, because every number already prints with two trailing blanks. Either one at the end of the statement holds the line open for the next PRINT.',
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <numvar>[, <numvar>]…',
      description:
        'Takes the next constants from the DATA statements, one per variable. Reading past the last of them stops the program: there is no RESTORE, so a list can be read once and once only.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A remark, ignored to the end of the line. It is a statement like any other, so it needs a line number of its own and cannot be tacked onto the end of a working line.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'RETURN',
      description:
        'Returns to the statement after the GOSUB that called this subroutine. Reaching one with no call outstanding stops the program.',
    },
    {
      name: 'STOP',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'STOP',
      description:
        'Halts the program wherever it stands, exactly as reaching END would. Nothing resumes afterwards: this BASIC has no CONT.',
    },
    {
      name: 'STEP',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> STEP <number>',
      description:
        'The amount a FOR loop adds each time round, which may be negative or fractional. Without it the step is 1.',
    },
    {
      name: 'THEN',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'IF <number> <relation> <number> THEN <line>',
      description:
        'Introduces what an IF does, and all it may introduce is a line number to jump to. THEN followed by a statement is a later idea.',
    },
    {
      name: 'TO',
      kind: 'operator',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number>',
      description:
        'The limit of a FOR loop, tested at the NEXT. Because blanks are deleted before the line is read, a variable name cannot contain it — but no name here is long enough to, so the trap that catches TOTAL on later machines cannot arise.',
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description:
        'The absolute value. There is no SGN to pair it with: the sign of X is X/ABS(X), guarded against zero.',
    },
    {
      name: 'ATN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ATN(<number>)',
      description:
        'Arctangent, in radians, between -π/2 and π/2. There is no two-argument form and no π constant — write 4*ATN(1).',
    },
    {
      name: 'COS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COS(<number>)',
      description: 'Cosine of an angle given in radians.',
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description:
        'e raised to the given power. Far enough either way and the result overflows or underflows, and both stop the program rather than settling for infinity or zero.',
    },
    {
      name: 'FN',
      kind: 'function',
      domain: 'control-flow',
      syntax: 'FN<name>(<arg>)',
      description:
        'Calls a function DEF defined. The argument is substituted into the definition wherever its parameter appears; a name no DEF defines is a compile fault, not a run-time one.',
    },
    {
      name: 'INT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'INT(<number>)',
      description:
        'The greatest integer not above the argument, so INT(-2.5) is -3. It is also the rule applied to an array subscript.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Natural logarithm. Zero and negative arguments each stop the program with a fault of their own; there is no LOG10, so divide by LOG(10).',
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>)',
      description:
        'The next number in a fixed sequence between 0 and 1. The argument is ignored, and the sequence is the same on every run — there is no RANDOMIZE, so a program wanting variety asks the user for a number and folds it in itself.',
    },
    {
      name: 'SIN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SIN(<number>)',
      description: 'Sine of an angle given in radians.',
    },
    {
      name: 'SQR',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SQR(<number>)',
      description:
        'Square root. A negative argument stops the program rather than returning anything.',
    },
    {
      name: 'TAN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'TAN(<number>)',
      description: 'Tangent of an angle given in radians.',
    },
    {
      name: '↑',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> ↑ <number>',
      description:
        'Raises to a power, binding tighter than anything else. It is the up arrow printed on the Teletype Model 33 keyboard, where a later machine has ^; neither ^ nor ** exists here. Zero to a negative power and a negative number to a fractional power each stop the program.',
    },
    {
      name: '*',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> * <number>',
      description: 'Multiply.',
    },
    {
      name: '/',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> / <number>',
      description:
        'Divide. Division by zero stops the program; there is no integer division and no remainder operator, so write A-B*INT(A/B).',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number>',
      description:
        'Add. There is nothing else it can do: with no string type there is no concatenation.',
    },
    {
      name: '-',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> - <number>',
      description: 'Subtract, and negate a single operand.',
    },
    {
      name: '=',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'LET <numvar> = <number> | IF <number> = <number> THEN <line>',
      description:
        'Assignment in a LET, equality between IF and THEN. The two are separate jobs rather than one: a comparison is not a value here, so it cannot be assigned, printed or added to anything.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <number> < <number> THEN <line>',
      description: 'Less than.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <number> > <number> THEN <line>',
      description: 'Greater than.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <number> <= <number> THEN <line>',
      description:
        'Less than or equal. The decoder reads the < first, so =< is not another spelling of it.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <number> >= <number> THEN <line>',
      description:
        'Greater than or equal, and as with <= only in that order — => is refused.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <number> <> <number> THEN <line>',
      description: 'Not equal. There is no other spelling of it.',
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from the machine's own resolution order rather than
 * authored above. There are none here — the compiler reads whole words — so the
 * rows come back unchanged. See ./abbreviations.
 */
export const ge235Reference: BasicReferenceTableData = withAbbreviations(
  'ge235',
  ge235Table,
);
