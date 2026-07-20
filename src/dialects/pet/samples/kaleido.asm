; Kaleidoscope: fills the PET screen RAM ($8000, 40x25 cells) with a four-way
; mirrored pattern of graphic characters. The PET is monochrome, so symmetry
; is carried by the character codes themselves. BASIC POKEs the three
; parameters, then calls the entry with SYS 28675.
;
; Each cell's glyph is mixed from its FOLDED coordinates - fx = min(x,39-x)
; and fy = min(y,24-y) - so cell (x,y) and its three mirrors share one value
; by construction (the centre row/column of the odd 40x25 grid included). Each
; pass nudges SEED, so PASSES > 1 layers the pattern.
        ORG $7000
seed:   DB 0            ; POKE 28672 - mix base
step:   DB 0            ; POKE 28673 - mix twist
reps:   DB 0            ; POKE 28674 - passes (0 treated as 1)
; entry: SYS 28675
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
        AND #$3F        ; map into the graphic screen-code band $40..$7F
        ORA #$40
store:  STA $8000,Y
        INY
        CPY #40
        BNE xloop
        LDA store+1     ; row base += 40
        CLC
        ADC #40
        STA store+1
        LDA store+2
        ADC #0
        STA store+2
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
