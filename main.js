
var g_view = new ol.View({ center: [0, 0], zoom: 14 });
var g_map = null;
var g_lastLonLat = [ 0, 0 ];

function positionCallback(pos)
{
    //console.log(pos);
    //console.log([pos.coords.longitude, pos.coords.latitude]);
    g_lastLonLat = [ pos.coords.longitude, pos.coords.latitude ];

	var newCenter = ol.proj.fromLonLat(g_lastLonLat, g_view.getProjection().getCode());
	console.log("pos.coords = (" + g_lastLonLat[0] + "," + g_lastLonLat[1] + ")");
    console.log("newCenter = (" + newCenter[0] + "," + newCenter[1] + ")");	
    g_view.setCenter(newCenter);
}

function positionError(err)
{
    console.warn('ERROR(' + err.code + '): ' + err.message);
}

function main()
{
    g_map = new ol.Map({
        layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }) ],
        target: 'map',
        view: g_view,
        renderer: 'webgl',
    });

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
    navigator.geolocation.watchPosition(positionCallback, positionError, options);

    /*
    setInterval(function() {
        console.log(g_view.getCenter());
    }, 1000);*/
}

$(document).ready(main);
