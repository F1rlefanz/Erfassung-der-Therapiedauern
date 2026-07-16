// tests/projections/calculators/ProjectionUtils.test.js

import { ProjectionUtils } from '../../../js/projections/calculators/ProjectionUtils.js';

describe('ProjectionUtils', () => {
  
  describe('calculateMonthlyAverage', () => {
    test('sollte korrekten Durchschnitt berechnen', () => {
      const values = [100, 200, 300];
      const months = 3;
      expect(ProjectionUtils.calculateMonthlyAverage(values, months)).toBe(200);
    });

    test('sollte 0 zurückgeben bei leeren Werten', () => {
      expect(ProjectionUtils.calculateMonthlyAverage([], 3)).toBe(0);
      expect(ProjectionUtils.calculateMonthlyAverage(null, 3)).toBe(0);
    });
  });

  describe('hasEnoughDataForProjection', () => {
    test('sollte true zurückgeben wenn genug Monate', () => {
      expect(ProjectionUtils.hasEnoughDataForProjection(3)).toBe(true);
      expect(ProjectionUtils.hasEnoughDataForProjection(6)).toBe(true);
    });

    test('sollte false zurückgeben wenn zu wenig Monate', () => {
      expect(ProjectionUtils.hasEnoughDataForProjection(2)).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    test('sollte höhere Konfidenz für mehr Monate geben', () => {
      const confLow = ProjectionUtils.calculateConfidence(3, 'linear');
      const confHigh = ProjectionUtils.calculateConfidence(9, 'linear');
      expect(confHigh).toBeGreaterThan(confLow);
    });

    test('sollte unterschiedliche Basis-Konfidenz pro Methode haben', () => {
      const confLinear = ProjectionUtils.calculateConfidence(6, 'linear');
      const confWeighted = ProjectionUtils.calculateConfidence(6, 'weighted');
      expect(confWeighted).toBeGreaterThan(confLinear);
    });
  });
});