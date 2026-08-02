// Presentation metadata for the keyword capability domains: the display order
// and a Lucide-style icon/label for each. The same split as `kindMeta.ts` -
// the ids and their canonical order are data (`src/reference/domains.ts`),
// and how they are labelled and drawn is theme.
import { KEYWORD_DOMAINS } from '../../../src/reference/domains';
import type { KeywordDomain } from '../../../src/reference/domains';

/**
 * Display order: the vocabulary's own canonical order, re-exported so a
 * component can pass it to `groupByDomain` without reaching past the theme.
 */
export const DOMAIN_ORDER: readonly KeywordDomain[] = KEYWORD_DOMAINS;

/** Inline Lucide-style SVG paths for each domain (rendered at ~14px). */
export const DOMAIN_META: Record<
  KeywordDomain,
  { label: string; paths: string }
> = {
  'control-flow': {
    label: 'Control flow',
    // A branch - the program taking one path or another.
    paths:
      '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  },
  data: {
    label: 'Data',
    // A store of records - variables, arrays and DATA statements.
    paths:
      '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  },
  numeric: {
    label: 'Numbers',
    // A sigma - arithmetic and the maths functions.
    paths: '<path d="M18 7V4H6l6 8-6 8h12v-3"/>',
  },
  strings: {
    label: 'Strings',
    // A text cursor over a serif I.
    paths:
      '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  },
  'text-screen': {
    label: 'Text and screen',
    // A monitor - PRINT, CLS, the cursor and the text window.
    paths:
      '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  },
  graphics: {
    label: 'Graphics',
    // Drawn shapes - PLOT, DRAW, CIRCLE and the graphics modes.
    paths:
      '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  },
  colour: {
    label: 'Colour',
    // A palette - ink, paper, border and the attribute settings.
    paths:
      '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  },
  sound: {
    label: 'Sound',
    // A speaker - BEEP, SOUND, PLAY and the envelopes.
    paths:
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  },
  input: {
    label: 'Input',
    // A keyboard - INPUT, INKEY$, GET and the joystick reads.
    paths:
      '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>',
  },
  storage: {
    label: 'Storage',
    // A floppy disk - tape, disc and the file channels.
    paths:
      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  },
  'memory-hardware': {
    label: 'Memory and hardware',
    // A RAM stick - PEEK/POKE, the I/O ports and the machine-code calls.
    paths:
      '<path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M2 14h20"/><path d="M6 19v-2"/><path d="M10 19v-2"/><path d="M14 19v-2"/><path d="M18 19v-2"/>',
  },
  'program-editing': {
    label: 'Program editing',
    // A pencil - LIST, RENUMBER, TRACE and the rest of the session commands.
    paths: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  },
  'error-handling': {
    label: 'Error handling',
    // A warning triangle - ON ERROR, RESUME, ERR and the break traps.
    paths:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  },
};
