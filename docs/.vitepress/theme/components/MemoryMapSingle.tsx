// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One machine's memory map, as a React island: the IDE's own `MemoryMapView`,
 * imported and rendered once - not a docs-side lookalike of it. The same
 * relationship `MemoryMapPair.tsx` has to the porting guide's comparison.
 *
 * Everything the pair does to make two maps one picture is deliberately absent.
 * `proportional` is not set, so the view takes its default: a region too small
 * to read is clamped to a legible minimum and the bands are gapped, which is
 * what a map being read on its own wants and what a map being aligned against
 * another cannot have. There are no write sites either - a reference page has no
 * open program to narrow to, and stays about the machine.
 *
 * No part of the dialect registry and no emulator core is reachable from here -
 * a `MemoryMap` is plain data, and `machinePickerBoundary.test.ts` holds that
 * line for the modules this reaches.
 */

import { MemoryMapView } from '../../../../src/components/MemoryMapView';
import type { Notation } from '../../../../src/components/MemoryMapView';
import type { MemoryMap } from '../../../../src/dialects/types';

export interface MemoryMapSingleProps {
  /** The machine's name, which names the map for assistive technology. */
  name: string;
  map: MemoryMap;
  /** True where this machine writes memory by indirection (`?addr`). */
  byIndirection?: boolean;
  zoom: number;
  notation: Notation;
  showDetails: boolean;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onZoomGesture: (next: (z: number) => number) => void;
}

export function MemoryMapSingle({
  name,
  map,
  byIndirection,
  zoom,
  notation,
  showDetails,
  selectedKey,
  onSelect,
  onZoomGesture,
}: MemoryMapSingleProps) {
  return (
    <div className="mm-single-pane">
      <MemoryMapView
        map={map}
        zoom={zoom}
        notation={notation}
        selectedKey={selectedKey}
        onSelect={onSelect}
        showDetails={showDetails}
        byIndirection={byIndirection}
        onZoomGesture={onZoomGesture}
        label={`${name} memory map`}
      />
    </div>
  );
}
