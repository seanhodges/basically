; Kaleidoscope for the ZX80: builds a four-way mirrored mosaic of block
; graphics as a full 24x32 display file. The routine lives inside a REM at
; line 1 (carried in the .bas as a #BIN directive), so it loads with the
; program at 0x402B; BASIC POKEs the three parameters and calls the entry as
; the function USR(16430).
;
; The ZX80 display file is *collapsed* (a blank row is a single NEWLINE), so
; there are no fixed cells to overwrite - the routine writes the whole file:
; 24 rows of 32 block-graphic characters, each ended by a 0x76 NEWLINE, then
; points DF_END (0x400E) past it. The ZX80 record has no length field, so the
; machine code itself must contain no 0x76 byte; the row terminator is built
; at run time with LD A,$75 : INC A rather than a literal 0x76.
;
; Each cell is mixed from its FOLDED coordinates - fx = min(x,31-x) and
; fy = min(y,23-y) - so cell (x,y) and its three mirrors share one code. The
; code lands in the block-graphic ranges 0x02-0x09 / 0x82-0x89 (bit 3 of the
; mix selects inverse video). Each pass nudges SEED, so PASSES > 1 layers.
        ORG $402B
seed:   DB 0            ; POKE 16427 - mix base
stp:    DB 0            ; POKE 16428 - mix twist
reps:   DB 0            ; POKE 16429 - passes (0 treated as 1)
draw:   LD A,(reps)     ; entry: LET X = USR(16430)
        OR A
        JR NZ,pass
        LD A,1
        LD (reps),A
pass:   LD HL,($400C)   ; HL = display file start
        LD B,0          ; B = y (0..23)
yloop:  LD A,23         ; fy = min(y, 23-y)
        SUB B
        CP B
        JR C,fyok
        LD A,B
fyok:   LD (fyv),A
        LD C,0          ; C = x (0..31)
xloop:  LD A,31         ; fx = min(x, 31-x)
        SUB C
        CP C
        JR C,fxok
        LD A,C
fxok:   LD E,A          ; E = fx
        LD A,(fyv)
        XOR E
        LD D,A
        LD A,(seed)
        ADD A,D         ; t1 = (fx XOR fy) + SEED
        LD (t1),A
        LD A,E
        LD D,A
        LD A,(fyv)
        ADD A,D         ; fx + fy
        LD D,A
        LD A,(stp)
        ADD A,D         ; (fx + fy) + STEP
        LD D,A
        LD A,(t1)
        XOR D           ; mix = t1 XOR t2
        LD D,A          ; keep the raw mix
        AND $07         ; low 3 bits -> a block graphic 0x02..0x09
        ADD A,$02
        LD E,A
        LD A,D          ; bit 3 of the mix selects inverse video...
        AND $08
        ADD A,A         ; ...shifted up into bit 7 (0x08 -> 0x80)
        ADD A,A
        ADD A,A
        ADD A,A
        OR E            ; code in 0x02..0x09 / 0x82..0x89, never 0x76
        LD (HL),A
        INC HL
        INC C
        LD A,C
        CP 32
        JR NZ,xloop
        LD A,$75        ; row terminator 0x76, built to avoid a literal 0x76
        INC A
        LD (HL),A
        INC HL
        INC B
        LD A,B
        CP 24
        JR NZ,yloop
        LD ($400E),HL   ; DF_END = just past the built display file
        LD ($4010),HL   ; DF_EA = same, so the ROM's lister leaves it alone
        LD A,(seed)     ; next pass: nudge the mix and go again
        INC A
        LD (seed),A
        LD A,(reps)
        DEC A
        LD (reps),A
        JR NZ,pass
        RET
fyv:    DB 0            ; scratch: folded y for the current row
t1:     DB 0            ; scratch: first half of the mix
