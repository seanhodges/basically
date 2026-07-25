## ADDED Requirements

### Requirement: A project can begin from a description

Creating a project SHALL accept a plain-English description of the wanted
program as its starting point. The IDE SHALL create the project on the chosen
machine and put the description to the assistant as the opening request, with
the assistant revealed so the answer is visible as it arrives.

Because the assistant requires the user's own API key, this starting point SHALL
be offered only when a key is set. Without one it SHALL be presented as
unavailable rather than hidden or silently failing, noting that the assistant
must be configured in settings before the option becomes available.

#### Scenario: Describing a program to start from

- **WHEN** the user creates a project by describing the program they want
- **THEN** the project is created on the chosen machine and the assistant begins
  answering that description for that machine

#### Scenario: The description option with no API key set

- **WHEN** the user is creating a project and the assistant has not been
  configured with an API key
- **THEN** the description option is shown as unavailable, noting that the
  assistant must be configured in settings first, and the other starting points
  remain usable
