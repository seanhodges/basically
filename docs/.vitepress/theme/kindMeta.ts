// Shared presentation metadata for reference-entry kinds: the canonical display
// order and the Lucide-style icon/label for each kind. Extracted so both
// ReferenceTable.vue and DialectCompare.vue render kinds identically instead of
// keeping two copies that could drift.
import type { ReferenceEntry } from '../../reference/data/types';

/** Canonical display order; BASIC kinds first, then the assembly kinds. */
export const KIND_ORDER: ReferenceEntry['kind'][] = [
  'command',
  'function',
  'operator',
  'instruction',
  'directive',
];

/** Inline Lucide-style SVG paths for each entry kind (rendered at ~14px). */
export const KIND_META: Record<
  ReferenceEntry['kind'],
  { label: string; plural: string; paths: string }
> = {
  command: {
    label: 'Command',
    plural: 'Commands',
    paths:
      '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  },
  function: {
    label: 'Function',
    plural: 'Functions',
    paths:
      '<path d="M7 4h2a3 3 0 0 0-3 3v3a3 3 0 0 1-3 3 3 3 0 0 1 3 3v3a3 3 0 0 0 3 3H7"/>',
  },
  operator: {
    label: 'Operator',
    plural: 'Operators',
    paths:
      '<line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="14" y1="4" x2="10" y2="20"/>',
  },
  instruction: {
    label: 'Instruction',
    plural: 'Instructions',
    // A CPU chip - the mnemonic that runs on the processor.
    paths:
      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/><path d="M20 9h2"/><path d="M20 14h2"/><path d="M2 9h2"/><path d="M2 14h2"/>',
  },
  directive: {
    label: 'Directive',
    plural: 'Directives',
    // A stack of data - the assembler pseudo-ops that lay out memory/bytes.
    paths:
      '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  },
};
