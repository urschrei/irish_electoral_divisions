import 'bootstrap';
import './style.scss';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2xzMzd6NzdnMHMxejJzbWszbHA2ZGk1ZCJ9.ovSNXA6ytYytX8zlex81iA';

const positions = ['base', 'middle', 'top'];
const divisions = ['ed', 'lea'];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/urschrei/cls285qtr00ht01qqd92g58mt',
    customAttribution: ['Electoral boundary data provided courtesy of CSO. Some extents have been simplified'],
    // zoom: 11,
    // minZoom: 8,
    // center: centre,
    // maxBounds: [{
    //     'lng': -0.5533749005341804,
    //     'lat': 51.31536873314653
    // }, {
    //     'lng': 0.4214032710438005,
    //     'lat': 51.71445426713464
    // }]
});

map.on('load', () => {
    // required for Bootstrap layout
    map.resize();
    // assign correct opacity duration to each layer. Quadratic, but it's six values
    positions.forEach((position) => {
        divisions.forEach((division) => {
            const template = `cso-${division}-polygons-${position}`;
            map.setPaintProperty(template, 'line-opacity-transition', {'duration' :500, 'delay': 0});
        });
    });
});

function toggle(on, off) {
    positions.forEach((position) => {
        const ontemplate = `cso-${on}-polygons-${position}`;
        const offtemplate = `cso-${off}-polygons-${position}`;
        // required for glow effect
        const opacity = (position === 'base' || position === 'middle') ? 0.4 : 1.0;
        map.setPaintProperty(ontemplate, 'line-opacity', opacity);
        map.setPaintProperty(offtemplate, 'line-opacity', 0);
    });

}

// Locate nearest chain if geolocation is successful
function glSuccess(position) {
    const lon = position.coords.longitude;
    const lat = position.coords.latitude;
    map.flyTo({
        center: [lon, lat],
        zoom: 14,
        essential: true
    });
}

// If we can't geolocate for some reason
function glError() {
    let elem = document.getElementById('locate');
    elem.classList.add('btn-pink');
    elem.classList.remove('btn-outline-orange');
    elem.innerText = 'Couldn\'t geolocate you';
}


document.addEventListener('click', function(event) {
    const ed = divisions[0];
    const lea = divisions[1];
    if (event.target.id == 'ed') {
        const on = ed;
        const off = lea;
        toggle(on, off);
    }
    if (event.target.id == 'lea') {
        const on = lea;
        const off = ed;
        toggle(on, off);
    }
    if (event.target.id == 'locate') {
        navigator.geolocation.getCurrentPosition(glSuccess, glError, {
            enableHighAccuracy: true,
            timeout: 2500
        });
    }
});
