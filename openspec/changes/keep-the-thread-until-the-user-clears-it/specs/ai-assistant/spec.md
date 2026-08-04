## MODIFIED Requirements

### Requirement: The conversation resets with the program

The chat thread SHALL persist across reloads while the user keeps working on
the same program, and SHALL clear when a different program becomes active or
when the user clears it deliberately.

#### Scenario: Open a different file

- **WHEN** the user opens a different program
- **THEN** the previous conversation no longer applies and the thread starts
  fresh

#### Scenario: Reloading on the same program

- **WHEN** the user reloads the IDE while still working on the same program
- **THEN** the conversation is still there, in the order it was held

## ADDED Requirements

### Requirement: The assistant keeps working while it is out of sight

Putting the assistant away SHALL NOT cancel its work. Closing it, moving to
another view, or leaving the page in the background SHALL leave a request, a
check, and an unrequested correction all running, and coming back SHALL show
the work as it now stands rather than as it was left. Only the user stopping
it, clearing the conversation, or a different program becoming active SHALL
end work that is in flight.

#### Scenario: Closing the assistant while an answer is arriving

- **WHEN** the user closes the assistant while an answer is still arriving and
  opens it again afterwards
- **THEN** the answer arrived in full and is there waiting

#### Scenario: Looking away while a check runs

- **WHEN** a check is running and the user moves to another view or leaves the
  page in the background
- **THEN** the check still reaches its verdict

### Requirement: An answer the page interrupted is offered again

An answer still arriving when the page goes away SHALL be restored marked as
cut short, and SHALL be distinguishable from one the user stopped on purpose.
This SHALL hold whether or not the answer had begun any code, so an answer
interrupted mid-sentence never reads as a finished one.

Because a stream cannot be picked up where it left off, the assistant SHALL
offer to put the same request again rather than claiming to resume it. What
was already said stays in the thread as the record of what happened.

#### Scenario: Reloading while an answer is arriving

- **WHEN** the user reloads the IDE while an answer is still arriving
- **THEN** the part that had arrived is still there, marked as cut short, with
  the offer to ask again

#### Scenario: An answer interrupted before any code

- **WHEN** the answer that was interrupted had not yet begun any code
- **THEN** it is still marked as cut short

#### Scenario: Asking again

- **WHEN** the user takes the offer to ask again
- **THEN** the same request is put afresh, and the cut-short answer remains in
  the thread above it

#### Scenario: An answer the user stopped

- **WHEN** the user stops an answer themselves and later reloads
- **THEN** it is not offered as interrupted, because nothing interrupted it

### Requirement: Leaving while an answer is arriving is confirmed first

While an answer is still arriving, the IDE SHALL have the browser confirm before
the page is left, so an answer is not lost to a reload the user did not mean.
It SHALL ask only while an answer is actually arriving: once the answer is in,
what remains is a check whose verdict is worth less than the interruption, and
leaving SHALL pass without comment.

This makes an interrupted answer rarer; it does not make it impossible. A page
the browser never gets to unload — a tab reclaimed by the OS, a crash — still
reaches `An answer the page interrupted is offered again`, which continues to
hold.

#### Scenario: Reloading while an answer is arriving

- **WHEN** the user reloads the IDE while an answer is still arriving
- **THEN** the browser asks them to confirm before the page is left

#### Scenario: Reloading with nothing arriving

- **WHEN** the user reloads the IDE with the answer already in
- **THEN** they are not asked anything

### Requirement: The user can clear the conversation

The user SHALL be able to clear the conversation at any time by sending
`/clear`, without having to change program to do it. Clearing SHALL end
whatever is in flight and remove the thread and everything remembered along
with it, leaving nothing to be restored on the next reload.

Because it is the way out of a conversation that has gone wrong, it SHALL work
while the assistant is busy and when no API key is set. It SHALL NOT be sent
to the provider, and SHALL leave the program in the editor untouched.

#### Scenario: Clearing a conversation

- **WHEN** the user sends `/clear`
- **THEN** the thread is empty, and it is still empty after a reload

#### Scenario: Clearing while the assistant is busy

- **WHEN** the user sends `/clear` while an answer is arriving
- **THEN** the answer stops arriving and the thread is empty

#### Scenario: The command is not a question

- **WHEN** the user sends `/clear`
- **THEN** nothing is asked of the provider and the program in the editor is
  unchanged

### Requirement: The user can put the assistant away

The user SHALL be able to close the assistant by sending `/hide`, with the
same effect as its toolbar control. The conversation and any work in flight
SHALL be left untouched, so bringing the assistant back shows it where it now
stands. Like clearing, it SHALL NOT be sent to the provider.

#### Scenario: Hiding the assistant

- **WHEN** the user sends `/hide`
- **THEN** the assistant closes and the machine takes the space it had

#### Scenario: Coming back to a preserved conversation

- **WHEN** the user sends `/hide` while an answer is arriving and opens the
  assistant again
- **THEN** the conversation is as it was, with the answer having continued to
  arrive meanwhile
