## 1. Widen what a picture may be, and re-pin what a screen is

- [ ] 1.1 `src/ai/providers/types.ts` — `ChatImage.mediaType` becomes
      `'image/png' | 'image/jpeg'`. Move the PNG-only reasoning out of the shared
      type: it is a fact about the machine's screen, not about every picture.
- [ ] 1.2 `src/app/screenCapture.ts` — narrow `ScreenCapture.mediaType` back to
      the literal `'image/png'`, so widening 1.1 costs no guarantee. The
      screenshot path names its file `.png` on the strength of it, and JPEG
      chroma subsampling is destructive on one-pixel lines.
- [ ] 1.3 One colocated test per backend (`src/ai/providers/anthropic.test.ts`,
      `openai.test.ts`, `gemini.test.ts`) that a JPEG goes out as a JPEG — as
      `media_type`, inside the data URI, and as `mimeType` respectively. Three
      one-line additions, and the whole cost of the widening.

## 2. A file becomes a picture a request can carry

- [ ] 2.1 New `src/app/listingPhoto.ts`, beside the app's other two DOM-image
      utilities. Export the arithmetic and the classification as pure functions
      and confine the DOM to one async call, following `src/app/screenshot.ts`;
      return a result union carrying a reason, never a throw.
- [ ] 2.2 Scale bounded **twice** — by the long edge and by total pixels — and
      never upscaling. A long-edge cap alone leaves a 4:3 photograph well over the
      pixel-count limit, where the provider resamples it anyway and the excess is
      paid for and thrown away.
- [ ] 2.3 Decode with `imageOrientation: 'from-image'`, with the
      `new Image()` + `decode()` path as the fallback. That option is the entire
      EXIF answer — no orientation parser ships — and without it an ordinary
      portrait photograph arrives on its side. Release the decoded bitmap
      explicitly; a 12-megapixel decode is tens of megabytes.
- [ ] 2.4 Draw with smoothing **enabled** — deliberately the opposite of
      `screenshot.ts`, which disables it to keep machine pixels square. Continuous
      tone downsampled without smoothing aliases the letterforms, which are the
      one thing being read. Comment both so neither is "corrected" to match the
      other later.
- [ ] 2.5 Encode as JPEG, with a quality ladder that re-encodes smaller if the
      result is somehow still too large — a backstop that should never fire, so a
      pathological input fails as a smaller picture rather than as a rejected
      request.
- [ ] 2.6 The failure reasons, each one the user can act on: not a picture;
      HEIC this browser cannot decode; a decode that failed; a canvas that gave
      nothing back. Count a HEIC file as a picture **on purpose**, so it reaches
      this module and earns the specific sentence instead of falling out as an
      unsupported file.
- [ ] 2.7 Colocated `src/app/listingPhoto.test.ts`: the scale never upscales, is
      bounded by the long edge in both orientations, and is bounded by area for a
      4:3 phone photograph; the file classification takes `.heic` as a picture and
      a `.bas`/`.zip`/`.prg` as not; each failure reason is reached. Note in a
      comment that the encode itself has no canvas under the test runner and is
      proved once in the browser (group 8) rather than shimmed.

## 3. Three ways in, one result

- [ ] 3.1 `src/storage/files.ts` — an image opener beside the binary one, using
      the module's own hidden input (which already carries the iOS Safari
      workaround) rather than the File System Access picker, which cannot offer a
      camera.
- [ ] 3.2 Use `accept="image/*"` and **no `capture` attribute**, with a comment
      saying why: `capture` does not add the camera, it *replaces* the picker with
      it, removing the photo library on most mobile browsers. Plain `image/*` is
      what gives a phone its choose-or-take sheet and a desktop its file browser —
      and it is what makes iOS transcode a HEIC to JPEG on the way out.
- [ ] 3.3 The one function all three routes reach: prepare the picture, reveal
      the assistant, and report the outcome — success or failure — in the panel
      rather than the status bar, so the same file cannot be answered differently
      depending on which gesture the user made.
- [ ] 3.4 Do **not** demand a key on attach. The send path already demands it at
      the moment the user sends; diverting an exploratory drop into a dialog would
      lose the picture, which the dialog knows nothing about. Comment it — the
      omission looks like an oversight.
- [ ] 3.5 The composer's paste route, reading the clipboard's **files**, not its
      items: the item list also reports an image for copied HTML, so reading items
      would silently attach the first picture of any web page pasted as text.
      Leave an ordinary text paste untouched.
- [ ] 3.6 `src/app/fileCommands.ts` — a picture branch ahead of the
      unsupported-type fallthrough. It is the one branch of that function that
      must **not** run the discard guard, because attaching replaces nothing;
      comment it, since every other branch does. No change is needed to the
      editor's drag handlers, which already hand any dropped file to it.

## 4. The picture slot, and the report that describes it

- [ ] 4.1 `src/ai/aiStore.ts` — a photograph is its own field on a request, not
      the existing picture plus a kind. Two fields admit a picture with no kind
      and a kind with no picture; one field per thing makes the precedence rule a
      single line.
- [ ] 4.2 The precedence: a photograph takes the slot ahead of any screen. The
      screen the panel is showing needs nothing to defer it — whether one is
      waiting is derived from the thread, so one not carried this turn is still
      waiting next turn, and the carried-once guarantee is untouched.
- [ ] 4.3 Fix the report that comes apart from its picture. A run composes its
      note before the request that carries it, and the note's own words claim the
      screen is attached; the send path then drops that picture whenever the
      caller supplied one, while still sending the note. Harmless today only
      because the two pictures happen to be the same one. Make the note and its
      picture one unit: where a photograph has taken the slot, a note that *has* a
      picture waits with it; a note with no picture travels as it always did.
- [ ] 4.4 The composer's attachment lives in the store beside the pending fix, so
      clearing the conversation takes it too — a picture waiting to be sent is
      part of the conversation being cleared.
- [ ] 4.5 The thread marks a turn as having shown a photograph, distinctly from
      one that showed a screen, and the stored marker records which. The stored
      message type already makes writing the picture itself a type error; say so
      in a comment rather than adding machinery.
- [ ] 4.6 Colocated tests in `src/ai/aiStore.test.ts`, where the real risk is and
      a browser proves nothing: a photograph takes the slot over a caller-supplied
      picture; it defers both the asked-for screen **and** its note, and the very
      next request carries both; a note with no picture still travels with a
      photograph; the turn is marked as a photograph and persists as a marker with
      no pixels; clearing the conversation clears the attachment.

## 5. Telling the assistant what it is looking at

- [ ] 5.1 `src/ai/promptBuilder.ts` — the "a screen is attached" flag on the user
      message becomes a single statement of which picture rode, so that a screen
      and a listing at once cannot be written down. Keep the screen sentence
      byte-identical, so no existing wire expectation moves. The run-fix and
      expectation-fix builders always mean a screen and keep their boolean.
- [ ] 5.2 Write the transcription guidance for the listing case, covering only
      what the machine's reference tables cannot: glyphs printed alike settled by
      what the line requires rather than by shape; a non-typewriter character
      written the way this machine spells it, never a lookalike; a narrow column's
      wrap being one line; a margin checksum not being program; transcribe as
      printed and report a fault rather than fixing it; and name an unsettled
      character by line number.
- [ ] 5.3 The one bullet that deliberately overrides the general rule about
      returning code: a picture showing part of a listing returns a **fragment**,
      whatever that rule would say. The general rule chooses by how much of the
      existing program a change affects, which reads backwards here — page two of
      a listing is a small part of a large program and would be judged a whole
      one. This bullet is what makes page-by-page transcription merge.
- [ ] 5.4 Keep every word of it in the user turn. The system prompt is composed
      identically per machine and provider so the cache matches from the front,
      and `src/ai/promptStability.test.ts` pins a measured character budget per
      machine; guidance about photographs would move every machine's budget and be
      paid for on every request that carries no picture.
- [ ] 5.5 Add the negative assertion to `src/ai/promptStability.test.ts`: the
      composed system prompt contains none of the transcription text. Cheap, and
      exactly the migration that test file exists to catch.
- [ ] 5.6 Colocated tests in `src/ai/promptBuilder.test.ts`: the listing guidance
      appears for a listing and not for a screen; the screen sentence is unchanged;
      neither appears when no picture rides; the fragment override is stated.

## 6. The composer

- [ ] 6.1 `src/components/AiPanel.tsx` — an attach control beside Send, labelled
      for a screen reader, its tooltip carrying the framing hint that half a page
      reads better than a whole one. Disabled exactly when the composer is, so the
      two behave as one thing.
- [ ] 6.2 The attached picture shown before it is sent: a thumbnail of the
      prepared bytes themselves — so the user can see the listing is in frame and
      the right way up before spending a request — its name, and a remove control.
- [ ] 6.3 Say what is displaced, and only when something is: where a screen is
      waiting, the chip says the screen stays behind because one picture goes with
      a message. Silence when there is no competition.
- [ ] 6.4 Send accepts a photograph with no words, filling the request with a
      stated default used both on the wire and in the thread, so the two say the
      same thing and the turn is not a blank bubble. Clear the attachment once the
      turn is away, alongside the typed text.
- [ ] 6.5 The turn's note reads as a photograph where it showed one, on the same
      style the screen note already uses. Hide the attach control where the chosen
      provider cannot be shown a picture — a courtesy; the refusal in the attach
      path is the guarantee.
- [ ] 6.6 `src/components/AiPanel.module.css` — the chip row above the composer.

## 7. Documentation

- [ ] 7.1 `docs/guide/getting-started.md` — a short passage under the AI section:
      attach a photo or scan of a printed listing and it is typed in for you,
      apply it like any other answer, half a page reads better than a whole one,
      and a long listing may arrive in two parts and be continued. End-user voice:
      no source paths, no internal names, relative links only.
- [ ] 7.2 Do not touch the sidebar in `docs/.vitepress/config.ts`. A new passage
      on an existing page needs nothing there, and the sidebar changes only when
      the user asks.

## 8. The browser test

- [ ] 8.1 A generated fixture at the flat `e2e/` root beside the existing stubs:
      a canvas filled white with a few BASIC lines drawn on it, encoded and handed
      over as a file. No image is committed — a photograph is a binary blob with a
      licence question that would drift — and nothing asserts on its pixels, only
      on what reached the wire, so font differences between browsers are safe.
- [ ] 8.2 Extend the existing journey in `e2e/ai-assistant/shown-screen.spec.ts`
      rather than starting cold: that file is already about which picture a request
      carries, already stubs the wire and boots the app once. Stage it — ask, get a
      screen back, attach through the file chooser (the pattern the persistence and
      import specs already use), see the chip say the screen stays behind, send,
      read off the wire that exactly one picture rode and that it was a JPEG whose
      turn names a printed listing, see the thread call it a photograph, then ask
      again with nothing attached and see **that** turn carry the screen as a PNG.
      Append the paste and drop routes as two short assertions on the same journey,
      since the wire is proved by then.
- [ ] 8.3 Comment what only a browser proves — a real file decoded, downscaled and
      encoded through a canvas; the file-picker fallback against an input created
      and removed on the spot; a real paste and a real drop — none of which exist
      under the test runner.
- [ ] 8.4 Re-read, and reword, the existing assertion that the composer offers no
      control for showing the screen. It still passes — an attach-a-photo control
      is not a show-the-screen control — but its comment ("no attachment to
      manage") becomes half wrong: for a photograph there now is one, and for the
      screen there still is not.
- [ ] 8.5 Record the manual check the suite deliberately does not automate: take a
      portrait photograph on a phone and confirm the thumbnail is upright. A canvas
      cannot emit an orientation tag, and hand-writing one would test the browser's
      EXIF handling rather than ours — which *is* our whole defence.

## 9. Quality gates

- [ ] 9.1 `npm run typecheck`
- [ ] 9.2 `npm test`
- [ ] 9.3 `npm run lint`
- [ ] 9.4 `npm run format:check` (or `npm run format`)
- [ ] 9.5 `npm run docs:build` — docs change in group 7.
- [ ] 9.6 `npm run e2e:chromium -- e2e/ai-assistant`. Only check off when it
      passes; a failing run leaves this unchecked with a note on what failed.
- [ ] 9.7 `npm run e2e:chromium -- e2e/persistence` — the drop route changes a
      function that folder's file journeys go through.
- [ ] 9.8 `npx openspec validate --specs`
- [ ] 9.9 With a real key: photograph a real printed listing on a machine with
      graphics characters, and check the transcription against the paper — the
      graphics glyphs, the line numbers, and whether anything unreadable was named
      rather than guessed.
