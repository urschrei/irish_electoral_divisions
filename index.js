import 'bootstrap';
import './style.scss';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

const accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2xzMzd6NzdnMHMxejJzbWszbHA2ZGk1ZCJ9.ovSNXA6ytYytX8zlex81iA';
const positions = ['base', 'middle', 'top'];
const divisions = ['ed', 'lea'];
const bounds = [
    [-14.471549243406628, 51.04252955091917],
    [-0.016129311437452998, 55.69861887397013]
];
const formatter = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});
let popup;

function getProperties(e) {
    const oid = e.features[0]['properties']['OBJECTID'];
    // which layer is active? ed or lea?
    const division = e.features[0].layer.id;
    const to_check = `cso-${divisions[1]}-polygons`;
    const activeLayer = division === to_check? `cso-${divisions[1]}-polygons` : `cso-${divisions[0]}-polygons`;
    // console.log(e.features[0]);
    const description = division === to_check?
        {
            'type': 'LEA',
            'county': `${e.features[0]['properties']['COUNTY']}`,
            'title': `Name: ${e.features[0]['properties']['CSO_LEA']}`,
            'id': `ID: ${e.features[0]['properties']['LEA_ID']}`,
            'median_income': `Median Income (2021): ${formatter.format(e.features[0]['properties']['MEDIAN_INCOME'])}`,
            'median_price': `Median House Price (all transactions, 2021): ${formatter.format(e.features[0]['properties']['MEDIAN_PRICE'])}`
        }:
        {
            'type': 'Electoral Division',
            'county': `${e.features[0]['properties']['COUNTY_ENGLISH']}`,
            'title': `Name: ${e.features[0]['properties']['ED_ENGLISH']}`,
            'id': `ID: ${e.features[0]['properties']['ED_ID_STR']}`
        };
    let coordinates = e.lngLat;
    // // Ensure that if the map is zoomed out such that multiple
    // // copies of the feature are visible, the popup appears
    // // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    const template = division === to_check?
        `<div class="row m-1">
            <div class="container">
                <div class="col">
                      <div class="card text-bg-secondary">
                            <div class="card-header">${description.type}</div>
                            <div class="card-body">
                                <h5 class="card-title">${description.id}</h5>
                                <h6 class="card-subtitle mb-2 text-orange text-opacity-75">${description.county}</h6>
                                <ul class="list-group list-group-flush">
                                    <li class="list-group-item">${description.title}</li>
                                    <li class="list-group-item">${description.median_income}</li>
                                    <li class="list-group-item">${description.median_price}</li>
                                </ul>
                            </div>
                      </div>
                </div>
            </div>
        </div>`:
        `<div class="row m-1">
            <div class="container">
                <div class="col">
                    <div class="card text-bg-secondary">
                        <div class="card-header">${description.type}</div>
                        <div class="card-body">
                            <h5 class="card-title">${description.id}</h5>
                            <h6 class="card-subtitle mb-2 text-orange text-opacity-75">${description.county}</h6>
                            <p class="card-text">${description.title}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    map.setPaintProperty(activeLayer, 'fill-opacity',
        ['match',
            ['get', 'OBJECTID'], oid, 0.5 , 0
        ]
    );
    popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(template)
        .addTo(map);

    updateId(description.id);
}

function cursorIn(e) {
    map.getCanvas().style.cursor = 'pointer';
}

function cursorOut(e) {
    map.getCanvas().style.cursor = '';
}

// toggle layer visibility
function toggle(on, off) {
    map.fire('closeAllPopups');
    positions.forEach((position) => {
        const ontemplate = `cso-${on}-polygons-${position}`;
        const offtemplate = `cso-${off}-polygons-${position}`;
        const offbase = `cso-${off}-polygons`;
        // required for glow effect
        const opacity = (position === 'base' || position === 'middle') ? 0.4 : 1.0;
        map.setPaintProperty(ontemplate, 'line-opacity', opacity);
        map.setPaintProperty(offtemplate, 'line-opacity', 0);
        // switch off inactive polygon layer
        map.setPaintProperty(offbase, 'fill-opacity', 0);
    });

}

// Fly to point if geolocation is successful
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
    accessToken: accessToken,
    mapboxgl: mapboxgl,
    options: {
        'placeholder': 'Address search',
        'countries': 'ie',
        'routing': false,
        'proximity': 'ip',
        'types': 'address,place,locality',
        'language': 'en'
    }
});

export const map = new mapboxgl.Map({
    accessToken: accessToken,
    container: 'map',
    style: 'mapbox://styles/urschrei/cls285qtr00ht01qqd92g58mt',
    maxBounds: bounds,
    customAttribution: ['<a href="https://www.geohive.ie/datasets/60b27acc557d4e8bb4b5a781f0622c39_1/about">Electoral Division</a> and <a href="https://www.geohive.ie/datasets/e73ec0ad02654778adca35fa86b24a5f_3/about">LEA data</a> provided by CSO'],
});

map.on('load', () => {
    // required for Bootstrap layout
    map.resize();
    // assign correct opacity duration to each layer. Quadratic, but it's six values
    positions.forEach((position) => {
        divisions.forEach((division) => {
            const template = `cso-${division}-polygons-${position}`;
            map.setPaintProperty(template, 'line-opacity-transition', {'duration': 500});
        });
    });
    divisions.forEach((division) => {
        const template = `cso-${division}-polygons`;
        map.setPaintProperty(template, 'fill-opacity-transition', {'duration': 1000});
    });
    map.addControl(geocoder);
    // make LEA active by default
    makeActive(divisions[1]);
});

// this is a custom event!
map.on('closeAllPopups', () => {
    try {
        popup.remove();
    } catch (e) {
        // swallow irrelevant error
    }
});

function updateId(id) {
// Get current URL parts
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // Update query string values
    params.set('id', id);

    // Update URL
    window.history.replaceState({}, '', `${path}?${params.toString()}${hash}`);
}

function makeActive(division) {
    const ed = divisions[0];
    const lea = divisions[1];
    if (division === ed) {
        const on = ed;
        const off = lea;
        toggle(on, off);
        registerLayerClick(on, false);
        registerLayerClick(off, true);
    }
    if (division === lea) {
        const on = lea;
        const off = ed;
        toggle(on, off);
        registerLayerClick(on, false);
        registerLayerClick(off, true);
    }
    document.getElementById(division).checked = true;
}

document.addEventListener('click', function(event) {
    const ed = divisions[0];
    const lea = divisions[1];
    switch (event.target.id) {
        case ed: {
            makeActive(ed);
            break;
        }
        case lea: {
            makeActive(lea);
            break;
        }
        case 'locate': {
            navigator.geolocation.getCurrentPosition(glSuccess, glError, {
                enableHighAccuracy: true,
                timeout: 2500
            });
            break;
        }
        default:
        // OK to do nothing
    }
});
