; Kaleidoscope: fills the Sorcerer's screen ($F080, a 64x30 grid of character
; codes one byte each) with a four-way mirrored pattern out of the standard
; graphics set. BASIC POKEs the three parameters, then calls the entry point
; with USR(0) - the interpreter's USR vector is the address field of the JP at
; 259, which kaleido.bas points here first.
;
; Each quadrant cell's character is mixed from cx, cy, SEED and TWIST with adds
; and XORs only, masked to 0-7, and looked up in `chars` as a ramp from blank to
; solid. It is then written into the cell and its three mirrors. Each pass
; nudges SEED, so PASSES > 1 layers the pattern.
;
; The screen is character codes rather than pixels, so a cell is one byte and
; the row stride is 64: there is no bit fiddling anywhere here, and the shapes
; come from the character generator.
        ORG $7000
seed:   DB 0            ; POKE 28672 - pattern mix base
twst:   DB 0            ; POKE 28673 - pattern mix twist
reps:   DB 0            ; POKE 28674 - passes (0 treated as 1)
draw:   LD A, (reps)    ; entry: USR(0), with 260/261 pointing here
        OR A
        JR NZ, pass
        LD A, 1
        LD (reps), A
pass:   LD C, 0         ; cy = quadrant row (0-14)
yloop:  LD B, 0         ; cx = quadrant column (0-31)
xloop:  LD A, B         ; n = (((cx XOR cy) + SEED) XOR (cx + cy + TWIST)) AND 7
        XOR C
        LD HL, seed
        ADD A, (HL)
        LD D, A
        LD A, B
        ADD A, C
        LD HL, twst
        ADD A, (HL)
        XOR D
        AND $07
        LD E, A         ; look up this cell's character
        LD D, 0
        LD HL, chars
        ADD HL, DE
        LD A, (HL)
        LD (fill), A
        LD D, B         ; cell (cx, cy)
        LD E, C
        CALL cell
        LD A, 63        ; cell (63-cx, cy)
        SUB B
        LD D, A
        LD E, C
        CALL cell
        LD A, 29        ; cell (cx, 29-cy)
        SUB C
        LD E, A
        LD D, B
        CALL cell
        LD A, 63        ; cell (63-cx, 29-cy)
        SUB B
        LD D, A
        LD A, 29
        SUB C
        LD E, A
        CALL cell
        INC B           ; next column
        LD A, B
        CP 32
        JR NZ, xloop
        INC C           ; next row
        LD A, C
        CP 15
        JR NZ, yloop
        LD HL, seed     ; next pass: nudge the mix and go again
        INC (HL)
        LD HL, reps
        DEC (HL)
        JR NZ, pass
        RET
; Paint the (D = column, E = row) cell with (fill): HL = $F080 + row*64 + column.
cell:   PUSH BC
        LD H, 0
        LD L, E
        ADD HL, HL      ; row * 64
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        LD B, 0         ; + the column
        LD C, D
        ADD HL, BC
        LD BC, $F080    ; + the screen's base
        ADD HL, BC
        LD A, (fill)
        LD (HL), A
        POP BC
        RET
; Blank, the four eighth-to-solid shades, then three shapes the set is known
; for: the ramp keeps the picture readable and the shapes give it a centre.
chars:  DB $20,$B0,$AA,$B1,$A9,$84,$8E,$A3
fill:   DB 0            ; scratch: the character for the current cell
