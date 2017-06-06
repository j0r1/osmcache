vex.defaultOptions.className = 'vex-theme-top';

var rEarth = 6378137;
var g_noSleep = new NoSleep();
var g_wakeLockEnabled = false;
var g_maxLevel = 19;
var g_maxAreaSize = 10000;

var g_view = null;
var g_osmSource = null;
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
var g_trackLength = 0;

var g_followEnabled = true;
var g_useCacheOnly = false;

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

function gotoCoords()
{
    getCoordsDialog('Enter starting latitude/longitude', function(lat, lon)
    {
        if (lat !== undefined && lon !== undefined)
        {
            g_view.setCenter(ol.proj.fromLonLat([lon, lat], g_view.getProjection().getCode()));
            g_followEnabled = false;
        }
    });
}

function XHRBlobDownload(url, successCallback, failCallback)
{
    //console.log("loading " + url);
    
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "blob";
    xhr.addEventListener("load", function()
    {
        if (xhr.status == 200)
            successCallback(xhr.response);
        else
        {
            var msg = "Load returned with a non 200-status: " + xhr.status;
            console.log(msg);
            if (failCallback)
                failCallback(msg);
        }
    });
    xhr.addEventListener("error", function(evt)
    {
        var msg = "Error during XMLHttpRequest";
        console.log(msg);
        console.log(evt);
        if (failCallback)
            failCallback(msg, evt);
    });
    xhr.addEventListener("abort", function(evt)
    {
        var msg = "XMLHttpRequest was aborted";
        console.log(msg);
        console.log(evt);
        if (failCallback)
            failCallback(msg, evt);
    });
    xhr.send();
}

function setProjection()
{
    function getAngleAndDistance(callback)
    {
        vex.dialog.open(
        {
            input: [ 
                'Angle (degrees from N): <input type="text" id="inp_ang" value="0"><br>',
                'Distance (meters): <input type="text" id="inp_dst" value="0"><br>',
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
            }],
            callback: function(data)
            {
                if (data === false)
                    return;

                var ang = parseFloat($("#inp_ang").val());
                var dst = parseFloat($("#inp_dst").val());

                if (ang != ang) ang = undefined;
                if (dst != dst) dst = undefined;
                callback(ang, dst);
            }
        });
    }

    getCoordsDialog('Enter starting latitude/longitude', function(lat, lon)
    {
        if (lat !== undefined && lon !== undefined)
        {
            // Ok, got starting point, now get angle and distance
            getAngleAndDistance(function(angle, distance)
            {
                if (angle !== undefined && distance !== undefined)
                {
                    if (distance > 5000) // Don't go too far
                        vex.dialog.alert("Projection distance should not exceed 5,000 meters");
                    else if (angle < 0 || angle > 360)
                        vex.dialog.alert("Projection angle should lie between 0 and 360 degrees");
                    else // Ok, calculate target
                    {
                        var alpha = (90-angle)/180.0*Math.PI;
                        var dx = distance*Math.cos(alpha);
                        var dy = distance*Math.sin(alpha);

                        var dlat = (dy/rEarth)*(180.0/Math.PI);
                        var dlon = (dx/(rEarth*Math.cos(lat*Math.PI/180.0)))*(180.0/Math.PI);

                        g_trailEnd = [ lon+dlon, lat+dlat ];

                        if (g_lastImmediateLonLat) // call positionCallback with last received coords again, to update view
                            setTimeout(function() { positionCallback(g_lastImmediateLonLat[0], g_lastImmediateLonLat[1]); }, 0);
                    }
                }
            });
        }
    });
}

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

    var maxZ = g_maxLevel;
    var XY = deg2num(lat, lon, maxZ);
    var NE = num2deg(0.5 + XY.X, 0.5 + XY.Y, maxZ);
    var NE1 = num2deg(1.5 + XY.X, 1.5 + XY.Y, maxZ);

    var dNtile = Math.abs(NE1.N-NE.N);
    var dEtile = Math.abs(NE1.E-NE.E);

    var rMeter = radius;
    var dN = (rMeter/rEarth) * (180.0/Math.PI);
    var dE = (rMeter/(rEarth*Math.cos(NE.N*Math.PI/180.0))) * (180.0/Math.PI);

    var tilesToDownload = { };

    for (var z = maxZ ; z >= 0 ; z--)
    {
        tilesToDownload[z] = { };
        tilesToDownload[z]["X"] = { };
        tilesToDownload[z]["Y"] = { };
    }

    var i = 0;
    while (i*dNtile < dN)
    {
        for (var z = maxZ ; z >= 0 ; z--)
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
        for (var z = maxZ ; z >= 0 ; z--)
        {
            XY = deg2num(NE.N, wrap(NE.E+i*dEtile), z);
            tilesToDownload[z]["X"][XY.X] = true;
            XY = deg2num(NE.N, wrap(NE.E-i*dEtile), z);
            tilesToDownload[z]["X"][XY.X] = true;
        }
        i += 1;
    }

    var numTiles = 0;
    for (var z = 0 ; z <= cutoffLevel ; z++)
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
    "//a.tile.openstreetmap.org/", 
    "//b.tile.openstreetmap.org/",
    "//c.tile.openstreetmap.org/"
];

function startDownloader(retObj, tileList, name, downloadCache)
{
    var maxErrCount = 3;
    var numStored = 0;
    var numStoreRequested = 0;

    var flushDownloadCache = function()
    {
        //console.log("Syncing " + downloadCache.length + " download cache entries");
        for (var i = 0 ; i < downloadCache.length ; i++)
        {
            var obj = downloadCache[i];
            numStoreRequested++;
            retObj.numwriterequests++;

            setTimeout(function() { retObj.onnumtiles(); }, 0);

            storeCachedTile(obj.Z, obj.Y, obj.X, obj.blob, function()
            {
                numStored++;
                retObj.numwritten++;

                setTimeout(function() { retObj.onnumtiles(); }, 0);
                //console.log("Stored " + numStored + "/" + numStoreRequested);
            });
        }
        downloadCache.length = 0;
    }

    var checkSyncDownloadCache = function()
    {
        if (downloadCache.length > 100) // TODO: make this configurable? What's a good value?
            flushDownloadCache();
    }

    var increaseCount = function()
    {
        retObj.numprocessed++;
        if (retObj.numprocessed >= retObj._numtotal)
        {
            retObj.isdone = true;
            flushDownloadCache();
        }

        if (retObj.numprocessed < retObj._numtotal && !retObj.cancelled) // need to continue
            setTimeout(f, 0);

        setTimeout(function() { retObj.onnumtiles(); }, 0);
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
                var server = g_osmServers[Math.floor(g_osmServers.length*Math.random())];
                var url = server + tileInfo.Z + "/" + tileInfo.X + "/" + tileInfo.Y + ".png";
                var startTime = performance.now();

                //console.log("" + name + ": " + url);
                XHRBlobDownload(url, function(blob)
                {
                    var elapsed = performance.now() - startTime;
                    //console.log("" + name + ": downloaded in " + (elapsed/1000) + " seconds");
                    increaseCount();
                    //storeCachedTile(tileInfo.Z, tileInfo.X, tileInfo.Y, xhr.response);
                    downloadCache.push({ 
                        Z: tileInfo.Z,
                        Y: tileInfo.X,
                        X: tileInfo.Y,
                        blob: blob
                    });
                    checkSyncDownloadCache();
                }, function(errMsg, errEvt)
                {
                    console.log("Error in XHRBlobDownload: " + errMsg);

                    tileInfo.errCount++;
                    if (tileInfo.errCount >= maxErrCount)
                    {
                        console.log("Error count exceeded for this tile");
                        // still increase the count, so that we know when all tiles are
                        // processed
                        // This also starts the download again if needed
                        increaseCount();
                        retObj.failedTiles.push(tileInfo);
                    }
                    else // retry, add it to the tile list again
                    {
                        console.log("Retrying this tile");
                        tileList.push(tileInfo);
                    }
                });
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
        numwritten: 0,
        numwriterequests: 0,
        numprocessed: 0, 
        _numtotal: 0,
        failedTiles: [],
    };
    
    // build a list of tiles to download
    var tileList = [ ];

    for (var z = 1 ; z <= cutoffLevel ; z++)
    {
        var xPosList = Object.keys(tilesToDownload[z].X);
        var yPosList = Object.keys(tilesToDownload[z].Y);

        for (var i = 0 ; i < yPosList.length ; i++)
        {
            for (var j = 0 ; j < xPosList.length ; j++)
            {
                tileList.push({ 
                    Z: z, 
                    X: xPosList[j], 
                    Y:yPosList[i],
                    errCount: 0,
                })
            }
        }
    }
    ret._numtotal = tileList.length;

    var numDownloaders = 10; // TODO: what's a good value? make this configurable?
    var downloadCache = [ ];
    for (var i = 0 ; i < numDownloaders ; i++)
        startDownloader(ret, tileList, i, downloadCache);

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
            "<h3>Downloading and storing tiles</h3>",
            "<p>Processing <span id='spntilesdownloaded'>0</span>/" + numTiles + "</p>",
            "<p>Writing <span id='spnnumtowrite'>0</span> tiles to database</p>",
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
            //console.log(data);
            r.cancelled = true;
            g_osmSource.refresh();
        }
    });

    r.onnumtiles = function()
    {
        var numProcessed = r.numprocessed;
        var numWriting = r.numwriterequests - r.numwritten;

        $("#spntilesdownloaded").text("" + numProcessed);
        $("#spnnumtowrite").text("" + numWriting);

        if (r.isdone && numWriting == 0)
        {
            dlg.close();

            if (r.failedTiles.length > 0)
            {
                setTimeout(function()
                {
                    vex.dialog.alert("Warning: unable to download " + r.failedTiles.length + " tiles");
                }, 0);
            }
        }
        //console.log("Failed tiles:");
        //console.log(r.failedTiles);
    }
}

function prefetchTiles()
{
    var radiusAndLevelDialog = function(lat, lon)
    {
        vex.dialog.open(
        {
            input: [
                'Maximum tile level: <input id="inp_lvl" type="number" size="2" step="1" min="1" max="' + g_maxLevel + '" value="17">',
                'Region size: <input id="inp_size" type="number" size="4" step="1" value="10000" min="1" max="' + g_maxAreaSize + '">',
            ].join("\n"),
            callback: function(data)
            {
                if (data === false)
                    return;

                var lvl = Math.round($("#inp_lvl").val());
                if (lvl < 1)
                    lvl = 1;
                else if (lvl > g_maxLevel)
                    lvl = g_maxLevel;

                var s = Math.round($("#inp_size").val());
                if (s < 1)
                    s = 1;
                else if (s > g_maxAreaSize)
                    s = g_maxAreaSize;
                
                startPrefetch(lat, lon, s/2.0, lvl);
            }
        });
    }

    getCoordsDialog('Enter prefetch latitude/longitude', function(lat, lon)
    {
        if (!(lat !== undefined && lon !== undefined))
            return;
        
        radiusAndLevelDialog(lat, lon);
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
        //console.log(parts);

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
            text: 'Current',
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
        $("#spndist").text("" + dist);
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

            g_trackLength += dist;
            $("#spnlength").text("" + Math.round(g_trackLength));
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

function updateHitMiss()
{
    $("#spnhit").text("" + g_hit);
    $("#spnmiss").text("" + g_miss);
}

function getCachedTile(z, y, x, callback)
{
    var idxStr = "" + z +"_" + y + "_" + x;
    g_db.getEntry(idxStr, function(blob)
    {
        //if (blob)
        //    console.log("Tile for " + idxStr + " exists in cache");

        callback(blob);
    });
}

function storeCachedTile(z, y, x, blob, callback)
{
    var idxStr = "" + z +"_" + y + "_" + x;
    g_db.storeEntry(idxStr, blob, callback);
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

    var idxStr = "" + z +"_" + y + "_" + x;

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
            var errorUrl = "generateerror:" + src;

            if (g_useCacheOnly)
            {
                imageTile.getImage().src = errorUrl; // make sure that it goes in ERROR state
            }
            else
            {
                XHRBlobDownload(src, function(blob)
                {
                    //console.log("Downloaded " + src);
                    setImageTileFromBlob(imageTile, blob);
                    storeCachedTile(z, y, x, blob);
                }, function()
                {
                    // make sure it goes into an ERROR state, so that redisplaying will
                    // attempt a reload
                    imageTile.getImage().src = errorUrl; 
                });
            }
        }
        updateHitMiss();
    });
}

function clearDatabase()
{
    vex.dialog.confirm({
        message: "Clear tile cache and reload?",
        callback: function(data)
        {
            if (!data)
                return;
            
            vex.dialog.confirm({
                message: "Are you sure?",
                callback: function(data)
                {
                    if (!data)
                        return;

                    vex.dialog.confirm({
                        message: "Are you really, really sure?",
                        callback: function(data)
                        {
                            if (!data)
                                return;

                            g_db.deleteDatabase();
                            window.onbeforeunload = null; // don't ask for further confirmation
                            location.reload();
                        }
                    });
                }
            });
        }
    });
}

function onMenu()
{
    setTimeout(function()
    {
        $(".menu").hide("slow", "swing", function()
        {
            $("#menubutton").show("slow", "swing");
        });
    },15000);

    $("#menubutton").hide("slow", "swing", function()
    {
        $(".menu").show("slow", "swing");
    });
}

function main()
{
    g_db = new DB();
    g_db.onopen = function()
    {
        $("#initiallyhidden").show();

        g_view = new ol.View({ center: [0, 0], zoom: 17 });
        g_osmSource = new ol.source.OSM({tileLoadFunction:tileLoadFunction});

        g_map = new ol.Map({
            layers: [ new ol.layer.Tile({ source: g_osmSource }), 
                      new ol.layer.Vector({ source: new ol.source.Vector({features: [g_pathFeature, g_pointFeature,
                                                                                     g_trailFeature] }) })
            ],
            target: 'map',
            view: g_view,
            //renderer: 'webgl',
            loadTilesWhileAnimating: true,
            preload: 4,
            interactions: ol.interaction.defaults({doubleClickZoom :false}),
        });

        g_map.on('pointerdrag', disableFollow);
        g_map.on('dblclick', function() { setTimeout(setTargetCoords, 1000); });

        var geo = new GEOLocation();
        geo.onPositionError = positionError;
        geo.onSmoothedPosition = positionCallback;
        geo.onImmediatePosition = function(lon, lat)
        {
            // Use the first position immediately, for quicker view update
            positionCallback(lon, lat);
            // Then, disable this again
            geo.onImmediatePosition = function() { };
        }
    }
    g_db.onopenerror = function(evt)
    {
        console.log("Error opening DB:");
        console.log(evt);
        vex.dialog.alert("Error: unable to open tile cache database");
    }
}

function toggleWakeLock()
{
    try
    {
        if (!g_wakeLockEnabled)
            g_noSleep.enable();
        else
            g_noSleep.disable();

        g_wakeLockEnabled = !g_wakeLockEnabled;

        if (g_wakeLockEnabled)
            $("#btnwake").text("Disable wake lock").addClass("reddish");
        else
            $("#btnwake").text("Enable wake lock").removeClass("reddish");
    }
    catch(e)
    {
        alert("Error: " + e);
    }
}

function toggleCacheOnly()
{
    g_useCacheOnly = !g_useCacheOnly;
    if (g_useCacheOnly)
        $("#btncacheonly").text("Use only cached tiles").addClass("reddish");
    else
        $("#btncacheonly").text("Enable tile download").removeClass("reddish");

    g_osmSource.refresh();
}

$(document).ready(main);

window.onbeforeunload = function(e)
{
    return "Please confirm";
}


