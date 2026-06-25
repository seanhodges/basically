10 REM MAZE - REACH THE E, W A S D TO MOVE
20 CLS
30 DIM M$(12)
40 FOR I=0 TO 12:READ M$(I):NEXT
50 FOR I=0 TO 12:PRINT M$(I):NEXT
60 PRINT "REACH E   W A S D TO MOVE";
70 X=1:Y=1
80 POKE 15360+Y*64+X,79
90 K$=INKEY$:IF K$="" THEN 90
100 NX=X:NY=Y
110 IF K$="A" THEN NX=X-1
120 IF K$="D" THEN NX=X+1
130 IF K$="W" THEN NY=Y-1
140 IF K$="S" THEN NY=Y+1
150 IF NX<0 OR NX>38 OR NY<0 OR NY>12 THEN 90
160 T$=MID$(M$(NY),NX+1,1)
170 IF T$="#" THEN 90
180 POKE 15360+Y*64+X,32
190 X=NX:Y=NY
200 POKE 15360+Y*64+X,79
210 IF T$="E" THEN 230
220 GOTO 90
230 CLS:PRINT "YOU ESCAPED!"
240 END
250 DATA "#######################################"
260 DATA "# #   #   #   #               #       #"
270 DATA "# # # # # # # # ####### # ### ##### # #"
280 DATA "# # #   #   #     #   # # # # #   # # #"
290 DATA "# ######### ####### # # # # # # # ### #"
300 DATA "#   #     # # #     # # # #   # #   # #"
310 DATA "### # ### # # # ##### ### # ### ### # #"
320 DATA "# #   # # #   #   # #     # #   # # # #"
330 DATA "# ##### # ### ### # ####### # # # # # #"
340 DATA "#       # #   #   # #   #   # # # #   #"
350 DATA "# ### ### ##### ### # # # ##### # ### #"
360 DATA "#   #           #     #         #    E#"
370 DATA "#######################################"
