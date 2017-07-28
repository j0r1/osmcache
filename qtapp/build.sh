#!/bin/bash
(cd ../ ; ./generateallinone.py )
cp ../index_allinone.html .
qmake
make -j 8
