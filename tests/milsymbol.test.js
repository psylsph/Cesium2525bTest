import { describe, it, expect } from 'vitest';
import ms from 'milsymbol';

const MILSTD_2525_SYMBOLS = [
  { sidc: 'SFG-UCI----D', name: 'Infantry Platoon', description: 'Ground combat unit' },
  { sidc: 'SFG-UCF----D', name: 'Armor Platoon', description: 'Armored combat unit' },
  { sidc: 'SFG-UCJ----D', name: 'Field Artillery', description: 'Indirect fire support' },
  { sidc: 'SFG-UCH----D', name: 'Anti-Tank', description: 'Anti-armor unit' },
  { sidc: 'SFG-UCS---D', name: 'Air Defense', description: 'Anti-aircraft unit' },
  { sidc: 'SFG-UCT----D', name: 'Engineer', description: 'Combat engineer unit' },
  { sidc: 'SFG-UCM----D', name: 'Signal', description: 'Communications unit' },
  { sidc: 'SFG-UCW----D', name: 'Reconnaissance', description: 'Scout unit' },
  { sidc: 'SFG-UCQ----D', name: 'Medical', description: 'Medical support unit' },
  { sidc: 'SFG-UCC----D', name: 'Supply', description: 'Logistics unit' },
  { sidc: 'SFG-UCA----D', name: 'Maintenance', description: 'Maintenance unit' },
  { sidc: 'SFG-UCB----D', name: 'Transportation', description: 'Transport unit' }
];

function isCanvas(obj) {
  return obj && typeof obj.getContext === 'function' && typeof obj.width === 'number';
}

describe('milsymbol integration', () => {
  describe('Symbol creation', () => {
    it('should create a symbol with valid SIDC', () => {
      const sym = new ms.Symbol('SFG-UCI----D', { size: 35 });
      expect(sym).toBeDefined();
      expect(sym.metadata).toBeDefined();
    });

    it('should generate a canvas element', () => {
      const sym = new ms.Symbol('SFG-UCI----D', { size: 35 });
      const canvas = sym.asCanvas();
      expect(canvas).toBeDefined();
      expect(isCanvas(canvas)).toBe(true);
    });

    it('should have anchor for positioning', () => {
      const sym = new ms.Symbol('SFG-UCI----D', { size: 35 });
      const anchor = sym.getAnchor();
      expect(anchor).toBeDefined();
      expect(typeof anchor.x).toBe('number');
      expect(typeof anchor.y).toBe('number');
    });

    it('should respect size option', () => {
      const sym35 = new ms.Symbol('SFG-UCI----D', { size: 35 });
      const sym80 = new ms.Symbol('SFG-UCI----D', { size: 80 });
      
      const canvas35 = sym35.asCanvas();
      const canvas80 = sym80.asCanvas();
      
      expect(canvas80.width).toBeGreaterThan(canvas35.width);
      expect(canvas80.height).toBeGreaterThan(canvas35.height);
    });
  });

  describe('All MILSTD_2525 symbols', () => {
    MILSTD_2525_SYMBOLS.forEach(symbolData => {
      it(`should create symbol for ${symbolData.name}`, () => {
        const sym = new ms.Symbol(symbolData.sidc, { size: 40 });
        const canvas = sym.asCanvas();
        expect(canvas).toBeDefined();
        expect(isCanvas(canvas)).toBe(true);
        expect(canvas.width).toBeGreaterThan(0);
        expect(canvas.height).toBeGreaterThan(0);
      });
    });
  });

  describe('Symbol data integrity', () => {
    it('should have exactly 12 symbols defined', () => {
      expect(MILSTD_2525_SYMBOLS.length).toBe(12);
    });

    it('should have unique SIDCs', () => {
      const sidcs = MILSTD_2525_SYMBOLS.map(s => s.sidc);
      const uniqueSidcs = new Set(sidcs);
      expect(uniqueSidcs.size).toBe(MILSTD_2525_SYMBOLS.length);
    });

    it('should have required properties for each symbol', () => {
      MILSTD_2525_SYMBOLS.forEach(symbolData => {
        expect(symbolData.sidc).toBeDefined();
        expect(symbolData.name).toBeDefined();
        expect(symbolData.description).toBeDefined();
        expect(typeof symbolData.sidc).toBe('string');
        expect(typeof symbolData.name).toBe('string');
        expect(typeof symbolData.description).toBe('string');
      });
    });

    it('should have valid SIDC format (11-15 characters)', () => {
      MILSTD_2525_SYMBOLS.forEach(symbolData => {
        expect(symbolData.sidc.length).toBeGreaterThanOrEqual(11);
        expect(symbolData.sidc.length).toBeLessThanOrEqual(15);
      });
    });
  });
});
