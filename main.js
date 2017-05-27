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
            '<h3>Set latitude and longitude</h3>',
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
                if (g_lastImmediateLonLat)
                    setCoords(g_lastImmediateLonLat);
            }
        }],
        afterOpen: function()
        {
            if (g_trailEnd)
                setCoords(g_trailEnd);
            else if (g_lastImmediateLonLat)
                setCoords(g_lastImmediateLonLat);
        },
        callback: function(data)
        {
            if (data === false)
                return;

            var lat = parseLatLon($("#inp_lat").val());
            var lon = parseLatLon($("#inp_lon").val());

            console.log(lat);
            console.log(lon);

            if (lat === undefined && lon === undefined)
                g_trailEnd = null;
            else if (lat !== undefined && lon !== undefined)
                g_trailEnd = [ lon, lat ];

            if (g_lastImmediateLonLat) // call positionCallback with last received coords again, to update view
                setTimeout(function() { positionCallback(g_lastImmediateLonLat[0], g_lastImmediateLonLat[1]); }, 0);
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

var g_cnvs = document.createElement("canvas");
var g_ctx = g_cnvs.getContext("2d");

function tileLoadFunction(imageTile, src)
{
    var parts = src.split("//")[1].split("/");
    var z = parseInt(parts[1]);
    var y = parseInt(parts[2]);
    var x = parseInt(parts[3].split(".")[0]);
    console.log("" + z + " " + y + " " + x);

    var xhr = new XMLHttpRequest();

    xhr.open("GET", src, true);
    xhr.responseType = "blob";
	xhr.addEventListener("load", function () 
	{
        if (xhr.status == 200)
        {
            var imgURL = URL.createObjectURL(xhr.response);
            imageTile.getImage().src = imgURL;
        }
	}, false);
	xhr.send();

    //console.log(imageTile);
    //console.log(src);
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


