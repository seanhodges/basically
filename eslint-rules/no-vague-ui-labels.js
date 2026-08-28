// A control's `title` and `aria-label` say what activating it does, in a short
// imperative phrase, sentence case, no trailing period - "Open documentation",
// not "Documentation". See CLAUDE.md > Conventions > UI labels.
//
// Deciding whether a phrase is imperative needs part-of-speech tagging, and a
// regex that tries is wrong in both directions: it passes "Documentation" and
// fails "Run to the next BASIC line". So this rule checks only signals it can
// be sure about, and leaves judging a newly invented noun label to review:
//
//   | check                | why it is safe                                   |
//   | -------------------- | ------------------------------------------------ |
//   | trailing period      | labels are phrases, not sentences                |
//   | over the budget      | past 60 chars a tooltip is prose in the wrong slot|
//   | leading gerund       | "Running…" is reliably not imperative            |
//   | hard-coded keystroke | the shortcut map is the source of truth          |
//   | two machines named   | src/dialects/registry.ts is the source of truth  |
//   | title vs aria-label  | one control, one name                            |
//   | VAGUE_LABELS         | exact strings already judged category-not-action  |
//
// Only plain string literals are inspected. A label built from user data,
// from the live shortcut map (`withKeys(...)`) or from dialect data is a
// template literal or an expression, and is never flagged - which is also why
// the fix for a hard-coded keystroke is to route the string through the
// shortcut map rather than to reword it.
//
// The gerund and VAGUE_LABELS checks apply only to elements the user can
// activate. Everything else legitimately takes a noun: a dialog, a tablist or
// an iframe is named for what it *is*, a form field for the value it holds,
// and a status region reads "Loading" precisely because it is not a command.

// Past this, a tooltip is prose. The audit that introduced this rule found
// every label the reviewers were happy with at 55 chars or under, and every
// one they wanted cut at 61 or over.
const MAX_LABEL_LENGTH = 60;

// Exact strings this audit judged to name a category rather than an action.
// A ratchet against re-introducing a known-bad label, not a complete judge.
const VAGUE_LABELS = new Set([
  'AI code generation',
  'Documentation',
  'Edit actions',
  'Memory map',
  'More actions',
  'New tab',
  'Outline',
  'Profiler report',
  'Run actions',
  'Settings',
  'Tab actions',
  'Zoom',
]);

// Elements the user activates. A `role` literal, where there is one, decides:
// `<div role="button">` is a control and `<span role="img">` is not.
const CONTROL_ELEMENTS = new Set(['a', 'button', 'summary']);
const CONTROL_ROLES = new Set([
  'button',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'switch',
  'tab',
]);

// Ordinary English words that end in "ing" and open an imperative phrase are
// rare; these are the ones that would otherwise read as a gerund.
const NOT_GERUNDS = new Set(['bring', 'string', 'thing']);
const LEADING_WORD = /^([A-Za-z]+)\b/;

// A chord a label states instead of reading from the shortcut map, so that
// rebinding the shortcut leaves the label lying.
const HARD_CODED_CHORD = /\b(?:Ctrl|Cmd|Command|Alt|Option|Shift|Meta)\s*[+/]/i;

// Machine and dialect names. Which machines the IDE supports changes with
// every port, so copy that lists them is wrong from the next port onwards.
const MACHINE_NAMES =
  /\b(?:ZX ?80|ZX ?81|ZX ?Spectrum|Spectrum|Sinclair|Commodore|C64|VIC-?20|PET|BBC ?Micro|Acorn|Electron|Amstrad|CPC|MSX|Tandy|TRS-?80|Dragon ?32|Oric|Jupiter ?Ace)\b/gi;

/** The value of a JSX attribute, when it is a plain string literal. */
function literalValue(attribute) {
  const value = attribute.value;
  if (!value) return null;
  if (value.type === 'Literal' && typeof value.value === 'string') {
    return value.value;
  }
  return null;
}

/** Whether this opening element is something the user activates. */
function isControl(node) {
  const role = node.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name.name === 'role',
  );
  if (role) {
    const named = literalValue(role);
    // A role built from an expression could be anything; assume it is not a
    // control, so the judgement calls stay with review rather than the rule.
    return named !== null && CONTROL_ROLES.has(named);
  }
  return (
    node.name.type === 'JSXIdentifier' && CONTROL_ELEMENTS.has(node.name.name)
  );
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'UI labels name the action, in one voice, and tell the truth.',
    },
    schema: [],
    messages: {
      trailingPeriod:
        '{{attr}} ends in a period. A label is a phrase, not a sentence - drop it.',
      tooLong:
        '{{attr}} is {{length}} characters; the budget is {{budget}}. Cut it to a phrase, ' +
        'and put the explanation in the documentation the control can open.',
      gerund:
        '{{attr}} opens with "{{word}}". Say what activating the control does - ' +
        '"Open the file", not "Opening the file".',
      hardCodedChord:
        '{{attr}} spells out a keyboard shortcut, so it lies the moment the shortcut is ' +
        'rebound. Read the binding from the shortcut map instead (see withKeys in Toolbar.tsx).',
      machineList:
        '{{attr}} names the machines ({{machines}}). src/dialects/registry.ts is the source ' +
        'of truth for which exist - say what the control does without listing them.',
      disagree:
        'title "{{title}}" and aria-label "{{label}}" name the same control two ways. ' +
        'Give it one name: the title may add a suffix to the aria-label, not replace it.',
      vague:
        '"{{label}}" names a category, not an action. Say what activating the control ' +
        'does - "Open documentation", not "Documentation".',
    },
  },
  create(context) {
    /** Checks every label carries, control or not. */
    const checkAny = (attribute, text, attr) => {
      if (/\.$/.test(text.trim())) {
        context.report({
          node: attribute,
          messageId: 'trailingPeriod',
          data: { attr },
        });
      }
      if (text.length > MAX_LABEL_LENGTH) {
        context.report({
          node: attribute,
          messageId: 'tooLong',
          data: { attr, length: text.length, budget: MAX_LABEL_LENGTH },
        });
      }
      if (HARD_CODED_CHORD.test(text)) {
        context.report({
          node: attribute,
          messageId: 'hardCodedChord',
          data: { attr },
        });
      }
      const machines = [...new Set(text.match(MACHINE_NAMES) ?? [])];
      if (machines.length > 1) {
        context.report({
          node: attribute,
          messageId: 'machineList',
          data: { attr, machines: machines.join(', ') },
        });
      }
    };

    /** Checks that only make sense for something the user activates. */
    const checkControl = (attribute, text, attr) => {
      const word = LEADING_WORD.exec(text)?.[1] ?? '';
      if (
        word.length >= 5 &&
        /ing$/i.test(word) &&
        !NOT_GERUNDS.has(word.toLowerCase())
      ) {
        context.report({
          node: attribute,
          messageId: 'gerund',
          data: { attr, word },
        });
      }
      if (VAGUE_LABELS.has(text)) {
        context.report({
          node: attribute,
          messageId: 'vague',
          data: { label: text },
        });
      }
    };

    return {
      JSXOpeningElement(node) {
        const control = isControl(node);
        const labels = new Map();
        for (const attribute of node.attributes) {
          if (attribute.type !== 'JSXAttribute') continue;
          const attr = attribute.name.name;
          if (attr !== 'title' && attr !== 'aria-label') continue;
          const text = literalValue(attribute);
          if (text === null) continue;
          labels.set(attr, { attribute, text });
          checkAny(attribute, text, attr);
          if (control) checkControl(attribute, text, attr);
        }
        // An icon-only control carries both, and identical is the correct
        // pairing: the title explains the glyph on hover, the aria-label is
        // what a screen reader announces. What is a defect is a title that
        // does not start with the announced name - one control, two names.
        // (A title that extends it, with a shortcut or a hint, still agrees.)
        const title = labels.get('title');
        const label = labels.get('aria-label');
        if (title && label && !title.text.startsWith(label.text)) {
          context.report({
            node: title.attribute,
            messageId: 'disagree',
            data: { title: title.text, label: label.text },
          });
        }
      },
    };
  },
};
