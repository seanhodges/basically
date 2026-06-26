---
layout: home

hero:
  name: Basically
  text: A web IDE for microcomputer BASIC
  tagline: Write, run and ship games and programs for real retro hardware, straight from your browser.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Open the IDE ↗
      link: https://ba.sical.ly/
    - theme: alt
      text: View on GitHub
      link: https://github.com/seanhodges/basically

features:
  - icon: ✍️
    title: Rich code editor
    details: Live BASIC syntax highlighting, keyword autocomplete and documentation, flags errors as you type, and tracks the machine's RAM budget.
  - icon: 🕹️
    title: Built-in emulators
    details: Hardware-specific emulators using popular Web-based solutions, fully integrated into the IDE. One click rapid deployment with no fiddly configuration.
  - icon: ✦
    title: AI support
    details: Support for many popular AI coding providers; Claude, OpenAI, Gemini. More possible in future.
  - icon: 📼
    title: Two-way hardware transfer
    details: "Here's the really fun bit: if you have the real machine, the link runs both ways. Export via cassette audio (play via the EAR port or save a .wav), download a native machine image (.P / .TAP / .prg …) for SD card interfaces, or push over WebSerial to a microcontroller bridge (experimental) — and import the same way, pulling a program off the real machine by recording its tape or loading its image back into the editor."
  - icon: ⌨️
    title: Mobile-first input
    details: Basically IDE ships with machine-specific virtual keyboards; balancing mobile screen usability with an psuedo authentic shift-state experience. At any time you can toggle this off to use your familiar native keyboard.
  - icon: 📱
    title: Install as an app
    details: Basically is a PWA, you can install to your home screen and run it standalone, offline, on desktop or mobile.
---

## What is Basically?

**Basically** is a browser-based IDE for writing BASIC for classic
microcomputers. You write in a modern editor with highlighting, code completion and
inline error checking, and test your program in an emulator. When it works, you can ship it to real hardware using various methods.

It ships support for many microcomputers already including: Sinclair ZX80, ZX81 and Spectrum, the BBC Micro and Master, Commodore 64, TRS-80, with more being added all the time.

![The Basically IDE: a BASIC game in the editor, running in the built-in emulator with the on-screen keyboard](/screenshot.jpg)

## A closer look

### Write and lint

The editor highlights your chosen dialect, autocompletes keywords (with
per-keyword documentation), syntax errors
are underlined as you type. A byte counter estimates how much of the machine's RAM
your program might use.

![The editor with BASIC syntax highlighting and inline lint errors](/feature-editor.png)

### Run it on the real machine

Press **▶ Run** (or `Ctrl`+`Enter`) to run your program directly in the emulator the same way the real ROM would load from tape. The display and keyboard attempt to be hardware-accurate — just click the screen
and play.

![A BASIC game running in the built-in emulator](/feature-emulator.png)

### Generate code with AI

Open the **✦ AI** panel, pick your provider, and ask for a game, a new feature, or a fix. The agent is given a role and the active machine's dialect rules, so the BASIC it
writes actually runs (usually!). The agent will also watch the editor linting and emulator start state to check its mistakes.

![The AI panel generating a BASIC program](/feature-ai.png)

### Move programs to and from real hardware

Basically is a **two-way** bridge to the real machine, not just a one-way
exporter. When you're ready to leave the emulator behind, the **Export** tools
can play the program out as cassette audio, save it to a native image file for
an SD interface, or push it over WebSerial to a microcontroller bridge.

The **Import** tools are the mirror image: pull a BASIC program _off_ the real
machine — record its cassette output (or drop in a `.wav`) and let Basically
decode it, or load a native image file (`.P` / `.TAP` / `.prg` …) — straight
back into the editor. So you can grab an old program from real hardware, edit
and test it in the IDE, and export the updated version back to the machine —
and if you'd rather make your changes on the physical hardware, you can pull
those back in too.

Note: WebSerial support is **experimental**, please use with care, and be sure to share back how you get on!

![The hardware transfer dialog](/feature-transfer.png)

## Getting started

1. **[Open the IDE](https://ba.sical.ly/)** — nothing to install.
2. Pick **File** and under `SAMPLES` pick a demo or game, press **▶ Run** (or `Ctrl`+`Enter`).

New here? The **[Getting started guide](/guide/getting-started)** walks through
your first program step by step.
