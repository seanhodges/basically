; Kaleidoscope: fills the PMD 85's frame buffer ('C000, a 48x32 grid of cells
; one byte wide and eight scanlines tall) with a four-way mirrored pattern.
; BASIC POKEs the three parameters, then calls the entry point with USR('7003).
;
; Written in the Z80 mnemonics the assembler takes, but every instruction here
; is one an 8080 has: no JR, no DJNZ, no index registers. The machine's MHB8080A
; would refuse anything else, and the emulator would not.
;
; Each quadrant cell's pattern is mixed from cx, cy, SEED and TWIST with adds
; and XORs only, masked to 0-7, and looked up in `fills` as a six-bit pixel row;
; it is then painted into the cell and its three mirrors. Each pass nudges SEED,
; so PASSES > 1 layers the pattern. A scanline is 64 bytes from the next and
; only the low six bits of a byte are pixels, so a fill byte never exceeds $3F -
; the top two bits are the cell's blink and brightness attribute.
        ORG $7000
seed:   DB 0            ; POKE '7000 - pattern mix base
twst:   DB 0            ; POKE '7001 - pattern mix twist
reps:   DB 0            ; POKE '7002 - passes (0 treated as 1)
draw:   LD A, (reps)    ; entry: USR('7003)
        OR A
        JP NZ, pass
        LD A, 1
        LD (reps), A
pass:   XOR A           ; cy = quadrant row (0-15)
        LD (cyv), A
yloop:  XOR A           ; cx = quadrant column (0-23)
        LD (cxv), A
xloop:  LD A, (cxv)     ; n = (((cx XOR cy) + SEED) XOR (cx + cy + TWIST)) AND 7
        LD B, A
        LD A, (cyv)
        LD C, A
        LD A, B
        XOR C
        LD D, A
        LD A, (seed)
        ADD A, D
        LD D, A
        LD A, B
        ADD A, C
        LD E, A
        LD A, (twst)
        ADD A, E
        XOR D
        AND $07
        LD E, A         ; look up the six-bit pixel row for this pattern
        LD D, 0
        LD HL, fills
        ADD HL, DE
        LD A, (HL)
        LD (fill), A
        LD A, (cxv)     ; cell (cx, cy)
        LD (cellx), A
        LD A, (cyv)
        LD (celly), A
        CALL cell
        LD A, 47        ; cell (47-cx, cy)
        LD HL, cxv
        SUB (HL)
        LD (cellx), A
        LD A, (cyv)
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (cx, 31-cy)
        LD (cellx), A
        LD A, 31
        LD HL, cyv
        SUB (HL)
        LD (celly), A
        CALL cell
        LD A, 47        ; cell (47-cx, 31-cy)
        LD HL, cxv
        SUB (HL)
        LD (cellx), A
        LD A, 31
        LD HL, cyv
        SUB (HL)
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; next column
        INC A
        LD (cxv), A
        CP 24
        JP NZ, xloop
        LD A, (cyv)     ; next row
        INC A
        LD (cyv), A
        CP 16
        JP NZ, yloop
        LD A, (seed)    ; next pass: nudge the mix and go again
        INC A
        LD (seed), A
        LD A, (reps)
        DEC A
        LD (reps), A
        JP NZ, pass
        RET
; Paint the (cellx, celly) cell with (fill): HL = 'C000 + celly*512 + cellx,
; then eight scanlines, each 64 bytes further into the frame buffer.
cell:   LD A, (celly)   ; HL = celly * 512 (8 scanlines of 64 bytes)
        LD L, A
        LD H, 0
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        ADD HL, HL
        LD A, (cellx)   ; + the column, which is one byte
        LD E, A
        LD D, 0
        ADD HL, DE
        LD DE, $C000    ; + the frame buffer's base
        ADD HL, DE
        LD B, 8         ; eight scanlines
crow:   LD A, (fill)
        LD (HL), A
        LD DE, 64
        ADD HL, DE
        DEC B
        JP NZ, crow
        RET
fills:  DB $00,$15,$2A,$3F,$0F,$30,$33,$0C
fill:   DB 0            ; scratch: pixel row for the current cell
cellx:  DB 0            ; scratch: current cell column
celly:  DB 0            ; scratch: current cell row
cxv:    DB 0            ; loop: quadrant column
cyv:    DB 0            ; loop: quadrant row
