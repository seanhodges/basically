// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The two compared machines' memory maps, as a React island: the IDE's own
 * `MemoryMapView`, imported and rendered twice - not a docs-side lookalike of
 * it. The same relationship `MachineField.tsx` has to the machine picker.
 *
 * Everything that decides how the maps are read is controlled by the Vue
 * wrapper (`MemoryMapPair.vue`) and passed in here, because it belongs to the
 * *pair*: two panes at different zooms, or scrolled to different addresses, are
 * two pictures rather than one comparison. The IDE has a single map and so has
 * no such case.
 *
 * The write sites are the source machine's - the addresses the open program
 * aimed at. They are drawn on both panes deliberately: on the source's because
 * that is where the program put them, and on the target's because that is where
 * they would land, which is the difference this whole section exists to show.
 *
 * No part of the dialect registry and no emulator core is reachable from here -
 * a `MemoryMap` is plain data, and `machinePickerBoundary.test.ts` holds that
 * line for the modules this reaches.
 */

import { MemoryMapView } from '../../../../src/components/MemoryMapView';
import type {
  MapWriteSite,
  Notation,
} from '../../../../src/components/MemoryMapView';
import type { MemoryMap } from '../../../../src/dialects/types';

export interface MemoryMapPairSide {
  /** The machine's name, which titles the pane and names its tab. */
  name: string;
  map: MemoryMap;
  /** True where this machine writes memory by indirection (`?addr`). */
  byIndirection?: boolean;
}

export interface MemoryMapPairProps {
  from: MemoryMapPairSide;
  to: MemoryMapPairSide;
  zoom: number;
  notation: Notation;
  showDetails: boolean;
  scrollTop: number;
  /** The addresses the open program writes to, or empty where there is no
   *  program to narrow to. Resolved for the machine being ported *from*. */
  sites: MapWriteSite[];
  /** Which pane to show when there is not room for both; ignored when there is. */
  active: 'from' | 'to';
  /** True when the panes are shown one at a time behind tabs. */
  tabbed: boolean;
  selectedFrom: string | null;
  selectedTo: string | null;
  onSelect: (side: 'from' | 'to', key: string) => void;
  onScrollChange: (top: number) => void;
  onZoomGesture: (next: (z: number) => number) => void;
}

export function MemoryMapPair({
  from,
  to,
  zoom,
  notation,
  showDetails,
  scrollTop,
  sites,
  active,
  tabbed,
  selectedFrom,
  selectedTo,
  onSelect,
  onScrollChange,
  onZoomGesture,
}: MemoryMapPairProps) {
  const pane = (
    side: 'from' | 'to',
    machine: MemoryMapPairSide,
    selectedKey: string | null,
  ) => {
    // Hidden rather than unmounted when tabbed, so flipping keeps the scroll
    // position it was holding instead of remounting at the top.
    const hidden = tabbed && active !== side;
    return (
      <div
        className="mm-pane"
        hidden={hidden}
        role={tabbed ? 'tabpanel' : undefined}
        id={tabbed ? `mm-panel-${side}` : undefined}
        aria-labelledby={tabbed ? `mm-tab-${side}` : undefined}
      >
        {!tabbed && (
          <h4 className="mm-pane-name">
            {machine.name}
            <span className="mm-pane-role">
              {side === 'from' ? 'porting from' : 'porting to'}
            </span>
          </h4>
        )}
        <MemoryMapView
          map={machine.map}
          zoom={zoom}
          notation={notation}
          selectedKey={selectedKey}
          onSelect={(key) => onSelect(side, key)}
          showDetails={showDetails}
          sites={sites}
          byIndirection={machine.byIndirection}
          scrollTop={scrollTop}
          onScrollChange={onScrollChange}
          onZoomGesture={onZoomGesture}
          // The whole reason the two are side by side: every band is exactly its
          // share of the address space, so a line drawn across the panes is one
          // address on both machines.
          proportional
          // A `display: none` pane cannot take a scroll offset, so the view is
          // told when it is out of view and re-applies it on the way back. That
          // is what makes flipping tabs a comparison rather than two pictures.
          hidden={hidden}
          label={`${machine.name} memory map`}
        />
      </div>
    );
  };

  return (
    <div className={`mm-panes${tabbed ? ' mm-panes-tabbed' : ''}`}>
      {pane('from', from, selectedFrom)}
      {pane('to', to, selectedTo)}
    </div>
  );
}
