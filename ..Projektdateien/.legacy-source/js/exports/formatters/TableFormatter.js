// js/exports/formatters/TableFormatter.js

/**
 * Zentrale Klasse für die Formatierung von Tabellendaten
 * Stellt einheitliche Formatierung für verschiedene Export-Formate bereit
 */
export class TableFormatter {
    /**
     * Initialisiert den TableFormatter mit Standard-Optionen
     */
    constructor() {
        // Deutsche Datums- und Zahlenformatierung
        this.numberFormat = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
        
        this.dateFormat = new Intl.DateTimeFormat('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        // Monatsnamen für Tabellenformatierung
        this.months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
    }

    /**
     * Formatiert Therapiestatistiken für Tabellendarstellung
     * @param {Array} monthlyData - Monatliche Statistikdaten
     * @returns {Object} Formatierte Tabellendaten
     */
    formatTherapyStats(monthlyData, therapyType) {
        console.log("Eingehende Daten:", monthlyData);
        // Monate für erste Spalte
        this.months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
    
        // Spaltenkonfiguration pro Therapieart
        const headers = {
            'beatmung': [
                'Monat',
                'Beatmungsdauerstunden',
                'Begonnene Beatmungsdauertage',
                'Ganze Beatmungsdauertage',
                'Beatmungsdauerpatienten',
                'Beatmungsdauerdauer in Tagen'
            ],
            'crrt': [
                'Monat',
                'Nierenersatzverfahrenstunden', 
                'Begonnene Nierenersatzverfahrentage',
                'Ganze Nierenersatzverfahrentage',
                'Nierenersatzverfahrenpatienten',
                'Nierenersatzverfahrendauer in Tagen'
            ],
            'ila_ecmo': [
                'Monat',
                'Extrakorporale Lungenunterstützungstunden',
                'Begonnene Extrakorporale Lungenunterstützungstage', 
                'Ganze Extrakorporale Lungenunterstützungstage',
                'Extrakorporale Lungenunterstützungspatienten',
                'Extrakorporale Lungenunterstützungsdauer in Tagen'
            ]
        };
    
        // Zeilen mit Monatsdaten erstellen
        const rows = monthlyData.map(data => [
            this.months[data.month - 1],
            this._formatNumber(data.totalHours),
            this._formatNumber(data.startedDays),
            this._formatNumber(data.completeDays),
            this._formatNumber(data.uniqueCases),
            this._formatNumber(data.avgDaysPerCase)
        ]);
    
        // Gesamtzeile
        const totals = this._calculateTotals(monthlyData);
        rows.push([
            'Gesamt',
            this._formatNumber(totals.totalHours),
            this._formatNumber(totals.startedDays),
            this._formatNumber(totals.completeDays),
            this._formatNumber(totals.uniqueCases),
            this._formatNumber(totals.avgDaysPerCase)
        ]);
    
        // Durchschnittszeile
        rows.push([
            'Durchschnitt pro Monat',
            this._formatNumber(totals.totalHours / 12),
            this._formatNumber(totals.startedDays / 12),
            this._formatNumber(totals.completeDays / 12),
            this._formatNumber(totals.uniqueCases / 12),
            this._formatNumber(totals.avgDaysPerCase)
        ]);
    
        return {
            headers: headers[therapyType],
            rows: rows
        };
    }

    /**
     * Formatiert ICU-Statistiken für Tabellendarstellung
     * @param {Array} monthlyData - Monatliche ICU-Statistiken
     * @returns {Object} Formatierte Tabellendaten
     */
    formatICUStats(monthlyData) {
        const headers = [
            'Monat',
            'Fälle',
            'Begonnene Beatmungstage',
            'Ganze Beatmungstage',
            'Beatmungsstunden total',
            'Beatmungspatienten',
            'Anteil Beatmungspatienten (%)',
            'Beatmungsdauer pro Patient (d)',
            'Hämofiltrationstage',
            'ECMO-Tage',
            'TISS-28-Punkte',
            'TISS-28 pro Fall'
        ];

        // Zeilen für jeden Monat erstellen
        const rows = monthlyData.map(data => [
            this.months[data.month - 1],
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
        ]);

        // Gesamtzeile berechnen und hinzufügen
        const totals = this._calculateICUTotals(monthlyData);
        rows.push([
            'Gesamt',
            ...Object.values(totals).map(val => this._formatNumber(val))
        ]);

        return { headers, rows };
    }

    /**
     * Formatiert IMC-Statistiken für Tabellendarstellung
     * @param {Array} monthlyData - Monatliche IMC-Statistiken
     * @returns {Object} Formatierte Tabellendaten
     */
    formatIMCStats(monthlyData) {
        const headers = [
            'Monat',
            'Fälle',
            'TISS-28-Punkte',
            'TISS-28 pro Fall'
        ];

        // Zeilen für jeden Monat erstellen
        const rows = monthlyData.map(data => [
            this.months[data.month - 1],
            this._formatNumber(data.cases),
            this._formatNumber(data.tissPoints),
            this._formatNumber(data.tissPerCase)
        ]);

        // Gesamtzeile berechnen und hinzufügen
        const totals = this._calculateIMCTotals(monthlyData);
        rows.push([
            'Gesamt',
            this._formatNumber(totals.cases),
            this._formatNumber(totals.tissPoints),
            this._formatNumber(totals.tissPerCase)
        ]);

        return { headers, rows };
    }

    /**
     * Berechnet Gesamtwerte für Therapiestatistiken
     * @private
     */
    _calculateTotals(monthlyData) {
        const totals = monthlyData.reduce((acc, curr) => ({
            totalHours: acc.totalHours + (curr.totalHours || 0),
            startedDays: acc.startedDays + (curr.startedDays || 0),
            completeDays: acc.completeDays + (curr.completeDays || 0),
            uniqueCases: acc.uniqueCases + (curr.uniqueCases || 0)
        }), {
            totalHours: 0,
            startedDays: 0,
            completeDays: 0,
            uniqueCases: 0
        });

        // Durchschnittliche Therapiedauer berechnen
        totals.avgDaysPerCase = totals.uniqueCases > 0 
            ? totals.startedDays / totals.uniqueCases 
            : 0;

        return totals;
    }

    /**
     * Berechnet Gesamtwerte für ICU-Statistiken
     * @private
     */
    _calculateICUTotals(monthlyData) {
        const totals = monthlyData.reduce((acc, curr) => ({
            cases: acc.cases + (curr.cases || 0),
            startedVentDays: acc.startedVentDays + (curr.startedVentDays || 0),
            completeVentDays: acc.completeVentDays + (curr.completeVentDays || 0),
            ventHours: acc.ventHours + (curr.ventHours || 0),
            ventPatients: acc.ventPatients + (curr.ventPatients || 0),
            crrtDays: acc.crrtDays + (curr.crrtDays || 0),
            ecmoDays: acc.ecmoDays + (curr.ecmoDays || 0),
            tissPoints: acc.tissPoints + (curr.tissPoints || 0)
        }), {
            cases: 0,
            startedVentDays: 0,
            completeVentDays: 0,
            ventHours: 0,
            ventPatients: 0,
            crrtDays: 0,
            ecmoDays: 0,
            tissPoints: 0
        });

        // Berechnete Werte
        totals.ventPercentage = totals.cases > 0
            ? (totals.ventPatients / totals.cases * 100)
            : 0;

        totals.avgVentDuration = totals.ventPatients > 0
            ? totals.startedVentDays / totals.ventPatients
            : 0;

        totals.tissPerCase = totals.cases > 0
            ? totals.tissPoints / totals.cases
            : 0;

        return totals;
    }

    /**
     * Berechnet Gesamtwerte für IMC-Statistiken
     * @private
     */
    _calculateIMCTotals(monthlyData) {
        const totals = monthlyData.reduce((acc, curr) => ({
            cases: acc.cases + (curr.cases || 0),
            tissPoints: acc.tissPoints + (curr.tissPoints || 0)
        }), {
            cases: 0,
            tissPoints: 0
        });

        // TISS pro Fall berechnen
        totals.tissPerCase = totals.cases > 0
            ? totals.tissPoints / totals.cases
            : 0;

        return totals;
    }

    /**
     * Formatiert eine Zahl einheitlich
     * @private
     */
    _formatNumber(value) {
        if (value === undefined || value === null) return '-';
        return this.numberFormat.format(value);
    }

    /**
     * Formatiert ein Datum einheitlich
     * @private
     */
    _formatDate(date) {
        if (!date) return '-';
        return this.dateFormat.format(new Date(date));
    }

    /**
     * Formatiert Rohdaten für tabellarische Darstellung
     * @param {Object} rawData - Die Rohdaten nach Datum/Therapie strukturiert
     * @returns {Object} Formatierte Tabellendaten mit headers und rows
     */
    formatRawData(rawData) {
        console.log('Raw Data erhalten:', rawData);
    
        const headers = [
            'Datum',
            'Therapieart', 
            'Fallnummer',
            'Name',
            'Behandlungsstunden',
            'Von',
            'Bis'
        ];
    
        const rows = [];
        
        if (!rawData || typeof rawData !== 'object') {
            console.error('Ungültige rawData:', rawData);
            return { headers, rows };
        }
    
        // Wenn die Daten in dailyEntries verschachtelt sind, nehmen wir diese
        const entries = rawData.dailyEntries || rawData;
    
        Object.entries(entries).forEach(([date, therapies]) => {
            console.log('Verarbeite Datum:', date, 'Therapien:', therapies);
            
            if (!therapies || typeof therapies !== 'object') {
                console.warn(`Ungültige Therapiedaten für Datum ${date}:`, therapies);
                return;
            }
    
            Object.entries(therapies).forEach(([therapy, patients]) => {
                console.log('Verarbeite Therapie:', therapy, 'Daten:', patients);
                
                if (!Array.isArray(patients)) {
                    console.warn(`Keine gültigen Patientendaten für ${therapy} am ${date}`);
                    return;
                }
    
                patients.forEach(patient => {
                    if (!patient || typeof patient !== 'object') {
                        console.warn('Ungültiger Patient:', patient);
                        return;
                    }
    
                    // Aktive Stunden ermitteln
                    const hours = patient.hours || [];
                    const activeHours = hours.reduce((acc, hour, index) => {
                        if (hour) acc.push(index);
                        return acc;
                    }, []);
    
                    // Therapieart übersetzen
                    const therapyName = {
                        'beatmung': 'Beatmungsdauer',
                        'crrt': 'Nierenersatzverfahren',  
                        'ila_ecmo': 'Extrakorporale Lungenunterstützung'
                    }[therapy] || therapy;
    
                    // Zeile formatieren
                    rows.push([
                        this._formatDate(date),
                        therapyName,
                        patient.caseNumber || '-',
                        patient.name || '-',
                        this._formatNumber(activeHours.length),
                        activeHours.length ? `${String(activeHours[0]).padStart(2, '0')}:00` : '-',
                        activeHours.length ? `${String(activeHours[activeHours.length - 1]).padStart(2, '0')}:59` : '-'
                    ]);
                });
            });
        });
    
        console.log('Formatierte Daten:', { headers, rows });
        return { headers, rows };
    }
}