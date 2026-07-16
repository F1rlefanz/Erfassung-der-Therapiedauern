// exports/interfaces/ExportTypes.js

/**
 * Validierungs-Fehlermeldungen
 * @readonly
 * @enum {string} 
 */
const ValidationMessages = Object.freeze({
    MISSING_START_DATE: 'Startdatum muss angegeben werden',
    MISSING_END_DATE: 'Enddatum muss angegeben werden',
    INVALID_DATE_ORDER: 'Das Startdatum muss vor dem Enddatum liegen',
    INVALID_DATE_TYPE: 'Startdatum und Enddatum müssen als Date-Objekte übergeben werden',
    NO_DATA_SELECTED: 'Mindestens ein Datentyp muss für den Export ausgewählt sein',
    INVALID_FORMAT: 'Das angegebene Exportformat wird nicht unterstützt',
    REQUIRED_DATA_TYPES: 'Ungültige oder fehlende Datentypen',
    REQUIRED_FORMAT: 'Exportformat muss angegeben werden'
  });
  
  /**
   * Exportformate
   * @readonly
   * @enum {string}
   */
  export const ExportFormat = Object.freeze({
    PDF: 'pdf',
    CSV: 'csv', 
    JSON: 'json',
    DB: 'db'
  });
  
  /**
   * Datentypen für Export
   * @readonly
   * @enum {string}
   */
  export const DataType = Object.freeze({
    THERAPY_STATS: 'therapyStats',
    ICU_STATS: 'icuStats',
    IMC_STATS: 'imcStats', 
    RAW_DATA: 'rawData'
  });
  
  /**
   * Konfiguration für Export-Vorgänge
   */
  export class ExportOptions {
    /**
     * Erstellt neue ExportOptions
     * @throws {Error} Bei ungültiger Konfiguration
     */
    constructor() {
      /** @private */
      this._options = {
        dateRange: {
          from: null,
          to: null
        },
        dataTypes: {},
        format: null
      };
      
      // Datentypen mit Standardwerten initialisieren
      this._initializeDataTypes();
    }
  
    /**
     * Initialisiert die Datentypen mit Standardwerten
     * @private
     */
    _initializeDataTypes() {
      Object.values(DataType).forEach(type => {
        this._options.dataTypes[type] = type !== DataType.RAW_DATA;
      });
    }
  
    /**
     * Setzt den Exportzeitraum
     * @param {Date} from - Startdatum
     * @param {Date} to - Enddatum 
     * @throws {Error} Bei ungültigem Zeitraum
     */
    setDateRange(from, to) {
      // Validiere Eingaben
      if (!(from instanceof Date) || !(to instanceof Date)) {
        throw new Error(ValidationMessages.INVALID_DATE_TYPE);
      }
  
      if (from > to) {
        throw new Error(ValidationMessages.INVALID_DATE_ORDER);
      }
  
      this._options.dateRange = { from, to };
    }
  
    /**
     * Setzt das Exportformat
     * @param {ExportFormat} format - Zu setzendes Format
     * @throws {Error} Bei ungültigem Format
     */
    setFormat(format) {
      if (!format) {
        throw new Error(ValidationMessages.REQUIRED_FORMAT);
      }
  
      if (!Object.values(ExportFormat).includes(format)) {
        throw new Error(ValidationMessages.INVALID_FORMAT);
      }
  
      this._options.format = format;
    }
  
    /**
     * Setzt die zu exportierenden Datentypen
     * @param {Object.<string, boolean>} types - Aktivierte Datentypen
     * @throws {Error} Bei ungültiger Konfiguration
     */
    setDataTypes(types) {
      if (!types || typeof types !== 'object') {
        throw new Error(ValidationMessages.REQUIRED_DATA_TYPES);
      }
  
      // Validiere Datentypen
      Object.keys(types).forEach(type => {
        if (!Object.values(DataType).includes(type)) {
          throw new Error(ValidationMessages.REQUIRED_DATA_TYPES);
        }
      });
  
      // Prüfe ob mindestens ein Typ ausgewählt
      if (!Object.values(types).some(value => value)) {
        throw new Error(ValidationMessages.NO_DATA_SELECTED);
      }
  
      // Aktualisiere mit neuen Werten
      this._options.dataTypes = {
        ...this._options.dataTypes,
        ...types
      };
    }
  
    /**
     * Validiert alle Einstellungen
     * @throws {Error} Bei ungültiger Konfiguration
     */
    validate() {
      // Prüfe Zeitraum
      if (!this._options.dateRange.from) {
        throw new Error(ValidationMessages.MISSING_START_DATE);
      }
      if (!this._options.dateRange.to) {
        throw new Error(ValidationMessages.MISSING_END_DATE);
      }
      if (this._options.dateRange.from > this._options.dateRange.to) {
        throw new Error(ValidationMessages.INVALID_DATE_ORDER);
      }
  
      // Prüfe Format
      if (!this._options.format) {
        throw new Error(ValidationMessages.REQUIRED_FORMAT);
      }
      if (!Object.values(ExportFormat).includes(this._options.format)) {
        throw new Error(ValidationMessages.INVALID_FORMAT);
      }
  
      // Prüfe Datentypen
      if (!Object.values(this._options.dataTypes).some(value => value)) {
        throw new Error(ValidationMessages.NO_DATA_SELECTED);
      }
    }
  
    /**
     * Erstellt ExportOptions aus einem Objekt
     * @param {Object} data - Einstellungen als Objekt
     * @returns {ExportOptions} Neue ExportOptions Instanz
     * @throws {Error} Bei ungültigen Daten
     */
    static fromObject(data) {
      const options = new ExportOptions();
  
      if (data.dateRange) {
        options.setDateRange(
          new Date(data.dateRange.from),
          new Date(data.dateRange.to)
        );
      }
  
      if (data.format) {
        options.setFormat(data.format);
      }
  
      if (data.dataTypes) {
        options.setDataTypes(data.dataTypes);
      }
  
      // Validiere Gesamtkonfiguration
      options.validate();
  
      return options;
    }
  
    /**
     * Konvertiert die Einstellungen in ein Objekt
     * @returns {Object} Plain Object mit Einstellungen
     */
    toObject() {
      return {
        dateRange: {
          from: this._options.dateRange.from?.toISOString(),
          to: this._options.dateRange.to?.toISOString()
        },
        dataTypes: { ...this._options.dataTypes },
        format: this._options.format
      };
    }
  
    /**
     * Prüft ob alle Einstellungen gültig sind
     * @returns {boolean} true wenn gültig
     */
    isValid() {
      try {
        this.validate();
        return true;
      } catch {
        return false;  
      }
    }
  
    // Getter
    get dateRange() {
      return { ...this._options.dateRange };
    }
  
    get dataTypes() {
      return { ...this._options.dataTypes };
    }
  
    get format() {
      return this._options.format;
    }
  }