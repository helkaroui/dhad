#!/usr/bin/env python3.5

from sys import *

def open_file(filename):
    print(filename)
    data = open(filename,"r").read()
    return data

def lex(filecontents):
    tok = ""
    state = 0
    string = ""
    filecontents = list(filecontents)
    for char in filecontents:
        tok += char
        if tok ==" ":
            tok =""
        elif tok =="اكتب":
            print("يوجد وظيفة كتابة")
            tok =""
        elif tok =="(" or tok == ")":
            tok =""
        elif tok =="\"":
            if state ==0:
                state =1
            elif state ==1:
                print("يوجد نص")
                string=""
                state = 0
        elif state ==1:
            string += char
            tok = ""

def run():
    data = open_file(argv[1])
    lex(data)

run()
