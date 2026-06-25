# Running on real hardware

A program that works in the emulator can be sent to the real machine. Which
options are available depends on the target, but there are three broad paths:
**cassette audio**, a **downloadable image file**, and a **serial bridge**.

Open the **⇥ Hardware** dialog to choose.

## Cassette audio

For machines that loaded from tape, Basically can synthesise the tape signal:

1. Connect your device's headphone jack to the machine's **EAR** / aux socket
   and turn the volume up to maximum.
2. On the machine, start a load — on the ZX81 that's `LOAD ""` (or the
   equivalent for your machine).
3. In the IDE choose **⇥ Hardware ▸ Play through speakers**, or download a
   `.wav` to play later.

If loads fail on temperamental hardware, enable **robust mode**, which lengthens
the leader/pilot tone.

Basically can also go the other way: it can **decode** a cassette recording
(from the mic / line-in or a `.wav`) back into editable source. The decoders
estimate bit timing from the recovered signal, so they tolerate playback-speed
and clock drift.

The exact tape encoding for each machine is documented under
**[File formats ▸ Cassette audio](/reference/file-formats#cassette-audio)**.

## Image files (SD interfaces)

If your machine has an SD or disk interface, download the native image — for
example the ZX81 `.P` file (for ZXpand and friends), a Spectrum `.TAP`, or a
Commodore `.prg` — and copy it across. You can also import these images back
into the editor.

See **[File formats](/reference/file-formats)** for the layout of each format.

## Serial bridge (WebSerial)

Any microcontroller (Arduino, Pi Pico, ESP32 …) running the bridge firmware can
receive programs directly over **WebSerial** from Chrome or Edge. The IDE pushes
the built image to the bridge, which then delivers it to the machine — either by
re-encoding it as a tape signal on a GPIO pin, or (with bus access) by injecting
it into RAM.

The bridge firmware is out of scope for this repo, but the wire protocol it must
implement is fully specified under
**[Serial bridge protocol](/reference/serial-protocol)**.
