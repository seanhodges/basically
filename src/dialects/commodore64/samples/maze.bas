10 REM MAZE
20 POKE 53280,0:POKE 53281,0
30 PRINT CHR$(147);
40 DIM M$(20)
50 FOR I=0 TO 20:READ M$(I):NEXT
60 SC=1024:CM=55296:CO=CM-SC
70 PRINT CHR$(154);
80 FOR R=0 TO 20:PRINT M$(R):NEXT
90 PRINT CHR$(158);"REACH E - MOVE W A S D";
100 X=1:Y=1
110 GOSUB 400
115 REM WAIT FOR KEY
120 GET K$:IF K$="" THEN 120
130 NX=X:NY=Y
140 IF K$="A" THEN NX=X-1
150 IF K$="D" THEN NX=X+1
160 IF K$="W" THEN NY=Y-1
170 IF K$="S" THEN NY=Y+1
180 IF NX<0 OR NX>38 OR NY<0 OR NY>20 THEN 120
190 T$=MID$(M$(NY),NX+1,1)
200 IF T$="#" THEN 120
210 POKE SC+40*Y+X,32
220 X=NX:Y=NY
230 GOSUB 400
240 IF T$="E" THEN 260
250 GOTO 120
260 PRINT CHR$(147);CHR$(30);"YOU ESCAPED!"
270 END
395 REM DRAW PLAYER
400 POKE SC+40*Y+X,81:POKE SC+40*Y+X+CO,7:RETURN
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
