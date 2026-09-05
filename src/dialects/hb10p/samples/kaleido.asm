; Kaleidoscope: fills the SCREEN 2 colour table with a four-way mirrored
; pattern of solid 8x8 cells. BASIC POKEs the three parameters, then calls the
; entry point with DEFUSR=&HE003 : A=USR(0).
;
; Each quadrant cell's colour is mixed from x, y, SEED and TWIST with adds and
; XORs only, masked to 0-15, then written into the cell and its three mirrors.
; Each pass nudges SEED, so PASSES > 1 layers the pattern.
;
; The picture is painted through the colour table alone. A SCREEN 2 colour byte
; carries a foreground and a background nibble for one row of eight pixels, so
; a byte with the same colour in both nibbles fills that row whatever the
; pattern generator holds - which is why nothing here touches the 6KB pattern
; table. The colour table is 0x2000..0x37FF and its cells are linear: the byte
; for row r, column c, line l is 0x2000 + r*256 + c*8 + l, so the high address
; byte is 0x20+r and the low one is c*8.
;
; VRAM is a separate address space reached through the VDP's two ports: 0x99
; takes the write address low byte then its high byte with bit 6 set, and 0x98
; takes the data with the address auto-incrementing. The address pair must not
; be split by an interrupt (the BIOS handler uses the same ports), so the whole
; routine runs with interrupts off. The TMS9918 also needs about eight
; microseconds between accesses while it is displaying, which the write loop
; below spends without a delay of its own: 37 T-states at 3.58MHz is ten.
        ORG $E000
seed:   DB 0            ; POKE &HE000 - colour mix base
stp:    DB 0            ; POKE &HE001 - colour mix twist
reps:   DB 0            ; POKE &HE002 - passes (0 treated as 1)
draw:   DI              ; entry: DEFUSR=&HE003 : A=USR(0)
        LD A, (reps)
        OR A
        JR NZ, pass
        LD A, 1
        LD (reps), A
pass:   XOR A           ; cy = quadrant row (0-11)
        LD (cyv), A
yloop:  XOR A           ; cx = quadrant column (0-15)
        LD (cxv), A
xloop:  LD A, (cxv)     ; col = (((cx XOR cy) + SEED) XOR (cx + cy + TWIST)) AND 15
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
        LD B, A         ; the same colour in both nibbles
        ADD A, A
        ADD A, A
        ADD A, A
        ADD A, A
        OR B
        LD (fill), A
        LD A, (cxv)     ; cell (cx, cy)
        LD (cellx), A
        LD A, (cyv)
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (31-cx, cy)
        LD B, A
        LD A, 31
        SUB B
        LD (cellx), A
        LD A, (cyv)
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (cx, 23-cy)
        LD (cellx), A
        LD A, (cyv)
        LD B, A
        LD A, 23
        SUB B
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; cell (31-cx, 23-cy)
        LD B, A
        LD A, 31
        SUB B
        LD (cellx), A
        LD A, (cyv)
        LD B, A
        LD A, 23
        SUB B
        LD (celly), A
        CALL cell
        LD A, (cxv)     ; next column
        INC A
        LD (cxv), A
        CP 16
        JP NZ, xloop
        LD A, (cyv)     ; next row
        INC A
        LD (cyv), A
        CP 12
        JP NZ, yloop
        LD A, (seed)    ; next pass: nudge the mix and go again
        INC A
        LD (seed), A
        LD A, (reps)
        DEC A
        LD (reps), A
        JP NZ, pass
        EI
        RET
; Paint the (cellx, celly) cell solid with (fill): eight colour-table bytes
; from 0x2000 + celly*256 + cellx*8, written through the VDP's data port.
cell:   LD A, (cellx)
        ADD A, A
        ADD A, A
        ADD A, A
        OUT ($99), A    ; write address low byte
        LD A, (celly)
        ADD A, $60      ; 0x20 for the colour table, 0x40 to make it a write
        OUT ($99), A
        LD B, 8
crow:   LD A, (fill)
        OUT ($98), A
        DJNZ crow
        RET
fill:   DB 0            ; scratch: colour byte for the current cell
cellx:  DB 0            ; scratch: current cell column
celly:  DB 0            ; scratch: current cell row
cxv:    DB 0            ; loop: quadrant column
cyv:    DB 0            ; loop: quadrant row
