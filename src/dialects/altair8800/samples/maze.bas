10 REM MAZE - REACH THE E. TYPE W, A, S OR D AND PRESS RETURN.
20 DIM M$(12)
30 FOR I=0 TO 12
40 READ M$(I)
50 NEXT I
60 X=1:Y=1
70 REM ---- DRAW THE MAZE, WITH O ON THE PLAYER'S ROW ----
80 PRINT
90 FOR I=0 TO 12
100 IF I<>Y THEN PRINT M$(I)
110 IF I=Y THEN PRINT LEFT$(M$(I),X);"O";MID$(M$(I),X+2)
120 NEXT I
130 INPUT "REACH E - W,A,S OR D";K$
140 NX=X:NY=Y
150 IF K$="A" THEN NX=X-1
160 IF K$="D" THEN NX=X+1
170 IF K$="W" THEN NY=Y-1
180 IF K$="S" THEN NY=Y+1
190 IF NX<0 OR NX>38 OR NY<0 OR NY>12 THEN 80
200 T$=MID$(M$(NY),NX+1,1)
210 IF T$="#" THEN 80
220 X=NX:Y=NY
230 IF T$="E" THEN 260
240 GOTO 80
250 REM ---- REACHED THE EXIT ----
260 PRINT
270 PRINT "YOU ESCAPED!"
280 END
290 DATA "#######################################"
300 DATA "# #   #   #   #               #       #"
310 DATA "# # # # # # # # ####### # ### ##### # #"
320 DATA "# # #   #   #     #   # # # # #   # # #"
330 DATA "# ######### ####### # # # # # # # ### #"
340 DATA "#   #     # # #     # # # #   # #   # #"
350 DATA "### # ### # # # ##### ### # ### ### # #"
360 DATA "# #   # # #   #   # #     # #   # # # #"
370 DATA "# ##### # ### ### # ####### # # # # # #"
380 DATA "#       # #   #   # #   #   # # # #   #"
390 DATA "# ### ### ##### ### # # # ##### # ### #"
400 DATA "#   #           #     #         #    E#"
410 DATA "#######################################"
