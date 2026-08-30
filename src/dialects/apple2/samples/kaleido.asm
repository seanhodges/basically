; Kaleidoscope: a four-way mirrored pattern over the whole 40x40 lo-res page.
; BASIC POKEs the three parameters and CALL 771s the entry.
;
; Each cell's colour is mixed from its FOLDED coordinates - fx = min(cx,39-cx),
; fy = min(cy,39-cy) - so a cell and its three mirrors take the same value by
; construction, with no separate mirror writes.
;
; The lo-res page is text page 1 read as colour: one byte holds TWO rows, the
; even row in its low nibble and the odd row in its high one, and the twenty
; text rows are interleaved rather than consecutive - row t starts at
; $0400 + 128*(t MOD 8) + 40*(t/8). That is what `rowl`/`rowh` tabulate and why
; the store below is patched per row instead of just being advanced by 40.
        ORG $0300
seed:   DB 0            ; POKE 768 - pattern mix base
twst:   DB 0            ; POKE 769 - pattern mix twist
reps:   DB 0            ; POKE 770 - passes (0 treated as 1)
draw:   LDA reps        ; entry: CALL 771
        BNE pass
        LDA #1
        STA reps
pass:   LDA #0
        STA ty
tloop:  LDX ty          ; patch the store with this text row's base address
        LDA rowl,X
        STA store+1
        LDA rowh,X
        STA store+2
        TXA             ; cy = 2*ty, the even lo-res row of the pair
        ASL A
        STA cy
        LDY #0
cloop:  STY cx
        JSR mix         ; low nibble: the even row
        STA nib
        INC cy
        JSR mix         ; high nibble: the odd row
        ASL A
        ASL A
        ASL A
        ASL A
        ORA nib
        DEC cy
store:  STA $0400,Y
        INY
        CPY #40
        BNE cloop
        INC ty
        LDA ty
        CMP #20
        BNE tloop
        LDA seed        ; the next pass starts from a nudged seed
        CLC
        ADC #5
        STA seed
        DEC reps
        BNE pass
        RTS
; n = ((fx*fy + seed) EOR fx EOR fy EOR twist) AND 15, from the folded
; coordinates in cx/cy. Y holds the column and must survive.
mix:    LDA cx          ; fx = min(cx, 39-cx)
        CMP #20
        BCC xkeep
        LDA #39
        SEC
        SBC cx
xkeep:  STA fx
        LDA cy          ; fy = min(cy, 39-cy)
        CMP #20
        BCC ykeep
        LDA #39
        SEC
        SBC cy
ykeep:  STA fy
        LDA #0          ; fx*fy, by adding fx to itself fy times: the 6502 has
        LDX fy          ; no multiply, and fy is at most 19
        BEQ mdone
mloop:  CLC
        ADC fx
        DEX
        BNE mloop
mdone:  CLC
        ADC seed
        EOR fx
        EOR fy
        EOR twst
        AND #15
        RTS
rowl:   DB $00,$80,$00,$80,$00,$80,$00,$80
        DB $28,$A8,$28,$A8,$28,$A8,$28,$A8
        DB $50,$D0,$50,$D0
rowh:   DB $04,$04,$05,$05,$06,$06,$07,$07
        DB $04,$04,$05,$05,$06,$06,$07,$07
        DB $04,$04,$05,$05
nib:    DB 0
cx:     DB 0
cy:     DB 0
ty:     DB 0
fx:     DB 0
fy:     DB 0
