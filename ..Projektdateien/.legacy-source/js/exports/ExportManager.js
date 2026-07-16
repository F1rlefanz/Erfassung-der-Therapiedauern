// exports/ExportManager.js

import { ExportFormat, ExportOptions } from './interfaces/ExportTypes.js';
import { DataCollector } from './services/DataCollector.js';
import { PDFGenerator } from './services/PDFGenerator.js';
import { CSVGenerator } from './services/CSVGenerator.js';
import { JSONGenerator } from './services/JSONGenerator.js';
import { DBGenerator } from './services/DBGenerator.js';

/**
 * Manager-Klasse für den Export von Therapiedaten
 */
export class ExportManager {
  /**
   * Initialisiert einen neuen ExportManager mit allen Generatoren
   */
  constructor() {
    this.dataCollector = new DataCollector();
    
    // Initialisiere alle Generatoren
    try {
      this.generators = {
        [ExportFormat.PDF]: new PDFGenerator(),
        [ExportFormat.CSV]: new CSVGenerator(),
        [ExportFormat.JSON]: new JSONGenerator(),
        [ExportFormat.DB]: new DBGenerator()
      };
      
      console.log('ExportManager erfolgreich initialisiert');
    } catch (error) {
      console.error('Fehler bei Generator-Initialisierung:', error);
      throw new Error('Export-System konnte nicht initialisiert werden');
    }
  }

  /**
   * Exportiert Daten im gewählten Format
   * @param {ExportOptions} options - Export-Konfiguration
   * @returns {Promise<Blob|string>} Exportierte Daten
   * @throws {Error} Bei Validierungs- oder Export-Fehlern
   */
  async exportData(options = new ExportOptions()) {
    console.log('Starte Export mit Optionen:', options);

    try {
      // Validiere Optionen
      await this._validateOptions(options);
      
      // Sammle benötigte Daten
      console.log('Sammle Daten...');
      const data = await this.dataCollector.collectData(options);
      
      if (!data || Object.keys(data).length === 0) {
        throw new Error('Keine Daten zum Exportieren gefunden');
      }

      // Wähle und prüfe Generator
      const generator = this._getGenerator(options.format);
      
      // Führe Export durch
      console.log(`Generiere ${options.format}-Export...`);
      const result = await generator.generate(data, options);
      
      console.log('Export erfolgreich abgeschlossen');
      return result;

    } catch (error) {
      console.error('Export fehlgeschlagen:', error);
      
      // Spezifische Fehlermeldungen
      if (error.name === 'ValidationError') {
        throw error; // Validierungsfehler durchreichen
      }
      
      // Technische Fehler abfangen
      throw new Error(`Export fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Erweiterte Validierung der Export-Optionen
   * @private
   */
  async _validateOptions(options) {
    console.log('Validiere Export-Optionen...');

    try {
      // Prüfe Basis-Optionen
      if (!options || !(options instanceof ExportOptions)) {
        throw new Error('Ungültige Export-Optionen');
      }

      // Validiere Datumsbereich
      if (options.dateRange.from && options.dateRange.to) {
        if (options.dateRange.from > options.dateRange.to) {
          throw new Error('Startdatum muss vor Enddatum liegen');
        }
        
        // Prüfe ob Zeitraum im erlaubten Bereich
        const maxMonths = 24; // Max. 2 Jahre
        const months = (options.dateRange.to - options.dateRange.from) / 
                      (1000 * 60 * 60 * 24 * 30.44);
                      
        if (months > maxMonths) {
          throw new Error(`Zeitraum darf maximal ${maxMonths} Monate betragen`);
        }
      }

      // Prüfe Datentypen
      const hasDataType = Object.values(options.dataTypes).some(value => value);
      if (!hasDataType) {
        throw new Error('Mindestens ein Datentyp muss ausgewählt sein');
      }

      // Format-spezifische Validierungen
      if (options.format === ExportFormat.PDF) {
        // Prüfe PDF-spezifische Optionen...
      }

      console.log('Validierung erfolgreich');

    } catch (error) {
      error.name = 'ValidationError';
      throw error;
    }
  }

  /**
   * Wählt und validiert den passenden Generator
   * @private
   */
  _getGenerator(format) {
    const generator = this.generators[format];
    
    if (!generator) {
      throw new Error(`Nicht unterstütztes Export-Format: ${format}`);
    }

    return generator;
  }
}