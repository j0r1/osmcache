vex.defaultOptions.className = 'vex-theme-wireframe';

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
            '<h3>Select target coordinates</h3>',
            'Latitude: <input type="text" id="inp_lat"><br>',
            'Longitude: <input type="text" id="inp_lon"><br>',
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
                setCoords(g_lastImmediateLonLat);
            }
        }],
        afterOpen: function()
        {
            if (g_trailEnd)
                setCoords(g_trailEnd);
            else
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
                setTimeout(function() { positionCallback({ coords: { longitude: g_lastImmediateLonLat[0], latitude: g_lastImmediateLonLat[1] } }); }, 0);
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

function positionCallback(pos)
{
    //console.log(pos);
    //console.log([pos.coords.longitude, pos.coords.latitude]);

    var newLonLat = [ pos.coords.longitude, pos.coords.latitude ];
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

function positionError(err)
{
    var msg = 'ERROR(' + err.code + '): ' + err.message;
    console.warn(msg);
    alert(msg);
}

function main()
{
    g_map = new ol.Map({
        layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }), 
                  new ol.layer.Vector({ source: new ol.source.Vector({features: [g_pathFeature, g_pointFeature,
                                                                                 g_trailFeature] }) })
        ],
        target: 'map',
        view: g_view,
        renderer: 'webgl',
        loadTilesWhileAnimating: true,
        preload: 4,
    });

    g_map.on('pointerdrag', disableFollow);

    if (!("geolocation" in navigator))
    {
        alert("Geolocation API not present");
        return;
    }

    options = {
        enableHighAccuracy: false,
        timeout: 1000,
        maximumAge: 0
    };
    
    var f = function()
    {
        var center = [5.4278813, 50.9167316];
        var radius = 0.01;
        var t = 0;

        return function()
        {
            t += 0.0005;
            return [ center[0]+radius*Math.cos(t)*((Math.random()-0.5)/100.0+1.0), 
                     center[1]+radius*Math.sin(t)*((Math.random()-0.5)/100.0+1.0) ];
        }
    }

    if (location.hostname == "localhost")
    {
        var newPosFunction = f();
        setInterval(function() {
            var p = newPosFunction();
            var obj = { coords: { longitude: p[0], latitude: p[1] } };
            //console.log("Fake pos: " + JSON.stringify(obj));
            positionCallback(obj);
        },500);
    }
    else
    {
        navigator.geolocation.watchPosition(positionCallback, positionError, options);
    }
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
