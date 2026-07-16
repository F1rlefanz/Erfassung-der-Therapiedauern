// tests/projections/calculators/LinearProjection.test.js

import { LinearProjection } from '../../../js/projections/calculators/LinearProjection.js';

describe('LinearProjection', () => {
  
  test('sollte null zurückgeben wenn zu wenig Daten', () => {
    const result = LinearProjection.calculate(100, 2); // nur 2 Monate
    expect(result).toBeNull();
  });

  test('sollte korrekte lineare Hochrechnung berechnen', () => {
    // 6 Monate mit 600 Stunden = 100 pro Monat
    const result = LinearProjection.calculate(600, 6);
    
    expect(result).not.toBeNull();
    expect(result.projectedValue).toBe(1200); // 12 Monate * 100
    expect(result.method).toBe('linear');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(1);
  });

  test('sollte mit Dezimalzahlen umgehen können', () => {
    const result = LinearProjection.calculate(550.5, 6);
    expect(result.projectedValue).toBeCloseTo(1101, 1);
  });
});