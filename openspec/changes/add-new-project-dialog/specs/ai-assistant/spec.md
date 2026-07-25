## ADDED Requirements

### Requirement: A project can begin from a description

Creating a project SHALL accept a plain-English description of the wanted
program as its starting point. The IDE SHALL create the project on the chosen
machine and put the description to the assistant as the opening request, with
the assistant revealed so the answer is visible as it arrives.

Because the assistant requires the user's own API key, a missing key SHALL NOT
cost the user the project: the project SHALL be created regardless, and the user
SHALL be taken to where the key is entered instead of the request being silently
dropped.

#### Scenario: Describing a program to start from

- **WHEN** the user creates a project by describing the program they want
- **THEN** the project is created on the chosen machine and the assistant begins
  answering that description for that machine

#### Scenario: Describing a program with no API key set

- **WHEN** the user creates a project from a description without having provided
  an API key
- **THEN** the project is still created, and the user is taken to the settings
  where a key is entered
