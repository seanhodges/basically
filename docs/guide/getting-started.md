# Getting started

Basically runs entirely in your browser — there is nothing to install to use it.
Open the IDE at **[ba.sical.ly](https://ba.sical.ly/)** and you're ready to go.

This guide walks through running your first program, then generating one with AI.

## Run a sample program

1. Open the IDE at **[ba.sical.ly](https://ba.sical.ly/)**.
2. The toolbar's machine selector shows the active target (the **ZX81** by
   default). Each machine has its own dialect and emulator — you can switch at
   any time.
3. Choose **File ▸ Samples ▸ Breakout** to load a bundled sample game into the
   editor.
4. Press **▶ Run** (or `Ctrl`+`Enter`). Basically tokenizes your source to a
   machine image and boots it in the emulator through the ROM's own load path.
5. Click the emulator screen to give it focus, then play with the `5` and `8`
   keys.

The emulator is hardware-accurate: it runs the machine's real ROM, so the
display and keyboard behave exactly as they would on the original.

## Write your own

Clear the editor and start typing. The editor highlights your dialect's
keywords, autocompletes them (with documentation), and runs the tokenizer as you
type so mistakes are underlined inline. A byte counter in the status bar shows
how much of the machine's RAM your program uses.

Each machine has its own BASIC rules — see **[Writing BASIC](/guide/writing-basic)**
for the conventions and the per-machine notes.

## Generate code with AI

Basically can write BASIC for you with the Claude API:

1. Click **✦ AI** to open the assistant panel.
2. Add your Anthropic API key — create one at
   [platform.claude.com](https://platform.claude.com/). The key is stored only
   in your browser.
3. Ask for what you want ("write a snake game", "add a high-score counter").
   Claude is given the active machine's dialect rules, so the BASIC it produces
   actually runs.
4. Apply a suggestion with one click: **replace** the editor, **merge** by line
   number, or **replace and run**.

## Save and load

- **Save/load `.bas`** uses the File System Access API where available, with a
  download fallback. Your work also autosaves to the browser's local storage.
- You can **import** an existing machine image (for example a ZX81 `.P` file)
  back into editable source.

## Run on real hardware

When a program works in the emulator, you can send it to a real machine over
cassette audio, a downloadable image file, or a serial bridge. See
**[Running on real hardware](/guide/hardware)**.

## Install as an app

Basically is an installable PWA — use your browser's _Install_ / _Add to Home
Screen_ action to run it standalone on desktop or mobile.
