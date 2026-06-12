10 REM MAZE
20 BORDER 0: PAPER 0: INK 7: CLS
30 DIM a$(9,14)
40 LET a$(1)="██████████████"
50 LET a$(2)="█      █     █"
60 LET a$(3)="█ ████ █ ███ █"
70 LET a$(4)="█ █    █   █ █"
80 LET a$(5)="█ █ ████ █ █ █"
90 LET a$(6)="█ █      █ █ █"
100 LET a$(7)="█ ██████ █ █ █"
110 LET a$(8)="█        █   E"
120 LET a$(9)="██████████████"
130 FOR i=1 TO 9: PRINT AT i,8; INK 4;a$(i): NEXT i
140 PRINT AT 8,21; INK 6; FLASH 1;"E"
150 PRINT AT 11,8;"REACH E TO WIN"
160 LET y=2: LET x=2
170 PRINT AT y,x+7; INK 6;"O"
180 LET k$=INKEY$
190 IF k$="" THEN GO TO 180
200 LET u=y: LET v=x
210 IF k$="5" THEN LET v=x-1
220 IF k$="8" THEN LET v=x+1
230 IF k$="6" THEN LET u=y+1
240 IF k$="7" THEN LET u=y-1
250 IF a$(u,v)="█" THEN GO TO 180
260 PRINT AT y,x+7;" "
270 LET y=u: LET x=v
280 PRINT AT y,x+7; INK 6;"O"
290 IF a$(y,x)<>"E" THEN GO TO 180
300 PRINT AT 13,8; FLASH 1;"YOU ESCAPED"
310 PAUSE 300
320 RUN
