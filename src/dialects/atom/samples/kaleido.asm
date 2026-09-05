; Kaleidoscope: fills the Atom's MC6847 text screen ($8000, 32x16 cells) with
; a four-way mirrored pattern of characters. The screen is monochrome, so
; symmetry is carried by the character codes themselves. BASIC pokes the three
; parameters and calls the entry with LINK #3803.
;
; Each cell's glyph is mixed from its FOLDED coordinates - fx = min(x,31-x)
; and fy = min(y,15-y) - so cell (x,y) and its three mirrors share one value
; by construction. Each pass nudges SEED, so PASSES > 1 layers the pattern.
        ORG $3800
seed:   DB 0            ; ?#3800 - mix base
step:   DB 0            ; ?#3801 - mix twist
reps:   DB 0            ; ?#3802 - passes (0 treated as 1)
; entry: LINK #3803
start:  LDA reps
        BNE pass
        LDA #1
        STA reps
; --- one pass over the whole grid ---
pass:   LDA #$00        ; reset the self-modifying row pointer to $8000
        STA store+1
        LDA #$80
        STA store+2
        LDA #0
        STA yctr
yloop:  LDA #15         ; fy = min(y, 15-y)
        SEC
        SBC yctr
        CMP yctr
        BCC ykeep
        LDA yctr
ykeep:  STA fyv
        LDY #0          ; Y = x, 0..31
xloop:  STY xtmp        ; fx = min(x, 31-x)
        LDA #31
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
        LDA fxv         ; A = (fx + fy + STEP) XOR t1 - the cell's glyph
        CLC
        ADC fyv
        CLC
        ADC step
        EOR t1
store:  STA $8000,Y
        INY
        CPY #32
        BNE xloop
        LDA store+1     ; row base += 32
        CLC
        ADC #32
        STA store+1
        LDA store+2
        ADC #0
        STA store+2
        INC yctr
        LDA yctr
        CMP #16
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
