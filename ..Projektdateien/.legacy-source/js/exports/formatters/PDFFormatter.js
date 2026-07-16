// js/exports/formatters/PDFFormatter.js
import { TableFormatter } from './TableFormatter.js';

/**
 * Formatiert Daten speziell für PDF-Exporte mit jsPDF/AutoTable
 */
export class PDFFormatter {
    constructor() {
        // TableFormatter initialisieren
        this.tableFormatter = new TableFormatter();

        // Standard PDF-Formatierungen
        this.styles = {
            header: {
                fontSize: 10,
                fillColor: [155, 89, 182],  // Primary Color (#9b59b6)
                textColor: [255, 255, 255], // Weiß
                halign: 'center',
                valign: 'middle',
                cellPadding: 4
            },
            cell: {
                fontSize: 10,
                cellPadding: 3
            },
            alternateRow: {
                fillColor: [249, 249, 249] // Leichtes Grau
            },
            total: {
                fillColor: [142, 68, 173],  // Secondary Color (#8e44ad)
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            }
        };

        // Formatierung für Kopf-/Fußzeilen
        this.pageStyles = {
            header: {
                fontSize: 14,
                margin: { top: 20, bottom: 10 }
            },
            footer: {
                fontSize: 8,
                margin: { bottom: 10 }
            }
        };
    }

    /**
     * Bestimmt den Typ einer Spalte für die Breitenberechnung
     * @private
     */
    _getColumnType(header) {
        const headerLower = header.toLowerCase();
        
        // Prozentspalten
        if (headerLower.includes('%')) return 'percentage';
        
        // Textspalten
        if (headerLower.includes('name') || 
            headerLower.includes('beschreibung') || 
            headerLower.includes('typ')) return 'text';
        
        // Standard-Zahlen
        return 'numeric';
    }

    /**
     * Berechnet eine optimale Tabellenlayout-Konfiguration
     * @private
     */
    _calculateOptimalTableLayout(headers, tableWidth) {
        const minFontSize = 6;
        const maxFontSize = 10;
        const margins = 20;
        const availableWidth = tableWidth - (2 * margins);
        
        let fontSize = maxFontSize;
        let columnWidths = {};

        while (fontSize >= minFontSize) {
            let totalWidth = 0;
            columnWidths = this._calculateProportionalWidths(headers, availableWidth);
            
            totalWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0);
            
            if (totalWidth <= availableWidth) break;
            
            fontSize--;
        }

        return { 
            fontSize, 
            columnWidths,
            realTotalWidth: Object.values(columnWidths).reduce((sum, width) => sum + width, 0)
        };
    }

    /**
     * Berechnet proportionale Spaltenbreiten
     * @private
     */
    _calculateProportionalWidths(headers, availableWidth) {
        const columnWeights = { 
            month: 1,          // Monat
            numericSmall: 1.2, // Kleine Zahlen
            numericLarge: 1.5, // Große Zahlen
            text: 2,           // Textfelder
            percentage: 1.3    // Prozentangaben
        };

        // Gesamtgewicht berechnen
        const totalWeight = headers.reduce((sum, header) => {
            const columnType = this._getColumnType(header);
            switch(columnType) {
                case 'text': return sum + columnWeights.text;
                case 'percentage': return sum + columnWeights.percentage;
                case 'numeric': return sum + columnWeights.numericSmall;
                default: return sum + 1;
            }
        }, 0);

        // Breite pro Gewichtseinheit
        const widthPerWeight = availableWidth / totalWeight;

        return headers.reduce((widths, header, index) => {
            const columnType = this._getColumnType(header);
            let weight;
            
            switch(columnType) {
                case 'text': weight = columnWeights.text; break;
                case 'percentage': weight = columnWeights.percentage; break;
                case 'numeric': weight = columnWeights.numericSmall; break;
                default: weight = 1;
            }

            widths[index] = widthPerWeight * weight;
            return widths;
        }, {});
    }

    /**
     * Formatiert Metadaten für die Titelseite
     */
    formatTitlePage(metadata) {
        const exportDate = new Date(metadata.exportDate);
        const fromDate = new Date(metadata.timerange.from);
        const toDate = new Date(metadata.timerange.to);

        return {
            title: 'Therapiestatistiken Export',
            dateRange: `Zeitraum: ${fromDate.toLocaleDateString('de-DE')} bis ${toDate.toLocaleDateString('de-DE')}`,
            dataTypes: `Enthaltene Daten: ${metadata.exportedTypes.join(', ')}`,
            timestamp: `Exportiert am: ${exportDate.toLocaleString('de-DE')}`
        };
    }

    /**
     * Formatiert das Inhaltsverzeichnis mit übergebenen Seitenzahlen
     * @param {Object} data - Dokument-Daten
     * @param {Object} pageReferences - Berechnete Seitenzahlen
     */
    formatTableOfContents(data, pageReferences = {}) {
        const entries = [];

        if (data.data.therapyStats && pageReferences.therapyStats) {
            const { startPage, count } = pageReferences.therapyStats;
            const pageRange = count > 1 
                ? `Seite ${startPage}-${startPage + count - 1}` 
                : `Seite ${startPage}`;
            entries.push(`Therapiestatistiken ......................... ${pageRange}`);
        }

        if (data.data.icuStats && pageReferences.icuStats) {
            entries.push(`ICU Schweregradstatistik ................... Seite ${pageReferences.icuStats.startPage}`);
        }

        if (data.data.imcStats && pageReferences.imcStats) {
            entries.push(`IMC Schweregradstatistik ................... Seite ${pageReferences.imcStats.startPage}`);
        }

        return {
            title: 'Inhaltsverzeichnis',
            entries
        };
    }

    /**
     * Formatiert Tabellendaten für jsPDF-AutoTable
     */
    formatForAutoTable({ headers, rows }) {
        // Dynamische Spaltenbreiten berechnen
        const tableWidth = 317; // Standard-Tabellenbreite im Querformat
        const layoutConfig = this._calculateOptimalTableLayout(headers, tableWidth);

        return {
            head: [headers],
            body: rows,
            styles: {
                ...this.styles.cell, 
                fontSize: layoutConfig.fontSize
            },
            headStyles: this.styles.header,
            alternateRowStyles: this.styles.alternateRow,
            // Letzte Zeile = Summenzeile
            footStyles: this.styles.total,
            // Dynamische Spaltenbreiten
            columnStyles: Object.fromEntries(
                Object.entries(layoutConfig.columnWidths).map(([index, width]) => 
                    [index, { cellWidth: width }])
            ),
            // Zeilenformatierung
            createdRow: (row, data, index) => {
                // Summenzeile
                if (index === rows.length - 1) {
                    row.cells.forEach(cell => {
                        cell.styles.fillColor = this.styles.total.fillColor;
                        cell.styles.textColor = this.styles.total.textColor;
                        cell.styles.fontStyle = 'bold';
                    });
                }
            },
            // Zellenformatierung 
            didParseCell: (data) => {
                // Rechtsausrichtung für Zahlen
                if (!isNaN(data.cell.raw) && data.cell.raw !== '') {
                    data.cell.styles.halign = 'right';
                }
                // Zeilenumbrüche in langen Texten erlauben
                if (typeof data.cell.raw === 'string' && data.cell.raw.length > 15) {
                    data.cell.styles.cellWidth = 'wrap';
                }
            },
            // Seitenumbruch-Handling
            didDrawPage: (data) => {
                // Seitenumbruch wenn weniger als 60 Einheiten Platz
                if (data.cursor.y > data.pageSize.height - 60) {
                    data.addPage();
                    // Setze Cursor nach oben mit etwas Abstand
                    data.cursor.y = 20;
                }
            }
        };
    }

    /**
     * Formatiert Fußzeilen für jsPDF
     */
    formatFooter(pageCount) {
        return {
            text: `Seite {page} von ${pageCount} | Therapie-Tracking System | ${new Date().toLocaleDateString('de-DE')}`
        };
    }

    /**
     * Formatiert Rohdaten für PDF-spezifische Darstellung
     * @param {Object} rawData - Die zu formatierenden Rohdaten
     * @returns {Object} PDF-spezifisch formatierte Tabellendaten
     */
    formatRawData(rawData) {
        // Nutze Basis-Formatierung vom TableFormatter
        const { headers, rows } = this.tableFormatter.formatRawData(rawData);
        
        return {
            head: [headers],
            body: rows,
            // PDF-spezifische Styling-Optionen
            styles: {
                ...this.styles.cell,
                fontSize: 8,
                cellPadding: 2
            },
            // Optimierte Spaltenbreiten für PDF
            columnStyles: {
                0: { cellWidth: 25 }, // Datum
                1: { cellWidth: 35 }, // Therapieart
                2: { cellWidth: 20 }, // Fallnummer  
                3: { cellWidth: 35 }, // Name
                4: { cellWidth: 20 }, // Stunden
                5: { cellWidth: 15 }, // Von
                6: { cellWidth: 15 }  // Bis
            },
            // Zellen-Ausrichtung
            bodyStyles: {
                ...this.styles.cell,
                2: { halign: 'right' }, // Fallnummer rechtsbündig
                4: { halign: 'right' }, // Stunden rechtsbündig  
                5: { halign: 'center' }, // Von zentriert
                6: { halign: 'center' }  // Bis zentriert
            }
        };
    }

    /**
     * Liefert Standard-Tabellenkonfiguration
     */
    getTableConfig() {
        return {
            margin: { top: 15, right: 10, bottom: 15, left: 10 },
            startY: 20,
            tableWidth: 'auto',
            showHead: 'everyPage',
            tableLineColor: [222, 226, 230],
            tableLineWidth: 0.1,
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2
            },
            // didDrawPage Logik wird nun von den aufrufenden Methoden bereitgestellt
        };
    }
}