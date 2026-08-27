// Shared inline-SVG icon set for the toolbar and mobile tab bar. All icons use
// the same line-art theme: 16x16, currentColor stroke so they inherit the
// button's colour (normal --text, active --accent).

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function SparkleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l1.9 5.6a3 3 0 0 0 1.9 1.9L21.4 12l-5.6 1.9a3 3 0 0 0-1.9 1.9L12 21.4l-1.9-5.6a3 3 0 0 0-1.9-1.9L2.6 12l5.6-1.9a3 3 0 0 0 1.9-1.9L12 3z" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 6.5C10.5 5.3 8.6 4.8 4 4.8V18c4.6 0 6.5.5 8 1.7 1.5-1.2 3.4-1.7 8-1.7V4.8c-4.6 0-6.5.5-8 1.7z" />
      <path d="M12 6.5V19.7" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg {...iconProps}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

export function SpeakerMutedIcon() {
  return (
    <svg {...iconProps}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M22 9l-6 6" />
      <path d="M16 9l6 6" />
    </svg>
  );
}

export function DotsIcon() {
  return (
    <svg {...iconProps} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

// Floppy disk for the File menu - matches the AI/docs/settings line-art theme.
export function FloppyIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v5h7V3" />
      <rect x="8" y="13" width="8" height="6" />
    </svg>
  );
}

// Code glyph (`</>`) for the Editor tab.
export function CodeIcon() {
  return (
    <svg {...iconProps}>
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
    </svg>
  );
}

// Play triangle for the Run tab.
export function PlayIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

// Memory chip for the memory-map viewer - a DIP-style chip with pins, matching
// the line-art theme of the other toolbar icons.
export function MemoryIcon() {
  return (
    <svg {...iconProps}>
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" />
    </svg>
  );
}

// Eye (show) / eye-with-slash (hide) for the memory-map detail toggle - the
// compact icon form shown on mobile where the text label won't fit.
export function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a13.4 13.4 0 0 1-2.2 2.7M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 6 10 6a9.5 9.5 0 0 0 3.6-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

// Camera for the save-a-screenshot action, in the toolbar and the player's top
// bar - a body with the viewfinder bump and a lens.
export function CameraIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 8h3.5l1.6-2.4h7.8L17.5 8H21v11H3z" />
      <circle cx="12" cy="13.5" r="3.4" />
    </svg>
  );
}

// Hash mark for the byte editor's hex view tab.
export function HexIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}

// Paragraph lines for the byte editor's character view tab.
export function TextIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

// Game controller for the input-overlay toggle. Shared so the IDE status bar,
// the phone-landscape rail and the standalone player all show the same outline
// icon (matching the keyboard glyph's line-art style).
export function GamepadIcon() {
  return (
    <svg {...iconProps}>
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.585-.685-7.258A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}
