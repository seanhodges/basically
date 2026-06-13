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
130 FOR I%=1 TO 9:PRINT TAB(8,I%);M$(I%):NEXT
140 PRINT TAB(8,11);"REACH E TO WIN"
150 PRINT TAB(8,12);"Z X : / TO MOVE"
160 X%=2:Y%=2
170 PRINT TAB(X%+7,Y%);"O"
180 REPEAT
190 K$=INKEY$(0)
200 U%=Y%:V%=X%
210 IF K$="Z" THEN V%=X%-1
220 IF K$="X" THEN V%=X%+1
230 IF K$=":" THEN U%=Y%-1
240 IF K$="/" THEN U%=Y%+1
250 IF MID$(M$(U%),V%,1)<>"#" THEN PRINT TAB(X%+7,Y%);" ":X%=V%:Y%=U%:PRINT TAB(X%+7,Y%);"O"
260 UNTIL MID$(M$(Y%),X%,1)="E"
270 PRINT TAB(8,14);"YOU ESCAPED"
280 END
