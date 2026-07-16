// js/projections/calculators/LinearProjection.js
import { ProjectionUtils } from './ProjectionUtils.js';
import { ProjectionResult } from '../interfaces/ProjectionTypes.js';

export class LinearProjection {
  /**
   * Berechnet lineare Hochrechnung
   */
  static calculate(currentValue, currentMonth) {
    // Prüfe ob genügend Daten
    if (!ProjectionUtils.hasEnoughDataForProjection(currentMonth)) {
      return null;
    }

    // Durchschnitt pro Monat
    const monthlyAverage = currentValue / currentMonth;
    
    // Hochrechnung
    const remainingMonths = 12 - currentMonth;
    const projectedValue = currentValue + (monthlyAverage * remainingMonths);

    // Konfidenz berechnen
    const confidence = ProjectionUtils.calculateConfidence(currentMonth, 'linear');

    return new ProjectionResult(
      currentValue,
      projectedValue,
      'linear',
      confidence
    );
  }
}