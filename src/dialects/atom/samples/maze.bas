10 REM MAZE - WALK O TO THE E TO ESCAPE
20 REM TYPE Z X K M THEN RETURN
30 CLEAR 0
40 PRINT "MAZE"'
50 PRINT "PRESS RETURN TO START"'
60 INPUT $#7000
70 CLEAR 0
80 REM POKE THE OS CURSOR (#DE/#DF) TO HOME SO THE MAZE LANDS AT ROW 0
90 ?#DE=0
100 ?#DF=#80
110 PRINT "#############################"'
120 PRINT "#O  #       #   #     #     #"'
130 PRINT "### ### # # # # # # # ##### #"'
140 PRINT "# #   # # # # #   # #       #"'
150 PRINT "# ### # # # ### ### ####### #"'
160 PRINT "#     # # #   #   #   #   # #"'
170 PRINT "# ####### ### ####### # ### #"'
180 PRINT "#     #   #   #       #     #"'
190 PRINT "##### # ##### # ####### #####"'
200 PRINT "#   # #     #   #   #   #   #"'
210 PRINT "# # # ##### ##### ### ### # #"'
220 PRINT "# #         #             #E#"'
230 PRINT "#############################"'
240 PRINT "Z LEFT X RIGHT K UP M DOWN"'
250 X=1
260 Y=1
270 REM PARK THE CURSOR BELOW THE MAZE FOR INPUT
280 ?#DE=#C0
290 ?#DF=#81
300 INPUT $#7000
310 U=Y
320 V=X
330 IF ?#7000=#4B THEN U=Y-1
340 IF ?#7000=#4D THEN U=Y+1
350 IF ?#7000=#5A THEN V=X-1
360 IF ?#7000=#58 THEN V=X+1
370 C=?(#8000+U*32+V)
380 IF C=#23 THEN GOTO 280
390 ?(#8000+Y*32+X)=#20
400 X=V
410 Y=U
420 ?(#8000+Y*32+X)=#0F
430 IF C=#05 THEN GOTO 460
440 GOTO 280
450 REM REACHED THE EXIT
460 ?#DE=#C0
470 ?#DF=#81
480 PRINT "YOU ESCAPED      "'
490 END
