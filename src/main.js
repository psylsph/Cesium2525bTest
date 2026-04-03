import ms from 'milsymbol';
import { Viewer, Cartesian3, Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, SceneMode, defined, JulianDate, SampledPositionProperty, Color, ClockRange, HorizontalOrigin, VerticalOrigin, Ellipsoid, CallbackProperty } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import credentials from './credentials.json';

const OWN_SHIP_ID = 'destroyer_escort';
const OPENSKY_UPDATE_INTERVAL = 10000; // Update every 10 seconds
const MIN_UPDATE_INTERVAL = 5000; // Minimum time between API calls

let openskyLastUpdate = 0;
let openskyAircraft = {};
let openskyEntities = {};

const SCENARIO_SYMBOLS = [
  {
    id: 'carrier',
    sidc: 'SFS---------D',
    name: 'HMS Queen Elizabeth',
    description: 'UK Aircraft Carrier',
    type: 'friendly',
    speed: '15 knots',
    path: [
      { lon: 120.50, lat: 24.50, time: 0 },
      { lon: 120.55, lat: 24.55, time: 600 },
      { lon: 120.60, lat: 24.60, time: 1200 },
      { lon: 120.65, lat: 24.65, time: 1800 }
    ]
  },
  {
    id: 'torpedo_boat_1',
    sidc: 'SHSP--------D',
    name: 'Enemy Torpedo Boat 1',
    description: 'Fast attack craft',
    type: 'hostile',
    speed: '40 knots',
    path: [
      { lon: 119.80, lat: 24.00, time: 0 },
      { lon: 120.00, lat: 24.15, time: 400 },
      { lon: 120.20, lat: 24.30, time: 800 },
      { lon: 120.40, lat: 24.45, time: 1200 }
    ]
  },
  {
    id: 'torpedo_boat_2',
    sidc: 'SHSP--------D',
    name: 'Enemy Torpedo Boat 2',
    description: 'Fast attack craft',
    type: 'hostile',
    speed: '40 knots',
    path: [
      { lon: 121.20, lat: 24.80, time: 0 },
      { lon: 121.00, lat: 24.65, time: 400 },
      { lon: 120.80, lat: 24.50, time: 800 },
      { lon: 120.60, lat: 24.35, time: 1200 }
    ]
  },
  {
    id: 'enemy_aircraft',
    sidc: 'SHPA--------D',
    name: 'Enemy Strike Aircraft',
    description: 'Hostile fighter-bomber',
    type: 'hostile',
    speed: '500 knots',
    path: [
      { lon: 119.00, lat: 25.00, time: 0 },
      { lon: 119.50, lat: 24.90, time: 60 },
      { lon: 120.00, lat: 24.80, time: 120 },
      { lon: 120.50, lat: 24.70, time: 180 }
    ]
  },
  {
    id: 'land_missile',
    sidc: 'SHG-UCM----D',
    name: 'Land Attack Missile',
    description: 'Cruise missile from shore battery',
    type: 'hostile',
    speed: '550 knots',
    path: [
      { lon: 121.80, lat: 24.80, time: 30 },
      { lon: 121.60, lat: 24.70, time: 60 },
      { lon: 121.40, lat: 24.60, time: 90 },
      { lon: 121.20, lat: 24.50, time: 120 }
    ]
  },
  {
    id: 'destroyer_escort',
    sidc: 'SFSP--------D',
    name: 'HMS Defender',
    description: 'Type 45 Destroyer - Own Ship',
    type: 'ownship',
    speed: '20 knots',
    path: [
      { lon: 120.30, lat: 24.30, time: 0 },
      { lon: 120.38, lat: 24.38, time: 600 },
      { lon: 120.46, lat: 24.46, time: 1200 },
      { lon: 120.54, lat: 24.54, time: 1800 }
    ]
  }
];

let viewer;
let followTrackId = null;
let selectedTrackId = null;
const trackEntities = {};
const trackData = {};

function initCesium() {
  const startTime = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
  const stopTime = JulianDate.addSeconds(startTime, 1800, new JulianDate());

  viewer = new Viewer('cesiumContainer', {
    sceneMode: SceneMode.SCENE3D,
    sceneModePicker: false,
    baseLayerPicker: true,
    geocoder: false,
    homeButton: true,
    timeline: false,
    animation: false,
    infoBox: true,
    selectionIndicator: true,
    shouldAnimate: true
  });

  viewer.camera.minimumZoomDistance = 10000;
  viewer.scene.screenSpaceCameraController.inertiaSpin = 0.5;
  viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.5;
  viewer.scene.screenSpaceCameraController.inertiaZoom = 0.5;

  viewer.clock.startTime = startTime;
  viewer.clock.stopTime = stopTime;
  viewer.clock.currentTime = startTime;
  viewer.clock.clockRange = ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 1;
  viewer.clock.shouldAnimate = true;

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(120.5, 24.5, 150000)
  });

  addTracksToMap(startTime);
  const ownShipEntity = SCENARIO_SYMBOLS.find(s => s.id === OWN_SHIP_ID);
  if (ownShipEntity) {
    addOwnShipRingsAndCompass(ownShipEntity, startTime);
  }
  setupSelectionHandler();
  setupTrackingLoop();
  setupOpenSkyIntegration();
}

function getSymbolColor(type) {
  if (type === 'ownship') return 'rgb(0, 255, 0)';
  if (type === 'hostile') return 'rgb(255, 0, 0)';
  if (type === 'unknown') return 'rgb(255, 255, 0)';
  return 'rgb(0, 255, 255)';
}

function getSymbolAffiliation(type) {
  if (type === 'hostile') return 'Hostile';
  if (type === 'ownship') return 'Friend';
  return 'Friend';
}

function getAircraftAffiliation(country) {
  if (!country) return 'unknown';

  const hostileCountries = ['China', 'Russia', 'North Korea', 'Iran'];
  const friendlyCountries = ['United States', 'United Kingdom', 'France', 'Germany', 'Japan', 'South Korea', 'Taiwan', 'Australia', 'Canada'];

  if (hostileCountries.some(c => country.includes(c))) return 'hostile';
  if (friendlyCountries.some(c => country.includes(c))) return 'friendly';
  return 'unknown';
}

function formatDistance(meters) {
  if (meters >= 100000) {
    // Very large distances - round to nearest 10km
    const km = Math.round(meters / 1000);
    return `${Math.round(km / 10) * 10}km`;
  } else if (meters >= 10000) {
    // Large distances - round to nearest 1km
    const km = meters / 1000;
    return `${Math.round(km)}km`;
  } else if (meters >= 1000) {
    // Medium distances - round to nearest 100m
    const km = meters / 1000;
    return `${(km).toFixed(1)}km`;
  } else {
    // Small distances - round to nearest 100m
    return `${Math.round(meters / 100) * 100}m`;
  }
}

function getAircraftSidc(affiliation) {
  switch (affiliation) {
    case 'hostile': return 'SHP--------D'; // Hostile Plane
    case 'friendly': return 'SFP--------D'; // Friendly Plane
    default: return 'SUP--------D'; // Unknown Plane
  }
}

function addPickableBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 1;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function addTracksToMap(startTime) {
  const ownShipEntity = SCENARIO_SYMBOLS.find(s => s.id === OWN_SHIP_ID);
  
  SCENARIO_SYMBOLS.forEach(symbolData => {
    const positions = new SampledPositionProperty();

    symbolData.path.forEach(point => {
      const time = JulianDate.addSeconds(startTime, point.time, new JulianDate());
      const position = Cartesian3.fromDegrees(point.lon, point.lat);
      positions.addSample(time, position);
    });

    const color = getSymbolColor(symbolData.type);
    const sym = new ms.Symbol(symbolData.sidc, { 
      size: 35,
      monoColor: color,
      fill: true,
      civilianColor: false,
      infoBackground: 'rgba(0,0,0,0.5)'
    });
    let canvas = sym.asCanvas();
    canvas = addPickableBackground(canvas);
    const anchor = sym.getAnchor();
    const centerOffsetX = canvas.width / 2 - anchor.x;
    const centerOffsetY = canvas.height / 2 - anchor.y;

    const entity = viewer.entities.add({
      id: `track-${symbolData.id}`,
      position: positions,
      billboard: {
        image: canvas,
        pixelOffset: new Cartesian2(centerOffsetX, centerOffsetY),
        eyeOffset: new Cartesian3(0, 0, 0),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        id: `billboard-${symbolData.id}`
      },
      properties: {
        id: symbolData.id,
        sidc: symbolData.sidc,
        name: symbolData.name,
        description: symbolData.description,
        type: symbolData.type,
        speed: symbolData.speed
      }
    });

    trackEntities[symbolData.id] = entity;
    trackData[symbolData.id] = {
      ...symbolData,
      startTime,
      entity
    };

    // Add popup description
    entity.description = generateTrackDescription(symbolData);
  });
}

function generateTrackDescription(track) {
  const displayType = track.type === 'ownship' ? 'Own Ship' : track.type.toUpperCase();
  const trackingStatus = followTrackId === track.id ? 'Active' : 'Inactive';

  return `
    <table class="cesium-infoBox-defaultTable">
      <tbody>
        <tr><th>ID</th><td>${track.id}</td></tr>
        <tr><th>Name</th><td>${track.name}</td></tr>
        <tr><th>Description</th><td>${track.description}</td></tr>
        <tr><th>Type</th><td><span style="color: ${track.type === 'friendly' ? '#00ffff' : track.type === 'ownship' ? '#00ff00' : '#ff4444'}">${displayType}</span></td></tr>
        <tr><th>Speed</th><td>${track.speed}</td></tr>
        <tr><th>SIDC</th><td>${track.sidc}</td></tr>
        <tr><th>Waypoints</th><td>${track.path.length}</td></tr>
        <tr><th>Tracking</th><td><span style="color: ${followTrackId === track.id ? '#3fb950' : '#8b949e'}">${trackingStatus}</span></td></tr>
      </tbody>
    </table>
  `;
}

function addOwnShipRingsAndCompass(ownShipData, startTime) {
  const positions = new SampledPositionProperty();
  ownShipData.path.forEach(point => {
    const time = JulianDate.addSeconds(startTime, point.time, new JulianDate());
    positions.addSample(time, Cartesian3.fromDegrees(point.lon, point.lat));
  });

  const numRings = 5;
  const ringMultipliers = [1, 2, 3, 4, 5];
  const eastAngle = Math.PI / 2; // 90 degrees (East)

  ringMultipliers.forEach((multiplier, index) => {
    viewer.entities.add({
      id: `range-ring-${index}`,
      polyline: {
        positions: new CallbackProperty((time) => {
          const pos = positions.getValue(time);
          if (!pos) return [];
          const cart = Ellipsoid.WGS84.cartesianToCartographic(pos);
          
          // Calculate base distance based on camera height (zoom level)
          const cameraHeight = viewer.camera.positionCartographic.height;
          const baseDistance = Math.max(cameraHeight * 0.1, 5000); // 10% of camera height, min 5km
          const ringRadius = baseDistance * multiplier;
          
          return createCirclePositions(cart.longitude, cart.latitude, ringRadius, 72);
        }, false),
        width: 2,
        material: index === 0 ? Color.LIME : Color.LIME.withAlpha(0.3)
      }
    });
  });

  ringMultipliers.forEach((multiplier, index) => {
    viewer.entities.add({
      id: `ring-label-${index}-east`,
      position: new CallbackProperty((time) => {
        const pos = positions.getValue(time);
        if (!pos) return Cartesian3.ZERO;
        const cart = Ellipsoid.WGS84.cartesianToCartographic(pos);
        
        // Calculate base distance based on camera height (zoom level)
        const cameraHeight = viewer.camera.positionCartographic.height;
        const baseDistance = Math.max(cameraHeight * 0.1, 5000); // 10% of camera height, min 5km
        const ringRadius = baseDistance * multiplier;
        
        const d = ringRadius / 6371000;
        const latOffset = d * Math.cos(eastAngle);
        const lonOffset = d * Math.sin(eastAngle) / Math.cos(cart.latitude);
        return Cartesian3.fromRadians(cart.longitude + lonOffset, cart.latitude + latOffset);
      }, false),
      label: {
        text: new CallbackProperty(() => {
          const cameraHeight = viewer.camera.positionCartographic.height;
          const baseDistance = Math.max(cameraHeight * 0.1, 5000);
          const ringRadius = baseDistance * multiplier;
          
          return formatDistance(ringRadius);
        }, false),
        font: '10px monospace',
        fillColor: Color.LIME,
        showBackground: true,
        backgroundColor: Color.BLACK.withAlpha(0.6),
        pixelOffset: new Cartesian2(0, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
  });

  const numBearings = 16;
  for (let i = 0; i < numBearings; i++) {
    const angle = (i / numBearings) * 2 * Math.PI;
    const label = i * 22.5;
    const majorLine = i % 4 === 0;

    viewer.entities.add({
      polyline: {
        positions: new CallbackProperty((time) => {
          const pos = positions.getValue(time);
          if (!pos) return [];
          const cart = Ellipsoid.WGS84.cartesianToCartographic(pos);
          
          // Start compass lines from outside the inner ring
          const cameraHeight = viewer.camera.positionCartographic.height;
          const baseDistance = Math.max(cameraHeight * 0.1, 5000);
          const startRadius = baseDistance;
          const endRadius = majorLine ? baseDistance * 6 : baseDistance * 3.5;
          
          return [
            Cartesian3.fromRadians(
              cart.longitude + Math.sin(angle) * startRadius / 6371000,
              cart.latitude + Math.cos(angle) * startRadius / 6371000
            ),
            Cartesian3.fromRadians(
              cart.longitude + Math.sin(angle) * endRadius / 6371000,
              cart.latitude + Math.cos(angle) * endRadius / 6371000
            )
          ];
        }, false),
        width: majorLine ? 2 : 1,
        material: Color.LIME.withAlpha(majorLine ? 0.7 : 0.35)
      }
    });

    
  }
}

function createCirclePositions(lon, lat, radiusMeters, numPoints) {
  const positions = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const d = radiusMeters / 6371000;
    const latOffset = d * Math.cos(angle);
    const lonOffset = d * Math.sin(angle) / Math.cos(lat);
    positions.push(Cartesian3.fromRadians(lon + lonOffset, lat + latOffset));
  }
  return positions;
}

function selectTrack(trackId) {
  if (followTrackId === trackId) {
    followTrackId = null;
    viewer.trackedEntity = undefined;
  }
  selectedTrackId = trackId;

  updateTrackListHighlight();
}

function setupSelectionHandler() {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  
  handler.setInputAction((click) => {
    const pickedObjects = viewer.scene.drillPick(click.position);
    
    if (pickedObjects && pickedObjects.length > 0) {
      for (const picked of pickedObjects) {
        if (picked.id && picked.id.properties) {
          const trackId = picked.id.properties.id ? picked.id.properties.id.getValue() : null;
          
          if (trackId) {
            selectTrack(trackId);
            return;
          }
          
          if (picked.id.billboard && picked.id.billboard.id) {
            const billboardId = picked.id.billboard.id;
            const trackIdFromBillboard = billboardId.replace('billboard-', '');
            selectTrack(trackIdFromBillboard);
            return;
          }
        }
      }
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((movement) => {
    const pickedObjects = viewer.scene.drillPick(movement.endPosition);
    if (pickedObjects && pickedObjects.length > 0) {
      for (const picked of pickedObjects) {
        if (picked.id && (picked.id.billboard || picked.id.polyline)) {
          document.body.style.cursor = 'pointer';
          return;
        }
      }
    }
    document.body.style.cursor = 'default';
  }, ScreenSpaceEventType.MOUSE_MOVE);
}

function toggleFollowTrack(trackId) {
  if (followTrackId === trackId) {
    followTrackId = null;
    selectedTrackId = trackId;
    updateTrackListHighlight();
    return;
  }

  const entity = trackEntities[trackId];
  const position = entity.position.getValue(viewer.clock.currentTime);

  if (!position) {
    followTrackId = trackId;
    selectedTrackId = null;
    updateTrackListHighlight();
    showTrackDetails(trackId);
    return;
  }

  const cartographic = Ellipsoid.WGS84.cartesianToCartographic(position);
  const currentHeight = viewer.camera.positionCartographic.height;
  const targetHeight = Math.max(currentHeight, 10000);

  followTrackId = trackId;
  selectedTrackId = null;

  viewer.camera.flyTo({
    destination: Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      targetHeight
    ),
    orientation: {
      heading: 0,
      pitch: -1.5707963267948966,
      roll: 0
    },
    duration: 1.0,
    convert: false
  });

  updateTrackListHighlight();
}

function setupTrackingLoop() {
  viewer.clock.onTick.addEventListener(() => {
    // Update popup descriptions for scenario tracks
    Object.keys(trackData).forEach(trackId => {
      const entity = trackEntities[trackId];
      const track = trackData[trackId];
      if (entity && track) {
        entity.description = generateTrackDescription(track);
      }
    });

    if (!followTrackId) {
      return;
    }

    const entity = trackEntities[followTrackId];
    if (!entity) return;

    const position = entity.position.getValue(viewer.clock.currentTime);
    if (!position) return;

    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(position);

    const currentHeight = viewer.camera.positionCartographic.height;
    const targetHeight = Math.max(currentHeight, 10000);

    viewer.camera.setView({
      destination: Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        targetHeight
      ),
      orientation: {
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll
      },
      convert: false
    });
  });
}

function updateTrackListHighlight() {
  const items = document.querySelectorAll('.track-item');
  items.forEach(item => {
    item.classList.remove('selected', 'following');
  });
  
  if (followTrackId) {
    const activeItem = document.querySelector(`.track-item[data-id="${followTrackId}"]`);
    if (activeItem) activeItem.classList.add('following');
  } else if (selectedTrackId) {
    const activeItem = document.querySelector(`.track-item[data-id="${selectedTrackId}"]`);
    if (activeItem) activeItem.classList.add('selected');
  }
}

function initTrackList() {
  const trackList = document.getElementById('trackList');
  
  SCENARIO_SYMBOLS.forEach(symbolData => {
    const item = document.createElement('div');
    item.className = `track-item ${symbolData.type}`;
    item.dataset.id = symbolData.id;
    
    const color = getSymbolColor(symbolData.type);
    const sym = new ms.Symbol(symbolData.sidc, { 
      size: 40, 
      monoColor: color,
      fill: true,
      civilianColor: false
    });
    const canvas = sym.asCanvas();
    
    item.innerHTML = `
      <div class="track-item-canvas"></div>
      <div class="track-item-info">
        <div class="track-name">${symbolData.name}</div>
        <div class="track-sidc">${symbolData.sidc}</div>
      </div>
    `;
    
    item.querySelector('.track-item-canvas').appendChild(canvas);
    item.addEventListener('click', () => toggleFollowTrack(symbolData.id));
    trackList.appendChild(item);
  });
}

function getCameraBounds() {
  const rectangle = viewer.camera.computeViewRectangle();
  if (!rectangle) {
    console.log('No rectangle computed from camera');
    return null;
  }

  // Handle the case where the view crosses the antimeridian
  let west = rectangle.west * 180 / Math.PI;
  let east = rectangle.east * 180 / Math.PI;
  let south = rectangle.south * 180 / Math.PI;
  let north = rectangle.north * 180 / Math.PI;

  // Normalize longitude to [-180, 180]
  if (west < -180) west += 360;
  if (west > 180) west -= 360;
  if (east < -180) east += 360;
  if (east > 180) east -= 360;

  const bounds = {
    lamin: south,
    lomin: west,
    lamax: north,
    lomax: east
  };

  console.log('Camera bounds:', bounds);
  console.log('View area covers:', {
    latitude: `${south.toFixed(2)}° to ${north.toFixed(2)}°`,
    longitude: `${west.toFixed(2)}° to ${east.toFixed(2)}°`
  });

  return bounds;
}

async function fetchOpenSkyAircraft(bounds) {
  const now = Date.now();
  if (now - openskyLastUpdate < MIN_UPDATE_INTERVAL) {
    return;
  }

  openskyLastUpdate = now;

  try {
    // Use proxy to avoid CORS issues
    let url = `/opensky-api/api/states/all?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;

    const headers = {};

    if (credentials.clientId) {
      const authString = btoa(`${credentials.clientId}:${credentials.clientSecret || ''}`);
      headers['Authorization'] = `Basic ${authString}`;
    }

    console.log('Fetching OpenSky data:', url);

    const response = await fetch(url, { headers });

    console.log('OpenSky response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log('OpenSky response time:', data.time);
    console.log('States value:', data.states);
    console.log('States is null:', data.states === null);

    // Handle null states - means no aircraft in the area
    if (data.states === null) {
      console.log('No aircraft in current view area');
      // Clean up old aircraft
      cleanupOldAircraft();
      return;
    }

    if (!Array.isArray(data.states)) {
      console.warn('Invalid OpenSky API response:', data);
      return;
    }

    console.log(`Processing ${data.states.length} aircraft`);

    updateOpenSkyAircraft(data.states);
  } catch (error) {
    console.error('Error fetching OpenSky data:', error);
  }
}

function updateOpenSkyAircraft(states) {
  const seenIds = new Set();

  states.forEach(state => {
    const [
      icao24, callsign, originCountry, timePosition,
      lastContact, longitude, latitude, baroAltitude,
      onGround, velocity, trueTrack, verticalRate,
      sensors, geoAltitude, squawk, spi, positionSource
    ] = state;

    if (!callsign || !longitude || !latitude) return;

    seenIds.add(icao24);

    const affiliation = getAircraftAffiliation(originCountry);
    const sidc = getAircraftSidc(affiliation);
    const color = getSymbolColor(affiliation);

    if (!openskyEntities[icao24]) {
      const sym = new ms.Symbol(sidc, {
        size: 25,
        monoColor: color,
        fill: true,
        civilianColor: false,
        infoBackground: 'rgba(0,0,0,0.5)',
        direction: trueTrack || 0
      });

      let canvas = sym.asCanvas();
      canvas = addPickableBackground(canvas);
      const anchor = sym.getAnchor();
      const centerOffsetX = canvas.width / 2 - anchor.x;
      const centerOffsetY = canvas.height / 2 - anchor.y;

      const entity = viewer.entities.add({
        id: `opensky-${icao24}`,
        position: Cartesian3.fromDegrees(longitude, latitude, baroAltitude || 0),
        billboard: {
          image: canvas,
          pixelOffset: new Cartesian2(centerOffsetX, centerOffsetY),
          eyeOffset: new Cartesian3(0, 0, 0),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.CENTER,
          id: `billboard-opensky-${icao24}`
        },
        properties: {
          id: `opensky-${icao24}`,
          icao24: icao24,
          callsign: callsign,
          originCountry: originCountry,
          altitude: baroAltitude,
          velocity: velocity,
          heading: trueTrack,
          verticalRate: verticalRate,
          onGround: onGround,
          type: 'opensky',
          affiliation: affiliation,
          sidc: sidc
        }
      });

      // Add click handler for this entity
      entity.description = generateOpenSkyDescription(icao24, callsign, originCountry, baroAltitude, velocity, trueTrack, verticalRate, affiliation);

      openskyEntities[icao24] = entity;
      openskyAircraft[icao24] = {
        icao24,
        callsign,
        originCountry,
        affiliation,
        sidc,
        lastUpdate: Date.now()
      };
    } else {
      const entity = openskyEntities[icao24];
      entity.position = Cartesian3.fromDegrees(longitude, latitude, baroAltitude || 0);

      // Update symbol if affiliation changed
      if (entity.properties.affiliation !== affiliation) {
        const sym = new ms.Symbol(sidc, {
          size: 25,
          monoColor: color,
          fill: true,
          civilianColor: false,
          infoBackground: 'rgba(0,0,0,0.5)',
          direction: trueTrack || 0
        });

        let canvas = sym.asCanvas();
        canvas = addPickableBackground(canvas);
        const anchor = sym.getAnchor();
        const centerOffsetX = canvas.width / 2 - anchor.x;
        const centerOffsetY = canvas.height / 2 - anchor.y;

        entity.billboard.image = canvas;
        entity.billboard.pixelOffset = new Cartesian2(centerOffsetX, centerOffsetY);

        entity.properties.affiliation = affiliation;
        entity.properties.sidc = sidc;
      }

      if (entity.properties) {
        entity.properties.callsign = callsign;
        entity.properties.altitude = baroAltitude;
        entity.properties.velocity = velocity;
        entity.properties.heading = trueTrack;
        entity.properties.verticalRate = verticalRate;
      }

      // Update description
      entity.description = generateOpenSkyDescription(icao24, callsign, originCountry, baroAltitude, velocity, trueTrack, verticalRate, affiliation);

      openskyAircraft[icao24].lastUpdate = Date.now();
    }
  });

  // Remove aircraft not seen in this update
  Object.keys(openskyEntities).forEach(icao24 => {
    if (!seenIds.has(icao24)) {
      const age = Date.now() - (openskyAircraft[icao24]?.lastUpdate || 0);
      if (age > 60000) { // Remove after 60 seconds
        viewer.entities.remove(openskyEntities[icao24]);
        delete openskyEntities[icao24];
        delete openskyAircraft[icao24];
      }
    }
  });
}

function generateOpenSkyDescription(icao24, callsign, originCountry, altitude, velocity, heading, verticalRate, affiliation) {
  const affiliationDisplay = affiliation.toUpperCase();

  return `
    <table class="cesium-infoBox-defaultTable">
      <tbody>
        <tr><th>ICAO24</th><td>${icao24}</td></tr>
        <tr><th>Callsign</th><td>${callsign || 'N/A'}</td></tr>
        <tr><th>Country</th><td>${originCountry || 'N/A'}</td></tr>
        <tr><th>Type</th><td><span style="color: ${affiliation === 'friendly' ? '#00ffff' : affiliation === 'hostile' ? '#ff4444' : '#ffff00'}">${affiliationDisplay} Aircraft</span></td></tr>
        ${velocity ? `<tr><th>Speed</th><td>${(velocity * 3.6).toFixed(0)} km/h</td></tr>` : ''}
        ${altitude ? `<tr><th>Altitude</th><td>${(altitude * 0.3048).toFixed(0)} m</td></tr>` : ''}
        ${heading ? `<tr><th>Heading</th><td>${heading.toFixed(0)}°</td></tr>` : ''}
        ${verticalRate ? `<tr><th>Vertical Rate</th><td>${(verticalRate * 60 * 0.3048).toFixed(0)} m/min</td></tr>` : ''}
        <tr><th>Data</th><td><span style="color: #3fb950;">● Live</span></td></tr>
      </tbody>
    </table>
  `;
}

function cleanupOldAircraft() {
  const now = Date.now();
  Object.keys(openskyEntities).forEach(icao24 => {
    const age = now - (openskyAircraft[icao24]?.lastUpdate || 0);
    if (age > 60000) { // Remove after 60 seconds
      viewer.entities.remove(openskyEntities[icao24]);
      delete openskyEntities[icao24];
      delete openskyAircraft[icao24];
    }
  });
}

function setupOpenSkyIntegration() {
  let updateTimer = null;
  
  viewer.camera.changed.addEventListener(() => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    
    updateTimer = setTimeout(() => {
      const bounds = getCameraBounds();
      if (bounds) {
        fetchOpenSkyAircraft(bounds);
      }
    }, 1000);
  });
  
  // Initial fetch
  setTimeout(() => {
    const bounds = getCameraBounds();
    if (bounds) {
      fetchOpenSkyAircraft(bounds);
    }
  }, 2000);
}

function initTimelineControls() {
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const timeDisplay = document.getElementById('timeDisplay');

  const updateDisplay = () => {
    if (!viewer || !viewer.clock) return;
    
    const currentTime = viewer.clock.currentTime;
    const startTime = viewer.clock.startTime;
    
    if (!currentTime || !startTime) return;
    
    const elapsedSeconds = JulianDate.secondsDifference(currentTime, startTime);
    const minutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
    const seconds = Math.floor(Math.max(0, elapsedSeconds) % 60);
    timeDisplay.textContent = `T+${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  btnPlay.addEventListener('click', () => {
    viewer.clock.shouldAnimate = true;
  });

  btnPause.addEventListener('click', () => {
    viewer.clock.shouldAnimate = false;
  });

  btnReset.addEventListener('click', () => {
    viewer.clock.currentTime = viewer.clock.startTime;
    viewer.clock.shouldAnimate = false;
    updateDisplay();
  });

  viewer.clock.onTick.addEventListener(updateDisplay);
  
  // Initial display update
  setTimeout(updateDisplay, 100);
}

document.addEventListener('DOMContentLoaded', () => {
  initCesium();
  initTrackList();
  initTimelineControls();
});
