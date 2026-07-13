10 REM MAZE
20 PRINT CHR$(147)
30 PRINT "        *** MAZE ***"
40 PRINT:PRINT "   W A S D TO MOVE - REACH E"
50 PRINT:PRINT "   PRESS SPACE TO START"
60 GET K$:IF K$<>" " THEN 60
70 PRINT CHR$(147)
80 DIM M$(20)
90 FOR I=0 TO 20:READ M$(I):NEXT
100 SC=32768
110 FOR R=0 TO 20:PRINT M$(R):NEXT
120 X=1:Y=1
130 GOSUB 360
140 GOSUB 400
150 NX=X:NY=Y
160 IF LF THEN NX=X-1
170 IF RT THEN NX=X+1
180 IF UP THEN NY=Y-1
190 IF DN THEN NY=Y+1
200 IF NX=X AND NY=Y THEN 140
210 IF NX<0 OR NX>38 OR NY<0 OR NY>20 THEN 140
220 T=PEEK(SC+40*NY+NX)
230 IF T=35 THEN 140
240 POKE SC+40*Y+X,32
250 X=NX:Y=NY
260 GOSUB 360
270 IF T=5 THEN PRINT CHR$(147);"YOU ESCAPED!":END
280 GOTO 140
360 REM DRAW PLAYER
370 POKE SC+40*Y+X,81:RETURN
400 REM READ MOVE
410 LF=0:RT=0:UP=0:DN=0
420 GET K$
430 IF K$="A" THEN LF=1
440 IF K$="D" THEN RT=1
450 IF K$="W" THEN UP=1
460 IF K$="S" THEN DN=1
470 RETURN
500 DATA "#######################################"
510 DATA "#       #                 #     #     #"
520 DATA "####### ### ########### # # # ### ### #"
530 DATA "#     #   #   #       # #   # #   #   #"
540 DATA "# ### ### ##### ##### # ####### ### # #"
550 DATA "#   #   # #     #   # # #         # # #"
560 DATA "##### ### # ##### ### # # ######### # #"
570 DATA "#     #   # #   #     #   #       # # #"
580 DATA "# ##### ### # # # ##### ### ##### # # #"
590 DATA "# #   #     # # # #   # # # #     # # #"
600 DATA "# # # ####### # # # ### # # ##### # # #"
610 DATA "#   #         # # #     # #     #   # #"
620 DATA "# ############# # # ##### ##### ##### #"
630 DATA "# #     #       # #   #   #     #   # #"
640 DATA "# # ### # ### ### ### # # # ##### ### #"
650 DATA "# #   #   #   #   #     # # #   #   # #"
660 DATA "# ### ######### ########### # ### # # #"
670 DATA "#   #           #     #   # # #   #   #"
680 DATA "### ############# ### # # # # # #######"
690 DATA "#                 #     #   #         E"
700 DATA "#######################################"
