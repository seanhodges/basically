/**
 * Thrown for the things a caller gets wrong, as against a bad program.
 *
 * Its own module, with no import at all, so the operation layer and the
 * language server can raise it without pulling the listing runner - and the
 * filesystem it reads ROMs through - into a browser bundle. The command line
 * maps it onto the exit code reserved for a bad invocation.
 */
export class RunError extends Error {}
