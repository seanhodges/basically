10 REM Maze - reach the E
20 MODE 1:INK 0,0:INK 1,24:INK 2,6:INK 3,9:BORDER 0
30 PEN 1:LOCATE 19,2:PRINT "MAZE"
40 PEN 2:LOCATE 8,8:PRINT "1. KEYBOARD (CURSOR KEYS)"
50 PEN 3:LOCATE 8,10:PRINT "2. JOYSTICK"
60 MD=1
70 A$=INKEY$:IF A$="" THEN 70
80 IF A$="2" THEN MD=2
90 PEN 1:LOCATE 7,14:PRINT "PRESS SPACE / FIRE TO START"
100 IF MD=1 AND INKEY(47)=-1 THEN 100
110 IF MD=2 AND (JOY(0) AND 48)=0 THEN 110
120 CLS
130 DIM M$(21)
140 FOR R=1 TO 21:READ M$(R):NEXT
150 PEN 2:FOR R=1 TO 21:LOCATE 1,R+2:PRINT M$(R);:NEXT
160 PEN 3:LOCATE 1,1:IF MD=1 THEN PRINT "REACH E - CURSOR KEYS";
170 IF MD=2 THEN LOCATE 1,1:PRINT "REACH E - JOYSTICK";
180 PX=2:PY=2
190 PEN 1:LOCATE PX,PY+2:PRINT "@";
200 LF=0:RT=0:UP=0:DN=0
210 IF MD=1 THEN GOSUB 500
220 IF MD=2 THEN GOSUB 560
230 NX=PX:NY=PY
240 IF LF THEN NX=PX-1
250 IF RT THEN NX=PX+1
260 IF UP THEN NY=PY-1
270 IF DN THEN NY=PY+1
280 IF NX=PX AND NY=PY THEN 200
290 IF NX<1 OR NX>39 OR NY<1 OR NY>21 THEN 200
300 IF MID$(M$(NY),NX,1)="#" THEN 200
310 PEN 1:LOCATE PX,PY+2:PRINT " ";
320 PX=NX:PY=NY
330 LOCATE PX,PY+2:PRINT "@";
340 IF MID$(M$(PY),PX,1)="E" THEN 700
350 FOR T=1 TO 40:NEXT
360 GOTO 200
500 IF INKEY(8)<>-1 THEN LF=1
510 IF INKEY(1)<>-1 THEN RT=1
520 IF INKEY(0)<>-1 THEN UP=1
530 IF INKEY(2)<>-1 THEN DN=1
540 RETURN
560 J=JOY(0)
570 IF (J AND 4)<>0 THEN LF=1
580 IF (J AND 8)<>0 THEN RT=1
590 IF (J AND 1)<>0 THEN UP=1
600 IF (J AND 2)<>0 THEN DN=1
610 RETURN
700 PEN 3:LOCATE 13,1:PRINT "YOU ESCAPED!            ";
710 SOUND 1,239,20:SOUND 1,190,20:SOUND 1,159,40
720 GOTO 720
730 DATA "#######################################"
740 DATA "#       #                 #     #     #"
750 DATA "####### ### ########### # # # ### ### #"
760 DATA "#     #   #   #       # #   # #   #   #"
770 DATA "# ### ### ##### ##### # ####### ### # #"
780 DATA "#   #   # #     #   # # #         # # #"
790 DATA "##### ### # ##### ### # # ######### # #"
800 DATA "#     #   # #   #     #   #       # # #"
810 DATA "# ##### ### # # # ##### ### ##### # # #"
820 DATA "# #   #     # # # #   # # # #     # # #"
830 DATA "# # # ####### # # # ### # # ##### # # #"
840 DATA "#   #         # # #     # #     #   # #"
850 DATA "# ############# # # ##### ##### ##### #"
860 DATA "# #     #       # #   #   #     #   # #"
870 DATA "# # ### # ### ### ### # # # ##### ### #"
880 DATA "# #   #   #   #   #     # # #   #   # #"
890 DATA "# ### ######### ########### # ### # # #"
900 DATA "#   #           #     #   # # #   #   #"
910 DATA "### ############# ### # # # # # #######"
920 DATA "#                 #     #   #         E"
930 DATA "#######################################"
