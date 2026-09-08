## MODIFIED Requirements

### Requirement: A program can be edited in any editor that speaks the protocol

The product SHALL be able to serve a BASIC program's language help to an editor
other than its own, over the Language Server Protocol, without that editor
needing anything written specifically for it. The server SHALL be one a program
can start, SHALL exchange messages over the streams that program supplies, and
SHALL keep serving until the editor disconnects or asks it to stop. It SHALL
declare to the editor only the help it can actually give, so that an editor
offers the user nothing the server will decline.

The server SHALL take the streams it speaks over from whoever starts it, and
SHALL NOT read them from the process it happens to be running in, so that what
serves an editor is a decision of the program that started it.

While a server is running, the stream it writes to SHALL carry the conversation
with the editor and nothing else; anything the server has to say about itself
SHALL reach the user through the protocol's own reporting or the stream reserved
for it.

#### Scenario: Serving an editor

- **WHEN** a program starts the server on streams it supplies, an editor announces
  itself over them and opens a BASIC program
- **THEN** the server announces what help it can give, accepts the program, and
  goes on answering questions about it until the editor disconnects

#### Scenario: The program changes as it is typed

- **WHEN** the editor reports edits to a program it has open
- **THEN** every later answer is about the program as edited, and the user is not
  required to save the file first

#### Scenario: Serving over streams that are not the process's own

- **WHEN** a program starts the server on a pair of streams of its own making
- **THEN** the conversation is carried over those streams, and nothing about the
  process the server is running in changes what is served
