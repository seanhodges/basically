; Kaleidoscope: fills the attribute file ($5800, 32x24 cells) with a
; four-way mirrored colour pattern. BASIC POKEs the three parameters,
; then calls the entry point with RANDOMIZE USR 32771.
;
; The pattern value for a quadrant cell is mixed from x, y, SEED and
; STEP with adds and XORs only, then written to the cell and its three
; mirrors. Each pass nudges SEED, so PASSES > 1 layers the pattern.
        ORG $8000
seed:   DB 0            ; POKE 32768 - colour mix base
stp:    DB 0            ; POKE 32769 - colour mix twist
reps:   DB 0            ; POKE 32770 - passes (0 treated as 1)
draw:   LD A, (reps)    ; entry: RANDOMIZE USR 32771
        OR A
        JP NZ, pass
        LD A, 1
        LD (reps), A
pass:   LD C, 0         ; C = quadrant row (0-11)
yloop:  LD L, C         ; HL = $5800 + y*32 (top row base)
        LD H, 0
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        LD DE, $5800
        ADD HL, DE
        LD (topb), HL
        LD A, 23        ; HL = $5800 + (23-y)*32 (mirror row base)
        SUB C
        LD L, A
        LD H, 0
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, DE
        LD (botb), HL
        LD B, 0         ; B = quadrant column (0-15)
xloop:  LD A, B         ; E = (((x XOR y) + SEED) XOR (x + y + STEP)) AND $3F
        XOR C
        LD D, A
        LD A, (seed)
        ADD A, D
        LD D, A
        LD A, B
        ADD A, C
        LD E, A
        LD A, (stp)
        ADD A, E
        XOR D
        AND $3F
        LD E, A
        LD HL, (topb)   ; top-left cell (x, y)
        LD A, L
        ADD A, B
        LD L, A
        LD (HL), E
        LD HL, (topb)   ; top-right cell (31-x, y)
        LD A, L
        ADD A, 31
        SUB B
        LD L, A
        LD (HL), E
        LD HL, (botb)   ; bottom-left cell (x, 23-y)
        LD A, L
        ADD A, B
        LD L, A
        LD (HL), E
        LD HL, (botb)   ; bottom-right cell (31-x, 23-y)
        LD A, L
        ADD A, 31
        SUB B
        LD L, A
        LD (HL), E
        INC B
        LD A, B
        CP 16
        JR NZ, xloop
        INC C
        LD A, C
        CP 12
        JP NZ, yloop
        LD A, (seed)    ; next pass: nudge the mix and go again
        INC A
        LD (seed), A
        LD A, (reps)
        DEC A
        LD (reps), A
        JP NZ, pass
        RET
topb:   DW 0            ; scratch: current top row base
botb:   DW 0            ; scratch: current mirror row base
