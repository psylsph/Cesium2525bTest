# AAW Scenario Demo - Product Requirements Document

## 1. Project Overview

**Project Name:** AAW (Anti-Air Warfare) Scenario Demo  
**Project Type:** Interactive Web Mapping Application  
**Core Functionality:** Real-time visualization of a naval Anti-Air Warfare scenario in the South China Sea with military track symbols, own ship tracking, and zoom-independent range rings  
**Target Users:** Military operators, defense analysts, and training personnel

---

## 2. Technology Stack

- **CesiumJS** - 3D/2D geospatial visualization (via npm, no Ion dependency)
- **milsymbol** - MIL-STD-2525 military symbol rendering
- **Vite** - Build tool and dev server
- **Vitest** - Unit testing framework

---

## 3. UI/UX Specification

### 3.1 Layout Structure

**Main Layout:**
- Left sidebar: 380px fixed width
- Map area: Remaining viewport width
- Full viewport height

**Sidebar Sections:**
1. Header with scenario title
2. Mode selector (2D/3D toggle)
3. Legend (Friendly/Hostile/Own Ship indicators)
4. Track list (scrollable)
5. Track details panel (collapsible)

### 3.2 Visual Design

**Color Palette:**
- Background: `#0a0e17` (dark navy)
- Sidebar: `#1a1f2e` (dark slate)
- Header: `#0d1117` (near black)
- Primary accent: `#58a6ff` (bright blue)
- Text primary: `#e0e6ed` (light gray)
- Text secondary: `#8b949e` (muted gray)
- Friendly tracks: `#00ffff` (cyan)
- Hostile tracks: `#ff0000` (red)
- Own ship: `#00ff00` (lime green)
- Active/following: `#1a3a5c` (highlight blue)
- Borders: `#2d3748`, `#30363d`

**Typography:**
- Font family: 'Segoe UI', Arial, sans-serif
- Headings: 18px bold
- Body: 14px regular
- Labels/sidc: 11-12px monospace

### 3.3 Components

**Mode Selector:**
- Two buttons: "2D" and "3D"
- Active state: filled background with primary color
- Hover: slightly lighter background

**Track List Items:**
- Symbol canvas (40px)
- Name and SIDC text
- Left border color indicates type
- Hover: translate and background change
- Following state: highlighted border and glow

**Track Details Panel:**
- Large symbol preview (80px)
- Info items: ID, Name, Description, Type, Speed, SIDC, Position, Waypoints, Tracking status
- Tracking indicator: pulsing green "YES" when active

---

## 4. Functional Specification

### 4.1 Scenario Configuration

**Own Ship:**
- HMS Defender (Type 45 Destroyer)
- SIDC: `SFSP--------D` (friendly sea surface)
- Speed: 20 knots
- Initial position: 113.9°E, 11.9°N

**Friendly Units:**
- HMS Queen Elizabeth (Aircraft Carrier)
  - SIDC: `SFS---------D`
  - Speed: 15 knots

**Hostile Units:**
- Enemy Torpedo Boat 1 - 40 knots
- Enemy Torpedo Boat 2 - 40 knots  
- Enemy Strike Aircraft - 500 knots
- Land Attack Missile - 550 knots

### 4.2 Map Features

**2D/3D Mode Switching:**
- Toggle between SceneMode.SCENE2D and SceneMode.SCENE3D
- Default: 2D mode
- Buttons in sidebar control mode

**Timeline Animation:**
- 1800 second scenario duration
- Default playback speed: 1x multiplier
- Loop mode: ClockRange.LOOP_STOP
- Timeline widget visible

### 4.3 Track Selection & Following

**Selection Methods:**
- Click track in sidebar list
- Click track symbol on map

**Follow Mode:**
- Click to follow (centers camera on track)
- Click same track again to stop following
- Click different track to switch
- Zoom in/out freely while following (preserves zoom level)
- Camera automatically tracks selected entity position
- Position coordinates update in real-time in details panel

**Zoom Behavior:**
- Mouse wheel/pinch to zoom
- Zoom level preserved when selecting new track to follow
- Range rings and compass scale with zoom level

### 4.4 Own Ship Display

**Range Rings:**
- 5 concentric circles around HMS Defender
- Radii scale with camera zoom: 5k, 10k, 25k, 50k, 100k (scaled)
- Ring labels update dynamically
- Lime green color with transparency

**Compass Bearing Lines:**
- 36 lines at 10° intervals
- Major lines at 0°, 90°, 180°, 270° (thicker, more visible)
- Degree labels at major compass points
- Lines scale with zoom level
- Lime green color with transparency

### 4.5 Track Details Panel

**Displayed Information:**
- ID (track identifier)
- Name (unit name)
- Description (unit type)
- Type (FRIENDLY/HOSTILE/OWN SHIP)
- Speed (knots or knots)
- SIDC (MIL-STD-2525 symbol code)
- Position (lat/long, updates in real-time when following)
- Waypoints (number of path points)
- Tracking status (YES/No with pulsing indicator)

---

## 5. Data Handling

**Track Position Storage:**
- SampledPositionProperty for time-based interpolation
- Waypoints stored as {lon, lat, time} objects
- Position calculated for any clock time via interpolation

**Symbol Rendering:**
- milsymbol library generates canvas elements
- SIDC codes validated for 2525D standard
- monoColor property overrides default affiliation colors

---

## 6. Testing

**Test Coverage:**
- All 6 track SIDCs render correctly
- Symbol canvas generation works
- Track data integrity (unique IDs, valid coordinates)
- Scenario composition (correct unit types)
- All 41 tests passing

---

## 7. Acceptance Criteria

1. ✅ Application loads without console errors
2. ✅ Map displays in 2D mode by default with South China Sea view
3. ✅ All 6 tracks visible with correct symbols and colors
4. ✅ Clicking track in sidebar shows details panel
5. ✅ Clicking track centers and follows camera on entity
6. ✅ Zoom in/out works while following (zoom preserved)
7. ✅ Own ship (HMS Defender) has range rings that scale with zoom
8. ✅ Own ship has compass bearing lines that scale with zoom
9. ✅ 2D/3D mode toggle works
10. ✅ Timeline plays scenario at 1x speed by default
11. ✅ Track history lines removed
12. ✅ No Cesium Ion token required