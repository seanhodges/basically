10 REM MAZE - REACH THE E
20 CLEAR 1500
30 SCREEN 0:WIDTH 40:KEY OFF:COLOR 15,4,4:CLS
40 LOCATE 18,2:PRINT "MAZE"
50 LOCATE 7,8:PRINT "1. KEYBOARD (CURSOR KEYS)"
60 LOCATE 7,10:PRINT "2. JOYSTICK"
70 M=1
80 K$=INKEY$:IF K$="" THEN 80
90 IF K$="2" THEN M=2
100 LOCATE 6,14:PRINT "PRESS SPACE / FIRE TO START"
110 IF STRIG(M-1)=0 THEN 110
120 CLS
130 DIM Z$(20)
140 FOR R=0 TO 20:READ Z$(R):NEXT R
150 FOR R=0 TO 20:LOCATE 0,R+2:PRINT Z$(R);:NEXT R
160 IF M=1 THEN LOCATE 0,0:PRINT "REACH E - CURSOR KEYS";
170 IF M=2 THEN LOCATE 0,0:PRINT "REACH E - JOYSTICK";
180 X=1:Y=1
190 LOCATE X,Y+2:PRINT "O";
200 D=STICK(M-1)
210 A=X:B=Y
220 IF D=7 OR D=6 OR D=8 THEN A=X-1
230 IF D=3 OR D=2 OR D=4 THEN A=X+1
240 IF D=1 OR D=2 OR D=8 THEN B=Y-1
250 IF D=5 OR D=4 OR D=6 THEN B=Y+1
260 IF A=X AND B=Y THEN 200
270 IF A<0 OR A>38 OR B<0 OR B>20 THEN 200
280 IF MID$(Z$(B),A+1,1)="#" THEN 200
290 LOCATE X,Y+2:PRINT " ";
300 X=A:Y=B
310 LOCATE X,Y+2:PRINT "O";
320 IF MID$(Z$(Y),X+1,1)="E" THEN 400
330 FOR T=1 TO 150:NEXT T
340 GOTO 200
400 LOCATE 12,0:PRINT "YOU ESCAPED!        ";
410 PLAY"V15O5CEGO6C"
420 GOTO 420
430 DATA "#######################################"
440 DATA "#       #                 #     #     #"
450 DATA "####### ### ########### # # # ### ### #"
460 DATA "#     #   #   #       # #   # #   #   #"
470 DATA "# ### ### ##### ##### # ####### ### # #"
480 DATA "#   #   # #     #   # # #         # # #"
490 DATA "##### ### # ##### ### # # ######### # #"
500 DATA "#     #   # #   #     #   #       # # #"
510 DATA "# ##### ### # # # ##### ### ##### # # #"
520 DATA "# #   #     # # # #   # # # #     # # #"
530 DATA "# # # ####### # # # ### # # ##### # # #"
540 DATA "#   #         # # #     # #     #   # #"
550 DATA "# ############# # # ##### ##### ##### #"
560 DATA "# #     #       # #   #   #     #   # #"
570 DATA "# # ### # ### ### ### # # # ##### ### #"
580 DATA "# #   #   #   #   #     # # #   #   # #"
590 DATA "# ### ######### ########### # ### # # #"
600 DATA "#   #           #     #   # # #   #   #"
610 DATA "### ############# ### # # # # # #######"
620 DATA "#                 #     #   #         E"
630 DATA "#######################################"
