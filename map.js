import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
console.log("Mapbox GL JS Loaded:", mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYm1zYWt1IiwiYSI6ImNscmw2azJ1ZTBpOW8ya21pY3ZlbHZ4Y3AifQ.qeDvF7-mZ_GWsHV1CfxMCw';

const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

map.on('load', async () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    
    const bikePaint = {
        'line-color': '#32D400',
        'line-width': 5,          
        'line-opacity': 0.6 
    };

    map.addLayer({
        id: 'bike-lanes-boston',
        type: 'line',
        source: 'boston_route',
        paint: bikePaint
    });
    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: bikePaint
    });

    let jsonData;
    try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        
        // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
        
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
        
        let stations = jsonData.data.stations;
        console.log('Stations Array:', stations);

        const trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv');
        const departures = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.start_station_id,
          );
        const arrivals = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.end_station_id,
        );

        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });
        console.log(stations);

        const svg = d3.select('#map').select('svg');
        // Append circles to the SVG for each station
        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', 5)               // Radius of the circle
            .attr('fill', 'steelblue')  // Circle fill color
            .attr('stroke', 'white')    // Circle border color
            .attr('stroke-width', 1)    // Circle border thickness
            .attr('opacity', 0.8) //opacity
            .each(function(d) {
                d3.select(this)
                  .append('title')
                  .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
              });      

        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);
        // Function to update circle positions when the map moves/zooms

        function updatePositions() {
            circles
            .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
            .attr('cy', d => getCoords(d).cy) // Set the y-position using projected coordinates
            .attr('r', d => radiusScale(d.totalTraffic));  // Set the radius using traffic data
        }
        
        // Initial position update when map loads
        updatePositions();

          // Reposition markers on map interactions
        map.on('move', updatePositions);     // Update during map movement
        map.on('zoom', updatePositions);     // Update during zooming
        map.on('resize', updatePositions);   // Update on window resize
        map.on('moveend', updatePositions);  // Final adjustment after movement ends


        


    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }

});

