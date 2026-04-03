import ms from 'milsymbol';
import { Viewer, Cartesian3, Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, SceneMode, defined, JulianDate, SampledPositionProperty, Color, ClockRange, HorizontalOrigin, VerticalOrigin, Ellipsoid, CallbackProperty } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const OWN_SHIP_ID = 'destroyer_escort';

const SCENARIO_SYMBOLS = [
  {
    id: 'carrier',
    sidc: 'SFS---------D',
    name: 'HMS Queen Elizabeth',
    description: 'UK Aircraft Carrier',
    type: 'friendly',
    speed: '15 knots',
    path: [
      { lon: 114.00, lat: 12.00, time: 0 },
      { lon: 114.04, lat: 12.04, time: 600 },
      { lon: 114.08, lat: 12.08, time: 1200 },
      { lon: 114.12, lat: 12.12, time: 1800 }
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
      { lon: 113.50, lat: 11.50, time: 0 },
      { lon: 113.70, lat: 11.70, time: 400 },
      { lon: 113.90, lat: 11.90, time: 800 },
      { lon: 114.10, lat: 12.10, time: 1200 }
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
      { lon: 115.00, lat: 11.50, time: 0 },
      { lon: 114.80, lat: 11.70, time: 400 },
      { lon: 114.60, lat: 11.90, time: 800 },
      { lon: 114.40, lat: 12.10, time: 1200 }
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
      { lon: 112.50, lat: 13.00, time: 0 },
      { lon: 113.00, lat: 12.80, time: 60 },
      { lon: 113.50, lat: 12.60, time: 120 },
      { lon: 114.00, lat: 12.40, time: 180 }
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
      { lon: 115.50, lat: 12.50, time: 30 },
      { lon: 115.25, lat: 12.42, time: 60 },
      { lon: 115.00, lat: 12.33, time: 90 },
      { lon: 114.75, lat: 12.25, time: 120 }
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
      { lon: 113.90, lat: 11.90, time: 0 },
      { lon: 113.96, lat: 11.96, time: 600 },
      { lon: 114.02, lat: 12.02, time: 1200 },
      { lon: 114.08, lat: 12.08, time: 1800 }
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
    sceneMode: SceneMode.SCENE2D,
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

  viewer.clock.startTime = startTime;
  viewer.clock.stopTime = stopTime;
  viewer.clock.currentTime = startTime;
  viewer.clock.clockRange = ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 1;
  viewer.clock.shouldAnimate = true;

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(114.2, 12.0, 150000)
  });

  viewer.timeline.zoomTo(startTime, stopTime);

  addTracksToMap(startTime);
  setupSelectionHandler();
  setupTrackingLoop();
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
  showTrackDetails(trackId);
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
    viewer.trackedEntity = undefined;
    updateTrackListHighlight();
    return;
  }

  followTrackId = trackId;
  selectedTrackId = null;
  viewer.trackedEntity = trackEntities[trackId];
  
  updateTrackListHighlight();
  showTrackDetails(trackId);
}

function setupTrackingLoop() {
  let isUsingTrackedEntity = false;

  viewer.clock.onTick.addEventListener(() => {
    if (!followTrackId) {
      if (isUsingTrackedEntity) {
        isUsingTrackedEntity = false;
      }
      return;
    }

    const entity = trackEntities[followTrackId];
    if (!entity) return;

    const position = entity.position.getValue(viewer.clock.currentTime);
    if (!position) return;

    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(position);

    if (!isUsingTrackedEntity) {
      isUsingTrackedEntity = true;
      viewer.trackedEntity = entity;
    }

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

function initModeSelector() {
  const mode2dBtn = document.getElementById('mode2d');
  const mode3dBtn = document.getElementById('mode3d');

  mode2dBtn.addEventListener('click', () => {
    viewer.scene.mode = SceneMode.SCENE2D;
    mode2dBtn.classList.add('active');
    mode3dBtn.classList.remove('active');
  });

  mode3dBtn.addEventListener('click', () => {
    viewer.scene.mode = SceneMode.SCENE3D;
    mode3dBtn.classList.add('active');
    mode2dBtn.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCesium();
  initTrackList();
  initModeSelector();
});
