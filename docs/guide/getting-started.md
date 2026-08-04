# Getting started

Basically runs entirely in your browser - there is nothing to install to use it.
Open the IDE at **[ba.sical.ly](https://ba.sical.ly/)** and you're ready to go.

This guide walks through running your first program, then generating one with AI.

## Run a sample program

1. Open the IDE at **[ba.sical.ly](https://ba.sical.ly/)**.
2. Choose **File ▸ New project**. Everything a program needs to start is here:
   which machine to write for, what to call the project, and what to begin with.

   ![The Start a new project dialog: the chosen machine with its description, a name field, and Blank program / Sample / Describe it as starting points](/new-project-dialog.png)

3. Press the machine to open the picker and pick one. They're grouped by the
   company that made them, with the year and a line naming the BASIC each one
   runs - every machine has its own dialect and its own emulator.

   ![The Choose a machine picker, listing every machine grouped under Acorn, Amstrad, Commodore, Sinclair and Tandy, each with its illustration, release year and a one-line description naming its BASIC](/machine-picker.png)

4. Under **Start from**, choose **Sample** and pick **Breakout**, then press
   **Create project**.
5. Press **▶ Run** (or `Ctrl`+`Enter`). Basically tokenizes your source to a
   machine image and boots it in the emulator through the ROM's own load path.
6. Click the emulator screen to give it focus, then play - on most machines the
   paddle keys are shown on screen when the game starts.

The emulator is hardware-accurate: it runs the machine's real ROM, so the
display and keyboard behave exactly as they would on the original.

The toolbar's machine selector switches an in-progress program to a different
target. Starting a new project is how you choose a machine _and_ what to write
on it together.

## Write your own

Create a project and choose **Blank program**, then start typing. The editor
highlights your dialect's keywords, autocompletes them (with documentation), and
runs the tokenizer as you type so mistakes are underlined inline. A byte counter
in the status bar shows how much of the machine's RAM your program uses.

Naming the project when you create it means **Save project** already knows what
to call it; leave the name blank and it stays untitled until you save.

Each machine has its own BASIC rules - see **[Writing BASIC](/guide/writing-basic)**
for the conventions and the per-machine notes.

## Generate code with AI

Basically can write BASIC for you with the Claude API:

1. Click **✦ AI** to open the assistant panel.
2. Add your Anthropic API key - create one at
   [platform.claude.com](https://platform.claude.com/). The key is stored only
   in your browser.
3. Ask for what you want ("write a snake game", "add a high-score counter").
   Claude is given the active machine's dialect rules, so the BASIC it produces
   actually runs.
4. Apply a suggestion with one click: **replace** the editor, **merge** by line
   number, or **replace and run**.

Answers arrive already tried out. Before you are offered anything, the IDE runs
the program on the machine itself and checks how it went — your own listing is
left exactly as you had it while that happens. If the program fails, or does not
produce what the assistant said it would, the assistant is asked to fix it and
try again a couple of times before you are shown anything. So what reaches you is
code that has run, not code that looks like it should.

The panel says which stage it is at while you wait — writing the code, checking
it on the machine, looking at the screen it drew, or fixing a run that failed —
and **Stop** ends any of them.

When it has finished, you are shown the machine's screen as it stood, whatever
the outcome. That last look is yours: the checks can tell that a program ran and
that the text it printed is right, but only you can say whether the thing on the
screen is what you actually wanted.

Ask something next and that same picture goes with your question, so "why is the
circle squashed?" is answered against what you are both looking at. There is
nothing to attach: the screen already in the conversation is the one that is
sent, once, and only if the assistant you have chosen can be shown a picture.

Once your key is set you can also start a whole project this way: choose
**File ▸ New project**, pick a machine, and under **Start from** choose
**Describe it** and say what you want ("a snake game"). The project is created
and the assistant starts writing it for that machine. Until a key is set, that
option is shown but not selectable.

## Save and load

- **Save project** writes your whole document as a `.zip` bundle (a zip of
  your BASIC source plus any machine-code/data blocks and a metadata file), and
  **Open project** loads one back — switching to the machine the project was
  saved for — or opens a plain `.bas`/`.txt` as source, using the File System
  Access API where available with a download fallback. Your work also autosaves
  to the browser's local storage.
- To download just the BASIC listing as a `.bas`, right-click the **BASIC**
  editor tab and choose **Download .bas**.
- You can **import** an existing machine image (for example a ZX81 `.P` file)
  back into editable source.

## Run on real hardware

The link to the real machine runs **both ways**. When a program works in the
emulator, you can export it to a real machine over cassette audio, a
downloadable image file, or a serial bridge - and you can import a program back
off the machine (by decoding its cassette output or loading its native image)
to edit and test it in the IDE. See **[Running on real hardware](/guide/hardware)**.

## Install as an app

Basically is an installable PWA - use your browser's _Install_ / _Add to Home
Screen_ action to run it standalone on desktop or mobile.

The app works almost entirely offline, so you can sit on a flight, train or mountain summit and tinker with that game you're working on at home. There are a couple of things to be aware of:

- **AI support** currently only supports cloud-based solutions and requires Internet access at all times to work. In future we might add local LLM support.
- **Running the emulator** usually requires downloading a third-party ROM for the target machine, which are often large blobs and can have complex licencing rules. You should run the emulator **before** going offline, to ensure any runtime dependencies are cached and ready to use. A ROM you supply yourself (see below) is already stored in your browser, so it needs no download at all.

### Supplying your own ROM

Every machine ships with the ROM it needs, so there is normally nothing to do
here. But on machines that run a single ROM image - the Sinclair and Amstrad
ones - you can run your own image instead: a different revision of the
firmware, or your own build.

Open **Settings ▸ Emulator** and use **Upload ROM image…** under **Machine
ROM**. The setting applies to the machine you currently have selected, and each
machine keeps its own.

A few things worth knowing:

- The image must be **exactly** the size that machine's ROM is - the setting
  tells you the figure, and says so again if the file you pick is a different
  size. On the machines whose ROM is two banks joined together (the ZX Spectrum
  128 and both CPCs) the usual mistake is supplying one half.
- The image stays **in your browser**. It is never uploaded anywhere, and it is
  not included in programs you [publish](/guide/publishing).
- Changing it **restarts the machine**, so press Play again afterwards.
- If a ROM doesn't work, the machine will simply sit there doing nothing. Go
  back to **Settings ▸ Emulator** and press **Restore bundled ROM**.

Only the emulator follows your image. The editor's keyword highlighting,
completion and error checking are built for the machine's original BASIC, so an
image with a _different_ BASIC in it will run, but the editor will disagree with
it.

## Join the community

Got stuck, or made something you want to show off? Join the Basically
**[Discord](/guide/community)** - it's the quickest way to get help, share your
programs, and follow what's coming next.
