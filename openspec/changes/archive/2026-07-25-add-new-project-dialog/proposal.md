## Why

Starting a program is the first thing anyone does in Basically, and today it is
the least considered path in the product. **File ▸ New project** clears the
editor to nothing on whatever machine happened to be selected, offering no
choices at all — while four other paths each decide unilaterally what should be
in the editor, and disagree with one another:

| Path | Today |
| --- | --- |
| First ever launch | Welcome dialog, editor pre-loaded with the machine's first sample |
| Every later launch | Empty editor, no dialog |
| **File ▸ New project** | **Empty editor, no dialog** |
| Target switch, empty editor | Silently loads the new machine's first sample |
| Target switch, pristine sample | Swaps the same-named sample, else the first sample |

That first sample — the "starter" — is content the user never asked for, and it
appears or vanishes according to rules no one can see. Meanwhile the two
decisions a person actually makes when starting something (**which machine** and
**what am I starting from**) are split across two unrelated controls: the toolbar
target selector and the File ▸ Samples submenu.

This change makes one dialog the single place a program starts, and establishes
one rule: **the user always chooses; nothing is ever chosen for them.**

## What Changes

- **New:** a New project dialog on File ▸ New, offering a machine picker grouped
  by manufacturer (with each machine's year and a one-line description), an
  optional project name, and a starting point — a blank program, one of the
  machine's bundled samples, or a plain-English description handed to the AI
  assistant.
- The description starting point is offered only when an API key is set;
  otherwise it appears disabled, noting that the AI assistant must be configured
  in settings before it becomes available.
- The dialog pre-selects the current machine and *Blank*, so the keyboard path
  stays two keystrokes.
- The first-launch welcome greeting stays; its **Start coding** card now opens
  the New project dialog instead of simply dismissing.
- **BREAKING (user-visible):** the **starter-sample concept is removed
  entirely.** No sample is ever loaded automatically — not on first launch, not
  when switching to a machine with an empty editor. The first launch now opens an
  empty editor behind the welcome greeting.
- **BREAKING (user-visible):** the **File ▸ Samples menu is removed.** Samples
  are reached by creating a new project. Loading a sample is therefore now guarded
  by the same discard confirmation as any other document replacement.
- Every registered machine gains descriptive metadata (manufacturer, release
  year, one-line description) so the picker can group and describe them.
- A project may be given a name at creation instead of staying `untitled` until
  first save, and that name survives a reload.

### Non-goals

- **No project templates** beyond the samples each machine already bundles. This
  change surfaces existing content; it does not author new starting points.
- **No project browser, project list, or cloud storage.** Basically stays
  single-document and fully client-side.
- **No change to Open, Save, Import, Export, or Publish.** Their document-loading
  behaviour is untouched.
- **The toolbar target selector stays.** Switching the machine for a program
  already in progress remains its job; the dialog does not replace it.
- **No general accessibility retro-fit of the existing dialogs.** The new dialog
  is keyboard-complete, but the other modals are left as they are.
- **No "don't ask again" opt-out.** Choosing is the point.

## Capabilities

### New Capabilities

- `project-setup`: how a program comes into existence — choosing the target
  machine, the starting point (blank, a bundled sample, or an AI-generated
  program), and a name, as one deliberate act with nothing chosen implicitly.

### Modified Capabilities

- `persistence`: autosave must preserve a newly-created project's name (today
  only content decides whether a document is worth keeping, so a named-but-
  untouched project would lose its name on reload); and the first-launch
  behaviour of restoring a bundled sample is removed.
- `ai-assistant`: creating a project from a plain-English description seeds the
  conversation, making project creation a new entry point into the assistant —
  offered only once the assistant has been configured with a key.

## Impact

- **The `Dialect` seam** gains three required descriptive fields (manufacturer,
  year, one-line description), filled in for every registered machine. Purely
  descriptive — no behaviour hangs off them, so the machine-agnostic contract is
  unchanged. This is the only seam impact.
- **Application state** gains one document-creation action and a dialog flag; the
  three places that auto-loaded a starter sample are removed, along with the
  now-dead "has launched before" setting that existed only to serve them.
- **UI**: one new dialog component; the File menu loses its Samples section; the
  welcome greeting gains a hand-off.
- **AI**: the provider/key resolution helper currently private to the docs drawer
  is shared, so project creation and the docs hand-off use one implementation.
- **Existing tests**: four end-to-end specs depend on the removed behaviour —
  most significantly the suite that boots every machine and asserts it paints,
  which relies on the starter sample being auto-loaded and would otherwise run an
  empty program on every machine. One spec generates the published documentation
  screenshots.
- **Documentation**: the getting-started walkthrough, the machine-code guide, and
  the contributing quick-check all instruct the reader to use File ▸ Samples, and
  the architecture page's dialog inventory needs the new entry.
