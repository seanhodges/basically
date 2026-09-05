10 REM MAZE - W A S D MOVE THE MARKER, REACH THE E
20 REM THE SCREEN IS THE MAP. A STRING WOULD HOLD 255 CHARACTERS AND THIS
30 REM MAP IS 819, SO A WALL TEST IS A PEEK AT THE TEXT PAGE INSTEAD
40 CALL -936
50 PRINT "#######################################"
60 PRINT "#       #                 #     #     #"
70 PRINT "####### ### ########### # # # ### ### #"
80 PRINT "#     #   #   #       # #   # #   #   #"
90 PRINT "# ### ### ##### ##### # ####### ### # #"
100 PRINT "#   #   # #     #   # # #         # # #"
110 PRINT "##### ### # ##### ### # # ######### # #"
120 PRINT "#     #   # #   #     #   #       # # #"
130 PRINT "# ##### ### # # # ##### ### ##### # # #"
140 PRINT "# #   #     # # # #   # # # #     # # #"
150 PRINT "# # # ####### # # # ### # # ##### # # #"
160 PRINT "#   #         # # #     # #     #   # #"
170 PRINT "# ############# # # ##### ##### ##### #"
180 PRINT "# #     #       # #   #   #     #   # #"
190 PRINT "# # ### # ### ### ### # # # ##### ### #"
200 PRINT "# #   #   #   #   #     # # #   #   # #"
210 PRINT "# ### ######### ########### # ### # # #"
220 PRINT "#   #           #     #   # # #   #   #"
230 PRINT "### ############# ### # # # # # #######"
240 PRINT "#                 #     #   #         E"
250 PRINT "#######################################"
260 VTAB 23
270 TAB 1
280 PRINT "REACH E - W A S D TO MOVE";
290 X=2
300 Y=2
310 GOSUB 560
320 REM PEEK(-16384) READS THE KEY LATCH WITHOUT WAITING. ASC CARRIES THE SAME
330 REM BIT 7 THE LATCH AND THE SCREEN DO, SO ALL THREE COMPARE DIRECTLY
340 K=PEEK(-16384)
350 IF K<128 THEN 340
360 POKE -16368,0
370 V=X
380 U=Y
390 IF K=ASC("W") THEN U=Y-1
400 IF K=ASC("A") THEN V=X-1
410 IF K=ASC("S") THEN U=Y+1
420 IF K=ASC("D") THEN V=X+1
430 IF V=X AND U=Y THEN 340
440 REM SCREEN ROWS ARE INTERLEAVED: ROW R STARTS AT 1024+128*(R MOD 8)+40*(R/8)
450 T=PEEK(1024+128*((U-1) MOD 8)+40*((U-1)/8)+V-1)
460 IF T=ASC("#") THEN 340
470 VTAB Y
480 TAB X
490 PRINT " ";
500 X=V
510 Y=U
520 GOSUB 560
530 IF T=ASC("E") THEN 600
540 GOTO 340
550 REM THE MARKER, DRAWN WHEREVER X AND Y NOW POINT
560 VTAB Y
570 TAB X
580 PRINT "O";
590 RETURN
600 VTAB 23
610 TAB 1
620 PRINT "YOU ESCAPED!             ";
630 END
