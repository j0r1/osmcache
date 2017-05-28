vex.defaultOptions.className = 'vex-theme-top';

var g_noSleep = new NoSleep();
var g_wakeLockEnabled = false;

var g_view = new ol.View({ center: [0, 0], zoom: 17 });
var g_map = null;
var g_lastImmediateLonLat = null;
var g_lastCenter = null;
var g_lastLonLat = null;
var g_lastRotAng = null;
var g_earthSphere = new ol.Sphere(6378137);
var g_lineString = new ol.geom.LineString([]);
var g_curPoint = new ol.geom.Circle([0,0],10);
var g_pathFeature = new ol.Feature({ geometry: g_lineString });
var g_pointFeature = new ol.Feature({ geometry: g_curPoint });
var g_trailLine = new ol.geom.LineString([], []);
var g_trailFeature = new ol.Feature({ geometry: g_trailLine });
var g_trailEnd = null;

var g_followEnabled = true;

g_trailFeature.setStyle(new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: "#0000AA",
        width: 4,
    }),
}));
g_pointFeature.setStyle(new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: "#AA0000",
        width: 4,
    }),
}));
g_pathFeature.setStyle(new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: "#00AA00",
        width: 4,
    }),
}));


function setTargetCoords()
{
    getCoordsDialog('Enter target latitude/longitude', function(lat, lon)
    {
        if (lat === undefined && lon === undefined)
            g_trailEnd = null;
        else if (lat !== undefined && lon !== undefined)
            g_trailEnd = [ lon, lat ];

        if (g_lastImmediateLonLat) // call positionCallback with last received coords again, to update view
            setTimeout(function() { positionCallback(g_lastImmediateLonLat[0], g_lastImmediateLonLat[1]); }, 0);
    });
}

function startPrefetch(lat, lon, radius, cutoffLevel)
{
    // Determine the tiles to download

    // Helper functions from http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon..2Flat._to_tile_numbers_2
    function num2deg(xtile, ytile, zoom)
    {
        var n = 1 << zoom;
        var lon_deg = xtile/n * 360.0 - 180.0;
        var lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ytile / n)));
        var lat_deg = lat_rad * 180.0/Math.PI;
        return { N: lat_deg, E: lon_deg };
    }

    function deg2num(lat_deg, lon_deg, zoom)
    {
        var lat_rad = lat_deg/180.0 * Math.PI;
        var n = 1 << zoom;
        var xtile = Math.floor((lon_deg + 180.0) / 360.0 * n);
        var ytile = Math.floor((1.0 - Math.log(Math.tan(lat_rad) + (1 / Math.cos(lat_rad))) / Math.PI) / 2.0 * n);
        return { X: xtile, Y: ytile };
    }

    function clip(x)
    {
        if (x < -85.0) x = -85.0;
        else if (x > 85.0) x = 85.0;
        return x;
    }

    function wrap(x)
    {
        if (x < -180.0) x += 360.0;
        else if (x > 180.0) x -= 360.0;
        return x;
    }

    var maxZ = 19;
    var XY = deg2num(lat, lon, maxZ);
    var NE = num2deg(0.5 + XY.X, 0.5 + XY.Y, maxZ);
    var NE1 = num2deg(1.5 + XY.X, 1.5 + XY.Y, maxZ);

    var dNtile = Math.abs(NE1.N-NE.N);
    var dEtile = Math.abs(NE1.E-NE.E);

    var rMeter = radius;
    var rEarth = 6378137;
    var dN = (rMeter/rEarth) * (180.0/Math.PI);
    var dE = (rMeter/(rEarth*Math.cos(NE.N*Math.PI/180.0))) * (180.0/Math.PI);

    var tilesToDownload = { };

    for (var z = maxZ ; z > 0 ; z--)
    {
        tilesToDownload[z] = { };
        tilesToDownload[z]["X"] = { };
        tilesToDownload[z]["Y"] = { };
    }

    var i = 0;
    while (i*dNtile < dN)
    {
        for (var z = maxZ ; z > 0 ; z--)
        {
            XY = deg2num(clip(NE.N+i*dNtile), NE.E, z);
            tilesToDownload[z]["Y"][XY.Y] = true;
            XY = deg2num(clip(NE.N-i*dNtile), NE.E, z)
            tilesToDownload[z]["Y"][XY.Y] = true;
        }
        i += 1;
    }

    i = 0;
    while (i*dEtile < dE)
    {
        for (var z = maxZ ; z > 0 ; z--)
        {
            XY = deg2num(NE.N, wrap(NE.E+i*dEtile), z);
            tilesToDownload[z]["X"][XY.X] = true;
            XY = deg2num(NE.N, wrap(NE.E-i*dEtile), z);
            tilesToDownload[z]["X"][XY.X] = true;
        }
        i += 1;
    }

    var numTiles = 0;
    for (var z = 1 ; z <= cutoffLevel ; z++)
        numTiles += Object.keys(tilesToDownload[z].X).length * Object.keys(tilesToDownload[z].Y).length;

    vex.dialog.confirm({
        message: 'This will download ' + numTiles + ' tiles. Continue?',
        callback: function (value) 
        {
            if (!value)
                return;

            downloadTiles(tilesToDownload, cutoffLevel);
        }
    });
}

var g_osmServers = [ 
    "http://a.tile.openstreetmap.org/", 
    "http://b.tile.openstreetmap.org/",
    "http://c.tile.openstreetmap.org/"
];

function startDownloader(retObj, tileList)
{
    var increaseCount = function()
    {
        retObj._numprocessed++;
        if (retObj._numprocessed >= retObj._numtotal)
            retObj.isdone = true;

        if (retObj._numprocessed < retObj._numtotal && !retObj.cancelled) // need to continue
            setTimeout(f, 0);

        var n = retObj._numprocessed;
        if (retObj.onnumtiles)
            setTimeout(function() { retObj.onnumtiles(n); }, 0);
    }

    // Start async
    var f = function()
    {
        if (tileList.length == 0) // nothing to do
            return;

        var tileInfo = tileList.pop();
        
        // Note that X and Y names are swapped here. TODO: fix all this
        getCachedTile(tileInfo.Z, tileInfo.X, tileInfo.Y, function(blob)
        {
            if (blob) // Entry already exists
            {
                increaseCount();
            }
            else // Download it
            {
                var xhr = new XMLHttpRequest();
                var server = g_osmServers[Math.floor(g_osmServers.length*Math.random())];
                var url = server + tileInfo.Z + "/" + tileInfo.X + "/" + tileInfo.Y + ".png";

                xhr.open("GET", url, true);
                xhr.responseType = "blob";
                xhr.addEventListener("load", function () 
                {
                    // TODO: log errors? Do something different?
                    increaseCount();

                    if (xhr.status == 200) // Note that X and Y names are swapped here. TODO: fix all this
                        storeCachedTile(tileInfo.Z, tileInfo.X, tileInfo.Y, xhr.response);

                }, false);
                xhr.send();
            }
        });
    };

    setTimeout(f, 0); // Start it
}

function downloadTilesInternal(tilesToDownload, cutoffLevel)
{
    var ret = { 
        cancelled: false, 
        isdone: false,
        onnumtiles: null,
        _numprocessed: 0, 
        _numtotal: 0
    };
    
    // build a list of tiles to download
    var tileList = [ ];

    for (var z = 1 ; z <= cutoffLevel ; z++)
    {
        var xPosList = Object.keys(tilesToDownload[z].X);
        var yPosList = Object.keys(tilesToDownload[z].Y);

        for (var i = 0 ; i < yPosList.length ; i++)
            for (var j = 0 ; j < xPosList.length ; j++)
                tileList.push({ Z: z, X: xPosList[j], Y:yPosList[i]})
    }
    ret._numtotal = tileList.length;

    var numDownloaders = 10; // TODO: what's a good value? make this configurable?
    for (var i = 0 ; i < numDownloaders ; i++)
        startDownloader(ret, tileList);

    return ret;
}

function downloadTiles(tilesToDownload, cutoffLevel)
{
    var numTiles = 0;
    for (var z = 1 ; z <= cutoffLevel ; z++)
        numTiles += Object.keys(tilesToDownload[z].X).length * Object.keys(tilesToDownload[z].Y).length;

    var r = downloadTilesInternal(tilesToDownload, cutoffLevel);

    var dlg = vex.dialog.open(
    {
        input: [ 
            "<h3>Downloading tiles</h3>",
            "Downloaded <span id='spntilesdownloaded'>0</span>/" + numTiles + " tiles" 
        ].join("\n"),
        buttons : [{
            text: 'Cancel',
            type: 'button',
            className: 'vex-dialog-button-secondary',
            click: function() 
            {
              this.value = false;
              return this.close();
            }
        }],
        callback: function(data)
        {
            console.log(data);
            r.cancelled = true;
        }
    });

    r.onnumtiles = function(n)
    {
        $("#spntilesdownloaded").text("" + n);
        if (r.isdone)
            dlg.close();
    }
}

function prefetchTiles()
{
    getCoordsDialog('Enter prefetch latitude/longitude', function(lat, lon)
    {
        if (!(lat !== undefined && lon !== undefined))
            return;
        
        // TODO: make max level and radius configurable?
        startPrefetch(lat, lon, 5000, 17);
    });
}

function getCoordsDialog(title, newLatLonCallback)
{
    function fillZeros(x, num)
    {
        x = ""+x;
        while (x.length < num)
            x = "0" + x;
        return x;
    }

    function getCoordText(x)
    {
        var signTxt = "";
        if (x < 0)
        {
            signTxt = "-";
            x = -x;
        }
        
        var deg = Math.floor(x);
        var minFloat = (x-deg)*60.0;
        var min = Math.floor(minFloat);
        var thousands = Math.round((minFloat - min)*1000.0);

        var s = signTxt + deg + " " + fillZeros(min,2) + "." + fillZeros(thousands, 3);
        return s;
    }

    function setCoords(lonLat)
    {
        var lat = lonLat[1];
        var lon = lonLat[0];
        $("#inp_lat").val(getCoordText(lat));
        $("#inp_lon").val(getCoordText(lon));
    }

    function parseLatLon(txt)
    {
        txt = $.trim(txt);
        var parts = txt.split(" ");
        console.log(parts);

        if (parts.length > 3)
            return undefined;
        
        var x = 0;
        var i = parts.length-1;
        while (i >= 0)
        {
            x /= 60.0;
            x += parseFloat(parts[i]);
            i--;
        }
        if (x != x)
            return undefined;

        return x;
    }

    vex.dialog.open(
    {
        input: [ 
            '<h3>' + title + '</h3>',
            '<input type="text" id="inp_lat"><br>',
            '<input type="text" id="inp_lon"><br>',
        ].join("\n"),
        buttons: [
        {
            text: 'OK',
            type: 'submit',
            className: 'vex-dialog-button-primary'
        },
        {
            text: 'Cancel',
            type: 'button',
            className: 'vex-dialog-button-secondary',
            click: function() 
            {
              this.value = false;
              return this.close();
            }
        },
        {
            text: 'Cur',
            type: 'button',
            className: 'vex-dialog-button-secondary',
            click: function()
            {
                var center = g_view.getCenter();
                var lonlat = ol.proj.toLonLat(center, g_view.getProjection().getCode());
                setCoords(lonlat);
            }
        }],
        afterOpen: function()
        {
            if (g_trailEnd)
                setCoords(g_trailEnd);
            else
            {
                var center = g_view.getCenter();
                var lonlat = ol.proj.toLonLat(center, g_view.getProjection().getCode());
                setCoords(lonlat);
            }
        },
        callback: function(data)
        {
            if (data === false)
                return;

            var lat = parseLatLon($("#inp_lat").val());
            var lon = parseLatLon($("#inp_lon").val());

            newLatLonCallback(lat, lon);
        }
    });
}

function disableFollow()
{
    g_followEnabled = false;
}

function enableFollow()
{
    g_followEnabled = true;

    var obj = { }
    
    if (g_lastCenter)
        obj.center = g_lastCenter;
    if (g_lastRotAng)
        obj.rotation = g_lastRotAng;

    g_view.animate(obj);
}

function positionCallback(lon, lat)
{
    var newLonLat = [ lon, lat ];
	var newCenter = ol.proj.fromLonLat(newLonLat, g_view.getProjection().getCode());
    g_lastImmediateLonLat = newLonLat;

    g_curPoint.setCenter(newCenter);
    if (g_trailEnd)
    {
        g_trailLine.setCoordinates([newCenter, ol.proj.fromLonLat(g_trailEnd, g_view.getProjection().getCode())]);
        var dist = g_earthSphere.haversineDistance(newLonLat, g_trailEnd);
        dist = Math.round(dist);
        $("#spndist").text("" + dist + " meter");
        $("#spndistwrap").show();
    }
    else
    {
        g_trailLine.setCoordinates([]);
        $("#spndistwrap").hide();
    }
    if (g_lastLonLat != null)
    {
        var dist = g_earthSphere.haversineDistance(g_lastLonLat, newLonLat);
        //console.log(dist);
        if (dist > 10.0) // try to avoid GPS coord jumps to modifiy the orientation
        {
            var dx = newCenter[0] - g_lastCenter[0];
            var dy = newCenter[1] - g_lastCenter[1];
            var angle = 0;

            if (dx*dx < 1e-10) // nearly zero
            {
                if (dy > 0)
                    angle = Math.PI*0.5;
                else
                    angle = -Math.PI*0.5;
            }
            else
            {
                var r = Math.sqrt(dx*dx+dy*dy);
                var c = dx/r;

                angle = Math.acos(c);
                if (dy < 0)
                    angle = 2.0*Math.PI-angle;

                //console.log(angle*180.0/Math.PI);
            }

            var rotAng = 3.0*Math.PI*0.5+angle;
            while (rotAng > Math.PI)
                rotAng -= 2.0*Math.PI;
            while (rotAng < -Math.PI)
                rotAng += 2.0*Math.PI;

            if (g_followEnabled)
                g_view.animate({ rotation: rotAng, center: newCenter });
            g_lineString.appendCoordinate(newCenter);

            g_lastRotAng = rotAng;
            g_lastLonLat = newLonLat;
            g_lastCenter = newCenter;
        }
    }
    else
    {
        g_lastLonLat = newLonLat;
        g_lastCenter = newCenter;
        g_view.setCenter(newCenter);
        g_lineString.appendCoordinate(newCenter);
    }

}

function positionError(errCode, errMsg)
{
    var msg = 'ERROR(' + errCode + '): ' + errMessage;
    console.warn(msg);
    alert(msg);
}

var g_db = null;
var g_hit = 0;
var g_miss = 0;

if (location.hash == "#cleardb")
    indexedDB.deleteDatabase("osmcachedatabase");

(function()
{
    var r = indexedDB.open("osmcachedatabase", 1);
    r.onsuccess = function()
    {
        console.log("got database");
        g_db = r.result;
    }
    r.onupgradeneeded = function(event) 
    {
        console.log("onupgradeneeded");
        var db = event.target.result;
        var objectStore = db.createObjectStore("tilecache", { keyPath: "zyx" });
    }
})();

function updateHitMiss()
{
    $("#spnhit").text("" + g_hit);
    $("#spnmiss").text("" + g_miss);
}

function getCachedTile(z, y, x, callback)
{
    var idxStr = "" + z +"_" + y + "_" + x;

    if (!g_db)
        setTimeout(function() { callback(null); }, 0);
    else
    {
        var transaction = g_db.transaction(["tilecache"], "readonly");
        var r = transaction.objectStore("tilecache").get(idxStr);
        r.onsuccess = function(evt)
        {
            var blob = null;
            var obj = evt.target.result;
            if (!obj)
                blob = null;
            else
            {
                blob = obj.blob;
                console.log("Retrieved blob for " + idxStr);
                console.log(blob);
            }
            setTimeout(function() { callback(blob); }, 0);
        }
        r.onerror = function(evt)
        {
            console.log("Error getting " + idxStr + " from cache");
            console.log(evt);
            setTimeout(function() { callback(null); }, 0);
        }
    }
}

function storeCachedTile(z, y, x, blob)
{
    var idxStr = "" + z +"_" + y + "_" + x;

    if (!g_db) // TODO: try again later?
        return;

    var transaction = g_db.transaction(["tilecache"], "readwrite");
    var r = transaction.objectStore("tilecache").put({blob: blob, zyx: idxStr});
    r.onsuccess = function()
    {
        console.log("Saved " + idxStr + " in database");
    }
    r.onerror = function(evt)
    {
        console.log("Couldn't save " + idxStr + " in database");
        console.log(evt);
    }
}

function setImageTileFromBlob(imageTile, blob)
{
    var imgURL = URL.createObjectURL(blob);
    imageTile.getImage().src = imgURL;
}

function tileLoadFunction(imageTile, src)
{
    var parts = src.split("//")[1].split("/");
    var z = parseInt(parts[1]);
    var y = parseInt(parts[2]);
    var x = parseInt(parts[3].split(".")[0]);
    //console.log("" + z + " " + y + " " + x);

    getCachedTile(z, y, x, function(blob)
    {
        if (blob)
        {
            g_hit++;

            setImageTileFromBlob(imageTile, blob);
        }
        else
        { 
            g_miss++;

            var xhr = new XMLHttpRequest();

            xhr.open("GET", src, true);
            xhr.responseType = "blob";
            xhr.addEventListener("load", function () 
            {
                if (xhr.status == 200)
                {
                    setImageTileFromBlob(imageTile, xhr.response);
                    storeCachedTile(z, y, x, xhr.response);
                }
            }, false);
            xhr.send();
        }
        updateHitMiss();
    });
}

function main()
{
    g_map = new ol.Map({
        layers: [ new ol.layer.Tile({ source: new ol.source.OSM({tileLoadFunction:tileLoadFunction}) }), 
                  new ol.layer.Vector({ source: new ol.source.Vector({features: [g_pathFeature, g_pointFeature,
                                                                                 g_trailFeature] }) })
        ],
        target: 'map',
        view: g_view,
        renderer: 'webgl',
        loadTilesWhileAnimating: true,
        preload: 4,
        interactions: ol.interaction.defaults({doubleClickZoom :false}),
    });

    g_map.on('pointerdrag', disableFollow);
    g_map.on('dblclick', function() { setTimeout(setTargetCoords, 1000); });

    var geo = new GEOLocation();
    geo.onPositionError = positionError;
    geo.onSmoothedPosition = positionCallback;
}

function toggleWakeLock()
{
    var elem = document.getElementById("btnwake");
    elem.innerText = "Testing...";

    try
    {
        if (!g_wakeLockEnabled)
            g_noSleep.enable();
        else
            g_noSleep.disable();

        g_wakeLockEnabled = !g_wakeLockEnabled;

        if (g_wakeLockEnabled)
            elem.innerText = "Disable wake lock";
        else
            elem.innerText = "Enable wake lock";
    }
    catch(e)
    {
        alert("Error: " + e);
    }
}

$(document).ready(main);

window.onbeforeunload = function(e)
{
    return "Please confirm";
}


