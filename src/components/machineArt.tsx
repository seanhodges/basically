// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Flat-colour portraits of the target machines, one per registered dialect id.
 *
 * Deliberately *not* the line-art theme of `icons.tsx`: those icons name an
 * action and inherit `currentColor`, whereas these identify one specific
 * computer, so they carry its own colours. Fill-only - no gradients and no
 * `<defs>`, because the same portrait renders several times on a page and
 * gradient ids would collide.
 *
 * Every portrait shares one 3:2 viewBox and the same small shape vocabulary
 * (base, case front, rear deck, key rows, accent) so a column of them lines up
 * and reads as a set rather than as clip art.
 */

import {
  GENERIC_ART_ID,
  machineArtId,
  type MachineArtId,
} from './machineArtIds';

const VIEW_BOX = '0 0 48 32';

/** `size` is the rendered *height* in px; the 3:2 viewBox fixes the width. */
interface ArtProps {
  size: number;
}

const artProps = (size: number) =>
  ({
    width: size * 1.5,
    height: size,
    viewBox: VIEW_BOX,
    'aria-hidden': true,
    focusable: false,
  }) as const;

/* ---------------------------------------------------------------------------
   Palette.

   Where a machine already has hand-authored colours in
   `src/keyboard/VirtualKeyboard.css` (the virtual keyboard's per-machine
   themes) those exact values are reused, so the two surfaces agree. Those
   themes only ever colour keycaps and legends, though - no theme carries a
   *case* colour, so every case hex below is new. The ZX81 and ZX80 name a
   `vk-theme-zx81` that has no rules in that stylesheet, so both of their
   palettes are new as well. */

const SPECTRUM_CASE = '#1b1b1f'; // VirtualKeyboard.css .vk-theme-zxspectrum
const SPECTRUM_KEYS = '#3a3a40'; // VirtualKeyboard.css .vk-theme-zxspectrum .vk-keycap
const SPECTRUM_RAINBOW = ['#d12d2d', '#d1c52d', '#2dbf3c', '#2db5d1'];
const BBC_RED = '#b5302a'; // VirtualKeyboard.css .vk-theme-bbc .vk-style-fn
const BBC_RED_DIM = '#d98682';
const C64_FN = '#3a3a3e'; // VirtualKeyboard.css .vk-theme-commodore64
const VIC_KEYS = '#dbd3c7'; // VirtualKeyboard.css .vk-theme-vic20
const VIC_AMBER = '#cfa96f';
const PET_PHOSPHOR = '#4f9a5a'; // VirtualKeyboard.css .vk-theme-pet
const ATOM_BLUE = '#6f9bd1'; // VirtualKeyboard.css .vk-theme-atom
const ALTAIR_PANEL = '#2a3240'; // VirtualKeyboard.css .vk-theme-altair8800
const ALTAIR_CASE = '#3c4757'; // VirtualKeyboard.css .vk-theme-altair8800
const ALTAIR_LED = '#e05a3c';
const ALTAIR_SWITCH = '#b9bcc2';
const TRS_SILVER = '#9aa0a6'; // VirtualKeyboard.css .vk-theme-trs80
const PMD_BLUE = '#7fb4d4'; // VirtualKeyboard.css .vk-theme-pmd85 .vk-style-fn
const PMD_RED = '#c0362c'; // VirtualKeyboard.css .vk-theme-pmd85 .vk-style-shift
const CPC_BLUE = '#2f6fb0'; // VirtualKeyboard.css .vk-theme-cpc464
const CPC_GREY = '#8d9299'; // VirtualKeyboard.css .vk-theme-cpc6128

const DARK_KEYS = '#2a2a2e';

/* Case colours - all new; see the note above. */
const ZX81_CASE = '#0f0f12';
const ZX80_CASE = '#e6e4dc';
const SPECTRUM128_HEATSINK = '#9a9aa2';
const BBC_CASE = '#d5cfbc';
const MASTER_CASE = '#ded8c7';
const ATOM_CASE = '#dcd8ca';
const C64_CASE = '#c9bda4';
const C64_KEYS = '#6f5f4d';
const VIC_CASE = '#dcd8c8';
const PET_CASE = '#b3b1a8';
const TRS_CASE = '#b4b6b1';
const CPC_CASE = '#1e1e22';
const PMD_CASE = '#5a5e64';
const PMD_DECK = '#4e5258';
const PMD_PANEL = '#6b6f76';
/* The PMD's ordinary caps: charcoal rather than the near-black every virtual
   keyboard uses for an unthemed cap, because at portrait size a black grid on
   a dark case is one shape, not fifteen columns of keys. */
const PMD_KEYS = '#363a41';
const APPLE_BOARD = '#2f6b4a';
const APPLE_BOARD_DIM = '#27593e';
const APPLE_CHIP = '#1b1d21';
const APPLE_GOLD = '#c9a227';
const APPLE_WOOD = '#8c5a34'; // the Byte Shop's koa tray, not a factory case
const SCREEN_BLACK = '#0b0d0a';
const ATARI_CASE = '#d7cbae';
const ATARI_DECK = '#e6ddc7';
const ATARI_FN = '#8a4a3a'; // VirtualKeyboard.css .vk-theme-atari .vk-style-fn
const ATARI_DOOR = '#3a352c';
const ATARI_MEMBRANE = '#e8e0cc';
const ATARI_MEMBRANE_KEY = '#cfc6ab';

/** Darken-by-a-notch used for the shadowed base each case sits on. */
const BASE = {
  zx81: '#000',
  zx80: '#bab8b0',
  spectrum: '#101014',
  bbc: '#a9a493',
  master: '#b2ad9c',
  atom: '#b0ac9f',
  c64: '#8a7d66',
  vic: '#b0ac9c',
  pet: '#8d8b83',
  trs: '#8e908c',
  cpc: '#0e0e10',
  altair: '#20262f',
  pmd: '#3f4247',
  apple: '#5e3b21',
  atari: '#a89878',
};

/* ---------------------------------------------------------------------------
   Sinclair */

/** ZX81: the small matte-black wedge with its flat membrane keyboard. */
function Zx81Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.zx81} />
      <path d="M3 12h42v12H3z" fill={ZX81_CASE} />
      <path d="M7 8h38v4H7z" fill="#1c1c20" />
      <rect x="7" y="15" width="26" height="2" fill="#4a4a52" />
      <rect x="7" y="18.5" width="26" height="2" fill="#4a4a52" />
      <rect x="7" y="22" width="22" height="2" fill="#4a4a52" />
      <rect x="36" y="15" width="7" height="9" fill="#2a2a30" />
      <rect x="36" y="8.8" width="8" height="2.4" fill="#d0342c" />
    </svg>
  );
}

/** ZX80: the same wedge in white, with the black membrane. */
function Zx80Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.zx80} />
      <path d="M3 12h42v12H3z" fill={ZX80_CASE} />
      <path d="M7 8h38v4H7z" fill="#f2f0ea" />
      <rect x="7" y="15" width="26" height="2" fill={DARK_KEYS} />
      <rect x="7" y="18.5" width="26" height="2" fill={DARK_KEYS} />
      <rect x="7" y="22" width="22" height="2" fill={DARK_KEYS} />
      <rect x="36" y="15" width="7" height="9" fill="#c8c6bd" />
      <rect x="36" y="8.8" width="8" height="2.4" fill="#4a4a52" />
    </svg>
  );
}

/** Spectrum 48K: grey rubber keys and the rainbow flash on the case corner. */
function SpectrumArt({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.spectrum} />
      <path d="M3 11h42v13H3z" fill={SPECTRUM_CASE} />
      <path d="M6 7h39v4H6z" fill="#26262b" />
      <rect x="6" y="14" width="27" height="2.4" fill={SPECTRUM_KEYS} />
      <rect x="6" y="18" width="27" height="2.4" fill={SPECTRUM_KEYS} />
      <rect x="6" y="22" width="23" height="2.4" fill={SPECTRUM_KEYS} />
      {SPECTRUM_RAINBOW.map((c, i) => (
        <rect
          key={c}
          x={36 + i * 2.2}
          y="14"
          width="1.8"
          height="10"
          fill={c}
        />
      ))}
    </svg>
  );
}

/** Spectrum 128 "toastrack": the 48K shell with the finned heatsink flank. */
function Spectrum128Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.spectrum} />
      <path d="M3 11h42v13H3z" fill={SPECTRUM_CASE} />
      <path d="M6 7h33v4H6z" fill="#26262b" />
      <rect x="6" y="14" width="24" height="2.4" fill={SPECTRUM_KEYS} />
      <rect x="6" y="18" width="24" height="2.4" fill={SPECTRUM_KEYS} />
      <rect x="6" y="22" width="20" height="2.4" fill={SPECTRUM_KEYS} />
      {/* The heatsink fins along the right-hand flank. */}
      <rect x="39" y="7" width="6" height="17" fill={SPECTRUM128_HEATSINK} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x="39"
          y={8.5 + i * 3}
          width="6"
          height="1.2"
          fill="#6c6c74"
        />
      ))}
      {SPECTRUM_RAINBOW.map((c, i) => (
        <rect key={c} x={32} y={14 + i * 2.6} width="5" height="2" fill={c} />
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Acorn */

/** BBC Micro: the cream case under its red f0-f9 strip. */
function BbcMicroArt({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.bbc} />
      <path d="M3 11h42v13H3z" fill={BBC_CASE} />
      <path d="M6 7h39v4H6z" fill="#e2ddcc" />
      <rect x="6" y="13" width="36" height="2.2" fill={BBC_RED} />
      <rect x="6" y="17" width="36" height="2.4" fill={DARK_KEYS} />
      <rect x="6" y="21" width="31" height="2.4" fill={DARK_KEYS} />
      <rect x="39" y="21" width="3" height="2.4" fill={BBC_RED_DIM} />
      <rect x="36" y="8.2" width="8" height="1.8" fill={BBC_RED} />
    </svg>
  );
}

/** BBC Master: a lighter, wider case with the numeric keypad on the right. */
function BbcMasterArt({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M2 24h44v5H2z" fill={BASE.master} />
      <path d="M2 11h44v13H2z" fill={MASTER_CASE} />
      <path d="M5 7h41v4H5z" fill="#ebe6d6" />
      <rect x="5" y="13" width="30" height="2.2" fill={BBC_RED} />
      <rect x="5" y="17" width="30" height="2.4" fill={DARK_KEYS} />
      <rect x="5" y="21" width="26" height="2.4" fill={DARK_KEYS} />
      {/* Numeric keypad - the Master's most obvious tell against the Micro. */}
      <rect x="37" y="13" width="8" height="10.4" fill="#c4bfae" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={37.8 + c * 2.4}
            y={13.8 + r * 3}
            width="1.8"
            height="2"
            fill={DARK_KEYS}
          />
        )),
      )}
    </svg>
  );
}

/** Acorn Atom: cream wedge, dark keys, the Acorn badge in Atom blue. */
function AtomArt({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M5 24h38v5H5z" fill={BASE.atom} />
      <path d="M5 12h38v12H5z" fill={ATOM_CASE} />
      <path d="M9 8h34v4H9z" fill="#e9e5d8" />
      <rect x="9" y="15" width="24" height="2.2" fill={DARK_KEYS} />
      <rect x="9" y="18.6" width="24" height="2.2" fill={DARK_KEYS} />
      <rect x="9" y="22.2" width="20" height="2.2" fill={DARK_KEYS} />
      <rect x="35" y="15" width="6" height="9.4" fill="#c9c5b7" />
      <rect x="34" y="8.8" width="8" height="2.4" fill={ATOM_BLUE} />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Commodore */

/** C64 "breadbin": beige wedge, brown keys, the dark function-key column. */
function Commodore64Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.c64} />
      <path d="M3 11h42v13H3z" fill={C64_CASE} />
      <path d="M6 7h39v4H6z" fill="#d8cdb6" />
      <rect x="6" y="13.5" width="30" height="2.4" fill={C64_KEYS} />
      <rect x="6" y="17.4" width="30" height="2.4" fill={C64_KEYS} />
      <rect x="6" y="21.3" width="26" height="2.4" fill={C64_KEYS} />
      <rect x="38" y="13.5" width="6" height="10.2" fill={C64_FN} />
      <rect x="6" y="8.2" width="6" height="1.8" fill="#8fa6cf" />
    </svg>
  );
}

/** VIC-20: the same shell in off-white, with the amber function keys. */
function Vic20Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.vic} />
      <path d="M3 11h42v13H3z" fill={VIC_CASE} />
      <path d="M6 7h39v4H6z" fill="#eae6d8" />
      <rect x="6" y="13.5" width="30" height="2.4" fill={VIC_KEYS} />
      <rect x="6" y="17.4" width="30" height="2.4" fill={VIC_KEYS} />
      <rect x="6" y="21.3" width="26" height="2.4" fill={VIC_KEYS} />
      <rect x="38" y="13.5" width="6" height="10.2" fill={VIC_AMBER} />
      <rect x="6" y="8.2" width="6" height="1.8" fill="#8fa6cf" />
    </svg>
  );
}

/** PET: the all-in-one metal case, green phosphor screen over a chiclet pad. */
function PetArt({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M8 3h32v18H8z" fill={PET_CASE} />
      <rect x="11" y="5.5" width="26" height="12" fill={SCREEN_BLACK} />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x="13"
          y={7.5 + i * 3}
          width={i === 2 ? 12 : 20}
          height="1.6"
          fill={PET_PHOSPHOR}
        />
      ))}
      <path d="M5 21h38v6H5z" fill={PET_CASE} />
      <path d="M5 27h38v2H5z" fill={BASE.pet} />
      {[0, 1].map((r) =>
        [0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={7.5 + c * 4.2}
            y={22.4 + r * 2.4}
            width="3"
            height="1.8"
            fill={DARK_KEYS}
          />
        )),
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Tandy */

/** TRS-80 Model I: silver-grey monitor sat above the keyboard unit. */
function Trs80Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M12 2h24v16H12z" fill={TRS_CASE} />
      <rect x="14.5" y="4" width="19" height="11" fill={SCREEN_BLACK} />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x="16"
          y={5.6 + i * 2.8}
          width={i === 2 ? 8 : 15}
          height="1.4"
          fill={TRS_SILVER}
        />
      ))}
      <path d="M18 18h12v3H18z" fill="#9b9d99" />
      <path d="M4 21h40v6H4z" fill={TRS_CASE} />
      <path d="M4 27h40v2H4z" fill={BASE.trs} />
      <rect x="7" y="22.4" width="28" height="1.8" fill={DARK_KEYS} />
      <rect x="7" y="24.8" width="24" height="1.8" fill={DARK_KEYS} />
      <rect x="37" y="22.4" width="4" height="4.2" fill="#9b9d99" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Amstrad */

/** CPC 464: black case with the built-in cassette deck and blue function keys. */
function Cpc464Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M2 24h44v5H2z" fill={BASE.cpc} />
      <path d="M2 11h44v13H2z" fill={CPC_CASE} />
      <path d="M5 7h41v4H5z" fill="#2b2b31" />
      <rect x="5" y="13.5" width="24" height="2.4" fill="#3a3a42" />
      <rect x="5" y="17.4" width="24" height="2.4" fill="#3a3a42" />
      <rect x="5" y="21.3" width="20" height="2.4" fill="#3a3a42" />
      {/* Cassette deck - the CPC's silhouette tell. */}
      <rect x="31" y="12.6" width="13" height="11" fill="#33333b" />
      <rect x="32.5" y="14.2" width="10" height="5" fill="#15151a" />
      <circle cx="35.2" cy="16.7" r="1.5" fill="#5a5a64" />
      <circle cx="39.8" cy="16.7" r="1.5" fill="#5a5a64" />
      <rect x="32.5" y="20.4" width="4.5" height="1.8" fill={CPC_BLUE} />
      <rect x="38" y="20.4" width="4.5" height="1.8" fill={BBC_RED} />
    </svg>
  );
}

/**
 * CPC 6128: the same black case, but the cassette deck is gone - in its place
 * the 3" disc drive with its slot and eject button, and the keypad went grey.
 */
function Cpc6128Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M2 24h44v5H2z" fill={BASE.cpc} />
      <path d="M2 11h44v13H2z" fill={CPC_CASE} />
      <path d="M5 7h41v4H5z" fill="#2b2b31" />
      <rect x="5" y="13.5" width="24" height="2.4" fill="#3a3a42" />
      <rect x="5" y="17.4" width="24" height="2.4" fill="#3a3a42" />
      <rect x="5" y="21.3" width="20" height="2.4" fill="#3a3a42" />
      {/* 3" disc drive - the 6128's silhouette tell against the 464's deck. */}
      <rect x="31" y="12.6" width="13" height="11" fill="#33333b" />
      <rect x="32.5" y="15.4" width="10" height="2.6" fill="#15151a" />
      <rect x="32.5" y="20.4" width="6" height="1.8" fill={CPC_GREY} />
      <rect x="40.5" y="20" width="2" height="2.6" fill={CPC_GREY} />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Fallback */

/**
 * Stand-in for a machine with no portrait yet. Drawn in `currentColor` so it
 * takes the surrounding text colour in either theme rather than guessing at a
 * case that does not exist.
 */
function GenericArt({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <g fill="currentColor">
        <path d="M3 24h42v5H3z" opacity="0.35" />
        <path d="M3 11h42v13H3z" opacity="0.2" />
        <rect x="6" y="14" width="27" height="2.4" opacity="0.5" />
        <rect x="6" y="18" width="27" height="2.4" opacity="0.5" />
        <rect x="6" y="22" width="23" height="2.4" opacity="0.5" />
        <rect x="36" y="14" width="7" height="10.4" opacity="0.35" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   MITS */

/**
 * Altair 8800: the blue-grey rack box whose entire front is the panel - two
 * banks of address/data lamps over a row of paddle switches. The only machine
 * here with no screen and no keyboard to draw, which is exactly its silhouette.
 */
function Altair8800Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M2 5h44v24H2z" fill={ALTAIR_CASE} />
      <path d="M2 27h44v2H2z" fill={BASE.altair} />
      <path d="M5 7h38v18H5z" fill={ALTAIR_PANEL} />
      {/* The lamps: address on top, data below. */}
      {[0, 1].map((r) =>
        [0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
          <circle
            key={`l${r}-${c}`}
            cx={8 + c * 4.4}
            cy={10.5 + r * 4}
            r="1.1"
            fill={ALTAIR_LED}
          />
        )),
      )}
      {/* The paddle switches, each a stem on its bezel. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
        <g key={`s${c}`}>
          <rect
            x={6.8 + c * 4.4}
            y="19.6"
            width="2.4"
            height="1.4"
            fill="#7d828b"
          />
          <rect
            x={7.7 + c * 4.4}
            y="21"
            width="0.9"
            height="2.6"
            fill={ALTAIR_SWITCH}
          />
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Tesla */

/**
 * Key fill by grid position, row 0 being the K0-K11 function strip. Blue runs
 * along the top and down the last two columns; red closes both ends of that
 * run - RST at the top right, the left shift and STOP/EOL along the bottom.
 */
function pmdKeyFill(r: number, c: number) {
  if (r === 0) return c === 14 ? PMD_RED : PMD_BLUE;
  if (r === 4) return c === 0 || c >= 13 ? PMD_RED : PMD_KEYS;
  return c >= 13 ? PMD_BLUE : PMD_KEYS;
}

/**
 * PMD 85-2A: a dark graphite wedge that is almost all keyboard, its grid of
 * fifteen small square keys set into a lighter grey plate. The silhouette tell
 * is the colour edging - a blue function strip across the top and a second one
 * down the right of the grid, both capped in red - over the louvred cassette
 * deck, with the space bar sitting on the case below the plate between its two
 * indicator lamps.
 */
function Pmd85Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 26h42v3H3z" fill={BASE.pmd} />
      <path d="M3 8h42v18H3z" fill={PMD_CASE} />
      <path d="M6 3h38v5H6z" fill={PMD_DECK} />
      {/* Vent slats over the cassette deck. */}
      {[0, 1, 2].map((i) => (
        <rect
          key={`v${i}`}
          x="8"
          y={4.2 + i * 1.1}
          width="17"
          height="0.5"
          fill="#46494e"
        />
      ))}
      <rect x="4.4" y="9.4" width="39.2" height="13.2" fill={PMD_PANEL} />
      {/* Five rows of fifteen, drawn as a grid because that is what it is. */}
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 15 }, (_, c) => (
          <rect
            key={`k${r}-${c}`}
            x={5.2 + c * 2.55}
            y={10.3 + r * 2.5}
            width="1.9"
            height="1.9"
            fill={pmdKeyFill(r, c)}
          />
        )),
      )}
      <rect x="20.5" y="23.4" width="7" height="1.5" fill="#8d9198" />
      <circle cx="14" cy="24.1" r="0.7" fill="#d4802b" />
      <circle cx="34" cy="24.1" r="0.7" fill="#4fae55" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Apple */

/**
 * Apple I: the one machine here with no case of its own. Apple sold a bare
 * board, and the wooden tray under this one is the Byte Shop's - which is why
 * the silhouette is a circuit board rather than a computer: a green PCB carrying
 * four rows of black DIPs, the two big sockets of the monitor PROM pair standing
 * out at the left of the top row, and the gold edge-connector fingers along the
 * bottom where the board met its power supply and expansion.
 */
function Apple1Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M1 25h46v4H1z" fill={BASE.apple} />
      <path d="M1 6h46v19H1z" fill={APPLE_WOOD} />
      <path d="M4 8h40v16H4z" fill={APPLE_BOARD} />
      {/* The ground plane across the top third of the board. */}
      <path d="M4 8h40v3H4z" fill={APPLE_BOARD_DIM} />
      {/* Four rows of DIPs. The first two of the top row are the wide sockets
          the monitor PROMs sat in; every other package is a 14- or 16-pin. */}
      {[0, 1, 2, 3].map((r) =>
        Array.from({ length: r === 0 ? 8 : 9 }, (_, c) => {
          const wide = r === 0 && c < 2;
          return (
            <rect
              key={`c${r}-${c}`}
              x={5.5 + (r === 0 ? c * 4.7 : c * 4.2)}
              y={9 + r * 3.6}
              width={wide ? 4 : 3.2}
              height="2.4"
              fill={APPLE_CHIP}
            />
          );
        }),
      )}
      {/* The edge connector: gold fingers on the board's bottom lip. */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={`f${i}`}
          x={7 + i * 2.9}
          y="22.4"
          width="1.8"
          height="1.6"
          fill={APPLE_GOLD}
        />
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Atari */

/**
 * Atari 800: the full-travel keyboard, the rust-brown console strip
 * (START/SELECT/OPTION/BREAK) above it, and the hinged door over its two
 * cartridge slots - the 800's tell against the 400's single slot.
 */
function Atari800Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.atari} />
      <path d="M3 11h42v13H3z" fill={ATARI_CASE} />
      <path d="M6 7h35v4H6z" fill={ATARI_DECK} />
      <rect x="6" y="8.2" width="30" height="1.6" fill={ATARI_FN} />
      <rect x="6" y="13" width="30" height="2.2" fill={DARK_KEYS} />
      <rect x="6" y="17" width="30" height="2.4" fill={DARK_KEYS} />
      <rect x="6" y="21" width="26" height="2.4" fill={DARK_KEYS} />
      {/* The cartridge door and its two slots. */}
      <rect x="39" y="11" width="6" height="13" fill={ATARI_DOOR} />
      <rect x="40.5" y="13" width="3" height="4" fill="#55503f" />
      <rect x="40.5" y="18" width="3" height="4" fill="#55503f" />
    </svg>
  );
}

/**
 * Atari 400: the same case in miniature, but the keyboard is a sealed
 * membrane - one flat panel rather than individual keycaps - and there is
 * only one cartridge slot, set into the top rather than a side door.
 */
function Atari400Art({ size }: ArtProps) {
  return (
    <svg {...artProps(size)}>
      <path d="M3 24h42v5H3z" fill={BASE.atari} />
      <path d="M3 13h42v11H3z" fill={ATARI_CASE} />
      <path d="M6 9h35v4H6z" fill={ATARI_DECK} />
      <rect x="19" y="5" width="10" height="4" fill={ATARI_DOOR} />
      <rect x="6" y="15.5" width="30" height="7" fill={ATARI_MEMBRANE} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={6.4 + i * 3}
          y="16.3"
          width="2.4"
          height="5.4"
          fill={ATARI_MEMBRANE_KEY}
        />
      ))}
    </svg>
  );
}

/**
 * Portraits by registry dialect id. Typed against `MachineArtId`, so the map
 * and `machineArtIds.ts` cannot drift apart.
 */
const ART: Record<MachineArtId, (p: ArtProps) => JSX.Element> = {
  zx81: Zx81Art,
  zx80: Zx80Art,
  zxspectrum: SpectrumArt,
  zxspectrum128: Spectrum128Art,
  bbcmicro: BbcMicroArt,
  bbcmaster: BbcMasterArt,
  atom: AtomArt,
  commodore64: Commodore64Art,
  vic20: Vic20Art,
  pet: PetArt,
  trs80: Trs80Art,
  cpc464: Cpc464Art,
  cpc6128: Cpc6128Art,
  altair8800: Altair8800Art,
  pmd85: Pmd85Art,
  apple1: Apple1Art,
  atari800: Atari800Art,
  atari400: Atari400Art,
};

/** A machine's portrait, `size` px tall. */
export function MachineArt({ id, size = 32 }: { id: string; size?: number }) {
  const key = machineArtId(id);
  const Art = key === GENERIC_ART_ID ? GenericArt : ART[key];
  return <Art size={size} />;
}
