## Why

The assistant can already be shown a picture: the machine's screen rides with a
request so a question about what a program produced is answered against the
picture the user is looking at. Every part of that road exists - a picture on a
user turn, a per-provider statement of whether one can be shown, and a rule that
no picture is ever kept.

What has no route in is a picture the user brings. A printed listing - a
magazine type-in, a manual, a school printout, a photocopy that has outlived the
machine it was written for - is exactly the kind of program this IDE exists to
run, and the only way to open one today is to type it. That is the work the
emulator was built to spare, done by hand, before the emulator is reached.

## What Changes

- **The user SHALL be able to attach a photograph or scan of a printed listing
  to a request**, and the assistant SHALL return it as code for the machine the
  user is writing for.
- **The code SHALL land through the actions that already exist** - merging by
  line number, replacing the program, and either with a run - so a listing
  photographed in one page at a time merges page onto page, and nothing new has
  to be learned to apply it.
- **A picture SHALL be identified to the assistant as what it is.** A photograph
  of paper and a capture of the machine's screen are read differently, and which
  one is attached SHALL be said rather than left to be inferred.
- **The assistant SHALL be told how to read a printed listing** - which reading
  of an ambiguous glyph is valid BASIC for this machine, that a line wrapped in a
  narrow column is still one line, that a checksum printed down the margin is not
  part of the program, and that a character it could not read SHALL be said
  rather than guessed.
- **One picture SHALL ride one request.** Where a photograph is attached to a
  request that a screen was also waiting to ride, the photograph SHALL be the one
  carried and the screen SHALL be carried by a later request rather than lost.
- **A report that says a screen is attached SHALL be sent with that screen.**
  Today the words and the picture can come apart - a request carrying its own
  picture drops the one a run's report describes while still sending the report -
  which is harmless only for as long as the two pictures are the same one. They
  travel together or they wait together.
- **A photograph SHALL be attachable from where the user already is**: the
  assistant's own composer, an image pasted into it, and an image dropped on the
  editor - which today reports itself as an unsupported file.
- **A photograph SHALL be retained no longer than a screen is.** It goes to the
  chosen provider and nowhere else, and the saved conversation SHALL record that
  a listing was shown without keeping the picture.
- No breaking change. Every request that attaches nothing behaves exactly as it
  does today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: new requirements for reading a printed listing from a
  photograph, and for what the assistant is told about the picture it is looking
  at; and three existing requirements restated - which picture a request carries
  when a photograph and a screen are both waiting, that a report describing a
  screen is sent with that screen, and that neither kind of picture is retained.

## Non-goals

- **Reading a listing without the assistant.** No optical character recognition
  ships in the IDE. A printed listing is prose in a machine's own language, full
  of glyphs no general recogniser knows and ambiguities only the dialect can
  settle; the thing already in the product that can settle them is the assistant,
  which is also why this needs no new dependency.
- **More than one picture on a request.** A listing spanning pages is
  photographed page by page, and the second page merges into the first by line
  number - which the merge already does correctly. Carrying several pictures at
  once would widen a message shape three provider backends depend on, to buy a
  case the merge already covers.
- **A new starting point when creating a project.** Attaching a photograph to an
  empty editor already produces a whole listing and replaces the program with it,
  so `project-setup` is untouched.
- **Treating a transcription as a special kind of answer.** It is checked on the
  machine and corrected when it fails exactly as any other answer is. An answer
  that ran out of room is continued the way any answer is.
- **Importing a picture as a machine file.** A photograph never becomes bytes a
  dialect knows, so this is not an import: `hardware-transfer` is untouched.
- **Correcting the photograph.** No deskewing, no contrast stretching, no page
  detection. A picture is decoded, turned the right way up, and made small enough
  to send; a photograph too poor to read is reported as such, not repaired.

## Impact

- `src/ai/providers/types.ts` - the picture on a turn gains a second media type,
  so a photograph can be sent as a photograph. All three backends already pass
  the media type through untouched (`providers/anthropic.ts`,
  `providers/openai.ts`, `providers/gemini.ts`), so none of them changes.
- **New:** `src/app/listingPhoto.ts` - a file becomes a picture a request can
  carry: decoded the right way up, scaled down, encoded. Returns a reason rather
  than throwing, as `src/app/screenshot.ts` beside it does.
- `src/app/screenCapture.ts` - the machine's own capture is narrowed to PNG, so
  widening the media type above costs no guarantee: the screenshot path names its
  file `.png` on the strength of it.
- `src/ai/promptBuilder.ts` - the flag saying a screen is attached becomes a
  statement of which kind of picture is, carrying the transcription guidance for
  the listing case. Per-turn text, so the system prompt does not move and
  `src/ai/promptStability.test.ts` keeps its measured per-machine budgets.
- `src/ai/aiStore.ts` and `src/storage/settings.ts` - the thread records which
  kind of picture a turn showed; the stored marker stays a marker, and no picture
  reaches storage. The rule that a run's note and the picture that note describes
  travel together is fixed here: today the picture is dropped whenever a request
  carries one of its own, while the words claiming it is attached are still sent.
- `src/components/AiPanel.tsx` - an attach control, a paste route, the attached
  picture shown before it is sent, and a request that may be a picture with no
  words.
- `src/storage/files.ts` - the file picker gains an image route, including the
  one that opens a camera on a phone.
- `src/app/fileCommands.ts` - an image dropped on the editor stops being an
  unsupported file.
- **Tests:** colocated tests for the picture pipeline, the prompt, and the store;
  one browser test in `e2e/ai-assistant/`, which is where the real file input and
  the real image decode can be exercised.
- **No dialect, emulator or machine-boundary changes, and no new dependencies.**
