10 REM MAZE
20 GRAPHICS 0:POKE 752,1:POKE 82,0
30 SETCOLOR 2,0,0:SETCOLOR 4,0,0:SETCOLOR 1,0,14
40 PRINT "{clear}"
50 POSITION 13,2:PRINT "*** MAZE ***"
60 POSITION 10,5:PRINT "1. KEYBOARD"
70 POSITION 10,7:PRINT "2. JOYSTICK (PORT 1)"
80 GOSUB 900
90 MD=1
100 POKE 764,255
110 IF PEEK(764)=255 THEN 110
120 IF PEEK(764)=30 THEN MD=2
130 POSITION 10,10
140 IF MD=1 THEN PRINT "PRESS SPACE TO START"
150 IF MD=2 THEN PRINT "PRESS FIRE TO START"
160 POKE 764,255
170 IF MD=1 AND PEEK(764)<>33 THEN 170
180 IF MD=2 AND STRIG(0)=1 THEN 180
190 POKE 764,255
200 PRINT "{clear}";
210 PRINT "#######################################"
220 PRINT "#       #                 #     #     #"
230 PRINT "####### ### ########### # # # ### ### #"
240 PRINT "#     #   #   #       # #   # #   #   #"
250 PRINT "# ### ### ##### ##### # ####### ### # #"
260 PRINT "#   #   # #     #   # # #         # # #"
270 PRINT "##### ### # ##### ### # # ######### # #"
280 PRINT "#     #   # #   #     #   #       # # #"
290 PRINT "# ##### ### # # # ##### ### ##### # # #"
300 PRINT "# #   #     # # # #   # # # #     # # #"
310 PRINT "# # # ####### # # # ### # # ##### # # #"
320 PRINT "#   #         # # #     # #     #   # #"
330 PRINT "# ############# # # ##### ##### ##### #"
340 PRINT "# #     #       # #   #   #     #   # #"
350 PRINT "# # ### # ### ### ### # # # ##### ### #"
360 PRINT "# #   #   #   #   #     # # #   #   # #"
370 PRINT "# ### ######### ########### # ### # # #"
380 PRINT "#   #           #     #   # # #   #   #"
390 PRINT "### ############# ### # # # # # #######"
400 PRINT "#                 #     #   #         E"
410 PRINT "#######################################"
420 POSITION 0,21
430 IF MD=1 THEN PRINT "REACH E - W A S D";
440 IF MD=2 THEN PRINT "REACH E - JOYSTICK PORT 1";
450 X=1:Y=1:GOSUB 700
460 GOSUB 600
470 NX=X+DX:NY=Y+DY
480 IF DX=0 AND DY=0 THEN 460
490 IF NX<0 OR NX>38 OR NY<0 OR NY>20 THEN 460
500 LOCATE NX,NY,C
510 IF C=35 THEN 460
520 POSITION X,Y:PRINT " ";
530 X=NX:Y=NY:GOSUB 700
540 IF C=69 THEN 800
550 GOTO 460
600 REM READ MOVE
610 DX=0:DY=0
620 IF MD=2 THEN 660
630 K=PEEK(764):POKE 764,255
640 IF K=63 THEN DX=-1
642 IF K=58 THEN DX=1
644 IF K=46 THEN DY=-1
646 IF K=62 THEN DY=1
650 RETURN
660 J=STICK(0)
662 IF J=11 THEN DX=-1
664 IF J=7 THEN DX=1
666 IF J=14 THEN DY=-1
668 IF J=13 THEN DY=1
670 FOR D=1 TO 12:NEXT D
680 RETURN
700 REM DRAW MARKER
710 POSITION X,Y:PRINT "O";
720 SOUND 0,60,10,4:FOR D=1 TO 4:NEXT D:SOUND 0,0,0,0
730 RETURN
800 POSITION 0,21:PRINT "YOU ESCAPED!             ";
810 GOSUB 950
820 POKE 752,0:END
900 REM TITLE TUNE
910 SOUND 0,121,10,8:FOR D=1 TO 40:NEXT D
920 SOUND 0,96,10,8:FOR D=1 TO 40:NEXT D
930 SOUND 0,81,10,8:FOR D=1 TO 40:NEXT D
940 SOUND 0,72,10,8:FOR D=1 TO 60:NEXT D:SOUND 0,0,0,0:RETURN
950 REM VICTORY TUNE
960 FOR P=121 TO 60 STEP -6
970 SOUND 0,P,10,8:FOR D=1 TO 20:NEXT D
980 NEXT P
990 SOUND 0,0,0,0:RETURN
