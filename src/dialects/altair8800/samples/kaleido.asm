; Kaleidoscope: prints a four-way mirrored pattern on the Altair's terminal.
; BASIC POKEs the three parameters, then calls the entry point through the 8K
; BASIC USR vector at 73/74 (see kaleido.bas).
;
; Written in the Z80 mnemonics the assembler takes, but every instruction here
; is one an 8080 has: no JR, no DJNZ, no index registers. The dialect declares
; cpu 'z80' for exactly that reason (see memoryBlocks.ts); real hardware would
; refuse anything more.
;
; The machine has no screen memory and no cursor addressing, so unlike every
; other machine's version this one cannot plot a quadrant and mirror it into
; three others - the picture leaves in one stream, top row first. So the mirror
; is in the counters instead: the row and column are folded about the centre
; before the cell is worked out, which makes the 32x16 picture symmetric about
; both axes by construction.
;
; A cell's character is the interference of two fields, worked out with adds,
; ANDs and XORs only - there is no multiply on an 8080 worth writing here. One
; field is the distance from the centre, which draws the rings; the other is
; dx AND dy, which breaks them up. SEED offsets the first and TWIST the second,
; and each pass nudges SEED by TWIST, so PASSES > 1 turns the pattern. The
; result is masked to 0-7 and looked up in `chars`, a ramp from blank to solid.

        ORG $7000

seed:   DB 0            ; POKE 28672 - pattern mix base
twst:   DB 0            ; POKE 28673 - pattern mix twist
reps:   DB 0            ; POKE 28674 - passes (0 treated as 1)

draw:   LD A,(reps)     ; entry: USR(0) with the vector pointing at 28675
        AND $0F
        JP NZ,setrep
        LD A,$01
setrep: LD (left),A
        LD A,(seed)
        LD (mix),A      ; the seed this pass draws with

pass:   CALL picture
        CALL pause
        LD HL,twst      ; each pass turns the pattern by the twist
        LD A,(mix)
        ADD A,(HL)
        LD (mix),A
        LD A,(left)
        DEC A
        LD (left),A
        JP NZ,pass
        RET

; ---- one whole picture: 32 columns by 16 rows ------------------------------
picture:
        XOR A
        LD (row),A
prow:   LD A,(row)      ; dy = 7..0,0..7 as the row crosses the centre line
        CP $08
        JP NC,pbelow
        SUB $07
        CPL
        INC A
        JP phave
pbelow: SUB $08
phave:  LD (dy),A
        XOR A
        LD (col),A
pcol:   LD A,(col)      ; dx = 15..0,0..15 as the column crosses the centre
        CP $10
        JP NC,cright
        SUB $0F
        CPL
        INC A
        JP chave
cright: SUB $10
chave:  LD B,A          ; B = dx, C = dy
        LD A,(dy)
        LD C,A
        ADD A,C         ; dx + 2*dy: the distance from the centre. The row
        ADD A,B         ; distance counts double because a terminal cell is
                        ; twice as tall as it is wide, so the rings come out
                        ; round rather than squashed.
        LD D,A
        LD A,(mix)      ; n = ((dx + 2*dy + SEED) XOR ((dx AND dy) + TWIST)) AND 7
        ADD A,D
        LD D,A
        LD A,B
        AND C
        LD E,A
        LD A,(twst)
        ADD A,E
        XOR D
        AND $07
        LD E,A
        LD D,$00
        LD HL,chars
        ADD HL,DE
        LD A,(HL)
        CALL putc
        LD A,(col)
        INC A
        LD (col),A
        CP $20
        JP NZ,pcol
        CALL crlf
        LD A,(row)
        INC A
        LD (row),A
        CP $10
        JP NZ,prow
        JP crlf

; ---- console: the 88-2SIO, driven the way BASIC's own PRINT drives it -------
; Poll status port $10 until TDRE (bit 1, active high - see addresses.ts) and
; write the byte to data port $11.
putc:   PUSH AF
ptx:    IN A,($10)
        AND $02
        JP Z,ptx
        POP AF
        OUT ($11),A
        RET

crlf:   LD A,$0D
        CALL putc
        LD A,$0A
        JP putc

; ---- long enough to read one picture before the next scrolls it away -------
; The emulated transmitter is never busy, so without this the whole run would
; land in one frame and only the last picture would ever be seen. Two passes of
; a 65536-step loop at roughly 25 cycles a step is about 1.6 seconds at 2MHz.
pause:  LD B,$02
pouter: LD DE,$0000
pinner: DEC DE
        LD A,D
        OR E
        JP NZ,pinner
        DEC B
        JP NZ,pouter
        RET

chars:  DB $20,$2E,$3A,$2D,$2B,$2A,$23,$40   ; ramp: space . : - + * # @

row:    DB 0
col:    DB 0
dy:     DB 0
left:   DB 0
mix:    DB 0
