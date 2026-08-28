import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './no-vague-ui-labels.js';

// RuleTester reaches for describe/it as globals; vitest doesn't publish them.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
});

ruleTester.run('no-vague-ui-labels', rule as never, {
  valid: [
    // The house style: an imperative phrase, sentence case, no full stop.
    '<button title="Open documentation" />',
    '<button aria-label="Save a screenshot" />',
    // An icon-only control carries both, and identical is the right pairing.
    '<button title="Close memory map" aria-label="Close memory map" />',
    // A title may extend the announced name with a hint.
    '<button title="Save a screenshot of the machine screen" aria-label="Save a screenshot" />',
    // Labels built from the shortcut map, user data or dialect data are
    // expressions, and are the rule's blind spot on purpose.
    "<button title={withKeys('Play the program', 'run.play')} />",
    '<button title={`Rename ${buffer.name}`} />',
    // A noun names a region, a dialog, a frame or a form field correctly.
    '<div role="dialog" aria-label="Documentation" />',
    '<div role="tablist" aria-label="Profiler report" />',
    '<iframe title="Documentation" />',
    '<input aria-label="Fill from address" />',
    // A status region reads as a gerund precisely because it is not a command.
    '<svg role="img" aria-label="Loading" />',
    // One machine named in passing is not a list of the machines.
    '<button title="Open this program in the BBC Micro emulator" />',
    // A leading word that merely ends in "ing".
    '<button title="String the blocks together" />',
  ],
  invalid: [
    {
      code: '<button title="Open the documentation." />',
      errors: [{ messageId: 'trailingPeriod' }],
    },
    {
      // 61 characters: one over the budget.
      code: '<button title="List procedures, subroutines and jump targets in this program" />',
      errors: [{ messageId: 'tooLong' }],
    },
    {
      code: '<button title="Running the program in the emulator" />',
      errors: [{ messageId: 'gerund' }],
    },
    {
      code: '<button title="Renumber the current line (Ctrl/Cmd+Alt+R)" />',
      errors: [{ messageId: 'hardCodedChord' }],
    },
    {
      code: '<button title="Export for the ZX81, the Spectrum or the C64" />',
      errors: [{ messageId: 'machineList' }],
    },
    {
      // The zoom slider: one control, two names.
      code: '<input title="Zoom" aria-label="Zoom level" />',
      errors: [{ messageId: 'disagree' }],
    },
    {
      code: '<button title="Documentation" />',
      errors: [{ messageId: 'vague' }],
    },
    {
      // A category name on a control reached through an explicit role.
      code: '<div role="menuitem" aria-label="Settings" />',
      errors: [{ messageId: 'vague' }],
    },
  ],
});
