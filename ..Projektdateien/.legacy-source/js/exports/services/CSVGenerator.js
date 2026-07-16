// js/exports/services/CSVGenerator.js

import { CSVFormatter } from '../formatters/CSVFormatter.js';
import { TableFormatter } from '../formatters/TableFormatter.js';

/**
 * Generator für CSV-Exporte der Therapiestatistiken
 */
export class CSVGenerator {
    constructor() {
        this.csvFormatter = new CSVFormatter();
        this.tableFormatter = new TableFormatter();
    }

    /**
     * Generiert ZIP-Datei mit CSV-Exporten
     * @param {Object} data - Die zu exportierenden Daten
     * @param {Object} options - Exportoptionen
     * @returns {Promise<Blob>} ZIP-Datei mit CSV-Dateien
     * @throws {Error} Bei Fehlern während der Generierung
     */
    async generate(data, options) {
        if (!this._validateInput(data)) {
            throw new Error('Ungültige oder fehlende Eingabedaten');
        }

        try {
            // JSZip für Mehrere CSV-Dateien in einer ZIP
            const zip = new JSZip();
            const metadata = this._formatMetadata(data.metadata);

            // Metadaten als README
            zip.file('README.txt', metadata);

            // Generiere CSVs für jeden Datentyp
            if (data.data.therapyStats) {
                await this._addTherapyStats(zip, data.data.therapyStats);
            }
            if (data.data.icuStats) {
                await this._addICUStats(zip, data.data.icuStats);
            }
            if (data.data.imcStats) {
                await this._addIMCStats(zip, data.data.imcStats);
            }

            // ZIP erstellen
            return await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE'
            });

        } catch (error) {
            console.error('CSV-Generierung fehlgeschlagen:', error);
            throw new Error(`CSV-Erstellung fehlgeschlagen: ${error.message}`);
        }
    }

    /**
     * Validiert die Eingabedaten
     * @private
     */
    _validateInput(data) {
        return data?.metadata && 
               data?.data && 
               Object.keys(data.data).length > 0;
    }

    /**
     * Formatiert Metadaten für README
     * @private
     */
    _formatMetadata(metadata) {
        return [
            'Therapiestatistiken Export',
            '=======================',
            '',
            `Exportiert am: ${new Date(metadata.exportDate).toLocaleString('de-DE')}`,
            `Zeitraum: ${new Date(metadata.timerange.from).toLocaleDateString('de-DE')} bis ${new Date(metadata.timerange.to).toLocaleDateString('de-DE')}`,
            '',
            'Enthaltene Daten:',
            metadata.exportedTypes.join(', '),
            '',
            'Hinweise:',
            '- Alle Dateien im CSV-Format mit Semikolon als Trennzeichen',
            '- UTF-8 Kodierung mit BOM für Excel-Kompatibilität',
            '- Dezimalzahlen mit Punkt als Dezimaltrennzeichen'
        ].join('\n');
    }

    /**
     * Fügt Therapiestatistiken zum ZIP hinzu
     * @private
     */
    async _addTherapyStats(zip, stats) {
        // Für jede Therapieart eine eigene Datei
        for (const [therapyType, monthlyData] of Object.entries(stats.monthly)) {
            const csvData = this._convertToCSV(
                this.tableFormatter.formatTherapyStats(monthlyData)
            );
            zip.file(`therapie_${therapyType}.csv`, this._addBOM(csvData));
        }

        // Jahresstatistiken
        if (stats.yearly) {
            const yearlyData = this._convertToCSV(
                this.tableFormatter.formatYearlyStats(stats.yearly)
            );
            zip.file('therapie_jahresstatistik.csv', this._addBOM(yearlyData));
        }
    }

    /**
     * Fügt ICU-Statistiken zum ZIP hinzu
     * @private
     */
    async _addICUStats(zip, stats) {
        const csvData = this._convertToCSV(
            this.tableFormatter.formatICUStats(stats.monthly)
        );
        zip.file('icu_schweregrad.csv', this._addBOM(csvData));
    }

    /**
     * Fügt IMC-Statistiken zum ZIP hinzu
     * @private
     */
    async _addIMCStats(zip, stats) {
        const csvData = this._convertToCSV(
            this.tableFormatter.formatIMCStats(stats.monthly)
        );
        zip.file('imc_schweregrad.csv', this._addBOM(csvData));
    }

    /**
     * Konvertiert Tabellendaten in CSV-Format
     * @private
     */
    _convertToCSV({ headers, rows }) {
        const csvRows = [
            // Kopfzeile
            headers.map(h => this._escapeCSV(h)).join(';'),
            // Datenzeilen
            ...rows.map(row => 
                row.map(cell => this._escapeCSV(cell)).join(';')
            )
        ];

        return csvRows.join('\n');
    }

    /**
     * Escaped Werte für CSV
     * @private
     */
    _escapeCSV(value) {
        if (value === null || value === undefined) {
            return '';
        }

        // Konvertiere Zahlen ins deutsche Format
        if (typeof value === 'number') {
            return value.toString().replace('.', ',');
        }

        const stringValue = value.toString();
        
        // Wenn Semikolon, Komma oder Zeilenumbruch enthalten,
        // in Anführungszeichen einschließen
        if (/[;,\n"]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
    }

    /**
     * Fügt BOM für Excel-Kompatibilität hinzu 
     * @private
     */
    _addBOM(csv) {
        const BOM = '\ufeff';
        return BOM + csv;
    }
}