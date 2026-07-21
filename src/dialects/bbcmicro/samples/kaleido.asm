; Kaleidoscope: fills the MODE 7 (teletext) screen ($7C00, 40x25 cells) with a
; four-way mirrored mosaic. BASIC selects MODE 7, POKEs the three parameters,
; then calls the entry with CALL &2E03.
;
; Teletext carries colour with an inline control code, so column 0 of each row
; holds a "graphics colour" code ($91..$97) and columns 1..39 hold sixel block
; graphics ($20..$3F) drawn in that colour. Both the row colour and each block
; are mixed from FOLDED coordinates - fr = min(row,24-row), fc = min(col,40-col)
; - so the picture is symmetric top/bottom and left/right by construction. Each
; pass nudges SEED, so PASSES > 1 layers the pattern.
        ORG $2E00
seed:   DB 0            ; ?&2E00 - mix base
step:   DB 0            ; ?&2E01 - mix twist
reps:   DB 0            ; ?&2E02 - passes (0 treated as 1)
; entry: CALL &2E03
start:  LDA reps
        BNE pass
        LDA #1
        STA reps
; --- one pass over the whole grid ---
pass:   LDA #$00        ; reset the self-modifying row pointer to $7C00
        STA store+1
        LDA #$7C
        STA store+2
        LDA #0
        STA row
rowloop: LDA #24        ; fr = min(row, 24-row)
        SEC
        SBC row
        CMP row
        BCC frok
        LDA row
frok:   STA frv
        LDX #0          ; X = column, 0..39
cell:   CPX #0          ; column 0 carries the row's graphics-colour control code
        BNE mosaic
        LDA frv         ; colour = ((fr + SEED) AND 7), 0 mapped to 7 (white)
        CLC
        ADC seed
        AND #7
        BNE ccol
        LDA #7
ccol:   ORA #$90        ; $91..$97 = teletext graphics red..white
        JMP put
mosaic: STX ctmp        ; fc = min(col, 40-col)
        LDA #40
        SEC
        SBC ctmp
        CMP ctmp
        BCC fcok
        LDA ctmp
fcok:   STA fcv
        EOR frv         ; t1 = (fc XOR fr) + SEED
        CLC
        ADC seed
        STA t1
        LDA fcv         ; A = (fc + fr + STEP) XOR t1
        CLC
        ADC frv
        CLC
        ADC step
        EOR t1
        AND #$1F        ; a sixel block graphic, $20..$3F
        ORA #$20
put:
store:  STA $7C00,X
        INX
        CPX #40
        BNE cell
        LDA store+1     ; row base += 40
        CLC
        ADC #40
        STA store+1
        LDA store+2
        ADC #0
        STA store+2
        INC row
        LDA row
        CMP #25
        BEQ rdone
        JMP rowloop
rdone:  INC seed        ; next pass: nudge the mix and go again
        DEC reps
        BEQ done
        JMP pass
done:   RTS
t1:     DB 0            ; scratch
frv:    DB 0
fcv:    DB 0
ctmp:   DB 0
row:    DB 0
