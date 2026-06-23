10 REM MAZE - WALK O TO THE E TO ESCAPE
20 REM TYPE A DIRECTION NUMBER THEN RETURN
30 CLEAR 0
40 REM POKE THE OS CURSOR (#DE/#DF) TO HOME SO THE MAZE LANDS AT ROW 0
50 ?#DE=0
60 ?#DF=#80
70 PRINT "#############################"'
80 PRINT "#O  #       #   #     #     #"'
90 PRINT "### ### # # # # # # # ##### #"'
100 PRINT "# #   # # # # #   # #       #"'
110 PRINT "# ### # # # ### ### ####### #"'
120 PRINT "#     # # #   #   #   #   # #"'
130 PRINT "# ####### ### ####### # ### #"'
140 PRINT "#     #   #   #       #     #"'
150 PRINT "##### # ##### # ####### #####"'
160 PRINT "#   # #     #   #   #   #   #"'
170 PRINT "# # # ##### ##### ### ### # #"'
180 PRINT "# #         #             #E#"'
190 PRINT "#############################"'
200 PRINT "8 UP 2 DOWN 4 LEFT 6 RIGHT"'
210 X=1
220 Y=1
230 REM PARK THE CURSOR BELOW THE MAZE FOR INPUT
240 ?#DE=#C0
250 ?#DF=#81
260 INPUT N
270 U=Y
280 V=X
290 IF N=8 THEN U=Y-1
300 IF N=2 THEN U=Y+1
310 IF N=4 THEN V=X-1
320 IF N=6 THEN V=X+1
330 C=?(#8000+U*32+V)
340 IF C=#23 THEN GOTO 240
350 ?(#8000+Y*32+X)=#20
360 X=V
370 Y=U
380 ?(#8000+Y*32+X)=#0F
390 IF C=#05 THEN GOTO 420
400 GOTO 240
410 REM REACHED THE EXIT
420 ?#DE=#C0
430 ?#DF=#81
440 PRINT "YOU ESCAPED      "'
450 END
