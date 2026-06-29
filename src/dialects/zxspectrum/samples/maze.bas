10 REM MAZE
20 BORDER 0: PAPER 0: INK 7: CLS
30 PRINT AT 3,14; INK 6; BRIGHT 1; FLASH 1;"MAZE"
40 PRINT AT 8,6; INK 5;"1. KEYBOARD CONTROLS"
50 PRINT AT 10,6; INK 7;"2. KEMPSTON JOYSTICK"
60 PRINT AT 12,6; INK 7;"3. SINCLAIR JOYSTICK (SJS)"
70 FOR n=1 TO 2: BEEP .12,0: BEEP .12,7: BEEP .12,12: NEXT n: BEEP .25,16
80 LET m=1
90 LET k$=INKEY$
100 IF k$="" THEN GO TO 90
110 IF k$="2" THEN LET m=2
120 IF k$="3" THEN LET m=3
121 IF m=1 THEN PRINT AT 16,6; INK 7;"PRESS SPACE TO START"
122 IF m>1 THEN PRINT AT 16,8; INK 7;"PRESS FIRE TO START"
123 LET k$=INKEY$
124 IF m=1 AND k$<>" " THEN GO TO 123
125 IF m=2 AND INT((IN 31)/16)=0 THEN GO TO 123
126 IF m=3 AND k$<>"5" THEN GO TO 123
130 BORDER 0: PAPER 0: INK 7: CLS
140 DIM a$(19,31)
150 LET a$(1)="███████████████████████████████"
160 LET a$(2)="█ █     █ █     █       █     █"
170 LET a$(3)="█ ███ █ █ █ █ ███ ███ ███ █ █ █"
180 LET a$(4)="█ █   █ █   █       █ █   █ █ █"
190 LET a$(5)="█ █ ███ █████████████ █ ███ ███"
200 LET a$(6)="█ █   █         █   █ █ █ █   █"
210 LET a$(7)="█ ███ █████████ █ █ █ █ █ ███ █"
220 LET a$(8)="█   █     █   █   █ █     █   █"
230 LET a$(9)="███ █ ███ █ ███████ ███████ █ █"
240 LET a$(10)="█   █ █   █ █       █   █   █ █"
250 LET a$(11)="█ ███ █ ███ █ ███████ █ █ ███ █"
260 LET a$(12)="█ █ █ █ █   █ █       █ █ █ █ █"
270 LET a$(13)="█ █ █ █ ███ █ ███ █████ █ █ █ █"
280 LET a$(14)="█ █   █   █   █   █   █   █   █"
290 LET a$(15)="█ █ █████ █ ███ ███ █ █████ ███"
300 LET a$(16)="█ █     █ █ █   █ █ █   █   █ █"
310 LET a$(17)="█ ███████ █ ███ █ █ ███ █ ███ █"
320 LET a$(18)="█         █     █     █       E"
330 LET a$(19)="███████████████████████████████"
340 FOR i=1 TO 19: PRINT AT i-1,0; INK 4;a$(i): NEXT i
350 PRINT AT 17,30; INK 6; FLASH 1;"E"
360 PRINT AT 20,0;"REACH E TO WIN"
362 IF m=1 THEN PRINT AT 21,0;"5 6 7 8 TO MOVE"
364 IF m=2 THEN PRINT AT 21,0;"KEMPSTON JOYSTICK"
366 IF m=3 THEN PRINT AT 21,0;"SINCLAIR JOYSTICK"
370 LET y=2: LET x=2
380 PRINT AT y-1,x-1; INK 6;"O"
390 REM WAIT FOR MOVE
400 LET k$=INKEY$
410 LET lf=0: LET rt=0: LET up=0: LET dn=0
420 IF m=1 AND k$="5" THEN LET lf=1
430 IF m=1 AND k$="8" THEN LET rt=1
440 IF m=1 AND k$="7" THEN LET up=1
450 IF m=1 AND k$="6" THEN LET dn=1
460 IF m=3 AND k$="1" THEN LET lf=1
470 IF m=3 AND k$="2" THEN LET rt=1
480 IF m=3 AND k$="4" THEN LET up=1
490 IF m=3 AND k$="3" THEN LET dn=1
500 IF m=2 THEN LET j=IN 31: LET rt=j-2*INT (j/2): LET lf=INT (j/2)-2*INT (j/4): LET dn=INT (j/4)-2*INT (j/8): LET up=INT (j/8)-2*INT (j/16)
510 IF lf=0 AND rt=0 AND up=0 AND dn=0 THEN GO TO 400
520 LET u=y: LET v=x
530 IF lf=1 THEN LET v=x-1
540 IF rt=1 THEN LET v=x+1
550 IF up=1 THEN LET u=y-1
560 IF dn=1 THEN LET u=y+1
570 IF a$(u,v)="█" THEN GO TO 400
580 PRINT AT y-1,x-1;" "
590 LET y=u: LET x=v
600 PRINT AT y-1,x-1; INK 6;"O"
610 IF a$(y,x)<>"E" THEN GO TO 400
620 FOR n=0 TO 1: BEEP .12,7: BEEP .12,12: BEEP .12,16: NEXT n: BEEP .35,19
630 PRINT AT 20,0; FLASH 1;"YOU ESCAPED!  "
640 PAUSE 300
