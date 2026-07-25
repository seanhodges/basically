## ADDED Requirements

### Requirement: A project can begin from a description

Creating a project SHALL accept a plain-English description of the wanted
program as its starting point. The IDE SHALL create the project on the chosen
machine and put the description to the assistant as the opening request, with
the assistant revealed so the answer is visible as it arrives.

Because the assistant requires the user's own API key, this starting point SHALL
be offered only when a key is set. Without one it SHALL be presented as
unavailable rather than hidden or silently failing, explaining that a key is
needed and offering a way to set one. Once a key is set the option SHALL become
available without the user having to abandon and restart creating the project.

#### Scenario: Describing a program to start from

- **WHEN** the user creates a project by describing the program they want
- **THEN** the project is created on the chosen machine and the assistant begins
  answering that description for that machine

#### Scenario: The description option with no API key set

- **WHEN** the user is creating a project and no API key has been set
- **THEN** the description option is shown as unavailable, explaining that an
  API key is required and offering a route to set one

#### Scenario: Setting a key without losing the project in progress

- **WHEN** the user follows that route, sets an API key, and returns
- **THEN** the project they were creating is still being created, with their
  machine, name and starting-point choices intact, and the description option
  now available
