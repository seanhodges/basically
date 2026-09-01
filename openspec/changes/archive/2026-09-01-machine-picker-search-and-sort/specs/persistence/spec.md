## MODIFIED Requirements

### Requirement: Settings persist locally

Every user preference (target machine, editor, emulator, input, AI provider
and per-provider keys) SHALL persist in the browser across sessions, and
SHALL never leave the browser except where the setting's purpose is to be
sent (an API key to its own provider).

How the user last left the machine list — the text it was narrowed by and the
arrangement it was in — SHALL persist on the same terms, so that reopening the
list after a reload shows what reopening it before the reload showed.

#### Scenario: Preferences survive reload

- **WHEN** the user changes settings and reloads the IDE
- **THEN** the same settings are in effect

#### Scenario: The machine list is remembered as it was left

- **WHEN** the user narrows and rearranges the machine list, then reloads the
  IDE
- **THEN** the list opens narrowed and arranged the same way
