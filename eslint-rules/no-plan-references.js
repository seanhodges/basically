// Comments must describe the code, not the plan that produced it. Per-dialect
// plans under docs/contributing/dialect-plans/ and OpenSpec change folders are
// deleted once the work ships, so a comment naming one is dead the day the work
// lands - and in practice half of them describe work that never shipped at all.
// See CLAUDE.md > Conventions > Comments.
//
// Only the `stage + number/letter` form is matched. A bare "stage" is live
// vocabulary here: requests carry a `stage` field, and the disk tests "stage a
// filename". Likewise a bare "plan" is the AI assistant's apply-plan object.

const PATTERNS = [
  // "Stage 3", "Stage-4", "stages 2".
  { re: /\bstages?[\s-]+\d/i, hint: 'a plan stage' },
  // "Stage G". Case-sensitive on both halves, so "stage a filename" is clear.
  { re: /\bStages?[\s-]+[A-Z]\b/, hint: 'a plan stage' },
  // The retired per-dialect plan folder.
  { re: /\bdialect-plans?\b/i, hint: 'the dialect-plans folder' },
  // "the memory-blocks plan", "the edit-export plan".
  { re: /\bthe\s+[a-z0-9]+(?:-[a-z0-9]+)+\s+plans?\b/i, hint: 'a named plan' },
  // "the plan said/expected/accepts", "per the plan", "the plan's Memory tab".
  {
    re: /\bplan(?:'s)?\s+(?:said|says|expected|expects|calls?\s+for|called\s+for|specified|accepts?|wants?)\b/i,
    hint: 'a plan',
  },
  { re: /\bper\s+the\s+plan\b/i, hint: 'a plan' },
  // A plan document by filename.
  { re: /\b[\w-]*plan[\w-]*\.md\b/i, hint: 'a plan document' },
  // "the block editor lands in a later stage". Only sequencing words - a bare
  // "the stage" is ordinary English, and "first/last stage" is an audio filter.
  {
    re: /\b(?:later|earlier|subsequent|future)\s+stages?\b/i,
    hint: 'an unnamed plan stage',
  },
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Comments must describe the code, not a planning artifact.',
    },
    schema: [],
    messages: {
      planReference:
        'Comment refers to {{hint}}. Plans are deleted once the work ships, so this rots. ' +
        'State what the code does today, and delete anything that never shipped.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    return {
      Program() {
        for (const comment of source.getAllComments()) {
          for (const { re, hint } of PATTERNS) {
            if (re.test(comment.value)) {
              context.report({
                loc: comment.loc,
                messageId: 'planReference',
                data: { hint },
              });
              break;
            }
          }
        }
      },
    };
  },
};
