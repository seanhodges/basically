10 REM MAZE
20 MODE 7
30 DIM M$(9)
40 M$(1)="##############"
50 M$(2)="#      #     #"
60 M$(3)="# #### # ### #"
70 M$(4)="# #    #   # #"
80 M$(5)="# # #### # # #"
90 M$(6)="# #      # # #"
100 M$(7)="# ###### # # #"
110 M$(8)="#        #   E"
120 M$(9)="##############"
130 FOR R%=1 TO 9:PROCrow(R%):NEXT
140 PRINT TAB(8,11);"REACH E TO WIN"
150 PRINT TAB(8,12);"Z X : / TO MOVE"
160 X%=2:Y%=2:F%=0:PROCplayer
170 REPEAT
180 K$=INKEY$(0)
190 U%=Y%:V%=X%
200 IF K$="Z" THEN V%=X%-1
210 IF K$="X" THEN V%=X%+1
220 IF K$=":" THEN U%=Y%-1
230 IF K$="/" THEN U%=Y%+1
240 IF (V%<>X% OR U%<>Y%) AND MID$(M$(U%),V%,1)<>"#" THEN VDU 31,7+X%,Y%,32:X%=V%:Y%=U%:PROCplayer
250 UNTIL MID$(M$(Y%),X%,1)="E"
260 PRINT TAB(8,14);CHR$(130);CHR$(136);"YOU ESCAPED!"
270 END
280 DEF PROCrow(R%)
290 LOCAL I%,L$
300 L$=""
310 FOR I%=1 TO 14
320 IF MID$(M$(R%),I%,1)="#" THEN L$=L$+CHR$(255) ELSE L$=L$+" "
330 NEXT
340 VDU 31,7,R%,150:PRINT L$;
350 IF INSTR(M$(R%),"E") THEN VDU 31,5+INSTR(M$(R%),"E"),R%,146,136,255
360 ENDPROC
370 DEF PROCplayer
380 F%=1-F%
390 VDU 31,7+X%,Y%,185+45*F%
400 ENDPROC
