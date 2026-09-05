; Kaleidoscope: a four-way mirrored pattern over the whole hi-res page 1.
; BASIC POKEs the three parameters and CALL 771s the entry.
;
; Each byte is decided by its FOLDED coordinates - fx = min(cx,39-cx) over the
; forty byte-columns, fy = min(cy,159-cy) over the 160 rows HGR shows - so a
; byte and its three mirrors come out the same by construction, with no
; separate mirror writes. The bands are the contours of fx*fy, which are
; hyperbolas; the twist slides fy, which moves them, and each pass nudges the
; seed, which shifts their phase.
;
; A byte is drawn solid or left empty, never part-filled. Hi-res is one bit a
; dot, so a value written straight into the byte makes cells that differ by one
; look nothing alike and the mirror disappears into speckle - the sibling's
; lo-res version can write the value itself because there it is a colour. Bit 7
; is never set either: on a composite screen it shifts the dots into the other
; colour pair rather than lighting one, and half a picture in the other palette
; is not a mirror.
;
; The fold is quartered vertically because a row is a quarter the height that a
; byte-column is wide, so an unquartered fold draws the rings as stripes.
;
; The page is interleaved three deep. Row y starts at
;   $2000 + (y AND 7)*$400 + ((y>>3) AND 7)*$80 + (y>>6)*$28
; which is 160 addresses - far too many to tabulate in the one page of RAM a
; block gets - so `rowadr` computes it into the store below instead.
        ORG $0300
seed:   DB 0            ; POKE 768 - band phase
twst:   DB 0            ; POKE 769 - how far the vertical fold is slid
reps:   DB 0            ; POKE 770 - passes (0 treated as 1)
draw:   LDA reps        ; entry: CALL 771
        BNE pass
        LDA #1
        STA reps
pass:   LDA #0
        STA cy
rloop:  JSR rowadr      ; patch the store with this row's base address
        LDY #0
cloop:  STY cx
        JSR mix
store:  STA $2000,Y
        INY
        CPY #40
        BNE cloop
        INC cy
        LDA cy
        CMP #160
        BNE rloop
        LDA seed        ; the next pass starts from a nudged seed
        CLC
        ADC #5
        STA seed
        DEC reps
        BNE pass
        RTS
; The row address, into store+1/store+2. The high byte is $20 + (y AND 7)*4
; plus the top two bits of (y>>3) AND 7; the low byte is $80 for that field's
; bottom bit, plus $28 for each sixty-fourth row. Neither can carry into the
; other, which is why they are built separately.
rowadr: LDA cy
        AND #7
        ASL A
        ASL A
        CLC
        ADC #$20
        STA hi
        LDA cy
        LSR A
        LSR A
        LSR A
        STA t1          ; y>>3, 0 to 19
        AND #7
        LSR A
        CLC
        ADC hi
        STA store+2
        LDA t1          ; the field's bottom bit is worth $80, read again
        AND #1          ; rather than carried out of the shift above - the
        BEQ nohalf      ; ADC between would have overwritten the carry
        LDA #$80
nohalf: STA lo
        LDA t1          ; (y>>3)>>3 is y>>6: 0, 1 or 2
        LSR A
        LSR A
        LSR A
        TAX
        LDA lo
thirds: CPX #0
        BEQ rdone
        CLC
        ADC #$28
        DEX
        JMP thirds
rdone:  STA store+1
        RTS
; Solid where bit 3 of fx*(fy+twist)+seed is set, empty where it is not, from
; the folded coordinates in cx/cy. Y holds the column and must survive, so only
; A and X are used below.
mix:    LDA cx          ; fx = min(cx, 39-cx)
        CMP #20
        BCC xkeep
        LDA #39
        SEC
        SBC cx
xkeep:  STA fx
        LDA cy          ; fy = min(cy, 159-cy) / 4, slid by the twist
        CMP #80
        BCC ykeep
        LDA #159
        SEC
        SBC cy
ykeep:  LSR A
        LSR A
        CLC
        ADC twst
        STA fy
        LDA #0          ; fx*fy, by adding fy to itself fx times: the 6502 has
        LDX fx          ; no multiply, and fx is at most 19
        BEQ mdone
mloop:  CLC
        ADC fy
        DEX
        BNE mloop
mdone:  CLC
        ADC seed
        AND #8
        BEQ dark
        LDA #$7F
        RTS
dark:   LDA #0
        RTS
cx:     DB 0
cy:     DB 0
fx:     DB 0
fy:     DB 0
t1:     DB 0
lo:     DB 0
hi:     DB 0
