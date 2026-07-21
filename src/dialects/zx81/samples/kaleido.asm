; Kaleidoscope for the ZX81: draws a four-way mirrored mosaic of block
; graphics into the display file. The routine lives inside a REM at line 1
; (carried in the .bas as a #BIN directive), so it loads with the program at
; 0x4082; BASIC POKEs the three parameters and calls the entry with
; RAND USR 16517.
;
; The ZX81 is monochrome, so symmetry is carried by the character codes. Each
; cell is mixed from its FOLDED coordinates - fx = min(x,31-x) and
; fy = min(y,23-y) - so cell (x,y) and its three mirrors share one code. The
; code is masked to $87, which keeps it inside the block-graphic / inverse
; range (0x00-0x07, 0x80-0x87) and can never be the 0x76 row terminator. Each
; pass nudges SEED, so PASSES > 1 layers the pattern.
;
; The display file must be expanded first (BASIC does CLS in SLOW before the
; call); the routine reads D_FILE (0x400C) and walks it as 24 rows of 32
; characters, stepping over each row's trailing 0x76 NEWLINE.
        ORG $4082
seed:   DB 0            ; POKE 16514 - mix base
stp:    DB 0            ; POKE 16515 - mix twist
reps:   DB 0            ; POKE 16516 - passes (0 treated as 1)
draw:   LD A,(reps)     ; entry: RAND USR 16517
        OR A
        JR NZ,pass
        LD A,1
        LD (reps),A
pass:   LD HL,($400C)   ; HL = display file start
        INC HL          ; skip the leading NEWLINE -> row 0, column 0
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
        XOR E           ; fx XOR fy
        LD D,A
        LD A,(seed)
        ADD A,D         ; t1 = (fx XOR fy) + SEED
        LD (t1),A
        LD A,E          ; fx
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
        AND $07         ; low 3 bits pick a block graphic (0x00-0x07)
        LD E,A
        LD A,D          ; bit 3 of the mix selects inverse video...
        AND $08
        ADD A,A         ; ...shifted up into bit 7 (0x08 -> 0x80)
        ADD A,A
        ADD A,A
        ADD A,A
        OR E            ; code in {0x00-0x07, 0x80-0x87}, never 0x76
        LD (HL),A
        INC HL
        INC C
        LD A,C
        CP 32
        JR NZ,xloop
        INC HL          ; step over the row's trailing NEWLINE (column 32)
        INC B
        LD A,B
        CP 24
        JR NZ,yloop
        LD A,(seed)     ; next pass: nudge the mix and go again
        INC A
        LD (seed),A
        LD A,(reps)
        DEC A
        LD (reps),A
        JR NZ,pass
        RET
fyv:    DB 0            ; scratch: folded y for the current row
t1:     DB 0            ; scratch: first half of the colour mix
