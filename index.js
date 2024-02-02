import 'bootstrap';
import './style.scss';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
mapboxgl.accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2xzMzd6NzdnMHMxejJzbWszbHA2ZGk1ZCJ9.ovSNXA6ytYytX8zlex81iA';

const positions = ['base', 'middle', 'top'];
const divisions = ['ed', 'lea'];

function getProperties(e) {
    // which layer is active? ed or lea?
    const division = e.features[0].layer.id;
    const to_check = `cso-${divisions[1]}-polygons`;
    // console.log(e.features[0]);
    const description = division === to_check?
        {
            'county': `${e.features[0]['properties']['COUNTY']}`,
            'title': `Name: ${e.features[0]['properties']['CSO_LEA']}`,
            'id': `LEA ID: ${e.features[0]['properties']['LEA_ID']}`
        }:
        {
            'county': `${e.features[0]['properties']['COUNTY_ENGLISH']}`,
            'title': `Name: ${e.features[0]['properties']['ED_ENGLISH']}`,
            'id': `ED ID: ${e.features[0]['properties']['ED_ID_STR']}`
        };
    let coordinates = e.lngLat;
    // // Ensure that if the map is zoomed out such that multiple
    // // copies of the feature are visible, the popup appears
    // // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    const template = `
    <div class="row m-1">
        <div class="container">
            <div class="col">
                  <div class="card text-bg-dark">
                        <div class="card-body">
                        <h5 class="card-title">${description.id}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${description.county}</h6>
                              <p class="card-text">${description.title}</p>
                        </div>
                  </div>
            </div>
        </div>
    </div>`;

    new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(template)
        .addTo(map);
}

function cursorIn(e) {
    map.getCanvas().style.cursor = 'pointer';
}

function cursorOut(e) {
    map.getCanvas().style.cursor = '';
}

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
    elem.classList.add('btn-dark');
    elem.classList.remove('btn-outline-orange');
    elem.innerText = 'Couldn\'t geolocate you';
    elem.disabled = true;
}

// Register and unregister click handlers for the active layer
function registerLayerClick(division, reverse) {
    const tmp = `cso-${division}-polygons`;
    if (!reverse) {
        map.on('click', tmp, getProperties);
        map.on('mouseenter', tmp, cursorIn);
        map.on('mouseleave', tmp, cursorOut);
    } else {
        map.off('click', tmp, getProperties);
        map.off('mouseenter', tmp, cursorIn);
        map.off('mouseleave', tmp, cursorOut);
    }
}

const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    options: {
        'country': 'ie',
        'routing': false,
        'proximity': 'ip',
        'types': 'address',
        'language': 'en'
    }
});

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/urschrei/cls285qtr00ht01qqd92g58mt',
    customAttribution: ['<a href="https://www.geohive.ie/datasets/60b27acc557d4e8bb4b5a781f0622c39_1/about">Electoral Division</a> and <a href="https://www.geohive.ie/datasets/e73ec0ad02654778adca35fa86b24a5f_3/about">LEA data</a> provided by CSO'],
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
    map.addControl(geocoder);
    // ed is active by default
    registerLayerClick(divisions[0], false);
});

document.addEventListener('click', function(event) {
    const ed = divisions[0];
    const lea = divisions[1];
    if (event.target.id == ed) {
        const on = ed;
        const off = lea;
        toggle(on, off);
        registerLayerClick(on, false);
        registerLayerClick(off, true);
    }
    if (event.target.id == lea) {
        const on = lea;
        const off = ed;
        toggle(on, off);
        registerLayerClick(on, false);
        registerLayerClick(off, true);
    }
    if (event.target.id == 'locate') {
        navigator.geolocation.getCurrentPosition(glSuccess, glError, {
            enableHighAccuracy: true,
            timeout: 2500
        });
    }
});
