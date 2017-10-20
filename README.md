Web page
--------

The web page is a web application that uses [OpenLayers](http://openlayers.org/) to
show map data from [OpenStreetMap](https://www.openstreetmap.org/). Location
tracking is used and a few simple options are available so that the page
can be used for basic [Geocaching](https://www.geocaching.com/).

The site can be found at [https://j0r1.github.io/osmcache/](https://j0r1.github.io/osmcache/).

App
---

The web page has one disadvantage: your smartphone will not keep track of the 
coordinates while it's locked. To overcome this, a [Qt](https://www.qt.io/)-based
app was created, that uses a [Qt WebView](http://doc.qt.io/qt-5/qtwebview-index.html)
component to display the web page in. It also runs a background service to keep track
of the GPS locations in the background (while the app is running).

The icon used originates from [openclipart](https://openclipart.org/detail/120607/treasure-map)

You can either compile the package yourself, or install it from the app store:
[QOsmCache](https://play.google.com/store/apps/details?id=org.jori.qosmcache&hl=en)

