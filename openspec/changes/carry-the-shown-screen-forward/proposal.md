## Why

The assistant panel has two pictures of the same machine screen and two ways of
taking one. At the end of an answer the IDE runs the program, captures the
display and hands it to the user for a human look — the thumbnail that sits under
the reply in the thread. Separately, a "Show screen" button in the composer takes
its own capture off the emulator canvas and attaches it to the request the user
is writing, with a second thumbnail in an attachment strip above the input box.

So the ordinary case — look at the picture the assistant's program drew, then ask
about it — costs the user a button press, takes a second screenshot of the same
machine, and puts the same image in the thread twice. Worse, the two captures are
taken at different moments: the button reads the canvas as it stands now, which
after a check has run on a program the user never applied is not necessarily the
screen the thumbnail above it is showing. The user can end up asking about one
picture while the assistant is shown another.

The picture the user is looking at is already in the conversation. That is the
one to send.

## What Changes

- **The "Show screen" button and its attachment strip are removed.** The
  composer is the text box and Send, as it was before the control existed.
- **The screen already in the thread rides with the next request.** Where the
  conversation is showing the machine's screen from a checked answer, that same
  display — the one the user is looking at — is carried to the assistant with
  their next request. Nothing is captured a second time.
- **Carried once.** A display the assistant has already been shown is not
  attached again by a later request; it stays on the turn that carried it, as
  every shown screen already does.
- **One picture in the thread.** A request that carried the screen says so
  instead of repeating the thumbnail: the picture above it is the picture the
  assistant was shown.
- **The screen shown for a human check is no longer sent-to-nobody.** It was
  specified as the user's alone; it is now also what the user's own next request
  carries. It still travels on no request the IDE makes by itself.

## Non-goals

- **No blanket context.** The screen rides with the request that follows it,
  once. It is not attached to every turn, and no request captures the machine to
  find one.
- **No new capture point.** The only capture in the app stays where it is — the
  frame the run check reads its verdict from. This change removes a capture, it
  does not add one.
- **No change to what the assistant asks for.** Views it names, expectations it
  states, and the judging turn are untouched.
- **No change to what is stored.** The conversation still records that a screen
  was shown without keeping the pixels.
- **No screen without a checked run.** A program the user ran themselves, with
  nothing in the conversation, sends nothing — as it would have with the button
  disabled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the user no longer attaches the machine's display by hand;
  instead the display the conversation is already showing them is what their next
  request carries, once, and only where the provider can be shown one.

## Impact

- **`src/components/AiPanel.tsx`** — the attach control, the attachment strip and
  the composer's capture state go; the request picks up the screen the thread is
  showing, and a user turn that carried one says so rather than repeating it.
- **`src/ai/aiStore.ts`** — a small pure reader for "the screen this thread is
  showing that the assistant has not been sent".
- **`src/ai/promptBuilder.ts`** — the line that tells the model what the picture
  is now describes the screen the program left, not the canvas right now.
- **`src/app/store.ts`, `src/components/EmulatorPane.tsx`** — the store flag that
  existed only to enable/disable the button is removed.
- **`e2e/ai-assistant/`** — the show-screen scenarios are replaced by ones that
  send a request after a checked answer and assert what it carried.
- **Dependencies** — none added or removed.
