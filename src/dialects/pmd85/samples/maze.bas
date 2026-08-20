10 REM MAZE - K0 UP, K1 LEFT, K2 RIGHT, K3 DOWN. REACH THE E.
20 DIM M$(12)
30 FOR I=0 TO 12
40 READ M$(I)
50 NEXT I
60 X=1
70 Y=1
80 REM ---- DRAW THE MAZE, WITH O ON THE PLAYER'S ROW ----
90 GCLEAR
100 PRINT "K0 UP   K1 LEFT   K2 RIGHT   K3 DOWN"
110 PRINT
120 FOR I=0 TO 12
130 IF I<>Y THEN PRINT M$(I)
140 IF I=Y THEN PRINT LEFT$(M$(I),X);"O";MID$(M$(I),X+2)
150 NEXT I
160 REM ---- INKEY SEES ONLY THE FUNCTION KEYS, AND THAT IS ENOUGH ----
170 K=INKEY
180 IF K=255 THEN 170
190 NX=X
200 NY=Y
210 IF K=1 THEN NX=X-1
220 IF K=2 THEN NX=X+1
230 IF K=0 THEN NY=Y-1
240 IF K=3 THEN NY=Y+1
250 IF NX<0 THEN 320
260 IF NX>38 THEN 320
270 IF NY<0 THEN 320
280 IF NY>12 THEN 320
290 T$=MID$(M$(NY),NX+1,1)
300 IF T$="#" THEN 320
310 GOTO 340
320 IF INKEY<255 THEN 320
330 GOTO 170
340 X=NX
350 Y=NY
360 IF T$="E" THEN 400
370 IF INKEY<255 THEN 370
380 GOTO 90
390 REM ---- REACHED THE EXIT ----
400 GCLEAR
410 PRINT
420 PRINT "YOU ESCAPED!"
430 BEEP
440 END
450 DATA "#######################################"
460 DATA "# #   #   #   #               #       #"
470 DATA "# # # # # # # # ####### # ### ##### # #"
480 DATA "# # #   #   #     #   # # # # #   # # #"
490 DATA "# ######### ####### # # # # # # # ### #"
500 DATA "#   #     # # #     # # # #   # #   # #"
510 DATA "### # ### # # # ##### ### # ### ### # #"
520 DATA "# #   # # #   #   # #     # #   # # # #"
530 DATA "# ##### # ### ### # ####### # # # # # #"
540 DATA "#       # #   #   # #   #   # # # #   #"
550 DATA "# ### ### ##### ### # # # ##### # ### #"
560 DATA "#   #           #     #         #    E#"
570 DATA "#######################################"
