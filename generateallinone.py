#!/usr/bin/env python

from __future__ import print_function
import os
import sys
import urllib
import urllib2    
import cookielib            
import ssl

def downloadUrl(url):
    cookieJar = cookielib.LWPCookieJar()
    sslcontext = ssl.SSLContext(ssl.PROTOCOL_TLSv1)
    httpshandler = urllib2.HTTPSHandler(0, sslcontext)
    opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(cookieJar), httpshandler)
    headers =  {'User-agent' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.101 Safari/537.36' }

    req = urllib2.Request(url, None, headers)

    handle = opener.open(req)
    result = handle.read()
    handle.close()
    return result

def replaceUrl(url, tag, f):
    if url.startswith("https://"):
        print("Downloading {}".format(url))
        data = downloadUrl(url)
    else:
        data = open(url, "rt").read()

    f.write("<{}>\n".format(tag))
    f.write(data)
    f.write("\n</{}>\n".format(tag))

def replace(line, prefix, tag, f):
    idx = line.find(prefix)
    if idx < 0:
        raise Exception("Prefix '{}' not found in line '{}'".format(prefix, line))
    line = line[idx+len(prefix):]
    idx = line.find('"')
    if idx < 0:
        raise Exception("Closing \" not found in line '{}'".format(line))

    url = line[:idx]
    replaceUrl(url, tag, f)

def main():
    lines = open("index.html", "rt").readlines()
    with open("index_allinone.html", "wt") as f:
        for l in lines:
            if l.strip().startswith("<link "):
                replace(l, 'href="', "style", f)
            elif l.strip().startswith("<script "):
                replace(l, 'src="', "script", f)
            else:
                f.write(l)

if __name__ == "__main__":
    main()
