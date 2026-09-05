10 REM MAZE - REACH THE E
20 MODE 3: CSIZE 8,8: BORDER 0: PAPER 0: CLS
30 DIM M$(21,39)
40 FOR R=1 TO 21: READ M$(R): NEXT R
50 PEN 2: PRINT AT 0,21;"REACH E - KEYS 6 7 8 9"
60 PEN 1: FOR R=1 TO 21: PRINT AT R,12;M$(R): NEXT R
70 LET PX=2: LET PY=2
80 PEN 3: PRINT AT PY,PX+11;"O"
90 DO
100 LET K$=INKEY$
110 LET NX=PX: LET NY=PY
120 IF K$="6" THEN LET NX=PX-1
130 IF K$="7" THEN LET NX=PX+1
140 IF K$="9" THEN LET NY=PY-1
150 IF K$="8" THEN LET NY=PY+1
160 IF NX<>PX OR NY<>PY
170 IF M$(NY,NX)<>"#"
180 PEN 1: PRINT AT PY,PX+11;" "
190 LET PX=NX: LET PY=NY
200 PEN 3: PRINT AT PY,PX+11;"O"
210 END IF
220 REM one press is one cell: wait for the key to come back up
230 DO WHILE INKEY$<>""
240 LOOP
250 END IF
260 EXIT IF M$(PY,PX)="E"
270 LOOP
280 PEN 2: PRINT AT 0,21;"YOU ESCAPED!          "
290 PAUSE 0
300 DATA "#######################################"
310 DATA "#       #                 #     #     #"
320 DATA "####### ### ########### # # # ### ### #"
330 DATA "#     #   #   #       # #   # #   #   #"
340 DATA "# ### ### ##### ##### # ####### ### # #"
350 DATA "#   #   # #     #   # # #         # # #"
360 DATA "##### ### # ##### ### # # ######### # #"
370 DATA "#     #   # #   #     #   #       # # #"
380 DATA "# ##### ### # # # ##### ### ##### # # #"
390 DATA "# #   #     # # # #   # # # #     # # #"
400 DATA "# # # ####### # # # ### # # ##### # # #"
410 DATA "#   #         # # #     # #     #   # #"
420 DATA "# ############# # # ##### ##### ##### #"
430 DATA "# #     #       # #   #   #     #   # #"
440 DATA "# # ### # ### ### ### # # # ##### ### #"
450 DATA "# #   #   #   #   #     # # #   #   # #"
460 DATA "# ### ######### ########### # ### # # #"
470 DATA "#   #           #     #   # # #   #   #"
480 DATA "### ############# ### # # # # # #######"
490 DATA "#                 #     #   #         E"
500 DATA "#######################################"
