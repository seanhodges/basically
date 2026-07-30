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
5. Press **▶ Run** (or `Ctrl`+`Enter`). Basically tokenises your source to a
   machine image and boots it in the emulator through the ROM's own load path.
6. Click the emulator screen to give it focus, then play - on most machines the
   paddle keys are shown on screen when the game starts.

## Write your own

Create a project and choose **Blank program**, then start typing. The editor
highlights your dialect's keywords, autocompletes and checks as you type so mistakes are underlined inline. A byte counter
in the status bar shows how much of the machine's RAM your program uses.

Each machine has its own BASIC rules - see **[Writing BASIC](/guide/writing-basic)**
for per-machine notes.

## Generate code with AI

Basically has an AI assistant to support with writing BASIC code:

1. Click **✦ AI** to open the assistant panel.
2. Add your AI provider API key in the settings. The key is stored only
   in your browser.
3. Ask for what you want ("add a high-score counter").
   Claude is given the active machine's dialect rules, so the BASIC it produces
   actually runs.
4. Apply a suggestion with one click: **replace** the editor, **merge** by line
   number, or **replace and run**.

You can also create a whole project this way: choose
**File ▸ New project**, pick a machine, and under **Start from** choose
**Describe it** and say what you want ("a snake game"). The project is created
and the assistant starts writing it for that machine.

## Save and load

- **Save project** writes your whole document as a `.zip` bundle (a zip of
  your BASIC source plus any machine-code/data blocks and a metadata file), and
  **Open project** loads one back — switching to the machine the project was
  saved for — or opens a plain `.bas`/`.txt` as source, using the File System
  Access API where available with a download fallback. Your work also autosaves
  to the browser's local storage.
- To download just the BASIC listing as a `.bas`, right-click the **BASIC**
  editor tab and choose **Download .bas**.
- You can import an existing machine image (for example a ZX81 `.P` file)
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

The app works almost entirely offline, so you can sit on a flight, train or mountain summit and tinker with that game you're working on at home. There are a couple of things to be aware of however:

- **AI support** currently only supports cloud-based solutions and requires Internet access at all times to work. In future we might add local LLM support.
- **Running the emulator** usually requires downloading a third-party ROM for the target machine, whuch are often large blobs and can have complex licencing rules. You should run the emulator **before** going offline, to ensure any runtime dependencies are cached and ready to use.

## Join the community

Got stuck, or made something you want to show off? Join the Basically
**[Discord](/guide/community)** - it's the quickest way to get help, share your
programs, and follow what's coming next.
