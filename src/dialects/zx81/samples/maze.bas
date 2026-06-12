10 REM MAZE
20 DIM A$(9,14)
30 LET A$(1)="██████████████"
40 LET A$(2)="█      █     █"
50 LET A$(3)="█ ████ █ ███ █"
60 LET A$(4)="█ █    █   █ █"
70 LET A$(5)="█ █ ████ █ █ █"
80 LET A$(6)="█ █      █ █ █"
90 LET A$(7)="█ ██████ █ █ █"
100 LET A$(8)="█        █   E"
110 LET A$(9)="██████████████"
120 CLS
130 FOR I=1 TO 9
140 PRINT AT I,8;A$(I)
150 NEXT I
160 PRINT AT 11,8;"REACH E TO WIN"
170 LET Y=2
180 LET X=2
190 PRINT AT Y,X+7;"O"
200 LET K$=INKEY$
210 IF K$="" THEN GOTO 200
220 LET U=Y
230 LET V=X
240 IF K$="5" THEN LET V=X-1
250 IF K$="8" THEN LET V=X+1
260 IF K$="6" THEN LET U=Y+1
270 IF K$="7" THEN LET U=Y-1
280 IF A$(U,V)="█" THEN GOTO 200
290 PRINT AT Y,X+7;" "
300 LET Y=U
310 LET X=V
320 PRINT AT Y,X+7;"O"
330 IF A$(Y,X)="E" THEN GOTO 350
340 GOTO 200
350 PRINT AT 13,8;"YOU ESCAPED"
360 PAUSE 300
370 RUN
