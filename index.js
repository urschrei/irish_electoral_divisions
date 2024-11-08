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
let di_link = new Map();
di_link.set('13260429', 'dublin-city-council/artane-whitehall');
di_link.set('13260420', 'dublin-city-council/ballymun-finglas');
di_link.set('13260422', 'dublin-city-council/ballyfermot-drimnagh');
di_link.set('13260421', 'dublin-city-council/cabra-glasnevin');
di_link.set('13260427', 'dublin-city-council/clontarf');
di_link.set('13260428', 'dublin-city-council/donaghmede');
di_link.set('13260423', 'dublin-city-council/kimmage-rathmines');
di_link.set('13260426', 'dublin-city-council/north-inner-city');
di_link.set('13260424', 'dublin-city-council/pembroke');
di_link.set('13260425', 'dublin-city-council/south-east-inner-city');
di_link.set('13260430', 'dublin-city-council/south-west-inner-city');
di_link.set('13260417', 'fingal-county-council/balbriggan');
di_link.set('13260403', 'fingal-county-council/castleknock');
di_link.set('13260404', 'fingal-county-council/howth-malahide');
di_link.set('13260402', 'fingal-county-council/blanchardstown-mulhuddart');
di_link.set('13260401', 'fingal-county-council/swords');
di_link.set('13260418', 'fingal-county-council/ongar');
di_link.set('13260400', 'fingal-county-council/rush-lusk');
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
            'raw_id': e.features[0]['properties']['LEA_ID'],
            'id': `ID: ${e.features[0]['properties']['LEA_ID']}`,
            'median_income': `Median Income (2021): ${formatter.format(e.features[0]['properties']['MEDIAN_INCOME'])}`,
            'median_price': `Median House Price (all transactions, 2021): ${formatter.format(e.features[0]['properties']['MEDIAN_PRICE'])}`
        }:
        {
            'type': 'Electoral Division',
            'county': `${e.features[0]['properties']['COUNTY_ENGLISH']}`,
            'title': `Name: ${e.features[0]['properties']['ED_ENGLISH']}`,
            'raw_id': e.features[0]['properties']['ED_ID_STR'],
            'id': `ID: ${e.features[0]['properties']['ED_ID_STR']}`
        };
    if (division === to_check) {
        makeLink(e.features[0]['properties']['LEA_ID']);
    }
    let coordinates = e.lngLat;
    // // Ensure that if the map is zoomed out such that multiple
    // // copies of the feature are visible, the popup appears
    // // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    const template = division === to_check? lea_template(description): ed_template(description);
    map.setPaintProperty(activeLayer, 'fill-opacity',
        ['match',
            ['get', 'OBJECTID'], oid, 0.5 , 0
        ]
    );
    popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(template)
        .addTo(map);

    updateId(description.raw_id);
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
        zoom: 15,
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
    makeActive(divisions[0]);
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

// Because features come from tiled vector data,
// feature geometries may be split
// or duplicated across tile boundaries.
// As a result, features may appear
// multiple times in query results.
function getUniqueFeatures(features, comparatorProperty) {
    const uniqueIds = new Set();
    const uniqueFeatures = [];
    for (const feature of features) {
        const id = feature.properties[comparatorProperty];
        if (!uniqueIds.has(id)) {
            uniqueIds.add(id);
            uniqueFeatures.push(feature);
        }
    }
    return uniqueFeatures;
}

function lea_template(description) {
    return `<div class="row m-1">
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
            </div>`;
}

function ed_template(description) {
    return `<div class="row m-1">
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

// Add a Voter Guide 24 link if it's available
function makeLink(id) {
    const trailing = di_link.get(id);
    let parent = document.getElementById('le24');
    if (trailing) {
        while (parent.firstChild) {
            parent.removeChild(parent.lastChild);
        }
        const href = `https://dublinvoterguide2024.ie/areas/${trailing}`;
        let mark = document.createElement('mark');
        let link = document.createElement('a');
        link.href = href;
        let linktext = document.createTextNode('Voter Guide 24 candidate info');
        link.appendChild(linktext);
        mark.appendChild(link);
        parent.appendChild(mark);
    } else {
        parent.textContent = '';
    }
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
