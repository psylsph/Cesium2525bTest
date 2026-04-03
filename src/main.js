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
      { lon: 119.80, lat: 24.20, time: 0 },
      { lon: 120.00, lat: 24.35, time: 400 },
      { lon: 120.20, lat: 24.50, time: 800 },
      { lon: 120.40, lat: 24.65, time: 1200 }
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
      { lon: 121.20, lat: 24.20, time: 0 },
      { lon: 121.00, lat: 24.35, time: 400 },
      { lon: 120.80, lat: 24.50, time: 800 },
      { lon: 120.60, lat: 24.65, time: 1200 }
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
    timeline: true,
    animation: true,
    infoBox: false,
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

  viewer.timeline.zoomTo(startTime, stopTime);

  addTracksToMap(startTime);
  setupSelectionHandler();
  setupTrackingLoop();
  setupOpenSkyIntegration();
}

function getSymbolColor(type) {
  if (type === 'ownship') return 'rgb(0, 255, 0)';
  if (type === 'hostile') return 'rgb(255, 0, 0)';
  return 'rgb(0, 255, 255)';
}

function getSymbolAffiliation(type) {
  if (type === 'hostile') return 'Hostile';
  if (type === 'ownship') return 'Friend';
  return 'Friend';
}

function getAircraftAffiliation(country) {
  if (!country) return 'unknown';

  const hostileCountries = ['Russia', 'China', 'North Korea', 'Iran'];
  const friendlyCountries = ['United States', 'United Kingdom', 'France', 'Germany', 'Japan', 'South Korea', 'Taiwan', 'Australia', 'Canada'];

  if (hostileCountries.some(c => country.includes(c))) return 'hostile';
  if (friendlyCountries.some(c => country.includes(c))) return 'friendly';
  return 'unknown';
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
  });

  addOwnShipRingsAndCompass(ownShipEntity, startTime);
}

function addOwnShipRingsAndCompass(ownShipData, startTime) {
  const positions = new SampledPositionProperty();
  ownShipData.path.forEach(point => {
    const time = JulianDate.addSeconds(startTime, point.time, new JulianDate());
    positions.addSample(time, Cartesian3.fromDegrees(point.lon, point.lat));
  });

  const fixedRingRadii = [
    { meters: 5000, label: '5km' },
    { meters: 10000, label: '10km' },
    { meters: 25000, label: '25km' },
    { meters: 50000, label: '50km' },
    { meters: 100000, label: '100km' }
  ];

  fixedRingRadii.forEach((ring, index) => {
    viewer.entities.add({
      id: `range-ring-${index}`,
      polyline: {
        positions: new CallbackProperty((time) => {
          const pos = positions.getValue(time);
          if (!pos) return [];
          const cart = Ellipsoid.WGS84.cartesianToCartographic(pos);
          return createCirclePositions(cart.longitude, cart.latitude, ring.meters, 72);
        }, false),
        width: 2,
        material: index === 0 ? Color.LIME : Color.LIME.withAlpha(0.3)
      }
    });
  });

  const fixedLabelRadii = [5000, 10000, 25000, 50000, 100000];
  const labelAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];

  fixedLabelRadii.forEach((meters, ringIndex) => {
    labelAngles.forEach((angle, labelIndex) => {
      const id = `ring-label-${ringIndex}-${labelIndex}`;
      viewer.entities.add({
        id: id,
        position: new CallbackProperty((time) => {
          const pos = positions.getValue(time);
          if (!pos) return Cartesian3.ZERO;
          const cart = Ellipsoid.WGS84.cartesianToCartographic(pos);
          const d = meters / 6371000;
          const latOffset = d * Math.cos(angle);
          const lonOffset = d * Math.sin(angle) / Math.cos(cart.latitude);
          return Cartesian3.fromRadians(cart.longitude + lonOffset, cart.latitude + latOffset);
        }, false),
        label: {
          text: ringIndex === 0 || ringIndex === 2 || ringIndex === 4 ? 
            (fixedRingRadii[ringIndex].label) : '',
          font: '10px monospace',
          fillColor: Color.LIME,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.6),
          pixelOffset: new Cartesian2(0, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
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
          const startRadius = 3000;
          const endRadius = majorLine ? 60000 : 35000;
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

    if (majorLine) {
      viewer.entities.add({
        position: new CallbackProperty((time) => {
          const pos = positions.getValue(time);
          if (!pos) return Cartesian3.ZERO;
          const cart = Ellipsoid.WGS84.cartesianToCartographic(pos);
          const radius = 70000;
          return Cartesian3.fromRadians(
            cart.longitude + Math.sin(angle) * radius / 6371000,
            cart.latitude + Math.cos(angle) * radius / 6371000
          );
        }, false),
        label: {
          text: `${label.toFixed(0)}°`,
          font: 'bold 12px monospace',
          fillColor: Color.LIME,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.6),
          pixelOffset: new Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    }
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
  
  // Check if it's an OpenSky aircraft
  if (trackId.startsWith('opensky-')) {
    showOpenSkyDetails(trackId);
  } else {
    showTrackDetails(trackId);
  }
  
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
  showTrackDetails(trackId);
}

function setupTrackingLoop() {
  viewer.clock.onTick.addEventListener(() => {
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

    const trackInfo = document.getElementById('trackInfo');
    if (trackInfo && document.getElementById('trackDetails').style.display !== 'none') {
      const posEl = trackInfo.querySelector('.info-item:nth-child(8)');
      if (posEl && cartographic) {
        posEl.innerHTML = `<strong>Position:</strong> ${(cartographic.latitude * 180 / Math.PI).toFixed(4)}°, ${(cartographic.longitude * 180 / Math.PI).toFixed(4)}°`;
      }
    }
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

function showTrackDetails(trackId) {
  const track = trackData[trackId];
  if (!track) return;

  const detailsPanel = document.getElementById('trackDetails');
  const symbolCanvas = document.getElementById('symbolCanvas');
  const trackInfo = document.getElementById('trackInfo');

  const color = getSymbolColor(track.type);
  const sym = new ms.Symbol(track.sidc, { 
    size: 80, 
    monoColor: color,
    fill: true,
    civilianColor: false
  });
  const canvas = sym.asCanvas();
  
  symbolCanvas.innerHTML = '';
  symbolCanvas.appendChild(canvas);

  const entity = track.entity;
  const position = entity.position.getValue(viewer.clock.currentTime);
  const cartographic = position ? Ellipsoid.WGS84.cartesianToCartographic(position) : null;
  const displayType = track.type === 'ownship' ? 'Own Ship' : track.type.toUpperCase();

  trackInfo.innerHTML = `
    <div class="info-item"><strong>ID:</strong> ${track.id}</div>
    <div class="info-item"><strong>Name:</strong> ${track.name}</div>
    <div class="info-item"><strong>Description:</strong> ${track.description}</div>
    <div class="info-item"><strong>Type:</strong> <span class="${track.type}">${displayType}</span></div>
    <div class="info-item"><strong>Speed:</strong> ${track.speed}</div>
    <div class="info-item"><strong>SIDC:</strong> ${track.sidc}</div>
    ${cartographic ? `
      <div class="info-item"><strong>Position:</strong> ${(cartographic.latitude * 180 / Math.PI).toFixed(4)}°, ${(cartographic.longitude * 180 / Math.PI).toFixed(4)}°</div>
    ` : ''}
    <div class="info-item"><strong>Waypoints:</strong> ${track.path.length}</div>
    <div class="info-item follow-status"><strong>Tracking:</strong> ${followTrackId === trackId ? '<span class="following-indicator">YES</span>' : 'No'}</div>
  `;

  detailsPanel.style.display = 'block';
}

function showOpenSkyDetails(aircraftId) {
  const icao24 = aircraftId.replace('opensky-', '');
  const aircraft = openskyAircraft[icao24];
  const entity = openskyEntities[icao24];

  if (!aircraft || !entity) return;

  const detailsPanel = document.getElementById('trackDetails');
  const symbolCanvas = document.getElementById('symbolCanvas');
  const trackInfo = document.getElementById('trackInfo');

  const color = getSymbolColor(aircraft.affiliation === 'unknown' ? 'hostile' : aircraft.affiliation);
  const sym = new ms.Symbol(aircraft.sidc, {
    size: 80,
    monoColor: color,
    fill: true,
    civilianColor: false,
    direction: entity.properties?.heading || 0
  });
  const canvas = sym.asCanvas();

  symbolCanvas.innerHTML = '';
  symbolCanvas.appendChild(canvas);

  const position = entity.position;
  const cartographic = position ? Ellipsoid.WGS84.cartesianToCartographic(position) : null;

  const affiliationDisplay = aircraft.affiliation.toUpperCase();

  trackInfo.innerHTML = `
    <div class="info-item"><strong>ICAO24:</strong> ${icao24}</div>
    <div class="info-item"><strong>Callsign:</strong> ${aircraft.callsign || 'N/A'}</div>
    <div class="info-item"><strong>Country:</strong> ${aircraft.originCountry || 'N/A'}</div>
    <div class="info-item"><strong>Type:</strong> <span class="${aircraft.affiliation === 'unknown' ? 'hostile' : aircraft.affiliation}">${affiliationDisplay} AIRCRAFT</span></div>
    <div class="info-item"><strong>SIDC:</strong> ${aircraft.sidc}</div>
    ${entity.properties?.velocity ? `<div class="info-item"><strong>Speed:</strong> ${(entity.properties.velocity * 3.6).toFixed(0)} km/h</div>` : ''}
    ${entity.properties?.altitude ? `<div class="info-item"><strong>Altitude:</strong> ${(entity.properties.altitude * 0.3048).toFixed(0)} m</div>` : ''}
    ${entity.properties?.heading ? `<div class="info-item"><strong>Heading:</strong> ${entity.properties.heading.toFixed(0)}°</div>` : ''}
    ${entity.properties?.verticalRate ? `<div class="info-item"><strong>Vertical Rate:</strong> ${(entity.properties.verticalRate * 60 * 0.3048).toFixed(0)} m/min</div>` : ''}
    ${cartographic ? `
      <div class="info-item"><strong>Position:</strong> ${(cartographic.latitude * 180 / Math.PI).toFixed(4)}°, ${(cartographic.longitude * 180 / Math.PI).toFixed(4)}°</div>
    ` : ''}
    <div class="info-item follow-status"><strong>Live Data:</strong> <span class="following-indicator">YES</span></div>
  `;

  detailsPanel.style.display = 'block';
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
    const color = getSymbolColor(affiliation === 'unknown' ? 'hostile' : affiliation);

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

document.addEventListener('DOMContentLoaded', () => {
  initCesium();
  initTrackList();
});
