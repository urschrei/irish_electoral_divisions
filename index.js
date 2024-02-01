import 'bootstrap';
import './style.scss';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2xzMzd6NzdnMHMxejJzbWszbHA2ZGk1ZCJ9.ovSNXA6ytYytX8zlex81iA';

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
map.on("load", () => map.resize());
