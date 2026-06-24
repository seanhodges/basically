---
layout: home

hero:
  name: Basically
  text: A web IDE for microcomputer BASIC
  tagline: Write, run and ship games for real retro hardware — the ZX81, ZX Spectrum, BBC Micro and Commodore 64 — straight from your browser.
  image:
    light: /logo-light.png
    dark: /logo-dark.png
    alt: Basically
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
    title: Editor with live linting
    details: CodeMirror 6 with per-dialect BASIC syntax highlighting, keyword autocomplete and documentation, a live tokenizer that flags errors as you type, and a byte counter against the target machine's RAM budget.
  - icon: 🕹️
    title: Built-in emulators
    details: A hardware-accurate emulator per machine, running the real ROM. One click tokenizes your source to a machine image and flash-loads it through the ROM's own tape path.
  - icon: ✦
    title: AI code generation
    details: A chat panel backed by the Claude API (bring your own key, stored in your browser). Claude knows each machine's dialect rules; generated programs land in your editor with one click.
  - icon: 📼
    title: Real-hardware transfer
    details: Export cassette audio (play it straight into the EAR port or save a .wav), download a native machine image (.P / .TAP / .prg …), or push over WebSerial to a microcontroller bridge.
  - icon: 📱
    title: Installable PWA
    details: Add Basically to your home screen and run it standalone, on desktop or mobile.
---

## What is Basically?

**Basically** is a browser-based IDE for writing BASIC for classic
microcomputers. You write in a modern editor — with highlighting, completion and
inline error checking — and run your program in a cycle-accurate emulator of the
real machine, booting its original ROM. When it works, you can ship it to real
hardware over cassette audio, a downloadable image file, or a serial bridge.

It ships six dialects today: the **Sinclair ZX81, ZX80 and ZX Spectrum**, the
**BBC Micro and BBC Master**, and the **Commodore 64**.

![The Basically IDE: a BASIC game in the editor, running in the built-in emulator with the on-screen keyboard](./assets/screenshot.jpg)

## A closer look

### Write and lint

The editor highlights your chosen dialect, autocompletes keywords (with
per-keyword documentation), and runs the tokenizer continuously so syntax errors
are underlined as you type. A byte counter shows how much of the machine's RAM
your program will use.

![The editor with BASIC syntax highlighting and inline lint errors](./assets/feature-editor.png)

### Run it on the real machine

Press **▶ Run** (or `Ctrl`+`Enter`) and Basically tokenizes your source to a
machine image and loads it through the emulator the same way the real ROM would
load from tape. The display and keyboard are hardware-accurate — click the screen
and play.

![A BASIC game running in the built-in emulator](./assets/feature-emulator.png)

### Generate code with AI

Open the **✦ AI** panel, add your Anthropic API key, and ask for a game or a
routine. Claude is given the active machine's dialect rules, so the BASIC it
writes actually runs. Apply a suggestion with one click — replace, merge by line
number, or replace and run.

![The AI panel generating a BASIC program](./assets/feature-ai.png)

### Ship to real hardware

When you're ready to leave the emulator behind, the **⇥ Hardware** dialog can
play the program out as cassette audio, save a native image file for an SD
interface, or push it over WebSerial to a microcontroller bridge.

![The hardware transfer dialog](./assets/feature-transfer.png)

## Get started

1. **[Open the IDE](https://ba.sical.ly/)** — nothing to install.
2. Pick **File ▸ Samples ▸ Breakout**, press **▶ Run** (or `Ctrl`+`Enter`),
   click the screen and play with the `5` and `8` keys.
3. For AI generation, click **✦ AI**, add your Anthropic API key (created at
   [platform.claude.com](https://platform.claude.com/)), and ask for a game.

New here? The **[Getting started guide](/guide/getting-started)** walks through
your first program step by step.
