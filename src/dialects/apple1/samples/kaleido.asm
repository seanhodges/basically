; Kaleidoscope: draws a four-way mirrored character pattern over the top twelve
; rows of the Apple I's 40x24 display. BASIC POKEs the three parameters and
; calls the entry point with CALL 771.
;
; The block sits at $0300, in the free RAM below LOMEM - the only RAM Integer
; BASIC never touches, and the reason the machine can hold a routine and a
; program at once at all.
;
; Each cell's pattern is mixed from its FOLDED coordinates - fx = min(cx,39-cx)
; and fy = min(cy,11-cy) - so a cell and its three mirrors take the same value
; by construction, with no separate mirror writes. The mix leans on the product
; of the two, which is what stops it coming out as stripes; the 6502 has no
; multiply, so it is fy adds of fx. Each pass nudges SEED, so PASSES > 1 layers
; the pattern.
;
; There is no screen memory to write: the display is a shift register the CPU
; pushes one character into at a time, through the PIA at $D012, and it accepts
; one per video field. `putc` is that wait.
        ORG $0300
seed:   DB 0            ; POKE 768 - pattern mix base
twst:   DB 0            ; POKE 769 - pattern mix twist
reps:   DB 0            ; POKE 770 - passes (0 treated as 1)
draw:   LDA reps        ; entry: CALL 771
        BNE pass
        LDA #1
        STA reps
pass:   LDA #0
        STA cy
yloop:  LDA #0
        STA cx
xloop:  LDA cy          ; fy = min(cy, 11-cy)
        CMP #6
        BCC ykeep
        LDA #11
        SEC
        SBC cy
ykeep:  STA fy
        LDA cx          ; fx = min(cx, 39-cx)
        CMP #20
        BCC xkeep
        LDA #39
        SEC
        SBC cx
xkeep:  STA fx
        LDA #0          ; tmp = fx*fy, by adding fx to itself fy times: the
        LDX fy          ; 6502 has no multiply, and fy is at most 5
        BEQ mdone
mloop:  CLC
        ADC fx
        DEX
        BNE mloop
mdone:  CLC             ; n = ((fx*fy + seed) EOR fx EOR fy EOR twist) AND 7
        ADC seed
        EOR fx
        EOR fy
        EOR twst
        AND #7
        TAX
        LDA glyph,X
        JSR putc
        INC cx
        LDA cx
        CMP #40
        BNE xloop
        LDA #$8D        ; carriage return: the one code the display decodes
        JSR putc
        INC cy
        LDA cy
        CMP #12
        BNE yloop
        LDA seed        ; the next pass starts from a nudged seed
        CLC
        ADC #5
        STA seed
        DEC reps
        BNE pass
        RTS
; The monitor's own echo at $FFEF is these four instructions. Inlined rather
; than called, so the routine does not depend on a monitor being fitted: PB7 of
; the display PIA is high while the shift register is still rotating, and every
; character carries bit 7 set.
putc:   BIT $D012
        BMI putc
        STA $D012
        RTS
; Space, full stop, colon, plus, star, hash, at, slash - all with bit 7 set,
; which is how this machine carries every character.
glyph:  DB $A0,$AE,$BA,$AB,$AA,$A3,$C0,$AF
cx:     DB 0
cy:     DB 0
fx:     DB 0
fy:     DB 0
