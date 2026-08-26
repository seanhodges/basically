## Context

The assistant already carries a picture on a request. `ChatImage` is one media
type and some base64; a turn may hold one; each provider declares whether it can
be shown one; the three backends translate that one shape into their own image
block; and the saved conversation keeps a marker where the picture was rather
than the picture. Nothing about *sending* a picture needs building - the
registry's own comment already names an attach control as a reader of the
capability flags.

What is missing is the other direction. The only picture the IDE can produce is
the emulator's canvas, read back by `src/app/screenCapture.ts`. There is no route
from a file the user chose: no `accept="image/*"` anywhere, no `capture`
attribute, and the sole `<input type=file>` is private to `src/storage/files.ts`.
An image dropped on the editor is reported as an unsupported file.

So this change is small in the middle and entirely at the edges: a way in for a
photograph, a sentence telling the assistant what it is looking at, and a label
on the turn that carried it. Where the assistant sits relative to the editor, the
store and the machine is described in `docs/contributing/architecture.md`.

**Seam impact: none.** Nothing is added to `Dialect` or `MachineEmulator`. The
machine appears in this change only as the language rules the system prompt
already carries, composed from the shared reference data. What widens is the
assistant's own provider boundary, by one media type and one statement of what a
picture is - a different seam, and not the one the app is built around.

## Goals / Non-Goals

**Goals:**

- A printed listing reaches the editor without being typed.
- The transcription lands through the apply actions that already exist, so a
  listing photographed a page at a time merges page onto page.
- The assistant is told what it is looking at, and what makes print hard to read,
  without the system prompt moving.
- A photograph costs no more of the user's key than it must, and is kept no
  longer than a screen is.
- A machine or a provider that cannot take part is unchanged, not broken.

**Non-Goals:**

- Optical character recognition in the IDE, or any new dependency.
- More than one picture on a request.
- A starting point when creating a project.
- Special handling of a transcription as an answer - it is checked, corrected and
  continued exactly as any other answer is.
- Repairing a photograph: no deskew, no contrast, no page detection.

## Decisions

**1. A photograph is sent as a photograph, not re-encoded to PNG.**

`ChatImage.mediaType` is the literal `'image/png'`, and its comment says why:
what is ever sent is a retro screen, where lossy compression destroys the
single-pixel detail that is the point of showing it. That reasoning is sound and
it is about screens. A photograph of paper is the opposite case - already lossy,
its detail a letterform rather than a pixel - and photographic and halftone noise
defeat PNG's filters entirely: the same picture is several times larger as PNG,
at or over a provider's per-image ceiling, for no readability gain whatever.

So the media type widens to `'image/png' | 'image/jpeg'`. This is nearly free
because all three backends pass the field through rather than asserting it, as do
the two places that build a `data:` URI from it. None of them changes.

The widening would silently cost one guarantee, so it is paid back in the same
change: **the emulator's own capture narrows to `'image/png'`**, because the
screenshot path writes a `.png` filename on the strength of it and a screen must
never become a JPEG.

**2. Decoding, turning and scaling happen once, in one place, and report a reason
rather than throwing.**

A new `src/app/listingPhoto.ts` takes a file and returns either a picture a
request can carry or a reason it cannot. It belongs beside `screenCapture.ts` and
`screenshot.ts` - the app's other two DOM-image utilities - rather than under the
provider layer, which is SDK adapters, or under storage, which is picker plumbing
it calls. Shaped after `screenshot.ts`: the arithmetic and the classification are
pure and exported, the DOM is confined to one async function, and the result is a
union rather than a throw.

Four things it must get right, none obvious:

- **Orientation.** A phone writes the sensor's pixels and an EXIF tag saying
  which way up they are. Drawn without honouring that tag, an ordinary photograph
  arrives on its side, and a listing on its side is a listing that cannot be
  read. Decoding declares `imageOrientation: 'from-image'` rather than relying on
  a default that is not the same everywhere. That one option is the whole EXIF
  answer - no orientation parser ships.
- **Scale, bounded twice.** A long-edge cap alone is wrong: a 4:3 photograph at
  the usual long-edge limit is still well over the pixel-count limit and gets
  resampled by the provider anyway, so the excess is paid for and thrown away.
  Bound by the long edge *and* by total pixels, and never upscale.
- **Smoothing, the opposite of the screen path.** `screenshot.ts` disables
  smoothing deliberately, so each machine pixel stays an exact block. This path
  must enable it: continuous tone downsampled without smoothing aliases the
  letterforms, which are the one thing being read. Both settings follow from
  fidelity to what the picture actually is.
- **A size ladder that should never fire.** Re-encode at a lower quality if the
  result is somehow still too large, so a pathological input fails as a smaller
  picture rather than as a rejected request.

Returning a reason follows `saveScreenshot`, and is what makes HEIC tolerable:
many phones write it and most desktop browsers cannot decode it. A file named as
HEIC is therefore *counted as a picture on purpose*, so it reaches this module
and earns the specific sentence - "this browser can't read HEIC; save it as a
JPEG" - instead of falling out as an unsupported file. Shipping a HEIC decoder is
rejected: it is a large dependency and a licence question for one format, on the
one platform that already transcodes it away.

**3. A photograph is attached at the composer; three routes converge there.**

The attach control, an image pasted into the composer, and an image dropped on
the editor reach one function that prepares the picture, reveals the assistant,
and reports the outcome. They differ only in where the file came from, and one
reporting surface is the point: a picture lives in the assistant, so a failure
reported to the status bar instead would put the same message in two places
depending on which gesture the user made.

Three traps decide the details:

- **`capture` is not "also offer the camera" - it replaces the picker with it.**
  On most mobile browsers, setting it removes the photo library outright, which
  is worse than useless for someone photographing a page yesterday. Plain
  `accept="image/*"` is what produces the *choose or take* sheet on a phone, and
  a file browser on a desktop, from one control. It is also what makes iOS
  transcode a HEIC to JPEG on the way out, which removes the HEIC problem on the
  platform that has it.
- **The picker route deliberately skips the File System Access path** the
  document and binary openers prefer. That picker cannot offer a camera at all,
  and a picture is read once and never written back, so a file handle buys
  nothing. The private input in `src/storage/files.ts` gains an image opener
  beside it, inheriting the iOS Safari workaround that input already documents.
- **A paste reads the clipboard's *files*, not its items.** The item list also
  reports an image for copied *HTML*, so reading items would silently attach the
  first picture of any web page pasted as text.

Dropping on the editor extends the branch in `src/app/fileCommands.ts` that
currently calls a file unsupported. It is the one branch of that function that
must *not* run the discard guard, because attaching replaces nothing - what the
assistant makes of it lands through the apply actions, which guard themselves.

**Attaching does not demand a key.** The send path already demands it at the
moment the user presses send, and that stays the single place it is demanded.
Diverting an exploratory drop into a settings dialog would lose the photograph -
the dialog knows nothing about a pending attachment - and punish the gesture that
was going to teach the user the feature exists.

*Alternative considered:* a camera preview of our own, with `getUserMedia`. The
audio recorder shows what that costs - permission, device enumeration, labels
that fill in only after permission, cancellation on close - and buys nothing: the
phone's own camera frames a page better than a preview inside a browser tab.

**4. When a photograph and a screen both want the one slot, the photograph wins -
and neither the screen nor the words about it are lost.**

Three things want that slot: the screen the panel is showing the user, a screen
the assistant *asked* to see after a run, and the photograph. The photograph is
what the user is asking about, so it takes the slot - which is also what the
store already does with a user's own attachment, and has a test behind it.

Deferring the *shown* screen needs nothing built. Whether one is waiting is
derived from the thread rather than held in a flag, so a screen not carried this
turn is simply still waiting next turn. The existing guarantee that a screen is
carried once is untouched, and the case reduces to one already covered: a request
that carries no screen.

The *asked-for* screen is the sharp one, and it exposes a fault that exists
today. A run composes its note before the request that carries it, and the note's
own words say the picture is attached; the send path then drops that picture
whenever the caller supplied one of its own, while still sending the note. Today
that is harmless by coincidence - the only caller-supplied picture is the same
capture. With a photograph it becomes a plain lie: *"the screen you asked to see
is attached"* printed beside a photograph of a magazine.

So the note and its picture are treated as one unit. Where a photograph has taken
the slot, a note that *has* a picture waits with it for the next request; a note
with no picture is self-contained and travels as it always did.

*Alternatives considered:* editing the screen sentence back out of the composed
note (fragile - the note is prose assembled in four places); recomposing the note
at send time (correct, but a real refactor of four call sites for what deferral
buys in four lines); refusing to attach while a screen is pending (punishing the
user for the IDE's data model); carrying both pictures (the proposal's non-goal).

**5. What the picture is, and how to read it, ride in the user turn.**

The prompt builder already says one sentence when a screen is attached, and its
comment records why: a model told what it is looking at reads the picture as
evidence rather than decoration. The same seam takes the listing case - the flag
becomes a statement of *which* picture rode, expressed so that "a screen and a
listing at once" cannot be written down at all.

It must not go in the system prompt. That prompt is composed identically per
(dialect, provider capability) so the provider's cache matches from the front,
and its stability test pins a measured character budget per machine. Guidance
relevant to one turn in fifty would move every machine's budget, invalidate every
cached prefix once, and be paid for on every request that carries no picture. The
same test gains an assertion that the transcription text is *absent* from the
composed prompt - cheap, and exactly the migration it exists to catch.

The guidance covers only what the machine's reference tables cannot settle. The
tables say what this BASIC accepts; they do not say that a printed listing is a
hostile document. It is:

- `O` against `0`, `1` against `I` and `l`, `5` against `S`, `8` against `B`, `2`
  against `Z`, a comma against a full stop - one glyph in many listing fonts. The
  reading that is right is the one the line requires: a line number in sequence, a
  variable used elsewhere, a keyword this machine actually has.
- A glyph that is not on a typewriter is the machine's own - block and line
  graphics, arrows, a currency sign, an inverse character - and is written the way
  the reference above spells it. Never a lookalike ASCII substitute.
- A listing set in narrow columns wraps. A run of text with no line number of its
  own continues the line above it.
- A checksum or byte count printed down the margin is not part of the program.
- Transcribe as printed. Do not modernise, tidy, rename, or fix a bug that is on
  the page - say it underneath the code instead.
- A character the picture genuinely cannot settle is *listed by line number*
  underneath the code. A stated gap is a question the user answers in a sentence;
  a silent guess is a bug in a program they did not write.

One bullet deliberately overrides the general rule about returning code, and it
is what makes page-by-page transcription work. That rule chooses a fragment or a
whole listing by how much of the *existing program* a change affects, which reads
exactly backwards here: page two of a listing is a small part of a large program
and would be judged a whole one. So the picture decides instead - a picture
showing part of a listing returns a fragment, whatever the general rule would say
- and page two merges onto page one by line number through machinery that already
exists.

*Deliberate non-goal:* a listing printed for a *different* machine. "Transcribe
as printed" and "port it to this machine" are opposite instructions, and porting
already exists as its own path. The assistant will say what it sees; the user can
ask for a port on the next turn.

**6. The thread says which picture a turn showed, and stores neither.**

A turn showing a picture already renders a note saying so, and persistence
already keeps that note as a marker while dropping the bytes - the conversation
shares a few megabytes with the autosaved program, and images belong in neither.
Both generalise: the note says which kind, and the stored marker records which
kind, with the old marker keeping its meaning so threads stored before this
change still restore. A restored thread must not claim a photograph was a screen.

That the picture itself cannot reach storage needs no new machinery: the stored
message type is the wire type with the picture removed, so writing one is a type
error rather than a rule to remember.

**7. A picture with no words is a request.**

The composer refuses an empty request today. A photograph with nothing typed is
not empty - it is the clearest possible statement of what is wanted - so the
request falls back to a stated default, used both on the wire and in the thread,
so the two say the same thing and the turn is not a blank bubble.

## Risks / Trade-offs

- **A photograph stays in the conversation for the rest of its life.** Later
  turns replay prior turns byte-for-byte, picture included, because the cache
  matches from the front. → The cheaper of the two by a wide margin, and the
  reason the scale-down in decision 2 is not a nicety. A photograph is perhaps
  twenty times a screen's picture cost, replayed as cache reads thereafter; worth
  saying plainly, and `/clear` ends it.

- **A whole page reads worse than half a page.** At the size actually sent, a
  full magazine page gives roughly a dozen pixels per printed character -
  marginal. Half a page roughly doubles it. → Sending a bigger picture does *not*
  help, because the provider resamples it back down; the honest mitigation is to
  say so, in the control's own tooltip and in the spec, rather than to raise a
  limit that buys nothing.

- **A transcription that is wrong is expensive to find.** One misread character in
  a two-hundred-line listing is a bug the user did not write, in a program they
  have not read - and the check-and-correct loop is optimised to *make it run*,
  where a transcription's value is *fidelity to the page*. It may quietly fix the
  listing away from what is printed. → Accepted, deliberately: a transcription is
  an answer and gets an answer's treatment. The hedges are in the guidance, not in
  code - transcribe as printed and note a suspected error rather than fixing it,
  and list what could not be settled by line number - plus the diff the merge
  already shows before anything lands.

- **Transcription is an output-heavy request** and will meet the output budget far
  more often than a conversational turn, most sharply on the provider whose
  ceiling is lowest. → Nothing new is needed: a reply that ran out of room is
  already continuable and the panel already offers it. Worth a line in the docs so
  a long listing arriving in two parts reads as normal rather than as a failure.

- **HEIC** is unsolvable on most desktop browsers without a decoder. → A sentence
  the user can act on, and largely dodged on the platform that produces it.

- **Widening the media type touches a type three backends share.** → They pass it
  through rather than asserting it, so the change is type-level; one test per
  backend that a JPEG arrives as a JPEG pins it, and the screen capture is
  narrowed in the same change so nothing loses a guarantee.

- **Two markers where there was one.** A third kind of picture would want a
  proper enumeration. Fine at two; noted rather than pre-solved.

- **Hiding the attach control on a provider that cannot be shown pictures is
  cosmetic**, since the panel does not re-render the instant the provider
  changes. → The refusal inside the attach path is the guarantee; the hiding is a
  courtesy. Harmless while every registered provider accepts pictures.

## Migration Plan

Nothing to migrate. The feature is dormant until a picture is attached: a request
that attaches none composes the same bytes it does today. No stored format
changes - the conversation marker widens in meaning while keeping the key it
already writes, so a thread stored before this change restores unchanged.
Rollback is removing the attach routes; nothing else depends on them.

## Open Questions

- Whether a listing too long for one output budget should be continued
  automatically rather than on a press. The continue action already exists and
  works; whether a transcription is the case that should reach for it by itself is
  worth learning from use.
- Whether the guidance should keep a listing's own line numbers verbatim even
  where they are irregular. Verbatim is assumed - it is what makes page two merge
  onto page one - but a listing whose numbering restarts each page would test it.
- Whether a picture the assistant asked to see, deferred behind a photograph,
  should be surfaced to the user as waiting. It is carried by the next request
  either way; whether silence about the delay is confusing is a question for use.
