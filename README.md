# AAW Scenario Demo

An interactive naval Anti-Air Warfare (AAW) scenario visualization using CesiumJS and milsymbol for military track display.

## Features

- **Taiwan Strait Scenario** - Real-time visualization of a naval task force with HMS Queen Elizabeth carrier group under attack
- **MIL-STD-2525 Symbols** - Military unit symbols rendered using milsymbol library
- **Live Aircraft Tracking** - Integration with OpenSky Network API for real-time flight data (green aircraft icons)
- **Own Ship Display** - HMS Defender shown with range rings (5km, 10km, 25km, 50km, 100km) and compass bearing lines
- **3D Globe View** - Interactive 3D globe with smooth camera controls
- **Track Following** - Click any track to center and follow with the camera
- **Zoom Preservation** - Zoom in/out freely while following tracks
- **Timeline Animation** - Animated scenario playback with timeline controls

## Tracks

Taiwan Strait scenario (24.5°N, 120.5°E):

| Name | Type | Speed |
|------|------|-------|
| HMS Queen Elizabeth | Friendly | 15 knots |
| HMS Defender (Own Ship) | Own Ship | 20 knots |
| Enemy Torpedo Boat 1 | Hostile | 40 knots |
| Enemy Torpedo Boat 2 | Hostile | 40 knots |
| Enemy Strike Aircraft | Hostile | 500 knots |
| Land Attack Missile | Hostile | 550 knots |

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000/ in your browser.

### OpenSky API Configuration (Optional)

To enable live aircraft tracking with authentication:

1. Get free API credentials from https://opensky-network.org/
2. Edit `src/credentials.json`:
   ```json
   {
     "clientId": "your-username",
     "clientSecret": "your-password"
   }
   ```

**CORS Proxy**: The app uses a Vite proxy to avoid CORS issues with the OpenSky API. Requests go through `/opensky-api` which proxies to `https://opensky-network.org`

**Without credentials**: Live flights still work using anonymous API (with lower rate limits)

**Live Flight Features**:
- Green aircraft icons show real-time flights
- Click aircraft to see callsign, altitude, speed, heading
- Only loads aircraft in your current view area
- Updates every 10 seconds to avoid API overload
- Automatic cleanup of stale data

## Testing

```bash
npm run test:run
```

## Tech Stack

- **CesiumJS** - 3D/2D geospatial visualization
- **milsymbol** - MIL-STD-2525 military symbol rendering
- **Vite** - Build tool and dev server
- **Vitest** - Unit testing

## Notes

- No Cesium Ion token required (uses offline/base imagery)
- Default playback speed is 1x
- Track history lines are disabled for cleaner display
- Range rings and compass scale with zoom for readability