10 REM MAZE
20 POKE 53280,0:POKE 53281,0
30 POKE 54296,15:POKE 54277,9:POKE 54278,0
40 POKE 650,255
50 PRINT CHR$(147);CHR$(5)
60 PRINT:PRINT "        *** MAZE ***"
70 PRINT:PRINT CHR$(158);"   1. KEYBOARD"
80 PRINT CHR$(154);"   2. JOYSTICK (PORT 2)"
90 GOSUB 900
100 MD=1
110 GET K$:IF K$="" THEN 110
120 IF K$="2" THEN MD=2
130 PRINT CHR$(147);
140 DIM M$(20)
150 FOR I=0 TO 20:READ M$(I):NEXT
160 SC=1024:CM=55296:CO=CM-SC
170 PRINT CHR$(154);
180 FOR R=0 TO 20:PRINT M$(R):NEXT
190 PRINT CHR$(158);"REACH E - KEYS OR JOYSTICK";
200 X=1:Y=1
210 GOSUB 360
220 GOSUB 400
230 NX=X:NY=Y
240 IF LF THEN NX=X-1
250 IF RT THEN NX=X+1
260 IF UP THEN NY=Y-1
270 IF DN THEN NY=Y+1
280 IF NX=X AND NY=Y THEN 220
290 IF NX<0 OR NX>38 OR NY<0 OR NY>20 THEN 220
300 T$=MID$(M$(NY),NX+1,1)
310 IF T$="#" THEN 220
320 POKE SC+40*Y+X,32
330 X=NX:Y=NY
340 GOSUB 360
350 IF T$="E" THEN PRINT CHR$(147);CHR$(30);"YOU ESCAPED!":GOSUB 800:END
355 GOTO 220
360 REM DRAW PLAYER
365 POKE SC+40*Y+X,81:POKE SC+40*Y+X+CO,7:RETURN
400 REM READ MOVE
410 LF=0:RT=0:UP=0:DN=0
420 IF MD=1 THEN GET K$:GOSUB 450
430 IF MD=2 THEN J=PEEK(56320):IF (J AND 4)=0 THEN LF=1
432 IF MD=2 AND (J AND 8)=0 THEN RT=1
434 IF MD=2 AND (J AND 1)=0 THEN UP=1
436 IF MD=2 AND (J AND 2)=0 THEN DN=1
440 RETURN
450 IF K$="A" OR K$="a" THEN LF=1
452 IF K$="D" OR K$="d" THEN RT=1
454 IF K$="W" OR K$="w" THEN UP=1
456 IF K$="S" OR K$="s" THEN DN=1
458 RETURN
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
800 REM VICTORY TUNE
810 POKE 54273,17:GOSUB 870
820 POKE 54273,21:GOSUB 870
830 POKE 54273,25:GOSUB 870
840 POKE 54273,33:GOSUB 870
850 POKE 54273,42:GOSUB 870
860 RETURN
870 POKE 54276,16:POKE 54272,0:POKE 54276,17:FOR D=1 TO 120:NEXT D:RETURN
900 REM TITLE TUNE
910 POKE 54276,17
920 POKE 54273,17:FOR D=1 TO 90:NEXT
930 POKE 54273,25:FOR D=1 TO 90:NEXT
940 POKE 54273,33:FOR D=1 TO 90:NEXT
950 POKE 54273,42:FOR D=1 TO 120:NEXT
960 POKE 54276,16:RETURN
