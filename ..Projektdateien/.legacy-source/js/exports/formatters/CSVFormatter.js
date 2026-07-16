// js/exports/formatters/CSVFormatter.js

import { formatUtils } from '../utils/FormatUtils.js';

/**
 * Formatter für CSV-Exporte
 * Stellt korrekte Formatierung und Excel-Kompatibilität sicher
 */
export class CSVFormatter {
    constructor() {
        // Konfiguration für CSV-Format
        this.config = {
            delimiter: ';',           // Excel-Standard in DE
            lineBreak: '\r\n',       // Windows-Style für Excel
            enclosure: '"',          // Standard Texteinfassung
            escapeChar: '"',         // Verdoppeln für Escaping
            decimalSeparator: ',',   // Deutsches Format
            dateFormat: 'DD.MM.YYYY' // Deutsches Format
        };

        // Mapping für Spaltennamen ins Deutsche
        this.columnMapping = {
            // Therapiestatistiken
            month: 'Monat',
            hours: 'Therapiestunden',
            startedDays: 'Begonnene Tage',
            completeDays: 'Ganze Tage',
            uniqueCases: 'Patienten',
            daysPerCase: 'Tage pro Patient',
            
            // ICU spezifisch
            cases: 'Fälle',
            startedVentDays: 'Begonnene Beatmungstage',
            completeVentDays: 'Ganze Beatmungstage',
            ventHours: 'Beatmungsstunden',
            ventPatients: 'Beatmungspatienten',
            ventPercentage: 'Anteil Beatmung (%)',
            avgVentDuration: 'Durchschnittliche Beatmungsdauer',
            crrtDays: 'Hämofiltrationstage',
            ecmoDays: 'ECMO-Tage',
            tissPoints: 'TISS-28-Punkte',
            tissPerCase: 'TISS-28 pro Fall'
        };
    }

    /**
     * Formatiert einen einzelnen Wert für CSV
     * @private
     */
    _formatValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);

        // Prüfe ob Wert Sonderzeichen enthält
        const needsEnclosure = stringValue.includes(this.config.delimiter) ||
                             stringValue.includes(this.config.enclosure) ||
                             stringValue.includes('\n') ||
                             stringValue.includes('\r');

        if (!needsEnclosure) {
            return stringValue;
        }

        // Escape bestehende Anführungszeichen durch Verdopplung
        const escaped = stringValue.replace(
            new RegExp(this.config.enclosure, 'g'), 
            this.config.enclosure + this.config.enclosure
        );

        // In Anführungszeichen einschließen
        return `${this.config.enclosure}${escaped}${this.config.enclosure}`;
    }

    /**
     * Erstellt eine CSV-Zeile aus einem Array von Werten
     * @private
     */
    _createRow(values) {
        return values.map(value => this._formatValue(value))
                    .join(this.config.delimiter) + 
                    this.config.lineBreak;
    }

    /**
     * Fügt deutsche Spaltenüberschriften hinzu
     * @private
     */
    _addHeaders(headers) {
        return this._createRow(
            headers.map(header => this.columnMapping[header] || header)
        );
    }

    /**
     * Konvertiert einen Zahlenwert ins deutsche Format
     * @private
     */
    _formatNumber(value) {
        if (!formatUtils.isValidNumber(value)) return '';
        return String(value).replace('.', this.config.decimalSeparator);
    }

    /**
     * Formatiert Therapiestatistiken für CSV
     */
    formatTherapyStats(monthlyData, therapyType) {
        let csv = '';
        
        // Überschrift mit Therapieart
        csv += `Therapiestatistik - ${therapyType}${this.config.lineBreak}${this.config.lineBreak}`;
        
        // Spaltenüberschriften
        const headers = [
            'month', 'hours', 'startedDays', 'completeDays',
            'uniqueCases', 'daysPerCase'
        ];
        csv += this._addHeaders(headers);

        // Monatsdaten
        monthlyData.forEach(data => {
            const row = [
                formatUtils.getMonthName(data.month),
                this._formatNumber(data.hours),
                this._formatNumber(data.startedDays),
                this._formatNumber(data.completeDays),
                this._formatNumber(data.uniqueCases),
                this._formatNumber(data.daysPerCase)
            ];
            csv += this._createRow(row);
        });

        return csv;
    }

    /**
     * Formatiert ICU-Statistiken für CSV
     */
    formatICUStats(monthlyData) {
        let csv = '';
        
        // Überschrift
        csv += `ICU Schweregradstatistik${this.config.lineBreak}${this.config.lineBreak}`;
        
        // Spaltenüberschriften
        const headers = [
            'month', 'cases', 'startedVentDays', 'completeVentDays',
            'ventHours', 'ventPatients', 'ventPercentage', 'avgVentDuration',
            'crrtDays', 'ecmoDays', 'tissPoints', 'tissPerCase'
        ];
        csv += this._addHeaders(headers);

        // Monatsdaten
        monthlyData.forEach(data => {
            const row = [
                formatUtils.getMonthName(data.month),
                this._formatNumber(data.cases),
                this._formatNumber(data.startedVentDays),
                this._formatNumber(data.completeVentDays),
                this._formatNumber(data.ventHours),
                this._formatNumber(data.ventPatients),
                this._formatNumber(data.ventPercentage),
                this._formatNumber(data.avgVentDuration),
                this._formatNumber(data.crrtDays),
                this._formatNumber(data.ecmoDays),
                this._formatNumber(data.tissPoints),
                this._formatNumber(data.tissPerCase)
            ];
            csv += this._createRow(row);
        });
        
        return csv;
    }

    /**
     * Formatiert IMC-Statistiken für CSV
     */
    formatIMCStats(monthlyData) {
        let csv = '';
        
        // Überschrift
        csv += `IMC Schweregradstatistik${this.config.lineBreak}${this.config.lineBreak}`;
        
        // Spaltenüberschriften
        const headers = ['month', 'cases', 'tissPoints', 'tissPerCase'];
        csv += this._addHeaders(headers);

        // Monatsdaten
        monthlyData.forEach(data => {
            const row = [
                formatUtils.getMonthName(data.month),
                this._formatNumber(data.cases),
                this._formatNumber(data.tissPoints),
                this._formatNumber(data.tissPerCase)
            ];
            csv += this._createRow(row);
        });
        
        return csv;
    }
}