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
- Selected state (map click): subtle border highlight (#2d3748 background, 1px border)
- Following state (sidebar click): prominent border and glow (#1a3a5c background, 2px border, stronger shadow)

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
- Click track symbol on map: highlights track and shows details (no auto-center)
- Click track in sidebar list: follows track (centers camera and tracks)

**Selected Track (Map Click):**
- Highlights track in sidebar with subtle border
- Shows track details in details panel
- Does not change camera position or zoom
- Click another track to switch selection
- Track remains selected until sidebar click or map click on different track

**Follow Mode (Sidebar Click):**
- Centers camera on track and follows movement
- Click same track again to stop following (reverts to selected state)
- Click different track to switch following
- Zoom in/out freely while following (preserves zoom level)
- Camera automatically tracks selected entity position
- Position coordinates update in real-time in details panel
- Highlights track in sidebar with prominent border and glow

**Zoom Behavior:**
- Mouse wheel/pinch to zoom
- Zoom level preserved when selecting new track to follow
- Range rings and compass scale with zoom level
- Uses `viewer.trackedEntity` for automatic camera following

### 4.4 Own Ship Display

**Range Rings:**
- 5 concentric circles around HMS Defender
- Fixed radii: 5km, 10km, 25km, 50km, 100km
- Ring labels at cardinal points (N, E, S, W)
- Lime green color with transparency
- Centered on and follows own ship position via CallbackProperty

**Compass Bearing Lines:**
- 16 lines at 22.5° intervals (N, NNE, NE, ENE, E, etc.)
- Major lines at 0°, 90°, 180°, 270° (thicker, more visible)
- Degree labels at major compass points (N, E, S, W)
- Lines scale with zoom level
- Lime green color with transparency
- Centered on and follows own ship position via CallbackProperty

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
- Coordinate conversion uses `Ellipsoid.WGS84.cartesianToCartographic()` for accurate position retrieval
- Real-time position updates in tracking loop using `viewer.clock.onTick`

**Symbol Rendering:**
- milsymbol v2 library generates canvas elements using `asCanvas()` method
- SIDC codes validated for 2525D standard
- monoColor property overrides default affiliation colors
- `fill: true` and `civilianColor: false` options for filled symbols
- Canvas offset calculation: `centerOffsetX = canvas.width/2 - anchor.x` to properly center symbols
- Nearly-transparent background (alpha 1) added to enable click detection on unfilled symbol areas

**Click Detection:**
- `scene.drillPick()` used instead of `scene.pick()` to handle transparent symbol areas
- Billboard and entity IDs custom-set for reliable track identification
- Custom IDs follow pattern: `track-{id}` for entities, `billboard-{id}` for billboards

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
4. ✅ Clicking track in sidebar centers and follows camera on entity
5. ✅ Clicking track symbol on map highlights track and shows details (no auto-center)
6. ✅ Clicking anywhere on symbol (including unfilled areas) selects the track
7. ✅ Zoom in/out works while following (zoom preserved)
8. ✅ Zoom level preserved when switching between tracked entities
9. ✅ Own ship (HMS Defender) has range rings that scale with zoom
10. ✅ Own ship has compass bearing lines that scale with zoom
11. ✅ 2D/3D mode toggle works
12. ✅ Timeline plays scenario at 1x speed by default
13. ✅ Track history lines removed
14. ✅ No Cesium Ion token required

---

## 8. Technical Implementation Notes

### 8.1 milsymbol v2 API Differences
- No `getMarker()` method - use `asCanvas()` directly on Symbol instance
- Use `getAnchor()` instead of deprecated `markerAnchor()`
- Canvas size larger than actual symbol - requires offset calculation
- `fill: true` option for filled symbols
- `civilianColor: false` to use standard affiliation colors

### 8.2 Cesium Coordinate Conversion
- Use `Ellipsoid.WGS84.cartesianToCartographic(position)` instead of `Cartesian3.toCartographic()`
- Convert radians to degrees for display: `longitude * 180/Math.PI`

### 8.3 Click Detection on Transparent Areas
- `scene.drillPick()` returns all objects at click position (not just topmost)
- Nearly-transparent background (alpha 1) makes unfilled symbol areas clickable
- Custom IDs on billboards and entities for reliable identification

### 8.4 Zoom Preservation Implementation
- Save camera state before setting `trackedEntity`
- Use `flyTo()` with 0.5s duration and 100ms delay for smooth transitions
- `convert: false` prevents double coordinate conversion
- Maintains zoom level while tracking moving entities