# shell-navigation Delta

## ADDED Requirements

### Requirement: Raising a surface retires the editor's transient popups

The editor answers a caret with transient popups — the completion list it offers
while typing, and the menu of what a picked token can be asked. Both belong to a
position the user is currently looking at.

Raising a surface over the editor SHALL retire those popups, so that what the
user opened is what they are left looking at. This SHALL hold for every surface
the user opens themselves — dialogs, panels, the documentation drawer, and
moving to another pane on a phone.

The on-screen input surfaces — the keyboard, the game controller and its remap
picker — SHALL NOT retire them. Those are how the user types into the editor
rather than something raised over it, and the keyboard appears of its own accord
when a pane takes focus, so retiring a completion list as the keyboard arrives
would take away the offer the user was about to accept.

Only the popups SHALL be retired. The bars at the foot of the editor —
find/replace, and a variable's usages — SHALL be left as they are: the user
opened those deliberately and they are still true of the program when the
surface closes.

#### Scenario: Opening a dialog takes away the completion list

- **WHEN** the editor is offering a completion list and the user opens a dialog
- **THEN** the completion list is gone

#### Scenario: Opening the documentation drawer takes away the token menu

- **WHEN** the menu of what a picked token can answer is open and the user opens
  the documentation drawer
- **THEN** the menu is gone

#### Scenario: The on-screen keyboard leaves a completion list alone

- **WHEN** the editor is offering a completion list and the on-screen keyboard
  appears
- **THEN** the completion list is still offered, and can still be accepted

#### Scenario: A find is not lost to a surface

- **WHEN** find/replace is open at the foot of the editor and the user opens a
  dialog, then closes it
- **THEN** find/replace is still open, with what the user typed into it

### Requirement: A raised surface covers what the editor floats

A surface raised over the editor SHALL be drawn in front of everything the
editor floats above its text, including a popup the user raises while that
surface is already open. The documentation drawer leaves part of the editor
visible and usable beside it, so this is reachable rather than theoretical.

#### Scenario: A popup raised beside the open drawer stays behind it

- **WHEN** the documentation drawer is open, and the user picks a token in the
  part of the editor still visible beside it
- **THEN** the menu that opens is drawn behind the drawer, not in front of it
