#!/bin/bash
cp ../index_allinone.html .
qmake
make -j 8
