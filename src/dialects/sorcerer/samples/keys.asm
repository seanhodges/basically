; Reads the four movement keys and the space bar, leaving them at $7000 for
; BASIC to PEEK. The games POKE 260/261 with the entry and call it with USR(0).
;
; This exists because a BASIC program cannot read the matrix for itself.
; Selecting a keyboard line means writing its number to port $FE and reading
; the same port back, and between every two statements the interpreter asks the
; Monitor whether a break key is down - which selects line 1, then line 0, and
; leaves line 0 selected. So `OUT 254,3 : K=INP(254)` reads line 0 about
; ninety-nine times in a hundred, whatever line it asked for. Here the write
; and the read are two instructions apart with nothing between them.
;
; Bit 7 of the write is the RS-232/cassette select and bit 6 the baud rate;
; zeroing them costs nothing while a game is running, and the Monitor's own
; break check rewrites its shadow of them on the very next statement.
        ORG $7000
keys:   DB 0            ; PEEK 28672 - bit 0 up, 1 down, 2 left, 3 right, 4 space
scan:   LD A, 2         ; entry: USR(0), with 260/261 pointing here
        OUT ($FE), A    ; line 2: A is bit 2, Z is bit 1
        IN A, ($FE)
        CPL             ; a pressed key reads 0, so invert: pressed = 1
        LD B, 0         ; B builds the answer
        BIT 2, A
        JR Z, nleft
        SET 2, B
nleft:  BIT 1, A
        JR Z, ndown
        SET 1, B
ndown:  LD A, 3         ; line 3: W is bit 3, S is bit 2
        OUT ($FE), A
        IN A, ($FE)
        CPL
        BIT 3, A
        JR Z, nup
        SET 0, B
nup:    BIT 2, A
        JR Z, nright
        SET 3, B
nright: LD A, 1         ; line 1: SPACE is bit 2
        OUT ($FE), A
        IN A, ($FE)
        CPL
        BIT 2, A
        JR Z, nfire
        SET 4, B
nfire:  LD A, B
        LD (keys), A
        RET
