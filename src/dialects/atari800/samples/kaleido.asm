; Kaleidoscope: fills the GRAPHICS 11 screen - 80x192 pixels, one 4-bit hue
; each and two to a byte - with a four-way mirrored pattern of colours.
; BASIC POKEs the three parameters, then calls the entry with USR(1539).
;
; Each pixel's hue is mixed from its FOLDED coordinates - fx = min(x,79-x) and
; fy = min(y,191-y) - so a pixel and its three mirrors share one value by
; construction, with no separate mirror writes. Each pass nudges SEED, so
; PASSES > 1 layers the pattern.
;
; The routine lives in page 6, the 256 bytes between the OS's buffers and
; BASIC's workspace that neither ever touches.
        ORG $0600
seed:   DB 0            ; POKE 1536 - hue mix base
step:   DB 0            ; POKE 1537 - hue mix twist
reps:   DB 0            ; POKE 1538 - passes (0 treated as 1)
; entry: USR(1539)
start:  PLA             ; USR pushes the count of arguments it passed; drop it
        LDA reps
        BNE pass
        LDA #1
        STA reps
; The screen address is read from the OS's SAVMSC every pass rather than
; assumed: GRAPHICS 11 takes its memory off the top of RAM, which is a
; different address on a 16K 400 than on a 48K 800.
pass:   LDA $58
        STA store+1
        LDA $59
        STA store+2
        LDA #0
        STA yctr
yloop:  LDA #191        ; fy = min(y, 191-y)
        SEC
        SBC yctr
        CMP yctr
        BCC ykeep
        LDA yctr
; A GRAPHICS 11 pixel is four television pixels wide and one tall, so folding
; the row down by four makes the pattern's cells square on the screen.
ykeep:  LSR A
        LSR A
        STA fyv
        LDY #0          ; Y counts the bytes across one row, 0..39
xloop:  TYA             ; the byte's left pixel is x = 2*Y
        ASL A
        STA xpix
        JSR mix
        ASL A
        ASL A
        ASL A
        ASL A
        STA nib
        INC xpix        ; and its right pixel x = 2*Y+1
        JSR mix
        ORA nib
store:  STA $0000,Y
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
        CMP #192
        BNE yloop
        INC seed        ; next pass: nudge the mix and go again
        DEC reps
        BEQ done
        JMP pass
done:   RTS
; --- one pixel's hue, from its folded coordinates ---
mix:    LDA #79         ; fx = min(x, 79-x)
        SEC
        SBC xpix
        CMP xpix
        BCC mkeep
        LDA xpix
mkeep:  STA fxv
        EOR fyv         ; t1 = (fx XOR fy) + SEED
        CLC
        ADC seed
        STA t1
        LDA fxv         ; the hue is (fx + fy + TWIST) XOR t1
        CLC
        ADC fyv
        CLC
        ADC step
        EOR t1
        AND #$0F
        RTS
t1:     DB 0            ; scratch
fxv:    DB 0
fyv:    DB 0
xpix:   DB 0
nib:    DB 0
yctr:   DB 0
