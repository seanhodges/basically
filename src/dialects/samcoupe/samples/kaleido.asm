; Kaleidoscope: fills the whole MODE 4 screen with a four-way mirrored
; colour pattern. BASIC POKEs the three parameters, then calls the entry
; point with CALL 28675.
;
; The screen is not in the Z80's window - it is 24K of RAM the ASIC fetches
; from wherever VMPR points - so the routine pages it in over sections C and
; D (32768-57343) and puts back what BASIC had there. That is why the code
; lives at 28672: section B is the one part of the window HMPR does not move,
; and the ROM's stack is down there with it.
;
; MODE 4 stores two pixels a byte, sixteen colours each, 128 bytes a line.
; The pattern value for a quadrant cell is mixed from x, y, SEED and TWIST
; with adds and XORs only, doubled into both nibbles, then written to the
; cell and its three mirrors. Each pass nudges SEED, so PASSES > 1 layers
; the pattern.
        ORG $7000
seed:   DB 0            ; POKE 28672 - colour mix base
stp:    DB 0            ; POKE 28673 - colour mix twist
reps:   DB 0            ; POKE 28674 - passes (0 treated as 1)
draw:   DI              ; entry: CALL 28675
        IN A,($FB)      ; HMPR - what BASIC has in sections C and D
        LD (savehm),A
        IN A,($FC)      ; VMPR - the screen's page and mode
        AND $1E         ; a 24K mode always starts on an even page
        OUT ($FB),A     ; screen at $8000-$DFFF; this code is still at $7000
        LD A,(reps)
        OR A
        JP NZ,pass
        LD A,1
        LD (reps),A
pass:   LD C,0          ; C = quadrant row (0-95)
yloop:  LD H,0          ; HL = $8000 + y*128 (top row base)
        LD L,C
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        LD DE,$8000
        ADD HL,DE
        LD (topb),HL
        LD A,191        ; HL = $8000 + (191-y)*128 (mirror row base)
        SUB C
        LD L,A
        LD H,0
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,DE
        LD (botb),HL
        LD A,C          ; the pattern is coarsened to 8x4-pixel cells, so a
        SRL A           ; picture is a kaleidoscope rather than a fine dither
        SRL A
        LD (rowv),A
        LD B,0          ; B = quadrant byte column (0-63)
xloop:  LD A,B          ; A = (((px XOR py) + SEED) XOR (px + py + TWIST)) AND $0F
        SRL A
        SRL A
        LD D,A
        LD A,(rowv)
        XOR D
        LD E,A
        LD A,(seed)
        ADD A,E
        LD E,A
        LD A,(rowv)
        ADD A,D
        LD D,A
        LD A,(stp)
        ADD A,D
        XOR E
        AND $0F
        LD E,A          ; both pixels of the byte take that colour
        RLCA
        RLCA
        RLCA
        RLCA
        OR E
        LD E,A
        LD HL,(topb)    ; top-left cell (x, y)
        LD A,L
        ADD A,B
        LD L,A
        LD (HL),E
        LD HL,(topb)    ; top-right cell (127-x, y)
        LD A,L
        ADD A,127
        SUB B
        LD L,A
        LD (HL),E
        LD HL,(botb)    ; bottom-left cell (x, 191-y)
        LD A,L
        ADD A,B
        LD L,A
        LD (HL),E
        LD HL,(botb)    ; bottom-right cell (127-x, 191-y)
        LD A,L
        ADD A,127
        SUB B
        LD L,A
        LD (HL),E
        INC B
        LD A,B
        CP 64
        JP NZ,xloop
        INC C
        LD A,C
        CP 96
        JP NZ,yloop
        LD A,(seed)     ; next pass: nudge the mix and go again
        INC A
        LD (seed),A
        LD A,(reps)
        DEC A
        LD (reps),A
        JP NZ,pass
        LD A,(savehm)   ; put BASIC's own pages back before returning
        OUT ($FB),A
        EI
        RET
savehm: DB 0            ; scratch: HMPR as BASIC left it
rowv:   DB 0            ; scratch: this row's coarsened y
topb:   DW 0            ; scratch: current top row base
botb:   DW 0            ; scratch: current mirror row base
