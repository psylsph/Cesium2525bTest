# AAW Scenario Demo

An interactive naval Anti-Air Warfare (AAW) scenario visualization using CesiumJS and milsymbol for military track display.

## Features

- **South China Sea Scenario** - Real-time visualization of a naval task force with HMS Queen Elizabeth carrier group under attack
- **MIL-STD-2525 Symbols** - Military unit symbols rendered using milsymbol library
- **Own Ship Display** - HMS Defender shown with range rings (5km, 10km, 25km, 50km, 100km) and compass bearing lines
- **2D/3D Mode Switching** - Toggle between 2D map and 3D globe views
- **Track Following** - Click any track to center and follow with the camera
- **Zoom Preservation** - Zoom in/out freely while following tracks
- **Timeline Animation** - Animated scenario playback with timeline controls

## Tracks

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