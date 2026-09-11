// Reference table data for the Dartmouth BASIC page, which two machines read:
// the GE-235 compiling the February 1965 language, and the GE-635 compiling the
// fourth edition of January 1968.
//
// Seeded from the GE-235's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
//
// The page is the union of the two vocabularies, and the union is lopsided: the
// GE-235 has nothing the GE-635 has not, so every unscoped row below is a row
// both machines carry and every `onlyOn: ['ge635']` row is something the fourth
// edition added. keyword-crosscheck.test.ts holds each machine's set of rows in
// exact agreement with its own keyword table in both directions.
//
// What a shared row must never do is answer for one machine. The two differ on
// what INT does either side of zero, on whether a run-time fault stops the
// program, on how wide the paper is, on whether RND takes an argument and on
// whether a FOR tests its limit before the body - so each of those is said in
// the row that has it rather than left to whichever machine the reader happens
// to be on.
//
// The GE-235's facts are read off the surviving February 1965 compiler listing;
// the GE-635's off *BASIC, Fourth Edition* (John G. Kemeny and Thomas E. Kurtz,
// Dartmouth College Computation Center, 1 January 1968), which is the whole of
// the surviving evidence for that machine.
//
// The rows follow the keyword tables' own order - the statements as the
// compiler's jump table decodes them, then the clause words, then the words a
// MAT expression is built from, then the library, then the operators - so a
// reader with the source open finds them in the same place.
import type { BasicReferenceTableData } from './types';
import { withAbbreviations } from './abbreviations';

/** What the fourth edition added, as it is badged on every row that has it. */
const V4 = '4th edition only';

/** The machines those rows belong to: the GE-635 alone. */
const GE635 = ['ge635'];

const dartmouthTable: BasicReferenceTableData = {
  title: 'Dartmouth BASIC',
  machines: ['GE-235', 'GE-635'],
  placeholders: [
    // Two slots no other page needs. A comparison is not a value on either
    // machine - relations exist only between IF and THEN - and what PRINT takes
    // is neither `<expr>` nor `<number>`: a quoted literal is not a value on the
    // GE-235 at all, and on the GE-635 a string is a value but a literal in a
    // PRINT is still not one it could be assigned from.
    {
      id: 'relation',
      meaning: 'one of = < > <= >= <>, and only between IF and THEN',
    },
    {
      id: 'item',
      meaning: 'something to print: a number, a literal in quotes, or a string',
    },
  ],
  entries: [
    {
      name: 'CHANGE',
      kind: 'command',
      domain: 'strings',
      syntax: 'CHANGE <strvar> TO <numvar> | CHANGE <numvar> TO <strvar>',
      description:
        'Takes a string apart into character codes, or builds one back out of them. Left to right it puts the length in the vector’s zero component and the code of each character in the components above; right to left it reads the length back out of the zero component and makes a string that long. This is the whole of the machine’s string machinery — there is no length function, no substring and no concatenation — so reaching one character means changing the string to a vector and back.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'DATA',
      kind: 'command',
      domain: 'data',
      syntax: 'DATA <constant>[, <constant>]…',
      description:
        'Constants for READ to take in turn, gathered from the whole program in line order before it runs. On the GE-235 they are numbers and nothing else, the pointer only moves forwards, and a program may carry 128 of them in all. The GE-635 keeps two independent blocks, one numeric and one string, and matches each constant to the type of the variable reading it; a string there needs no quotes if it starts with a letter, and must have them if it starts with anything else or holds a comma.',
    },
    {
      name: 'DEF',
      kind: 'command',
      domain: 'control-flow',
      syntax:
        'DEF FN<name>(<param>) = <number> | DEF FN<name>([<param>[, <param>]…])',
      description:
        'Defines a function. The name is FN followed by a letter, and unlike the later BASICs that copied it the definition need not have run before the call: every DEF is collected before anything executes, so a function may be defined at the foot of the program and used at the top. The GE-235 takes one parameter and one line. The GE-635 takes none, one or several, and a DEF written without the = runs on over as many lines as it likes to an FNEND, its value being whatever the body last assigned to the function’s own name.',
    },
    {
      name: 'DIM',
      kind: 'command',
      domain: 'data',
      syntax: 'DIM <var>(<number>[, <number>])',
      description:
        'Declares an array bigger than the 11, or 11 by 11, any subscripted name gets for free. Subscripts count from 0, so DIM A(20) has twenty-one elements, and several arrays may be declared in one statement, separated by commas. On the GE-235 the bounds must be plain constants — nothing is evaluated there. The GE-635 dimensions a string vector the same way, which is the only kind of array a string may have: there are no string matrices.',
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
      name: 'FNEND',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FNEND',
      description:
        'Closes a multiple-line DEF. The lines between the two are the body, and the function’s value is whatever was last assigned to its own name; nothing may jump into or out of the range, so the body is reached only by calling it.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'FOR',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'FOR <numvar> = <number> TO <number> [STEP <number>]',
      description:
        'Opens a counting loop that runs to the matching NEXT. STEP sets the increment, which may be negative or fractional; left out it is 1. The loop variable is a plain variable and keeps its value after the loop ends. The two machines test the limit at opposite ends: the GE-235 runs the body and then tests, so a loop always runs once, while the GE-635 tests on entry — written FOR Z = 2 TO -2 with no negative step, its body is never performed. Thirteen loops may be open at once on the GE-235.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'GOSUB <line>',
      description:
        'Calls a subroutine, remembering the line to come back to, and RETURN comes back. On the GE-235 calls may nest 162 deep — the return stack is whatever the run-time leaves free. The GE-635’s manual states no depth, and going too deep there is one of the few faults that stops the program outright.',
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
        'Compares two values and jumps when the comparison holds. The line number is the whole of what THEN may take: there is no THEN followed by a statement and no ELSE, so a two-way choice is a jump over a jump. There is no AND, OR or NOT on either machine, so a compound test is a chain of IFs each jumping to the next. On the GE-635 the two sides may be strings, compared in alphabetical order with trailing blanks ignored.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      domain: 'input',
      syntax: 'INPUT <var>[, <var>]…',
      description:
        'Prints a question mark and waits for values to be typed at the teletype, one per variable, separated by commas. It takes no prompt string on either machine — PRINT the wording first, ending it with a semicolon to keep the question mark on the same line. The GE-235 reads numbers only. The GE-635 reads a string into a string variable, which is the only way a program there can read a letter.',
    },
    {
      name: 'LET',
      kind: 'command',
      domain: 'data',
      syntax: 'LET <var> = <expr>',
      description:
        'Assigns a value, to a variable or to an array element. The keyword is mandatory on both machines and in no later BASIC: a line opening with a letter reaches no statement at all, so 10 A=1 is rejected as a bad instruction. The GE-635 allows the assignment to be chained — LET X = Y3 = A(3,1) = 1 gives the one value to all three.',
    },
    {
      name: 'MAT',
      kind: 'command',
      domain: 'data',
      syntax: 'MAT <letter> = <expr> | MAT READ <letter> | MAT PRINT <letter>',
      description:
        'Operates on a whole vector or matrix in one statement. MAT READ, MAT PRINT and MAT INPUT move a whole array at a time; MAT B = A copies, and A+B, A-B, A*B, TRN(A), (K)*A and INV(A) build one. Naming a size — MAT READ M(17,30), MAT M = CON(7,3) — redimensions as it goes. Every array has a row and column 0 and MAT ignores them, so a MAT READ M(2,2) reads four elements and zeroes what row 0 held.',
      tag: V4,
      onlyOn: GE635,
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
      name: 'ON',
      kind: 'command',
      domain: 'control-flow',
      syntax: 'ON <number> GO TO <line>[, <line>]…',
      description:
        'Jumps to the first line listed when the value is 1, the second when it is 2, and so on; the value is truncated to a whole number first. A value below 1 or past the end of the list stops the program. It is the machine’s only computed jump — there is no ON … GOSUB.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'PRINT',
      kind: 'command',
      domain: 'text-screen',
      syntax: 'PRINT [<item>][;|,]…',
      description:
        'Prints values and quoted literals on the paper. A comma moves to the next of five fifteen-column zones; a semicolon packs items up, each number already carrying a leading sign-or-space and a trailing blank. Either one at the end of the statement holds the line open for the next PRINT. The line is 72 columns on the GE-235 and 75 on the GE-635, where TAB may also be used to place the carriage.',
    },
    {
      name: 'RANDOM',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RANDOM',
      description:
        'The manual’s own short spelling of RANDOMIZE, and the same statement.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'RANDOMIZE',
      kind: 'command',
      domain: 'numeric',
      syntax: 'RANDOMIZE',
      description:
        'Reseeds RND so that repeated runs differ. Without it the sequence is the same every time, which is what makes a program repeatable while it is being written — put the RANDOMIZE in last.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'READ',
      kind: 'command',
      domain: 'data',
      syntax: 'READ <var>[, <var>]…',
      description:
        'Takes the next constants from the DATA statements, one per variable. Reading past the last of them stops the program on both machines. On the GE-235 that is final — there is no RESTORE, so a list can be read once and once only; the GE-635 can wind either of its two blocks back and read them again.',
    },
    {
      name: 'REM',
      kind: 'command',
      domain: 'program-editing',
      syntax: 'REM <comment>',
      description:
        'A remark, ignored to the end of the line. It is a statement like any other, so it needs a line number of its own. The GE-635 has a second form for the same job: an apostrophe at the end of a working line starts a remark — except on a line ending inside a string, which swallows it.',
    },
    {
      name: 'RESTORE',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE',
      description:
        'Winds both DATA pointers back to the first constant, so the whole list can be read again. Numeric and string DATA are separate blocks here, and this is the statement that restores them together.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'RESTORE$',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE$',
      description:
        'Winds only the string DATA back, leaving the numeric pointer where it stands.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'RESTORE*',
      kind: 'command',
      domain: 'data',
      syntax: 'RESTORE*',
      description:
        'Winds only the numeric DATA back, leaving the string pointer where it stands.',
      tag: V4,
      onlyOn: GE635,
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
        'Halts the program wherever it stands, exactly as reaching END would. Nothing resumes afterwards: neither machine has a CONT.',
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
        'The limit of a FOR loop. Because blanks are deleted before the line is read, a variable name cannot contain it — but no name here is long enough to, so the trap that catches TOTAL on later machines cannot arise. CHANGE borrows the word to separate its two variables.',
    },
    {
      name: 'CON',
      kind: 'operator',
      domain: 'data',
      syntax: 'MAT <letter> = CON[(<number>[, <number>])]',
      description:
        'Stands for an array of ones, and only inside a MAT. Given a size it redimensions the array it fills; given none it fills the array at whatever size it already has.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'IDN',
      kind: 'operator',
      domain: 'data',
      syntax: 'MAT <letter> = IDN',
      description:
        'Stands for the identity matrix — ones down the diagonal, zeros elsewhere — at the size the array already has. It is the matrix MAT A = B*INV(B) should give back.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'INV',
      kind: 'function',
      domain: 'data',
      syntax: 'MAT <letter> = INV(<letter>)',
      description:
        'The inverse of a square matrix, and only inside a MAT. DET afterwards gives the determinant of what was inverted, which is how a program tells a singular matrix from an invertible one.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'TRN',
      kind: 'function',
      domain: 'data',
      syntax: 'MAT <letter> = TRN(<letter>)',
      description:
        'The transpose of a matrix — rows for columns — and only inside a MAT. The result is redimensioned to fit, so a 3 by 7 transposed gives a 7 by 3.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'ZER',
      kind: 'operator',
      domain: 'data',
      syntax: 'MAT <letter> = ZER[(<number>[, <number>])]',
      description:
        'Stands for an array of zeros, and only inside a MAT. Given a size it redimensions the array it clears, which is the usual way to set a working size before a MAT READ.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'ABS',
      kind: 'function',
      domain: 'numeric',
      syntax: 'ABS(<number>)',
      description:
        'The absolute value. The GE-235 has no SGN to pair it with, so the sign of X there is X/ABS(X), guarded against zero.',
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
      name: 'COT',
      kind: 'function',
      domain: 'numeric',
      syntax: 'COT(<number>)',
      description:
        'Cotangent of an angle given in radians, which is 1/TAN(X) without the division. There is no SEC and no CSC to go with it.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'DET',
      kind: 'function',
      domain: 'data',
      syntax: 'DET',
      description:
        'The determinant of the matrix the last MAT INV inverted. It takes no argument and means nothing before an inversion has happened; a determinant of zero says the inverse it just produced is worthless.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'EXP',
      kind: 'function',
      domain: 'numeric',
      syntax: 'EXP(<number>)',
      description:
        'e raised to the given power. Far enough either way and the result overflows or underflows: the GE-235 stops for it, while the GE-635 prints the fault, supplies a value and carries on.',
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
        'The whole-number part, and the one place the two machines disagree about arithmetic. The GE-635 floors, so INT(-2.35) is -3 and INT(X+.5) rounds; the GE-235 walks towards zero from both sides, so INT(-2.35) is -2 and the same expression trims rather than rounds. It is also the rule applied to an array subscript.',
    },
    {
      name: 'LOG',
      kind: 'function',
      domain: 'numeric',
      syntax: 'LOG(<number>)',
      description:
        'Natural logarithm. There is no LOG10, so divide by LOG(10). Zero and negative arguments each have a fault of their own, which stops the GE-235 and which the GE-635 prints before carrying on.',
    },
    {
      name: 'NUM',
      kind: 'function',
      domain: 'input',
      syntax: 'NUM',
      description:
        'How many values the last MAT INPUT actually read. It takes no argument, and it is the only way to find out how long a typed list was: MAT INPUT accepts as many as the operator cares to type, up to the array’s size.',
      tag: V4,
      onlyOn: GE635,
    },
    {
      name: 'RND',
      kind: 'function',
      domain: 'numeric',
      syntax: 'RND(<number>) | RND',
      description:
        'The next number in a sequence between 0 and 1. The GE-235 requires an argument and ignores it, and its sequence is the same on every run — there is no RANDOMIZE, so a program wanting variety asks the user for a number and folds it in itself. The GE-635 takes no argument at all, which is why its own examples read INT(10*RND), and RANDOMIZE reseeds it.',
    },
    {
      name: 'SGN',
      kind: 'function',
      domain: 'numeric',
      syntax: 'SGN(<number>)',
      description:
        'The sign of the argument: 1 above zero, 0 at it, -1 below. It is what saves the GE-235’s X/ABS(X) and its guard against zero.',
      tag: V4,
      onlyOn: GE635,
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
        'Square root. A negative argument stops the GE-235; the GE-635 prints the fault, takes the root of the absolute value and carries on.',
    },
    {
      name: 'TAB',
      kind: 'function',
      domain: 'text-screen',
      syntax: 'PRINT TAB(<col>)',
      description:
        'Moves the carriage to a column, counted from 0, and only inside a PRINT. The positions on a line are numbered 0 through 74 and 75 is position 0 of the next line; a TAB to a column the carriage is already past does nothing rather than starting a new line.',
      tag: V4,
      onlyOn: GE635,
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
        'Raises to a power, binding tighter than anything else and grouping left to right, so A↑B↑C raises A to the B and that result to the C. It is the up arrow printed on the Teletype Model 33 keyboard, where a later machine has ^; neither ^ nor ** exists here. The GE-235 stops for zero to a negative power or a negative number raised to anything; the GE-635 multiplies a negative base out when the exponent is a whole number, and otherwise prints a fault, uses the absolute value and carries on.',
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
        'Divide. There is no integer division and no remainder operator, so write A-B*INT(A/B). Division by zero stops the GE-235; the GE-635 prints the fault, supplies a very large number and carries on.',
    },
    {
      name: '+',
      kind: 'operator',
      domain: 'numeric',
      syntax: '<number> + <number>',
      description:
        'Add. There is nothing else it can do on either machine: the GE-235 has no string type, and the GE-635 has strings but no concatenation operator to join them with.',
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
      syntax: 'LET <var> = <expr> | IF <expr> = <expr> THEN <line>',
      description:
        'Assignment in a LET, equality between IF and THEN. The two are separate jobs rather than one: a comparison is not a value here, so it cannot be assigned, printed or added to anything.',
    },
    {
      name: '<',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <expr> < <expr> THEN <line>',
      description:
        'Less than. On the GE-635 it also orders strings, where it means earlier in alphabetical order and trailing blanks do not count, so "YES" and "YES " are equal.',
    },
    {
      name: '>',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <expr> > <expr> THEN <line>',
      description: 'Greater than.',
    },
    {
      name: '<=',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <expr> <= <expr> THEN <line>',
      description:
        'Less than or equal. The decoder reads the < first, so =< is not another spelling of it.',
    },
    {
      name: '>=',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <expr> >= <expr> THEN <line>',
      description:
        'Greater than or equal, and as with <= only in that order — => is refused.',
    },
    {
      name: '<>',
      kind: 'operator',
      domain: 'numeric',
      syntax: 'IF <expr> <> <expr> THEN <line>',
      description: 'Not equal. There is no other spelling of it.',
    },
  ],
};

/**
 * The page as it renders: each row carries the short spellings its keyword can
 * be typed as, derived from each machine's own resolution order rather than
 * authored above. There are none on either machine — both compilers read whole
 * words — so the rows come back unchanged. See ./abbreviations.
 */
export const dartmouthReference: BasicReferenceTableData = withAbbreviations(
  'dartmouth',
  dartmouthTable,
);
