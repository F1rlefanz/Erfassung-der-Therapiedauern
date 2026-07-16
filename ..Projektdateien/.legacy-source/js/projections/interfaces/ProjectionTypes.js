// js/projections/interfaces/ProjectionTypes.js

/**
 * Verfügbare Berechnungsmethoden
 */
export const ProjectionMethod = {
    LINEAR: 'linear',
    WEIGHTED: 'weighted'
  };
  
  /**
   * Konfiguration für eine Hochrechnung
   */
  export class ProjectionConfig {
    constructor() {
      this.method = ProjectionMethod.LINEAR;
      this.showProjections = false;
      this.useHistoricalData = false; 
      this.roundingPrecision = 1;
    }
  }
  
  /**
   * Ergebnis einer Hochrechnung
   */
  export class ProjectionResult {
    constructor(
      currentValue,
      projectedValue, 
      method,
      confidence
    ) {
      this.currentValue = currentValue;
      this.projectedValue = projectedValue;
      this.method = method;
      this.confidence = confidence; // 0-1 
    }
  }