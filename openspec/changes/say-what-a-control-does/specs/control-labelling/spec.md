## ADDED Requirements

### Requirement: Every control says what it does

A control the user can activate SHALL be labelled with what activating it does,
not with what it is called. The label SHALL be a short imperative phrase in
sentence case — "Run the program", not "Run"; "Open documentation", not
"Documentation" — so that a user who has never seen the icon learns the action
from the label alone.

A label SHALL be short enough to read at a glance. Where a control needs more
explanation than a phrase, the explanation belongs in the documentation the
control can open, not in the label.

#### Scenario: An icon-only control names its action

- **WHEN** the user hovers a control that shows only an icon
- **THEN** it tells them what activating it does, as an action rather than a
  category name

#### Scenario: A label does not spell out a whole feature

- **WHEN** the user hovers any control in the IDE
- **THEN** what they read is a phrase they can take in at a glance, not a
  sentence of prose

### Requirement: A control has one name

Where a control offers both a hover tooltip and a name for assistive
technology, the two SHALL agree. A user who hovers a control and a user who
reaches it with a screen reader SHALL be told the same thing about it.

A control that shows only an icon SHALL carry both: without the tooltip a
sighted user is left with an unexplained symbol, and without the assistive name
a screen reader announces the symbol or nothing.

#### Scenario: Hover text and announced name match

- **WHEN** a control offers both a tooltip and a name for assistive technology
- **THEN** both say the same thing about what the control does

#### Scenario: An icon-only control is reachable either way

- **WHEN** the user meets a control that shows only an icon
- **THEN** it is named both on hover and to a screen reader

### Requirement: A label tells the truth about the machine and the keyboard

A label that names a keyboard shortcut SHALL report the binding actually in
effect, so that rebinding a shortcut updates every label that mentions it. A
label SHALL NOT state a binding it does not read from the live configuration.

A label SHALL NOT name a fixed set of machines or dialects. Which machines the
IDE supports changes as machines are added, and copy that lists them is wrong
from the next port onwards.

Where a control both offers a shortcut and needs a name for assistive
technology, the shortcut SHALL appear in the hover tooltip only, so that a
screen reader announces the action rather than a keystroke.

#### Scenario: A rebound shortcut updates its label

- **WHEN** the user rebinds a keyboard shortcut and hovers the control that
  performs it
- **THEN** the label shows the new binding

#### Scenario: A label does not enumerate the machines

- **WHEN** the user reads any control's label
- **THEN** it does not name a fixed list of supported machines
