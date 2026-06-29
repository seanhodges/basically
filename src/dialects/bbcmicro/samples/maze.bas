10 REM MAZE
20 MODE 7
30 PRINT TAB(0,2);CHR$(141);CHR$(134);"MAZE"
40 PRINT TAB(0,3);CHR$(141);CHR$(134);"MAZE"
50 PRINT TAB(0,8);CHR$(135);"1. KEYBOARD"
60 PRINT TAB(0,10);CHR$(135);"2. JOYSTICK"
70 SOUND 1,-15,89,4:SOUND 1,-15,117,4:SOUND 1,-15,149,8
80 M%=1
90 K$=GET$
100 IF K$="2" THEN M%=2
110 CLS
120 DIM M$(21)
130 M$(1)="#######################################"
140 M$(2)="#       #                 #     #     #"
150 M$(3)="####### ### ########### # # # ### ### #"
160 M$(4)="#     #   #   #       # #   # #   #   #"
170 M$(5)="# ### ### ##### ##### # ####### ### # #"
180 M$(6)="#   #   # #     #   # # #         # # #"
190 M$(7)="##### ### # ##### ### # # ######### # #"
200 M$(8)="#     #   # #   #     #   #       # # #"
210 M$(9)="# ##### ### # # # ##### ### ##### # # #"
220 M$(10)="# #   #     # # # #   # # # #     # # #"
230 M$(11)="# # # ####### # # # ### # # ##### # # #"
240 M$(12)="#   #         # # #     # #     #   # #"
250 M$(13)="# ############# # # ##### ##### ##### #"
260 M$(14)="# #     #       # #   #   #     #   # #"
270 M$(15)="# # ### # ### ### ### # # # ##### ### #"
280 M$(16)="# #   #   #   #   #     # # #   #   # #"
290 M$(17)="# ### ######### ########### # ### # # #"
300 M$(18)="#   #           #     #   # # #   #   #"
310 M$(19)="### ############# ### # # # # # #######"
320 M$(20)="#                 #     #   #         E"
330 M$(21)="#######################################"
340 FOR R%=1 TO 21:PROCrow(R%):NEXT
350 PRINT TAB(0,22);"REACH E TO WIN"
360 X%=2:Y%=2:F%=0:PROCplayer
370 REPEAT
380 K$=INKEY$(0)
390 U%=Y%:V%=X%
400 IF M%=1 AND (K$="Z" OR K$="z") THEN V%=X%-1
410 IF M%=1 AND (K$="X" OR K$="x") THEN V%=X%+1
420 IF M%=1 AND (K$="K" OR K$="k") THEN U%=Y%-1
430 IF M%=1 AND (K$="M" OR K$="m") THEN U%=Y%+1
440 IF M%=2 THEN PROCjoy
450 IF (V%<>X% OR U%<>Y%) AND MID$(M$(U%),V%,1)<>"#" THEN VDU 31,X%,Y%,32:X%=V%:Y%=U%:PROCplayer
460 UNTIL MID$(M$(Y%),X%,1)="E"
470 SOUND 1,-15,89,4:SOUND 1,-15,117,4:SOUND 1,-15,149,4:SOUND 1,-15,161,8
480 PRINT TAB(0,24);CHR$(130);CHR$(136);"YOU ESCAPED!"
490 END
500 DEF PROCjoy
510 IF ADVAL(1)>49152 THEN V%=X%-1
520 IF ADVAL(1)<16384 THEN V%=X%+1
530 IF ADVAL(2)>49152 THEN U%=Y%-1
540 IF ADVAL(2)<16384 THEN U%=Y%+1
550 ENDPROC
560 DEF PROCrow(R%)
570 LOCAL I%,L$
580 L$=""
590 FOR I%=1 TO 39
600 IF MID$(M$(R%),I%,1)="#" THEN L$=L$+CHR$(255) ELSE L$=L$+" "
610 NEXT
620 VDU 31,0,R%,150:PRINT L$;
630 IF INSTR(M$(R%),"E") THEN VDU 31,INSTR(M$(R%),"E")-2,R%,146,136,255
640 ENDPROC
650 DEF PROCplayer
660 F%=1-F%
670 VDU 31,X%,Y%,185+45*F%
680 ENDPROC
