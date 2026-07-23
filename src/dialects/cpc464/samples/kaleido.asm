; Kaleidoscope: fills the Mode 0 screen (&C000, a 20x25 grid of 8x8 cells)
; with a four-way mirrored colour pattern. BASIC POKEs the three parameters,
; then calls the entry point with CALL &8003.
;
; Each quadrant cell's pen is mixed from x, y, SEED and TWIST with adds and
; XORs only, masked to 0-15, then painted as a solid Mode 0 ink into the cell
; and its three mirrors. Each pass nudges SEED, so PASSES > 1 layers the
; pattern. A Mode 0 cell is 8 pixels wide (4 screen bytes) and 8 scanlines
; tall; `inks` maps a pen to the byte whose two pixels are both that pen.
        ORG $8000
seed:   DB 0            ; POKE &8000 - colour mix base
stp:    DB 0            ; POKE &8001 - colour mix twist
reps:   DB 0            ; POKE &8002 - passes (0 treated as 1)
draw:   LD A, (reps)    ; entry: CALL &8003
        OR A
        JR NZ, pass
        LD A, 1
        LD (reps), A
pass:   XOR A           ; cy = quadrant row (0-12)
        LD (cyv), A
yloop:  XOR A           ; cx = quadrant column (0-9)
        LD (cxv), A
xloop:  LD A, (cxv)     ; pen = (((cx XOR cy) + SEED) XOR (cx + cy + TWIST)) AND 15
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
        LD A, (stp)
        ADD A, E
        XOR D
        AND $0F
        LD E, A         ; look up the solid-ink byte for this pen
        LD D, 0
        LD HL, inks
        ADD HL, DE
        LD A, (HL)
        LD (fill), A
        LD A, (cxv)     ; cell (cx, cy)
        LD (cellx), A
        LD A, (cyv)
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (19-cx, cy)
        LD B, A
        LD A, 19
        SUB B
        LD (cellx), A
        LD A, (cyv)
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (cx, 24-cy)
        LD (cellx), A
        LD A, (cyv)
        LD B, A
        LD A, 24
        SUB B
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (19-cx, 24-cy)
        LD B, A
        LD A, 19
        SUB B
        LD (cellx), A
        LD A, (cyv)
        LD B, A
        LD A, 24
        SUB B
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; next column
        INC A
        LD (cxv), A
        CP 10
        JP NZ, xloop
        LD A, (cyv)     ; next row
        INC A
        LD (cyv), A
        CP 13
        JP NZ, yloop
        LD A, (seed)    ; next pass: nudge the mix and go again
        INC A
        LD (seed), A
        LD A, (reps)
        DEC A
        LD (reps), A
        JP NZ, pass
        RET
; Paint the (cellx, celly) cell solid with (fill): HL = &C000 + cy*80 + cx*4,
; then 8 scanlines of 4 bytes, each scanline &800 further into screen memory.
cell:   LD A, (celly)   ; HL = cy * 80  (80 bytes per scanline)
        LD L, A
        LD H, 0
        ADD HL, HL      ; *2
        ADD HL, HL      ; *4
        ADD HL, HL      ; *8
        ADD HL, HL      ; *16
        LD D, H
        LD E, L         ; DE = 16 * cy
        ADD HL, HL      ; *32
        ADD HL, HL      ; *64
        ADD HL, DE      ; *80
        LD A, (cellx)   ; + cx * 4
        ADD A, A
        ADD A, A
        LD E, A
        LD D, 0
        ADD HL, DE
        LD DE, $C000    ; + screen base
        ADD HL, DE
        LD B, 8         ; 8 scanlines
crow:   LD A, (fill)
        LD (HL), A
        INC HL
        LD (HL), A
        INC HL
        LD (HL), A
        INC HL
        LD (HL), A
        LD DE, $07FD    ; step from byte 3 of this row to byte 0, +&800
        ADD HL, DE
        DJNZ crow
        RET
inks:   DB $00,$C0,$0C,$CC,$30,$F0,$3C,$FC
        DB $03,$C3,$0F,$CF,$33,$F3,$3F,$FF
fill:   DB 0            ; scratch: solid byte for the current cell
cellx:  DB 0            ; scratch: current cell column
celly:  DB 0            ; scratch: current cell row
cxv:    DB 0            ; loop: quadrant column
cyv:    DB 0            ; loop: quadrant row
