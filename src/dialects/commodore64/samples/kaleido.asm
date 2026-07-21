; Kaleidoscope: fills colour RAM ($D800, 40x25 cells) with a four-way
; mirrored colour pattern over a screen of solid blocks (screen code 160).
; BASIC POKEs the three parameters, then calls the entry with SYS 49155.
;
; Each cell's colour is mixed from its FOLDED coordinates - fx = min(x,39-x)
; and fy = min(y,24-y) - so cell (x,y) and its three mirrors share one value
; by construction (no separate mirror writes, and the centre row/column of the
; odd 40x25 grid are covered automatically). Each pass nudges SEED, so
; PASSES > 1 layers the pattern.
        ORG $C000
seed:   DB 0            ; POKE 49152 - colour mix base
step:   DB 0            ; POKE 49153 - colour mix twist
reps:   DB 0            ; POKE 49154 - passes (0 treated as 1)
; entry: SYS 49155
start:  LDA reps
        BNE fill
        LDA #1
        STA reps
; Paint the whole screen with solid blocks (reverse space, code 160) once, and
; force a black border/background so the colour mosaic reads cleanly.
fill:   LDX #0
sfill:  LDA #160
        STA $0400,X
        STA $0500,X
        STA $0600,X
        STA $0700,X
        INX
        BNE sfill
        LDA #0
        STA $D020
        STA $D021
; --- one colouring pass over the whole grid ---
pass:   LDA #$00        ; reset the self-modifying row pointer to $D800
        STA cstore+1
        LDA #$D8
        STA cstore+2
        LDA #0
        STA yctr
yloop:  LDA #24         ; fy = min(y, 24-y)
        SEC
        SBC yctr
        CMP yctr
        BCC ykeep
        LDA yctr
ykeep:  STA fyv
        LDY #0          ; Y = x, 0..39
xloop:  STY xtmp        ; fx = min(x, 39-x)
        LDA #39
        SEC
        SBC xtmp
        CMP xtmp
        BCC xkeep
        LDA xtmp
xkeep:  STA fxv
        EOR fyv         ; t1 = (fx XOR fy) + SEED
        CLC
        ADC seed
        STA t1
        LDA fxv         ; A = (fx + fy + STEP) XOR t1
        CLC
        ADC fyv
        CLC
        ADC step
        EOR t1
        AND #$0F        ; low nibble is the C64 colour
cstore: STA $D800,Y
        INY
        CPY #40
        BNE xloop
        LDA cstore+1    ; row base += 40
        CLC
        ADC #40
        STA cstore+1
        LDA cstore+2
        ADC #0
        STA cstore+2
        INC yctr
        LDA yctr
        CMP #25
        BNE yloop
        INC seed        ; next pass: nudge the mix and go again
        DEC reps
        BEQ done
        JMP pass
done:   RTS
t1:     DB 0            ; scratch
fxv:    DB 0
fyv:    DB 0
xtmp:   DB 0
yctr:   DB 0
