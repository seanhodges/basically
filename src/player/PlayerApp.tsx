// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// The standalone player (docs/contributing/standalone-player.md):
// a cut-down, fully responsive shell - emulator screen + virtual keyboard +
// virtual gamepad, no editor/docs/menus. It fetches the shared program behind
// its /<verb>/<shareId> URL, boots the verb's machine via the store's
// playerBoot action and auto-runs. Default export so main.tsx can React.lazy()
// it without pulling the player into the IDE bundle (or vice versa).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useInputOverlays } from '../app/useInputOverlays';
import {
  useMediaQuery,
  isLandscapeMobileViewport,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { getDialect } from '../dialects/registry';
import {
  fetchSharedProgram,
  ShareApiError,
  type SharedProgram,
} from '../share/shareClient';
import { getKeyboardAutoShow, setKeyboardAutoShow } from '../storage/settings';
import { playerPathFor } from './routes';
import {
  VirtualKeyboard,
  type KeyboardTarget,
} from '../keyboard/VirtualKeyboard';
import {
  GameController,
  type ControllerMachineTarget,
} from '../keyboard/GameController';
import { effectiveGamepadMode } from '../keyboard/controllerConfig';
import { EmulatorPane, type MachineApi } from '../components/EmulatorPane';
import { CodeIcon } from '../components/icons';
import styles from './PlayerApp.module.css';

type Phase = 'loading' | 'running' | 'incompatible' | 'error';

/** A user-facing message (and whether a retry can help) for a fetch failure. */
function describeShareError(e: unknown): {
  message: string;
  retryable: boolean;
} {
  if (e instanceof ShareApiError) {
    switch (e.kind) {
      case 'unconfigured':
        return {
          message:
            'This site has no share service configured, so shared programs cannot load.',
          retryable: false,
        };
      case 'invalid-id':
      case 'not-found':
        return {
          message:
            'There is no shared program at this link - it may have been mistyped or deleted.',
          retryable: false,
        };
      case 'expired':
        return { message: 'This share link has expired.', retryable: false };
      case 'rate-limited':
        return {
          message: 'The share service is busy - try again in a moment.',
          retryable: true,
        };
      case 'network':
        return {
          message:
            'Could not reach the share service. Check your connection and retry.',
          retryable: true,
        };
      default:
        return {
          message: 'The share service returned an unexpected error.',
          retryable: true,
        };
    }
  }
  return {
    message: e instanceof Error ? e.message : String(e),
    retryable: true,
  };
}

/** Display name for a dialect id the registry may not know (old records). */
function dialectName(id: string): string {
  try {
    return getDialect(id).name;
  } catch {
    return id;
  }
}

export default function PlayerApp({
  dialectId,
  shareId,
}: {
  dialectId: string;
  shareId: string;
}) {
  const dialect = useIdeStore((s) => s.dialect);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const requestRun = useIdeStore((s) => s.requestRun);
  const keyboardEnabled = useIdeStore((s) => s.keyboardEnabled);
  const controllerEnabled = useIdeStore((s) => s.controllerEnabled);
  const setKeyboardEnabledEphemeral = useIdeStore(
    (s) => s.setKeyboardEnabledEphemeral,
  );
  const setControllerEnabledEphemeral = useIdeStore(
    (s) => s.setControllerEnabledEphemeral,
  );
  const keyboardSound = useIdeStore((s) => s.keyboardSound);
  const keyboardHaptics = useIdeStore((s) => s.keyboardHaptics);
  const keyboardKeyDisplay = useIdeStore((s) => s.keyboardKeyDisplay);
  const controllerBindings = useIdeStore((s) => s.controllerBindings);
  const controllerDpadMode = useIdeStore((s) => s.controllerDpadMode);
  const controllerFireButtons = useIdeStore((s) => s.controllerFireButtons);
  const gamepadMode = useIdeStore((s) => s.gamepadMode);

  const [phase, setPhase] = useState<Phase>('loading');
  const [record, setRecord] = useState<SharedProgram | null>(null);
  const [error, setError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);
  const [retrySeq, setRetrySeq] = useState(0);
  // True once resumeAudio confirms sound is unlocked (or that there is none to
  // unlock); until then the "tap for sound" pill shows.
  const [audioReady, setAudioReady] = useState(false);

  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { controllerVisible, keyboardVisible } = useInputOverlays();

  // Top-bar overflow handling: when the horizontal bar can't fit everything,
  // drop the program name first, then the logo. Driven by measuring the header
  // rather than a fixed breakpoint so it reacts to the actual name length. The
  // landscape rail hides these via CSS already, so this only runs on the
  // horizontal bar.
  const headerRef = useRef<HTMLElement>(null);
  const programNameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => {
      if (landscape) return;
      // Reset to the full layout, then re-measure and hide progressively. Each
      // scrollWidth read forces a synchronous reflow, so the checks below see
      // the effect of the attribute set just before them.
      header.removeAttribute('data-hide-name');
      header.removeAttribute('data-hide-logo');
      const name = programNameRef.current;
      const overflowing = () => header.scrollWidth > header.clientWidth + 1;
      const nameTruncated = !!name && name.scrollWidth > name.clientWidth + 1;
      if (nameTruncated || overflowing())
        header.setAttribute('data-hide-name', '');
      if (overflowing()) header.setAttribute('data-hide-logo', '');
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [record?.name, landscape]);
  const effectiveMode = effectiveGamepadMode(dialect, gamepadMode);

  // The keyboard/controller reach the machine through the handle EmulatorPane
  // populates - built exactly like Workspace's targets (stable identities, the
  // indirection reads the latest handle).
  const machineApiRef = useRef<MachineApi | null>(null);
  const machineTarget = useMemo<KeyboardTarget>(
    () => ({
      kind: 'machine',
      getMachine: () => machineApiRef.current?.getMachine() ?? null,
      registerFrameHook: (cb) => machineApiRef.current?.registerFrameHook(cb),
    }),
    [],
  );
  const controllerTarget = useMemo<ControllerMachineTarget>(
    () => ({
      getMachine: () => machineApiRef.current?.getMachine() ?? null,
      registerFrameHook: (cb) => machineApiRef.current?.registerFrameHook(cb),
    }),
    [],
  );

  // Boot: fetch the shared program, check it can run on this URL's machine,
  // then load and auto-start it. requestRun in the same batch as playerBoot is
  // safe: EmulatorPane's run effect fires after the re-render, with the new
  // dialect and source already in place.
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setError(null);
    (async () => {
      try {
        const rec = await fetchSharedProgram(shareId);
        if (cancelled) return;
        setRecord(rec);
        if (!rec.compatibleDialects.includes(dialectId)) {
          setPhase('incompatible');
          return;
        }
        const store = useIdeStore.getState();
        store.playerBoot({
          dialectId,
          source: rec.source,
          fileName: rec.name || 'shared.bas',
        });
        // The on-screen keyboard follows the IDE's auto-show preference
        // (store.keyboardAutoShow already resolves it: on for touch devices,
        // off otherwise). When the user has never set it - never opened the IDE,
        // so the key is unset - persist the computed default now so both
        // surfaces agree from here on. Gamepad stays opt-in via the 🎮 toggle.
        // Ephemeral setters so the IDE's persisted toggles are untouched.
        if (getKeyboardAutoShow() === null) {
          setKeyboardAutoShow(store.keyboardAutoShow);
        }
        // Auto-show follows the IDE's keyboardAutoShow preference - except in
        // phone landscape, where the flanking gamepad is the default surface and
        // an auto-shown keyboard would cover it. The ⌨ toggle still opens it.
        store.setKeyboardEnabledEphemeral(
          isLandscapeMobileViewport() ? false : store.keyboardAutoShow,
        );
        store.setControllerEnabledEphemeral(false);
        store.requestRun();
        setPhase('running');
      } catch (e) {
        if (cancelled) return;
        setError(describeShareError(e));
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialectId, shareId, retrySeq]);

  // Audio autoplay policy blocks the AudioContext until a user gesture, and
  // auto-start means the run itself wasn't one. Unlock on the first tap
  // anywhere (users tap the virtual keyboard anyway); keep listening until
  // resumeAudio confirms, since a tap can land before the machine is up.
  useEffect(() => {
    if (phase !== 'running' || audioReady) return;
    const onPointerDown = () => {
      void machineApiRef.current?.resumeAudio().then((ok) => {
        if (ok) setAudioReady(true);
      });
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [phase, audioReady]);

  // The program's home machine link, for the incompatibility notice. Guarded:
  // a record minted for a dialect this build no longer knows has no player URL.
  const canonicalPath = useMemo(() => {
    if (!record) return null;
    try {
      return playerPathFor(record.dialectId, record.id);
    } catch {
      return null;
    }
  }, [record]);

  const openInIde = () => {
    // Refresh-safe handover: the IDE re-fetches the share (Stage 6).
    location.assign('/?open=' + shareId);
  };

  // Run *is* restart in the auto-running player. Same green Run button the IDE
  // toolbar uses (the global `run` class), living in the top bar on every form
  // factor; the narrow landscape rail shows just the glyph.
  const runButton = (
    <button
      type="button"
      className={`run ${styles.runButton}`}
      onClick={requestRun}
      title="Restart the program"
    >
      {landscape ? '▶' : '▶ Play'}
    </button>
  );

  return (
    <div className={`${styles.player} ${landscape ? styles.landscape : ''}`}>
      <header className={styles.topBar} ref={headerRef}>
        <img className={styles.logo} src="/logo-dark.png" alt="Basically" />
        {record?.name && (
          <>
            <span className={styles.programName} ref={programNameRef}>
              {record.name}
            </span>
            <span className={styles.separator}>|</span>
          </>
        )}
        <span className={styles.machineName}>{dialectName(dialectId)}</span>
        <div className={styles.topActions}>
          {phase === 'running' && runButton}
          <button
            type="button"
            className={`${styles.kbToggle} ${
              keyboardEnabled ? styles.toggleActive : ''
            }`}
            aria-pressed={keyboardEnabled}
            title={
              keyboardEnabled
                ? 'Hide on-screen keyboard'
                : 'Show on-screen keyboard'
            }
            onClick={() => setKeyboardEnabledEphemeral(!keyboardEnabled)}
          >
            ⌨
          </button>
          <button
            type="button"
            className={`${styles.padToggle} ${
              controllerEnabled ? styles.toggleActive : ''
            }`}
            aria-pressed={controllerEnabled}
            title={
              controllerEnabled
                ? 'Hide game controller'
                : 'Show game controller'
            }
            onClick={() => setControllerEnabledEphemeral(!controllerEnabled)}
          >
            🎮
          </button>
          <button
            type="button"
            className={styles.seeCode}
            title="Open this program in the Basically IDE"
            onClick={openInIde}
          >
            {isMobile || landscape ? <CodeIcon /> : 'See the Code'}
          </button>
        </div>
      </header>
      <div className={styles.stage}>
        {phase === 'loading' && (
          <div className={styles.notice}>
            <p>Loading shared program…</p>
          </div>
        )}
        {phase === 'error' && error && (
          <div className={styles.notice}>
            <p>{error.message}</p>
            {error.retryable && (
              <button type="button" onClick={() => setRetrySeq((n) => n + 1)}>
                Retry
              </button>
            )}
            <a href="/">See the Code</a>
          </div>
        )}
        {phase === 'incompatible' && record && (
          <div className={styles.notice}>
            <p>
              This program was written for the{' '}
              <strong>{dialectName(record.dialectId)}</strong> and can't run on
              the <strong>{dialectName(dialectId)}</strong> this link selects.
            </p>
            {canonicalPath ? (
              <a className={styles.canonicalLink} href={canonicalPath}>
                Play it on the {dialectName(record.dialectId)}
              </a>
            ) : (
              <a href="/">See the Code</a>
            )}
          </div>
        )}
        {phase === 'running' && (
          <>
            <EmulatorPane apiRef={machineApiRef} />
            {keyboardVisible && (
              <div className={styles.vkOverlay}>
                <VirtualKeyboard
                  layout={dialect.keyboardLayout}
                  target={machineTarget}
                  enabled={emulatorStatus === 'running'}
                  sound={keyboardSound}
                  haptics={keyboardHaptics}
                  keyDisplay={keyboardKeyDisplay}
                />
              </div>
            )}
            {controllerVisible && (
              <div className={`${styles.vkOverlay} ${styles.gcOverlay}`}>
                <GameController
                  key={`${dialect.id}:${effectiveMode}`}
                  layout={dialect.keyboardLayout}
                  target={controllerTarget}
                  enabled={emulatorStatus === 'running'}
                  haptics={keyboardHaptics}
                  overrides={controllerBindings}
                  dpadMode={controllerDpadMode}
                  displayFireButtons={controllerFireButtons}
                  hardwareFireButtons={dialect.joystickFireButtons ?? 1}
                  mode={effectiveMode}
                  // Remap is an IDE feature; long-press only fires while
                  // stopped, which the auto-running player never is.
                  onStartRemap={() => {}}
                />
              </div>
            )}
            {!audioReady && (
              <button type="button" className={styles.soundPill}>
                🔊 Tap for sound
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
