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

Controls
--------
When pressing `Menu` button on the screen, you'll see the following control buttons:

<img src="https://github.com/j0r1/osmcache/raw/master/qtapp/screenshot_controls.jpg" width="50%">

The meaning of these controls:

 - `Set target coords`: after entering a set of coordinates, a blue line will be drawn
   from the current position to these coordinates. The Distance to this target will be
   shown on the screen as well.

 - `Project target coords`: similar to the previous function, this also sets target
   coordinates and draws a line to them. Here the coordinates are based on projection
   information that's entered.

 - `Set center coords`: center the display on these coordinates.

 - `Recenter`: if shown, pressing the button will center the the display on the
   current GPS coordinates.

 - `Pre-fetch tiles`: the map downloads tiles from the [OpenStreetMap](https://www.openstreetmap.org/)
   project, but in case you won't have access to a network connection where you'll
   be needing the map, you can pre-download the necessary parts of the map with this
   function. You'll be asked to supply the center of the region for which this map info
   should be downloaded, as well as the size of the square region centered on this
   location (in meters) and the level of detail of the map parts (the 'tiles').

 - `Use only cached tiles`: if enabled, tiles will not be downloaded and only
   map tiles that have downloaded before are used.

 - `Clear cache`: this clears the cache of the previously downloaded tiles as well
   as of other settings.

 - `Enable wake lock`: if enabled, this should prevent your device from going to
   standby/sleep mode. Your mileage may vary on this one.

 - `Set UI Zoom`: the size of the controls can be changed by setting this zoom
   level.

 - `Restart geolocation`: restarts the GPS routines; may help if position updates
   seem to be stuck.

 - `Clear track & timing`: resets the recorded time, total distance and average
   velocity.

