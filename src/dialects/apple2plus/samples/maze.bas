10 REM MAZE - W A S D MOVE THE MARKER, REACH THE E
20 REM APPLESOFT HAS STRING ARRAYS, SO THE MAP IS READ INTO ONE AND A WALL
30 REM TEST IS A MID$ - THE SCREEN NEVER HAS TO BE READ BACK
40 DIM M$(21)
50 HOME
60 FOR R = 1 TO 21
70 READ M$(R)
80 PRINT M$(R)
90 NEXT R
100 VTAB 23
110 HTAB 1
120 PRINT "REACH E - W A S D TO MOVE";
130 X = 2
140 Y = 2
150 GOSUB 410
160 REM PEEK ( - 16384) READS THE KEY LATCH WITHOUT WAITING, WHERE GET WOULD
170 REM STOP THE PROGRAM. THE LATCH CARRIES BIT 7 AND ASC DOES NOT
180 K = PEEK ( - 16384)
190 IF K < 128 THEN 180
200 POKE - 16368,0
210 K = K - 128
220 V = X
230 U = Y
240 IF K = ASC ("W") THEN U = Y - 1
250 IF K = ASC ("A") THEN V = X - 1
260 IF K = ASC ("S") THEN U = Y + 1
270 IF K = ASC ("D") THEN V = X + 1
280 IF V = X AND U = Y THEN 180
290 T$ = MID$ (M$(U),V,1)
300 IF T$ = "#" THEN 180
310 REM ONLY THE TWO CELLS THAT CHANGED ARE REPAINTED, NOT THE WHOLE MAP
320 VTAB Y
330 HTAB X
340 PRINT " ";
350 X = V
360 Y = U
370 GOSUB 410
380 IF T$ = "E" THEN 450
390 GOTO 180
400 REM THE MARKER, DRAWN WHEREVER X AND Y NOW POINT
410 VTAB Y
420 HTAB X
430 PRINT "O";
440 RETURN
450 VTAB 23
460 HTAB 1
470 PRINT "YOU ESCAPED!             ";
480 END
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
