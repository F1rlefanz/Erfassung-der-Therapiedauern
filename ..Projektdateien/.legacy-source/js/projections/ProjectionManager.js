// js/projections/ProjectionManager.js
import { ProjectionConfig, ProjectionMethod } from './interfaces/ProjectionTypes.js';
import { LinearProjection } from './calculators/LinearProjection.js';
//import { WeightedProjection } from './calculators/WeightedProjection.js';

// js/projections/ProjectionManager.js

export class ProjectionManager {
  constructor() {
      this.method = 'linear';  // Standard-Methode
  }

  async calculateProjection(currentValue, currentMonth, historicalData = null) {
      try {
          // Einfache lineare Hochrechnung
          if (currentMonth < 3) {
              // Mindestens 3 Monate für eine sinnvolle Hochrechnung
              return null;
          }

          const monthlyAverage = currentValue / currentMonth;
          const remainingMonths = 12 - currentMonth;
          const projectedValue = currentValue + (monthlyAverage * remainingMonths);

          return {
              projectedValue,
              method: this.method,
              confidence: currentMonth / 12  // Einfaches Konfidenzmaß
          };

      } catch (error) {
          console.error('Fehler bei Berechnung der Hochrechnung:', error);
          throw error;
      }
  }

  setMethod(method) {
      this.method = method;
  }
}