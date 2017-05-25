
var g_view = new ol.View({ center: [0, 0], zoom: 17 });
var g_map = null;
var g_lastCenter = null;
var g_lastLonLat = null;
var g_lastRotAng = null;
var g_earthSphere = new ol.Sphere(6378137);
var g_lineString = new ol.geom.LineString([]);
var g_curPoint = new ol.geom.Point([0,0]);
var g_pathFeature = new ol.Feature({ geometry: g_lineString });
var g_pointFeature = new ol.Feature({ geometry: g_curPoint });

var g_followEnabled = true;

function setTargetCoords()
{
    // TODO
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

    g_curPoint.setCoordinates(newCenter);

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
    console.warn('ERROR(' + err.code + '): ' + err.message);
}

function main()
{
    g_map = new ol.Map({
        layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }), 
                  new ol.layer.Vector({ source: new ol.source.Vector({features: [g_pathFeature, g_pointFeature ] }) })
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

$(document).ready(main);
