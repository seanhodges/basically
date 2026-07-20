; Kaleidoscope: fills colour RAM ($9600, 22x23 cells) with a four-way mirrored
; colour pattern over a screen ($1E00) of solid blocks (screen code 160).
; BASIC POKEs the three parameters, then calls the entry with SYS 7171.
;
; Each cell's colour is mixed from its FOLDED coordinates - fx = min(x,21-x)
; and fy = min(y,22-y) - so cell (x,y) and its three mirrors share one value
; by construction (the centre row/column of the odd 22x23 grid included). Each
; pass nudges SEED, so PASSES > 1 layers the pattern.
        ORG $1C00
seed:   DB 0            ; POKE 7168 - colour mix base
step:   DB 0            ; POKE 7169 - colour mix twist
reps:   DB 0            ; POKE 7170 - passes (0 treated as 1)
; entry: SYS 7171
start:  LDA reps
        BNE fill
        LDA #1
        STA reps
; Paint the whole 22x23 screen with solid blocks (code 160) once, and force a
; black border/background so the colour mosaic reads cleanly.
fill:   LDX #0
sfill:  LDA #160
        STA $1E00,X
        STA $1F00,X
        INX
        BNE sfill
        LDA #8          ; black border, black background
        STA $900F
; --- one colouring pass over the whole grid ---
pass:   LDA #$00        ; reset the self-modifying row pointer to $9600
        STA cstore+1
        LDA #$96
        STA cstore+2
        LDA #0
        STA yctr
yloop:  LDA #22         ; fy = min(y, 22-y)
        SEC
        SBC yctr
        CMP yctr
        BCC ykeep
        LDA yctr
ykeep:  STA fyv
        LDY #0          ; Y = x, 0..21
xloop:  STY xtmp        ; fx = min(x, 21-x)
        LDA #21
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
        AND #$0F        ; low nibble is the VIC colour
cstore: STA $9600,Y
        INY
        CPY #22
        BNE xloop
        LDA cstore+1    ; row base += 22
        CLC
        ADC #22
        STA cstore+1
        LDA cstore+2
        ADC #0
        STA cstore+2
        INC yctr
        LDA yctr
        CMP #23
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
