import { describe, it, expect } from 'vitest';
import ms from 'milsymbol';

const SCENARIO_SYMBOLS = [
  {
    id: 'carrier',
    sidc: 'SFS---------D',
    name: 'HMS Queen Elizabeth',
    description: 'UK Aircraft Carrier',
    type: 'friendly',
    path: [
      { lon: 114.0, lat: 12.0, time: 0 },
      { lon: 114.5, lat: 12.5, time: 60 },
      { lon: 115.0, lat: 13.0, time: 120 },
      { lon: 115.5, lat: 13.5, time: 180 }
    ]
  },
  {
    id: 'torpedo_boat_1',
    sidc: 'SHSP--------D',
    name: 'Enemy Torpedo Boat 1',
    description: 'Fast attack craft',
    type: 'hostile',
    path: [
      { lon: 113.0, lat: 11.0, time: 0 },
      { lon: 113.5, lat: 11.5, time: 45 },
      { lon: 114.0, lat: 12.0, time: 90 },
      { lon: 114.5, lat: 12.5, time: 135 }
    ]
  },
  {
    id: 'torpedo_boat_2',
    sidc: 'SHSP--------D',
    name: 'Enemy Torpedo Boat 2',
    description: 'Fast attack craft',
    type: 'hostile',
    path: [
      { lon: 116.0, lat: 10.5, time: 0 },
      { lon: 115.5, lat: 11.0, time: 45 },
      { lon: 115.0, lat: 11.5, time: 90 },
      { lon: 114.5, lat: 12.0, time: 135 }
    ]
  },
  {
    id: 'enemy_aircraft',
    sidc: 'SHPA--------D',
    name: 'Enemy Strike Aircraft',
    description: 'Hostile fighter-bomber',
    type: 'hostile',
    path: [
      { lon: 112.0, lat: 14.0, time: 0 },
      { lon: 113.0, lat: 13.5, time: 30 },
      { lon: 114.0, lat: 13.0, time: 60 },
      { lon: 115.0, lat: 12.5, time: 90 }
    ]
  },
  {
    id: 'land_missile',
    sidc: 'SHG-UCM----D',
    name: 'Land Attack Missile',
    description: 'Cruise missile from shore battery',
    type: 'hostile',
    path: [
      { lon: 117.0, lat: 13.0, time: 15 },
      { lon: 116.5, lat: 12.8, time: 45 },
      { lon: 116.0, lat: 12.6, time: 75 },
      { lon: 115.5, lat: 12.4, time: 105 }
    ]
  },
  {
    id: 'destroyer_escort',
    sidc: 'SFSP--------D',
    name: 'HMS Defender',
    description: 'Type 45 Destroyer - AA escort',
    type: 'friendly',
    path: [
      { lon: 113.8, lat: 11.8, time: 0 },
      { lon: 114.3, lat: 12.3, time: 60 },
      { lon: 114.8, lat: 12.8, time: 120 },
      { lon: 115.3, lat: 13.3, time: 180 }
    ]
  }
];

function isCanvas(obj) {
  return obj && typeof obj.getContext === 'function' && typeof obj.width === 'number';
}

describe('AAW Scenario', () => {
  describe('Symbol creation for all tracks', () => {
    SCENARIO_SYMBOLS.forEach(track => {
      it(`should create symbol for ${track.name}`, () => {
        const sym = new ms.Symbol(track.sidc, { size: 40 });
        const canvas = sym.asCanvas();
        expect(canvas).toBeDefined();
        expect(isCanvas(canvas)).toBe(true);
        expect(canvas.width).toBeGreaterThan(0);
        expect(canvas.height).toBeGreaterThan(0);
      });
    });
  });

  describe('Track data integrity', () => {
    it('should have exactly 6 tracks', () => {
      expect(SCENARIO_SYMBOLS.length).toBe(6);
    });

    it('should have unique track IDs', () => {
      const ids = SCENARIO_SYMBOLS.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(SCENARIO_SYMBOLS.length);
    });

    it('should have required properties for each track', () => {
      SCENARIO_SYMBOLS.forEach(track => {
        expect(track.id).toBeDefined();
        expect(track.sidc).toBeDefined();
        expect(track.name).toBeDefined();
        expect(track.description).toBeDefined();
        expect(track.type).toBeDefined();
        expect(track.path).toBeDefined();
        expect(Array.isArray(track.path)).toBe(true);
        expect(track.path.length).toBeGreaterThan(0);
      });
    });

    it('should have valid track types', () => {
      SCENARIO_SYMBOLS.forEach(track => {
        expect(['friendly', 'hostile']).toContain(track.type);
      });
    });

    it('should have at least 2 waypoints per track', () => {
      SCENARIO_SYMBOLS.forEach(track => {
        expect(track.path.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should have ascending time values in path', () => {
      SCENARIO_SYMBOLS.forEach(track => {
        for (let i = 1; i < track.path.length; i++) {
          expect(track.path[i].time).toBeGreaterThan(track.path[i - 1].time);
        }
      });
    });

    it('should have valid coordinates in path', () => {
      SCENARIO_SYMBOLS.forEach(track => {
        track.path.forEach(point => {
          expect(point.lon).toBeGreaterThanOrEqual(-180);
          expect(point.lon).toBeLessThanOrEqual(180);
          expect(point.lat).toBeGreaterThanOrEqual(-90);
          expect(point.lat).toBeLessThanOrEqual(90);
          expect(point.time).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe('Scenario composition', () => {
    it('should have exactly 1 carrier', () => {
      const carriers = SCENARIO_SYMBOLS.filter(t => 
        t.name.includes('Carrier') || t.id === 'carrier'
      );
      expect(carriers.length).toBe(1);
    });

    it('should have at least 2 torpedo boats', () => {
      const torpedoBoats = SCENARIO_SYMBOLS.filter(t => 
        t.description.includes('Torpedo') || t.description.includes('attack craft')
      );
      expect(torpedoBoats.length).toBeGreaterThanOrEqual(2);
    });

    it('should have at least 1 enemy aircraft', () => {
      const aircraft = SCENARIO_SYMBOLS.filter(t => 
        t.description.includes('Aircraft') || t.description.includes('fighter')
      );
      expect(aircraft.length).toBeGreaterThanOrEqual(1);
    });

    it('should have at least 1 land attack missile', () => {
      const missiles = SCENARIO_SYMBOLS.filter(t => 
        t.description.toLowerCase().includes('missile') || t.description.toLowerCase().includes('cruise')
      );
      expect(missiles.length).toBeGreaterThanOrEqual(1);
    });

    it('should have at least 1 friendly escort', () => {
      const escorts = SCENARIO_SYMBOLS.filter(t => 
        t.type === 'friendly' && t.id !== 'carrier'
      );
      expect(escorts.length).toBeGreaterThanOrEqual(1);
    });

    it('should have more hostile than friendly tracks', () => {
      const hostile = SCENARIO_SYMBOLS.filter(t => t.type === 'hostile');
      const friendly = SCENARIO_SYMBOLS.filter(t => t.type === 'friendly');
      expect(hostile.length).toBeGreaterThan(friendly.length);
    });
  });

  describe('Symbol rendering with colors', () => {
    it('should create hostile symbols with red color', () => {
      const hostileTracks = SCENARIO_SYMBOLS.filter(t => t.type === 'hostile');
      hostileTracks.forEach(track => {
        const sym = new ms.Symbol(track.sidc, {
          size: 35,
          monoColor: 'rgb(255, 0, 0)'
        });
        const canvas = sym.asCanvas();
        expect(isCanvas(canvas)).toBe(true);
      });
    });

    it('should create friendly symbols with cyan color', () => {
      const friendlyTracks = SCENARIO_SYMBOLS.filter(t => t.type === 'friendly');
      friendlyTracks.forEach(track => {
        const sym = new ms.Symbol(track.sidc, {
          size: 35,
          monoColor: 'rgb(0, 255, 255)'
        });
        const canvas = sym.asCanvas();
        expect(isCanvas(canvas)).toBe(true);
      });
    });
  });
});
