// js/projections/calculators/ProjectionUtils.js

/**
 * Gemeinsame Hilfsfunktionen für Hochrechnungen
 */
export class ProjectionUtils {
  
    /**
     * Berechnet die durchschnittlichen Werte pro Monat
     */
    static calculateMonthlyAverage(values, months) {
      if (!values?.length || !months) return 0;
      return values.reduce((sum, val) => sum + val, 0) / months;
    }
  
    /**
     * Prüft ob genügend Daten für eine Hochrechnung vorliegen
     */
    static hasEnoughDataForProjection(currentMonth, minMonths = 3) {
      return currentMonth >= minMonths;
    }
  
    /**
     * Berechnet die Konfidenz basierend auf verfügbaren Daten
     */
    static calculateConfidence(currentMonth, method) {
      // Mehr Monate = höhere Konfidenz
      const monthConfidence = Math.min(currentMonth / 12, 0.8);
      
      // Methoden-spezifische Basis-Konfidenz
      const methodConfidence = {
        'linear': 0.7,
        'weighted': 0.8  
      };
  
      return monthConfidence * (methodConfidence[method] || 0.6);
    }
  
    /**
     * Formatiert Hochrechnungsergebnisse
     */
    static formatProjectionValue(value, precision = 1) {
      return Number(value).toFixed(precision);
    }
  }