10 REM MAZE - REACH THE E, W A S D TO MOVE
20 CLS
30 PRINT
40 PRINT "            MAZE"
50 PRINT
60 PRINT "       PRESS ANY KEY"
70 K$=INKEY$:IF K$="" THEN 70
80 CLS
90 DIM M$(12)
100 FOR I=0 TO 12:READ M$(I):NEXT
110 FOR I=0 TO 12:PRINT M$(I):NEXT
120 PRINT "REACH E   W A S D TO MOVE";
130 X=1:Y=1
140 POKE 15360+Y*64+X,79
150 K$=INKEY$:IF K$="" THEN 150
160 NX=X:NY=Y
170 IF K$="A" THEN NX=X-1
180 IF K$="D" THEN NX=X+1
190 IF K$="W" THEN NY=Y-1
200 IF K$="S" THEN NY=Y+1
210 IF NX<0 OR NX>38 OR NY<0 OR NY>12 THEN 150
220 T$=MID$(M$(NY),NX+1,1)
230 IF T$="#" THEN 150
240 POKE 15360+Y*64+X,32
250 X=NX:Y=NY
260 POKE 15360+Y*64+X,79
270 IF T$="E" THEN 290
280 GOTO 150
290 CLS:PRINT "YOU ESCAPED!"
300 END
310 DATA "#######################################"
320 DATA "# #   #   #   #               #       #"
330 DATA "# # # # # # # # ####### # ### ##### # #"
340 DATA "# # #   #   #     #   # # # # #   # # #"
350 DATA "# ######### ####### # # # # # # # ### #"
360 DATA "#   #     # # #     # # # #   # #   # #"
370 DATA "### # ### # # # ##### ### # ### ### # #"
380 DATA "# #   # # #   #   # #     # #   # # # #"
390 DATA "# ##### # ### ### # ####### # # # # # #"
400 DATA "#       # #   #   # #   #   # # # #   #"
410 DATA "# ### ### ##### ### # # # ##### # ### #"
420 DATA "#   #           #     #         #    E#"
430 DATA "#######################################"
