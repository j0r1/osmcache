#!/usr/bin/env python

import urllib2
import urllib
import sys
import math
import pprint

def sign(x):
    if x >= 0:
        return 1
    return -1

def main():
    N = int(sys.argv[1])
    Nm = float(sys.argv[2])
    E = int(sys.argv[3])
    Em = float(sys.argv[4])
    rMeter = float(sys.argv[5]);
    rEarth = 6378137;

    N = (float(abs(N)) + Nm/60.0)*sign(N)
    E = (float(abs(E)) + Em/60.0)*sign(E)

    #print N, E
    
    def num2deg(xtile, ytile, zoom):
        n = 2.0 ** zoom
        lon_deg = xtile / n * 360.0 - 180.0
        lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
        lat_deg = math.degrees(lat_rad)
        return (lat_deg, lon_deg)

    def deg2num(lat_deg, lon_deg, zoom):
        lat_rad = math.radians(lat_deg)
        n = 2.0 ** zoom
        xtile = int((lon_deg + 180.0) / 360.0 * n)
        ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
        return (xtile, ytile)

    def clip(x):
        if x < -85.0:
            x = -85.0
        elif x > 85.0:
            x = 85.0
        return x

    def wrap(x):
        if x < -180.0:
            x += 360.0
        elif x > 180.0:
            x -= 360.0
        return x

    maxZ = 19

    X, Y = deg2num(N, E, maxZ)
    N, E = num2deg(0.5 + X, 0.5 + Y, maxZ)
    N1, E1 = num2deg(1.5 + X, 1.5 + Y, maxZ)

    dNtile = abs(N1-N)
    dEtile = abs(E1-E)

    dN = (rMeter/rEarth) * (180.0/math.pi)
    dE = (rMeter/(rEarth*math.cos(N*math.pi/180.0))) * (180.0/math.pi)

    tilesToDownload = { }

    for z in range(maxZ, 0, -1):
        tilesToDownload[z] = { }
        tilesToDownload[z]["X"] = set([])
        tilesToDownload[z]["Y"] = set([])

    i = 0
    while i*dNtile < dN:
        for z in range(maxZ, 0, -1):
            X, Y = deg2num(clip(N+i*dNtile), E, z)
            tilesToDownload[z]["Y"].add(Y)
            X, Y = deg2num(clip(N-i*dNtile), E, z)
            tilesToDownload[z]["Y"].add(Y)
        i += 1

    i = 0
    while i*dEtile < dE:
        for z in range(maxZ, 0, -1):
            X, Y = deg2num(N, wrap(E+i*dEtile), z)
            tilesToDownload[z]["X"].add(X)
            X, Y = deg2num(N, wrap(E-i*dEtile), z)
            tilesToDownload[z]["X"].add(X)
        i += 1

    pprint.pprint(tilesToDownload)

    totalTiles = 0
    for z in tilesToDownload:
        totalTiles += len(tilesToDownload[z]["X"])*len(tilesToDownload[z]["Y"])

    print "Tiles to download:", totalTiles

if __name__ == "__main__":
    main()
