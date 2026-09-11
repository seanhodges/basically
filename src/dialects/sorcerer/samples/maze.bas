10 REM MAZE - REACH THE E, W A S Z MOVE THE MARKER
20 REM USR(0) SCANS THE KEYS INTO 28672, SEE KEYS.ASM
30 POKE 260,1:POKE 261,112
40 PRINT CHR$(12);
50 SC=-3968
60 DIM M$(12)
70 FOR I=0 TO 12:READ M$(I):NEXT I
80 FOR I=0 TO 12:PRINT M$(I):NEXT I
90 PRINT
100 PRINT "REACH E   W A S Z TO MOVE"
110 X=1:Y=1
120 POKE SC+Y*64+X,79
130 A=USR(0):K=PEEK(28672)
140 IF K=0 THEN 130
150 NX=X:NY=Y
160 IF (K AND 1) THEN NY=Y-1
170 IF (K AND 2) THEN NY=Y+1
180 IF (K AND 4) THEN NX=X-1
190 IF (K AND 8) THEN NX=X+1
200 IF NX<0 OR NX>38 OR NY<0 OR NY>12 THEN 130
210 T$=MID$(M$(NY),NX+1,1)
220 IF T$="#" THEN 130
230 POKE SC+Y*64+X,32
240 X=NX:Y=NY
250 POKE SC+Y*64+X,79
260 IF T$="E" THEN 290
270 FOR I=1 TO 150:NEXT I
280 GOTO 130
290 PRINT CHR$(12);
300 PRINT "YOU ESCAPED!"
310 END
320 DATA "#######################################"
330 DATA "# #   #   #   #               #       #"
340 DATA "# # # # # # # # ####### # ### ##### # #"
350 DATA "# # #   #   #     #   # # # # #   # # #"
360 DATA "# ######### ####### # # # # # # # ### #"
370 DATA "#   #     # # #     # # # #   # #   # #"
380 DATA "### # ### # # # ##### ### # ### ### # #"
390 DATA "# #   # # #   #   # #     # #   # # # #"
400 DATA "# ##### # ### ### # ####### # # # # # #"
410 DATA "#       # #   #   # #   #   # # # #   #"
420 DATA "# ### ### ##### ### # # # ##### # ### #"
430 DATA "#   #           #     #         #    E#"
440 DATA "#######################################"
