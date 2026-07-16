// js/exports/services/PDFGenerator.js

import { PDFFormatter } from '../formatters/PDFFormatter.js';
import { TableFormatter } from '../formatters/TableFormatter.js';

/**
 * PDF Styling Konfiguration für konsistentes Layout
 */
const PDF_STYLES = {
    colors: {
        primary: '#9b59b6',
        secondary: '#8e44ad', 
        text: '#333333',
        border: '#e0e0e0',
        highlight: '#f8f9fa',
        white: '#ffffff'
    },
    fonts: {
        sizes: {
            title: 16,
            subtitle: 14, 
            text: 10,
            small: 8
        },
        family: 'helvetica'
    },
    margins: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
    }
};

/** 
 * Generator für PDF-Exporte der Therapiestatistiken
 */
export class PDFGenerator {
    /**
     * Konfiguriert und initialisiert den PDF-Generator
     * @param {Object} customStyles - Optionale benutzerdefinierte Styles
     */
    constructor(customStyles = {}) {
        this.styles = { ...PDF_STYLES, ...customStyles };
        this.tableFormatter = new TableFormatter();
        this.pdfFormatter = new PDFFormatter();
    }

    /**
     * Generiert das PDF-Dokument mit den übergebenen Daten
     * @param {Object} data - Die zu exportierenden Daten  
     * @param {Object} options - Exportoptionen
     * @returns {Promise<Blob>} Das generierte PDF als Blob
     * @throws {Error} Bei Fehlern während der Generierung 
     */
    async generate(data, options) {
        if (!this._validateInput(data)) {
            throw new Error('Ungültige oder fehlende Eingabedaten');
        }

        // Nutze globales jsPDF Objekt
        const doc = new window.jspdf.jsPDF('landscape', 'mm', 'a4');
        
        try {
            await this._generateDocument(doc, data, options);
            return doc.output('blob');
        } catch (error) {
            console.error('PDF-Generierung fehlgeschlagen:', error);
            throw new Error(`PDF-Erstellung fehlgeschlagen: ${error.message}`);
        } finally {
            doc.close();
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
     * Richtet das Dokument ein
     * @private
     */
    _setupDocument(doc, metadata) {
        doc.setProperties({
            title: 'Therapiestatistiken Export',
            author: 'Therapie-Tracking System',
            subject: `Export vom ${new Date(metadata.exportDate).toLocaleDateString('de-DE')}`,
            keywords: 'Therapiestatistiken, ICU, IMC',
            creator: 'PDFGenerator'
        });

        doc.setFont(this.styles.fonts.family);
        doc.setFontSize(this.styles.fonts.sizes.text);
    }

    /**
     * Generiert die Titelseite
     * @private
     */
    async _generateTitlePage(doc, metadata) {
        const { width, height } = doc.internal.pageSize;
        const centerX = width / 2;

        const titlePageData = this.pdfFormatter.formatTitlePage(metadata);

        doc.setFontSize(this.styles.fonts.sizes.title);
        doc.text(titlePageData.title, centerX, 40, { align: 'center' });

        doc.setFontSize(this.styles.fonts.sizes.subtitle);
        doc.text(titlePageData.dateRange, centerX, 60, { align: 'center' });

        doc.setFontSize(this.styles.fonts.sizes.text);
        doc.text(titlePageData.dataTypes, centerX, 80, { align: 'center' });
        doc.text(titlePageData.timestamp, centerX, height - 20, { align: 'center' });

        doc.addPage();
    }

    /**
     * Fügt ein dynamisches Inhaltsverzeichnis mit korrekten Seitenzahlen ein
     * @private
     */
    _addTableOfContents(doc, data) {
        // Temporäre Speicherung der Seitenreferenzen
        const pageReferences = {
            therapyStats: null,
            icuStats: null,
            imcStats: null,
            rawData: null
        };
    
        // Dynamische Berechnung der Startseiten
        let currentPage = 3; // Nach Titel und Inhaltsverzeichnis
    
        // Speichere aktuelle Seitenzahlen für jede Statistikart
        if (data.data.therapyStats) {
            pageReferences.therapyStats = {
                startPage: currentPage,
                count: Object.keys(data.data.therapyStats.monthly).length
            };
            currentPage += pageReferences.therapyStats.count;
        }
        
        if (data.data.icuStats) {
            pageReferences.icuStats = {
                startPage: currentPage
            };
            currentPage++;
        }
        
        if (data.data.imcStats) {
            pageReferences.imcStats = {
                startPage: currentPage 
            };
            currentPage++;
        }
    
        if (data.data.rawData) {
            pageReferences.rawData = {
                startPage: currentPage
            };
        }
    
        // Wechsle zur zweiten Seite für Inhaltsverzeichnis
        doc.setPage(2);
    
        // Überschrift für Inhaltsverzeichnis
        doc.setFontSize(this.styles.fonts.sizes.subtitle);
        doc.text('Inhaltsverzeichnis', this.styles.margins.left, 30);
    
        // Einträge für Inhaltsverzeichnis
        doc.setFontSize(this.styles.fonts.sizes.text);
        const entries = [];
    
        if (pageReferences.therapyStats) {
            const { startPage, count } = pageReferences.therapyStats;
            entries.push(`Therapiestatistiken: Seite ${startPage}-${startPage + count - 1}`);
        }
        
        if (pageReferences.icuStats) {
            entries.push(`ICU Schweregradstatistik: Seite ${pageReferences.icuStats.startPage}`);
        }
        
        if (pageReferences.imcStats) {
            entries.push(`IMC Schweregradstatistik: Seite ${pageReferences.imcStats.startPage}`);
        }
    
        if (pageReferences.rawData) {
            entries.push(`Rohdaten der Therapien: Seite ${pageReferences.rawData.startPage}`);
        }
    
        // Einträge mit Abstand ausgeben
        entries.forEach((entry, index) => {
            doc.text(entry, this.styles.margins.left, 50 + (index * 10));
        });
    
        return pageReferences;
    }

    /**
     * Generiert das komplette Dokument
     * @private
     */
    async _generateDocument(doc, data, options) {
        console.log('Generiere PDF-Dokument...');
        
        // Setup und Titelseite
        this._setupDocument(doc, data.metadata);
        await this._generateTitlePage(doc, data.metadata);
        
        // Inhaltsverzeichnis mit Seitenreferenzen
        const pageReferences = this._addTableOfContents(doc, data);
        
        // Statistiken generieren mit den berechneten Seitenreferenzen
        await this._generateStatistics(doc, data.data, pageReferences);
        
        // Fußzeilen hinzufügen
        this._addFooters(doc);
        
        console.log('PDF-Dokument erfolgreich generiert');
    }

    async _generateStatistics(doc, data, pageReferences) {
        // Start mit Therapiestatistiken
        if (data.therapyStats) {
            console.log('Generiere Therapiestatistiken ab Seite:', pageReferences.therapyStats.startPage);
            
            // Explizit auf Seite 3 setzen für Therapiestatistiken
            while (doc.internal.getCurrentPageInfo().pageNumber < pageReferences.therapyStats.startPage) {
                doc.addPage();
            }
            await this._generateTherapyStats(doc, data.therapyStats);
        }
    
        // ICU Statistiken auf neuer Seite
        if (data.icuStats) {
            console.log('Generiere ICU Statistiken ab Seite:', pageReferences.icuStats.startPage);
            
            // Sicherstellen dass wir auf der richtigen Seite sind
            while (doc.internal.getCurrentPageInfo().pageNumber < pageReferences.icuStats.startPage) {
                doc.addPage();
            }
            await this._generateICUStats(doc, data.icuStats);
        }
    
        // IMC Statistiken auf neuer Seite
        if (data.imcStats) {
            console.log('Generiere IMC Statistiken ab Seite:', pageReferences.imcStats.startPage);
            
            // Sicherstellen dass wir auf der richtigen Seite sind
            while (doc.internal.getCurrentPageInfo().pageNumber < pageReferences.imcStats.startPage) {
                doc.addPage();
            }
            await this._generateIMCStats(doc, data.imcStats);
        }
    
        // Rohdaten auf neuer Seite 
        if (data.rawData && Object.keys(data.rawData).length > 0) {
            console.log('Generiere Rohdaten ab Seite:', pageReferences.rawData.startPage);
            
            // Sicherstellen dass wir auf der richtigen Seite sind
            while (doc.internal.getCurrentPageInfo().pageNumber < pageReferences.rawData.startPage) {
                doc.addPage();
            }
            doc.setFontSize(this.styles.fonts.sizes.subtitle);
            doc.text('Rohdaten der Therapien', this.styles.margins.left, 20);
    
            const tableData = this.pdfFormatter.formatRawData(data.rawData);
            const marginTop = this.styles.margins.top || 20;
    
            doc.autoTable({
                ...this.pdfFormatter.getTableConfig(),
                ...tableData,
                startY: 30,
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 35 }, 
                    2: { cellWidth: 20 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 15 },
                    6: { cellWidth: 15 }
                },
                alternateRowStyles: {
                    fillColor: [249, 249, 249]
                },
                didDrawPage: (data) => {
                    data.cursor.y = marginTop;
                }
            });
        }
    }

    /**
     * Generiert Therapiestatistiken
     * @private
     */
    async _generateTherapyStats(doc, stats) {
        // Hole die Seitenmaße am Anfang
        const pageSize = doc.internal.pageSize;
        const marginTop = this.styles.margins.top || 20;
    
        const therapyTitles = {
            'beatmung': 'Beatmungsdauer Statistik',
            'crrt': 'Nierenersatzverfahren Statistik',
            'ila_ecmo': 'Extrakorporale Lungenunterstützung Statistik'
        };
    
        for (const [therapyType, monthlyData] of Object.entries(stats.monthly)) {
            doc.setFontSize(this.styles.fonts.sizes.subtitle);
            doc.text(therapyTitles[therapyType], this.styles.margins.left, 20);
    
            const tableData = this.tableFormatter.formatTherapyStats(monthlyData, therapyType);
            const pdfTable = this.pdfFormatter.formatForAutoTable(tableData);
            
            doc.autoTable({
                ...this.pdfFormatter.getTableConfig(),
                ...pdfTable,
                startY: 30,
                didDrawPage: (data) => {
                    const remainingSpace = pageSize.height - data.cursor.y;
                    if (remainingSpace < 60) {
                        doc.addPage();
                        data.cursor.y = marginTop;
                    }
                }
            });
    
            // Neue Seite nur wenn es noch weitere Therapietypen gibt
            if (therapyType !== Object.keys(stats.monthly).pop()) {
                doc.addPage();
            }
        }
    }

    /**
     * Generiert ICU-Statistiken
     * @private
     */
    async _generateICUStats(doc, stats) {
        const pageSize = doc.internal.pageSize;
        const marginTop = this.styles.margins.top || 20;
    
        doc.setFontSize(this.styles.fonts.sizes.subtitle);
        doc.text('ICU Schweregradstatistik', this.styles.margins.left, 20);
    
        const tableData = this.tableFormatter.formatICUStats(stats.monthly);
        const pdfTable = this.pdfFormatter.formatForAutoTable(tableData);
        
        doc.autoTable({
            ...this.pdfFormatter.getTableConfig(),
            ...pdfTable,
            startY: 30,
            didDrawPage: (data) => {
                const remainingSpace = pageSize.height - data.cursor.y;
                if (remainingSpace < 60) {
                    doc.addPage();
                    data.cursor.y = marginTop;
                }
            }
        });
    }

    /**
     * Generiert IMC-Statistiken
     * @private
     */
    async _generateIMCStats(doc, stats) {
        const pageSize = doc.internal.pageSize;
        const marginTop = this.styles.margins.top || 20;
    
        doc.setFontSize(this.styles.fonts.sizes.subtitle);
        doc.text('IMC Schweregradstatistik', this.styles.margins.left, 20);
    
        const tableData = this.tableFormatter.formatIMCStats(stats.monthly);
        const pdfTable = this.pdfFormatter.formatForAutoTable(tableData);
        
        doc.autoTable({
            ...this.pdfFormatter.getTableConfig(),
            ...pdfTable,
            startY: 30,
            didDrawPage: (data) => {
                const remainingSpace = pageSize.height - data.cursor.y;
                if (remainingSpace < 60) {
                    doc.addPage();
                    data.cursor.y = marginTop;
                }
            }
        });
    }

    /**
     * Fügt Seitenzahlen zu allen Seiten hinzu
     * @private
     */
    _addFooters(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const footerData = this.pdfFormatter.formatFooter(pageCount);
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageSize = doc.internal.pageSize;
            doc.setFontSize(this.styles.fonts.sizes.small);
            doc.text(
                footerData.text.replace('{page}', i),
                pageSize.width / 2,
                pageSize.height - 10,
                { align: 'center' }
            );
        }
    }
}