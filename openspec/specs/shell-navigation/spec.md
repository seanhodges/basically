# shell-navigation Specification

## Purpose

Make getting *out* of somewhere as reliable as getting into it. The IDE stacks
dialogs, panels, drawers and overlays over the editor, and the user needs one
dependable way back: the Escape key on a keyboard, the Back gesture on a phone,
both closing what they just opened and neither ever throwing away the program
they were writing.

## Requirements

### Requirement: Dismissing the topmost surface

The application shell SHALL treat every ephemeral UI surface — dialogs, panels,
drawers, overlays and the mobile pane tabs — as dismissible, and SHALL offer the
same two dismissal gestures for all of them: the Escape key, and the platform's
Back gesture (the browser Back button, or a phone's hardware or system Back).

Both gestures SHALL dismiss exactly one surface: the one opened most recently.
Where surfaces are stacked, repeating the gesture SHALL walk back out through
them in the reverse of the order they were opened, returning the user to what
they were looking at before, one step at a time.

The two gestures SHALL be equivalent: any surface dismissible by one SHALL be
dismissible by the other, and both SHALL dismiss the same surface at any moment.

#### Scenario: Escape closes an open dialog

- **WHEN** any dialog is open and the user presses Escape
- **THEN** that dialog closes and the user is returned to the screen beneath it

#### Scenario: Back closes an open dialog instead of leaving the app

- **WHEN** any dialog is open and the user makes the platform's Back gesture
- **THEN** that dialog closes, the user remains in the IDE, and the program they
  were editing is untouched

#### Scenario: Stacked surfaces unwind one at a time

- **WHEN** the user opens a panel, then opens a dialog on top of it, then
  dismisses once by either gesture
- **THEN** only the dialog closes and the panel beneath it stays open
- **AND WHEN** the user dismisses a second time
- **THEN** the panel closes too

#### Scenario: Switching between mobile panes is lateral

- **WHEN** the user moves between non-editor panes on a phone and then makes the
  Back gesture
- **THEN** they return to the editor rather than retracing every pane they visited

### Requirement: Dismissing a confirmation means cancelling it

Where a surface asks the user to confirm an action that would discard or destroy
work — deleting a block, switching target machine — dismissing it by either
gesture SHALL be treated as declining the action, not as accepting it. The
program SHALL be left exactly as it was.

#### Scenario: Dismissing a delete confirmation keeps the block

- **WHEN** the user is asked to confirm deleting a block and dismisses by either
  gesture
- **THEN** the block is still present and unchanged

#### Scenario: Dismissing a target-switch confirmation keeps the machine

- **WHEN** the user is asked to confirm switching target machine and dismisses by
  either gesture
- **THEN** the target machine is unchanged and the program is not converted

### Requirement: Dismissal from the embedded documentation

The documentation drawer SHALL be dismissible by Escape while the user is reading
it, including while their focus sits within the documentation content itself.

#### Scenario: Escape while reading the docs

- **WHEN** the documentation drawer is open, the user has clicked into the
  documentation content, and they press Escape
- **THEN** the drawer closes and focus returns to the IDE

### Requirement: Surfaces the user did not open do not trap Back

A surface the IDE raised on the user's behalf rather than at their request — an
on-screen keyboard that appears automatically when a pane takes focus — SHALL NOT
consume a Back gesture. Back SHALL act on whatever the user last opened
themselves, or leave the app when they have opened nothing.

When no surface is open, the Back gesture SHALL leave the application, as it
would on any ordinary page.

#### Scenario: An auto-shown keyboard does not swallow Back

- **WHEN** the on-screen keyboard has appeared automatically because a pane took
  focus, and the user makes the Back gesture
- **THEN** the gesture is not spent on the keyboard

#### Scenario: Back from a closed app leaves it

- **WHEN** no surface is open and the user makes the Back gesture
- **THEN** the user leaves the application

### Requirement: Dismissal does not override a surface's own use of Escape

Where a surface uses Escape for its own purpose — releasing keyboard capture from
the running machine, or closing an editor's find bar — that use SHALL take
priority, and the same keypress SHALL NOT also dismiss the surface behind it.

#### Scenario: Escape releases the emulator first

- **WHEN** the user has clicked into the running machine's screen so their typing
  reaches the machine, and they press Escape
- **THEN** the keypress releases the machine and does not close anything else
