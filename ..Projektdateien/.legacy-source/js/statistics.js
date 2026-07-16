// js/statistics.js
import { ReactErrorBoundary, createSafeRoot } from './reactV18Check.js';
import { db } from './dbConfig.js';
import StatisticsTableWithProjections from './projections/components/StatisticsTableWithProjections.js';
import SeverityTableWithProjections from './projections/components/SeverityTableWithProjections.js';

// js/statistics/StatisticsManager.js

console.log('StatisticsManager Modul wird geladen:', new Error().stack);

export class StatisticsManager {    
    static instance = null;
    static initialized = false; // Neues Static Flag

    constructor() {
        // Singleton-Check
        if (StatisticsManager.instance) {
            console.log('Bestehende StatisticsManager-Instanz zurückgegeben');
            return StatisticsManager.instance;
        }
    
        // Container-Initialisierung
        this.container = document.getElementById('statistics-container');
        if (!this.container) {
            throw new Error('Statistics container not found');
        }
        
        // Basis-Properties
        this.selectedYear = new Date().getFullYear();
        this.yearSelectorRoot = null;
        StatisticsManager.instance = this;
    
        // Event Handler für Jahreswechsel
        this._yearChangedHandler = async (event) => {
            try {
                const { year } = event.detail;
                console.log(`Jahr geändert zu: ${year}`);
                
                // Setze das neue Jahr
                this.selectedYear = year;
                
                // Aktualisiere die Tabellen
                await this.updateTables(year);
                
                // Icons aktualisieren
                lucide.createIcons();
            } catch (error) {
                console.error('Fehler beim Jahreswechsel:', error);
                // Fehler-Container direkt in unserem this.container anzeigen
                const errorContainer = document.createElement('div');
                errorContainer.className = 'error-message';
                errorContainer.textContent = 'Fehler beim Aktualisieren der Statistiken';
                this.container.prepend(errorContainer);
            }
        };
    
        // Event Listener registrieren
        window.addEventListener('yearChanged', this._yearChangedHandler);
    }
    
    // Cleanup-Methode hinzufügen
    cleanup() {
        window.removeEventListener('yearChanged', this._yearChangedHandler);
    }
    
    async initializeYearSelector() {
        try {
            const { default: YearSelector } = await import('./components/year-selector-component.js');
            this.yearSelectorRoot = document.getElementById('year-selector-root');
            
            if (this.yearSelectorRoot) {
                const root = createSafeRoot(this.yearSelectorRoot, 'YearSelector');
                root.render(
                    React.createElement(ReactErrorBoundary, null,
                        React.createElement(YearSelector, {
                            onYearChange: async (year) => {
                                await this.setYear(year);
                            }
                        })
                    )
                );
            }
        } catch (error) {
            console.error('Error initializing year selector:', error);
        }
    }

    async initialize() {
        if (StatisticsManager.initialized) {
            console.log('StatisticsManager bereits initialisiert');
            return;
        }

        try {
            console.log(`Initializing statistics for year ${this.selectedYear}`);
            
            await db.ensureInit();
            
            await this.initializeYearSelector();
            
            const therapyTypes = await db.getActiveTherapyTypes();
            console.log('Loaded therapy types:', therapyTypes);
                
            if (!Array.isArray(therapyTypes) || therapyTypes.length === 0) {
                console.warn('No active therapy types found');
                return;
            }

            // Container leeren bevor neue Tabellen erstellt werden
            const container = document.getElementById('statistics-container');
            if (container) {
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
            }

            // Tabellen erstellen
            for (const therapy of therapyTypes) {
                try {
                    await this.createYearlyStatisticsTable(therapy); 
                } catch (error) {
                    console.error(`Error creating table for ${therapy.id}:`, error);
                    continue;
                }
            }
                
            await this.createSeverityStatisticsTables();

            StatisticsManager.initialized = true;
            console.log('Statistics initialization complete');

        } catch (error) {
            console.error('Error initializing statistics:', error);
            throw error;
        }
    }

    async setYear(year) {
        try {
            console.log('Setting year to:', year);
            this.selectedYear = year; 
            await this.updateTables(year); // Jahr explizit übergeben
            console.log(`Successfully updated tables for year ${year}`);
        } catch (error) {
            console.error('Error setting year:', error);
            throw error;
        }
    }

    async updateTables(year) {
        try {
            console.log(`--- Jahreswechsel: Aktualisiere Tabellen für Jahr ${year} ---`);
    
            // Logging der bestehenden Tabellen
            console.log('Vor Cleanup: Enthaltene Tabellen:', this.container.children.length);
            this.container.querySelectorAll('.statistics-table').forEach(table => {
                console.log('Gefundene Tabelle vor Cleanup:', table.id);
            });
    
            // Cleanup mit React-Unmounting
            while (this.container.firstChild) {
                if (this.container.firstChild._reactRootContainer) {
                    this.container.firstChild._reactRootContainer.unmount();
                }
                this.container.firstChild.remove();
            }
    
            console.log('Nach Cleanup: Enthaltene Tabellen:', this.container.children.length);
    
            // Neue Tabellen erstellen
            console.log(`Erstelle neue Tabellen für Jahr ${year}`);
            
            // 1. Erst die Therapiestatistiken
            const therapyTypes = await db.getActiveTherapyTypes();
            for (const therapy of therapyTypes) {
                await this.createYearlyStatisticsTable(therapy, year);
            }
    
            // 2. Dann die Schweregradstatistiken
            console.log('Erstelle Schweregradstatistiken');
            await this.createSeverityStatisticsTables(year);
    
            // Abschließende Prüfung
            console.log('Nach Erstellung: Enthaltene Tabellen:', this.container.children.length);
            
        } catch (error) {
            console.error('Fehler beim Aktualisieren der Tabellen:', error);
            throw error;
        }
    }
        
    // Hilfsfunktion zum Laden der Statistikdaten
    async loadStatisticsData(therapyId, year) {
        try {
            // Hole die monatlichen Daten
            const monthlyData = [];
            for(let month = 1; month <= 12; month++) {
                const stats = await db.getMonthlyStatistics(year, month, therapyId);
                if(stats) {
                    monthlyData.push({
                        month: month,
                        ...stats.statistics
                    });
                }
            }
            
            return monthlyData;
        } catch (error) {
            console.error(`Error loading statistics data for ${therapyId}:`, error);
            throw error;
        }
    }

    async calculateInitialStatistics(therapyTypes) {
        try {
            console.log('Starting initial statistics calculation...');
            
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;
            
            // Array für Validierungsergebnisse
            const validationResults = [];
            
            // Berechne zuerst alle Statistiken
            for (const therapy of therapyTypes) {
                console.log(`Calculating statistics for ${therapy.id}`);
                
                // Monatliche Statistiken
                for (let month = 1; month <= currentMonth; month++) {
                    await db.calculateMonthlyStatistics(currentYear, month, therapy.id);
                }
                
                // Jahresstatistik
                await db.calculateYearlyStatistics(currentYear, therapy.id);
                
                // Validiere die Statistiken
                console.log(`Validating statistics for ${therapy.id}`);
                const validationResult = await this.validateStatistics(currentYear, therapy.id);
                validationResults.push({
                    therapyType: therapy.id,
                    ...validationResult
                });
            }
            
            // Logge Validierungsergebnisse
            console.log('Validation results for all therapy types:', validationResults);
            
            // Erstelle die Tabellen
            console.log('Creating and updating tables...');
            for (const therapy of therapyTypes) {
                await this.createYearlyStatisticsTable(therapy);
            }
            
            // Erstelle die Schweregradstatistik-Tabellen
            await this.createSeverityStatisticsTables();
            
            // Wenn Validierungsfehler gefunden wurden, zeige Warnung
            const hasInconsistencies = validationResults.some(result => !result.isValid);
            if (hasInconsistencies) {
                console.warn('Some statistics show inconsistencies, check validation results for details');
            }
            
            console.log('Initial statistics calculation completed');
            
            return {
                success: true,
                validationResults,
                hasInconsistencies
            };
            
        } catch (error) {
            console.error('Detailed error in calculateInitialStatistics:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            throw error;
        }
    }

    async validateStatistics(year, therapyType) {
        try {
            console.log(`Validating statistics for ${year} ${therapyType}`);
    
            // Hole Jahres- und Monatsstatistiken
            const yearStats = await db.getYearlyStatistics(year, therapyType);
            const monthlyStats = [];
            for (let month = 1; month <= 12; month++) {
                const monthStat = await db.getMonthlyStatistics(year, month, therapyType);
                if (monthStat) {
                    monthlyStats.push(monthStat);
                }
            }
    
            const validationResults = {
                uniqueCases: {
                    yearly: new Set(yearStats?.statistics?.uniqueCases || []),
                    monthly: new Set()
                },
                continuedCases: {
                    yearly: new Set(yearStats?.statistics?.continuedCases || []),
                    monthly: new Set()
                },
                hours: {
                    yearly: yearStats?.statistics?.totalHours || 0,
                    monthlySum: 0
                },
                inconsistencies: []
            };
    
            // Sammle alle monatlichen Fälle
            monthlyStats.forEach(month => {
                if (!month?.statistics) return;
    
                // Neue Fälle
                month.statistics.uniqueCases?.forEach(caseNumber => 
                    validationResults.uniqueCases.monthly.add(caseNumber)
                );
    
                // Fortgeführte Fälle
                month.statistics.continuedCases?.forEach(caseNumber => 
                    validationResults.continuedCases.monthly.add(caseNumber)
                );
    
                // Stunden
                validationResults.hours.monthlySum += month.statistics.totalHours || 0;
            });
    
            // Prüfe auf Inkonsistenzen
            if (validationResults.uniqueCases.yearly.size !== validationResults.uniqueCases.monthly.size) {
                validationResults.inconsistencies.push({
                    type: 'uniqueCases',
                    message: 'Diskrepanz in der Anzahl einzigartiger Fälle',
                    yearly: validationResults.uniqueCases.yearly.size,
                    monthly: validationResults.uniqueCases.monthly.size
                });
            }
    
            if (validationResults.continuedCases.yearly.size !== validationResults.continuedCases.monthly.size) {
                validationResults.inconsistencies.push({
                    type: 'continuedCases',
                    message: 'Diskrepanz in der Anzahl fortgeführter Fälle',
                    yearly: validationResults.continuedCases.yearly.size,
                    monthly: validationResults.continuedCases.monthly.size
                });
            }
    
            if (Math.abs(validationResults.hours.yearly - validationResults.hours.monthlySum) > 0.01) {
                validationResults.inconsistencies.push({
                    type: 'hours',
                    message: 'Diskrepanz in den Gesamtstunden',
                    yearly: validationResults.hours.yearly,
                    monthlySum: validationResults.hours.monthlySum
                });
            }
    
            // Detailliertes Logging
            console.log('Validation results:', {
                year,
                therapyType,
                uniqueCasesYearly: validationResults.uniqueCases.yearly.size,
                uniqueCasesMonthly: validationResults.uniqueCases.monthly.size,
                continuedCasesYearly: validationResults.continuedCases.yearly.size,
                continuedCasesMonthly: validationResults.continuedCases.monthly.size,
                hoursYearly: validationResults.hours.yearly,
                hoursMonthly: validationResults.hours.monthlySum,
                inconsistencies: validationResults.inconsistencies
            });
    
            // Wenn Inkonsistenzen gefunden wurden, logge eine Warnung
            if (validationResults.inconsistencies.length > 0) {
                console.warn('Statistics validation found inconsistencies:', 
                    validationResults.inconsistencies);
                
                // Optional: Trigger für automatische Korrektur
                await this.handleStatisticsInconsistencies(year, therapyType, validationResults);
            }
    
            return {
                isValid: validationResults.inconsistencies.length === 0,
                results: validationResults
            };
    
        } catch (error) {
            console.error('Error validating statistics:', error);
            throw error;
        }
    }
    
    // Hilfsmethode zum Umgang mit Inkonsistenzen
    async handleStatisticsInconsistencies(year, therapyType, validationResults) {
        try {
            console.log('Handling statistics inconsistencies for:', {year, therapyType});
            
            // Hier könnten wir automatische Korrekturen implementieren
            // Für den Anfang loggen wir nur die Details
            
            return {
                handled: false,
                reason: 'Automatic correction not implemented yet',
                details: validationResults.inconsistencies
            };
        } catch (error) {
            console.error('Error handling statistics inconsistencies:', error);
            throw error;
        }
    }

    async createYearlyStatisticsTable(therapy) {
        try {
            console.log(`Erstelle Statistiktabelle für ${therapy.id}`);
    
            // Prüfen ob bereits eine Tabelle für diese Therapie existiert
            const existingTable = document.getElementById(`${therapy.id}-statistics-${this.selectedYear}`);
            if (existingTable && existingTable._reactRootContainer) {
                // Wenn ja, existierenden Root unmounten
                existingTable._reactRootContainer.unmount();
                delete existingTable._reactRootContainer;
                existingTable.remove();
            }
            
            // Container erstellen
            const table = document.createElement('section');
            table.id = `${therapy.id}-statistics-${this.selectedYear}`; // Eindeutige ID
            table.className = 'statistics-table';
    
            // Daten für die Tabelle vorbereiten
            const monthlyData = [];
            
            // Lade Daten für jeden Monat
            for (let month = 1; month <= 12; month++) {
                try {
                    const stats = await db.getMonthlyStatistics(
                        this.selectedYear, 
                        month, 
                        therapy.id
                    );
                    
                    if (stats?.statistics) {
                        monthlyData.push({
                            month,
                            totalHours: stats.statistics.totalHours || 0,
                            startedDays: stats.statistics.startedDays || 0,
                            completeDays: Math.floor((stats.statistics.totalHours || 0) / 24),
                            uniqueCases: stats.statistics.uniqueCases || [],
                            historicalData: await this.getHistoricalData(
                                this.selectedYear - 1, 
                                month, 
                                therapy.id
                            )
                        });
                    } else {
                        console.log(`Keine Daten für ${therapy.id} im Monat ${month}`);
                    }
                } catch (error) {
                    console.error(`Fehler beim Laden der Daten für Monat ${month}:`, error);
                    monthlyData.push({
                        month,
                        totalHours: 0,
                        startedDays: 0,
                        completeDays: 0,
                        uniqueCases: [],
                        historicalData: null
                    });
                }
            }
    
            // React-Komponente initialisieren
            const root = createSafeRoot(table, 'StatisticsTable');
            root.render(
                React.createElement(ReactErrorBoundary, null,
                    React.createElement(StatisticsTableWithProjections, {
                        therapyType: therapy.displayName,
                        year: this.selectedYear,
                        data: monthlyData
                    })
                )
            );
    
            // Füge Tabelle zum Container hinzu  
            this.container.appendChild(table);
            
            console.log(`Statistiktabelle für ${therapy.id} erfolgreich erstellt`);
            return table;
            
        } catch (error) {
            console.error(`Fehler beim Erstellen der Statistiktabelle für ${therapy.id}:`, error);
            throw error;
        }
    }

        // Neue Hilfsmethode für historische Daten
        async getHistoricalData(year, month, therapyId) {
            try {
                const stats = await db.getMonthlyStatistics(year, month, therapyId);
                return stats?.statistics || null;
            } catch (error) {
                console.error(`Fehler beim Laden historischer Daten für ${year}-${month}:`, error);
                return null;
            }
        }
    

    async updateProjections(therapyId, year) {
        try {
            const table = document.getElementById(`${therapyId}-statistics-${year}`);
            if (!table) return;

            const rows = table.querySelectorAll('tr[data-month]');
            rows.forEach(async (row) => {
                const month = parseInt(row.dataset.month);
                const currentValue = parseFloat(row.querySelector('.hours').textContent);
                
                if (currentValue > 0) {
                    const projection = await this.calculateProjection(currentValue, month);
                    const projectionCell = row.querySelector('.projection-column');
                    if (projectionCell) {
                        projectionCell.textContent = projection.toFixed(1);
                    }
                }
            });
        } catch (error) {
            console.error('Error updating projections:', error);
        }
    }

    // Hilfsmethode für die Berechnung der Hochrechnung
    calculateProjection(currentValue, currentMonth) {
        // Einfache lineare Hochrechnung
        const remainingMonths = 12 - currentMonth;
        const monthlyAverage = currentValue / currentMonth;
        return currentValue + (monthlyAverage * remainingMonths);
    }
    
    generateMonthRows() {
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
    
        return months.map((month, index) => `
            <tr data-month="${index + 1}">
                <td>${month}</td>
                <td class="value hours">0</td>
                <td class="value started-days">0</td>
                <td class="value complete-days">0</td>
                <td class="value unique-cases">0</td>
                <td class="value days-per-case">0.0</td>
            </tr>
        `).join('');
    }
    
    generateSummaryRows() {
        return `
            <tr class="summary">
                <td>Gesamt</td>
                <td class="total hours">0</td>
                <td class="total started-days">0</td>
                <td class="total complete-days">0</td>
                <td class="total unique-cases">0</td>
                <td class="total days-per-case">0.0</td>
            </tr>
            <tr class="average">
                <td>Durchschnitt pro Monat</td>
                <td class="avg hours">0.0</td>
                <td class="avg started-days">0.0</td>
                <td class="avg complete-days">0.0</td>
                <td class="avg unique-cases">0.0</td>
                <td class="avg days-per-case">0.0</td>
            </tr>
        `;
    }

    async updateStatistics(therapyId, year) {
        try {
            const table = document.getElementById(`${therapyId}-statistics-${year}`);
            if (!table) return;

            // Update monthly rows
            for (let month = 1; month <= 12; month++) {
                const stats = await db.getMonthlyStatistics(year, month, therapyId);
                if (stats) {
                    const row = table.querySelector(`tr[data-month="${month}"]`);
                    if (row) {
                        this.updateMonthlyRow(row, stats);
                    }
                }
            }

            // Update summary rows
            await this.updateYearlySummary(therapyId, year);
        } catch (error) {
            console.error(`Error updating statistics for ${therapyId}:`, error);
            throw error;
        }
    }

    async updateYearlySummary(therapyId, year) {
        try {
            const yearlyStats = await db.getYearlyStatistics(year, therapyId);
            if (!yearlyStats) return;
    
            const table = document.getElementById(`${therapyId}-statistics-${year}`);
            if (!table) return;
    
            const totalRow = table.querySelector('tr.summary');
            const avgRow = table.querySelector('tr.average');
    
            if (totalRow && avgRow) {
                // Update total values
                totalRow.querySelector('.hours').textContent = yearlyStats.statistics.totalHours || '0';
                totalRow.querySelector('.started-days').textContent = yearlyStats.statistics.startedDays || '0';
                totalRow.querySelector('.complete-days').textContent = 
                    Math.floor(yearlyStats.statistics.totalHours / 24) || '0';
                totalRow.querySelector('.unique-cases').textContent = 
                    yearlyStats.statistics.uniqueCases?.length || '0';
                
                const avgDays = yearlyStats.statistics.uniqueCases?.length > 0
                    ? (yearlyStats.statistics.startedDays / yearlyStats.statistics.uniqueCases.length).toFixed(1)
                    : '0.0';
                totalRow.querySelector('.days-per-case').textContent = avgDays;
    
                // Update average values
                avgRow.querySelector('.hours').textContent = 
                    (yearlyStats.statistics.totalHours / 12).toFixed(1);
                avgRow.querySelector('.started-days').textContent = 
                    (yearlyStats.statistics.startedDays / 12).toFixed(1);
                avgRow.querySelector('.complete-days').textContent = 
                    (Math.floor(yearlyStats.statistics.totalHours / 24) / 12).toFixed(1);
                avgRow.querySelector('.unique-cases').textContent = 
                    (yearlyStats.statistics.uniqueCases?.length / 12).toFixed(1);
                avgRow.querySelector('.days-per-case').textContent = 
                    yearlyStats.statistics.daysPerCase?.toFixed(1) || '0.0';
            }
        } catch (error) {
            console.error(`Error updating yearly summary for ${therapyId}:`, error);
            throw error;
        }
    }

    updateMonthlyRow(row, stats) {
        if (!row || !stats || !stats.statistics) return;

        row.querySelector('.hours').textContent = stats.statistics.totalHours || '0';
        row.querySelector('.started-days').textContent = stats.statistics.startedDays || '0';
        row.querySelector('.complete-days').textContent = Math.floor((stats.statistics.totalHours || 0) / 24);
        row.querySelector('.unique-cases').textContent = stats.statistics.uniqueCases?.length || '0';
        
        const avgDays = stats.statistics.uniqueCases?.length > 0
            ? (stats.statistics.startedDays / stats.statistics.uniqueCases.length).toFixed(1)
            : '0.0';
        row.querySelector('.days-per-case').textContent = avgDays;
    }

    async createSeverityStatisticsTables(year) {
        try {
            console.log(`Creating severity statistics tables for year ${year}`);
    
            // ICU Tabelle 
            const icuContainer = document.createElement('section');
            icuContainer.id = `icu-severity-${year}`; 
            icuContainer.className = 'statistics-table severity-table';
            
            const icuData = await this.prepareICUData(year);
            
            const icuRoot = createSafeRoot(icuContainer, 'ICUSeverityTable');
            icuRoot.render(
                React.createElement(ReactErrorBoundary, null,
                    React.createElement(SeverityTableWithProjections, {
                        tableType: 'ICU',
                        year: year,
                        data: icuData
                    })
                )
            );
    
            // IMC Tabelle
            const imcContainer = document.createElement('section');
            imcContainer.id = `imc-severity-${year}`;
            imcContainer.className = 'statistics-table severity-table';
            
            const imcData = await this.prepareIMCData(year);
            
            const imcRoot = createSafeRoot(imcContainer, 'IMCSeverityTable');
            imcRoot.render(
                React.createElement(ReactErrorBoundary, null,
                    React.createElement(SeverityTableWithProjections, {
                        tableType: 'IMC',
                        year: year,
                        data: imcData
                    })
                )
            );
    
            // Tabellen zum korrekten Container hinzufügen
            this.container.appendChild(icuContainer);
            this.container.appendChild(imcContainer);
    
            console.log('Severity tables created successfully');
    
        } catch (error) {
            console.error('Error creating severity tables:', error);
            throw error;
        }
    }
    
    // Neue Hilfsfunktion für ICU-Daten
    async prepareICUData() {
        const icuData = [];
        
        for(let month = 1; month <= 12; month++) {
            try {
                // Basis-Daten (Fälle und TISS)
                const [cases, tissPoints] = await Promise.all([
                    db.getFallbuchCasesMonthly(this.selectedYear, month, 'ICU'),
                    db.getTISS28PointsMonthly(this.selectedYear, month, 'ICU')
                ]);

                // Therapie-Statistiken
                const [beatmungStats, crrtStats, ecmoStats] = await Promise.all([
                    db.getMonthlyStatistics(this.selectedYear, month, 'beatmung'),
                    db.getMonthlyStatistics(this.selectedYear, month, 'crrt'),
                    db.getMonthlyStatistics(this.selectedYear, month, 'ila_ecmo')
                ]);

                // Monatsdaten zusammenstellen
                const monthData = {
                    month: month,
                    cases: cases || 0,
                    tissPoints: tissPoints || 0,
                    startedVentDays: beatmungStats?.statistics?.startedDays || 0,
                    completeVentDays: beatmungStats?.statistics?.totalHours 
                        ? Math.floor(beatmungStats.statistics.totalHours / 24) 
                        : 0,
                    ventHours: beatmungStats?.statistics?.totalHours || 0,
                    ventPatients: beatmungStats?.statistics?.uniqueCases?.length || 0,
                    ventPercentage: cases > 0 && beatmungStats?.statistics?.uniqueCases
                        ? ((beatmungStats.statistics.uniqueCases.length / cases) * 100).toFixed(1)
                        : '0.0',
                    avgVentDuration: beatmungStats?.statistics?.uniqueCases?.length > 0
                        ? (beatmungStats.statistics.startedDays / beatmungStats.statistics.uniqueCases.length).toFixed(1)
                        : '0.0',
                    crrtDays: crrtStats?.statistics?.startedDays || 0,
                    ecmoDays: ecmoStats?.statistics?.startedDays || 0,
                    tissPerCase: cases > 0 && tissPoints
                        ? (tissPoints / cases).toFixed(1)
                        : '0.0'
                };

                icuData.push(monthData);
                console.log(`Prepared ICU data for ${this.selectedYear}-${month}:`, monthData);

            } catch (error) {
                console.error(`Error preparing ICU data for month ${month}:`, error);
                // Füge Leerdaten ein um die Struktur zu erhalten
                icuData.push({
                    month: month,
                    cases: 0,
                    tissPoints: 0,
                    startedVentDays: 0,
                    completeVentDays: 0,
                    ventHours: 0,
                    ventPatients: 0,
                    ventPercentage: '0.0',
                    avgVentDuration: '0.0',
                    crrtDays: 0,
                    ecmoDays: 0,
                    tissPerCase: '0.0'
                });
            }
        }

        return icuData;
    }

    //Neue Hilfsfunktion für IMC
    async prepareIMCData() {
        const imcData = [];
        
        for(let month = 1; month <= 12; month++) {
            try {
                // Basis-Daten (Fälle und TISS)
                const [cases, tissPoints] = await Promise.all([
                    db.getFallbuchCasesMonthly(this.selectedYear, month, 'IMC'),
                    db.getTISS28PointsMonthly(this.selectedYear, month, 'IMC')
                ]);
    
                // Monatsdaten zusammenstellen
                const monthData = {
                    month: month,
                    cases: cases || 0,
                    tissPoints: tissPoints || 0,
                    tissPerCase: cases > 0 && tissPoints
                        ? (tissPoints / cases).toFixed(1)
                        : '0.0'
                };
    
                imcData.push(monthData);
                console.log(`Prepared IMC data for ${this.selectedYear}-${month}:`, monthData);
    
            } catch (error) {
                console.error(`Error preparing IMC data for month ${month}:`, error);
                // Füge Leerdaten ein um die Struktur zu erhalten
                imcData.push({
                    month: month,
                    cases: 0,
                    tissPoints: 0,
                    tissPerCase: '0.0'
                });
            }
        }
    
        return imcData;
    }

    async createICUSeverityTable() {
        try {
            const table = document.createElement('section');
            table.className = 'statistics-table severity-table';
            table.id = `icu-severity-${this.selectedYear}`;
            
            // Monatszeilen generieren
            const months = [
                'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
            ];
            
            let monthRows = '';
            months.forEach((month, idx) => {
                monthRows += `
                    <tr id="icu-severity-row-${this.selectedYear}-${idx + 1}">
                        <td>${month}</td>
                        <td class="cases-input" contenteditable="true">0</td>
                        <td class="value beatmung-days">0</td>
                        <td class="value complete-days">0</td>
                        <td class="value beatmung-hours">0</td>
                        <td class="value beatmung-patients">0</td>
                        <td class="value beatmung-percentage">0.0</td>
                        <td class="value avg-beatmung-days">0.0</td>
                        <td class="value crrt-days">0</td>
                        <td class="value ecmo-days">0</td>
                        <td class="tiss-input" contenteditable="true">0</td>
                        <td class="value tiss-per-case">0.0</td>
                    </tr>
                `;
            });
            
            table.innerHTML = `
                <h2>Schweregradstatistik ${this.selectedYear}, Intensivstation 10</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Monat</th>
                                <th>Fälle</th>
                                <th>Begonnene Beatmungstage</th>
                                <th>Ganze Beatmungstage</th>
                                <th>Beatmungsstunden total</th>
                                <th>Beatmungspatienten</th>
                                <th>Anteil Beatmungspatienten in %</th>
                                <th>Durchschnittliche Beatmungsdauer in Tagen</th>
                                <th>Hämofiltrationstage</th>
                                <th>ECMO-Tage</th>
                                <th>TISS-28-Punkte</th>
                                <th>TISS-28-Punkte pro Fall</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthRows}
                            <tr id="icu-severity-total-${this.selectedYear}" class="summary">
                                <td>Gesamt</td>
                                <td class="total-cases">0</td>
                                <td class="total-beatmung-days">0</td>
                                <td class="total-complete-days">0</td>
                                <td class="total-beatmung-hours">0</td>
                                <td class="total-beatmung-patients">0</td>
                                <td class="total-beatmung-percentage">0.0</td>
                                <td class="total-avg-beatmung-days">0.0</td>
                                <td class="total-crrt-days">0</td>
                                <td class="total-ecmo-days">0</td>
                                <td class="total-tiss">0</td>
                                <td class="total-tiss-per-case">0.0</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
    
            // DOM Update und Daten laden
            if (this.mainContainer) {
                this.mainContainer.appendChild(table);
            }
    
            // Monatsdaten laden
            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                const monthNumber = monthIndex + 1;
                
                try {
                    const [cases, tissPoints] = await Promise.all([
                        db.getFallbuchCasesMonthly(this.selectedYear, monthNumber, 'ICU'),
                        db.getTISS28PointsMonthly(this.selectedYear, monthNumber, 'ICU')
                    ]);
                    
                    console.log(`Loaded values for ${this.selectedYear}-${monthNumber}:`, { cases, tissPoints });
            
                    // Lade die Therapiedauer-Statistiken für diesen Monat
                    const [monthStats, crrtStats, ecmoStats] = await Promise.all([
                        db.getMonthlyStatistics(this.selectedYear, monthNumber, 'beatmung'),
                        db.getMonthlyStatistics(this.selectedYear, monthNumber, 'crrt'),
                        db.getMonthlyStatistics(this.selectedYear, monthNumber, 'ila_ecmo')
                    ]);
            
                    // Setze die Werte in die Eingabefelder des entsprechenden Monats
                    const row = table.querySelector(`#icu-severity-row-${this.selectedYear}-${monthNumber}`);
                    if (row) {
                        
                                // Setze manuelle Eingaben
                                const casesInput = row.querySelector('.cases-input');
                                const tissInput = row.querySelector('.tiss-input');
                                
                                if (casesInput && cases !== null) {
                                    casesInput.textContent = cases;
                                }
                                if (tissInput && tissPoints !== null) {
                                    tissInput.textContent = tissPoints;
                                }

                                // Setze die berechneten Werte
                                if (monthStats?.statistics) {
                                    row.querySelector('.beatmung-days').textContent = 
                                        monthStats.statistics.startedDays || '0';
                                    row.querySelector('.complete-days').textContent = 
                                        Math.floor(monthStats.statistics.totalHours / 24) || '0';
                                    row.querySelector('.beatmung-hours').textContent = 
                                        monthStats.statistics.totalHours || '0';
                                    row.querySelector('.beatmung-patients').textContent = 
                                        monthStats.statistics.uniqueCases?.length || '0';
                                    
                                    // Berechne Prozentsatz der Beatmungspatienten
                                    const beatmungPercentage = cases > 0
                                        ? ((monthStats.statistics.uniqueCases?.length / cases) * 100).toFixed(1)
                                        : '0.0';
                                    row.querySelector('.beatmung-percentage').textContent = beatmungPercentage;
                                    
                                    // Berechne durchschnittliche Beatmungsdauer
                                    const avgDays = monthStats.statistics.uniqueCases?.length > 0
                                        ? (monthStats.statistics.startedDays / monthStats.statistics.uniqueCases?.length).toFixed(1)
                                        : '0.0';
                                    row.querySelector('.avg-beatmung-days').textContent = avgDays;
                                }

                                if (crrtStats?.statistics) {
                                    row.querySelector('.crrt-days').textContent = 
                                        crrtStats.statistics.startedDays || '0';
                                }

                                if (ecmoStats?.statistics) {
                                    row.querySelector('.ecmo-days').textContent = 
                                        ecmoStats.statistics.startedDays || '0';
                                }

                                // Berechne TISS pro Fall
                                if (cases > 0 && tissPoints) {
                                    row.querySelector('.tiss-per-case').textContent = 
                                        (tissPoints / cases).toFixed(1);
                                }
                            }
                        } catch (error) {
                            console.error(`Error loading data for month ${monthNumber}:`, error);
                        }
                    }
            
                    // Event Listener und Updates
                    await this.initializeICUSeverityListeners(this.selectedYear);
                    await this.updateICUSeverityTotals(this.selectedYear);
            
                    console.log(`ICU Severity Table for ${this.selectedYear} created and initialized`);
                    
                } catch (error) {
                    console.error('Error creating ICU severity table:', error);
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = 'Fehler beim Erstellen der Schweregradstatistik';
                    this.mainContainer?.appendChild(errorDiv);
                    throw error;
                }
            }

    async updateICUSeverityTotals() {
        try {
            const totalRow = document.querySelector(`#icu-severity-total-${this.selectedYear}`);
            if (!totalRow) return;
    
            // Initialisiere die Summen
            let totalCases = 0;
            let totalBeatmungDays = 0;
            let totalCompleteDays = 0;
            let totalBeatmungHours = 0;
            let totalBeatmungPatients = 0;
            let totalCrrtDays = 0;
            let totalEcmoDays = 0;
            let totalTissPoints = 0;
    
            // Sammle die Werte aus allen Monatszeilen
            for (let month = 1; month <= 12; month++) {
                const row = document.querySelector(`#icu-severity-row-${this.selectedYear}-${month}`);
                if (!row) continue;
    
                // Addiere die numerischen Werte
                totalCases += parseInt(row.querySelector('.cases-input').textContent) || 0;
                totalBeatmungDays += parseInt(row.querySelector('.beatmung-days').textContent) || 0;
                totalCompleteDays += parseInt(row.querySelector('.complete-days').textContent) || 0;
                totalBeatmungHours += parseInt(row.querySelector('.beatmung-hours').textContent) || 0;
                totalBeatmungPatients += parseInt(row.querySelector('.beatmung-patients').textContent) || 0;
                totalCrrtDays += parseInt(row.querySelector('.crrt-days').textContent) || 0;
                totalEcmoDays += parseInt(row.querySelector('.ecmo-days').textContent) || 0;
                totalTissPoints += parseInt(row.querySelector('.tiss-input').textContent) || 0;
            }
    
            // Setze die Gesamtwerte
            totalRow.querySelector('.total-cases').textContent = totalCases;
            totalRow.querySelector('.total-beatmung-days').textContent = totalBeatmungDays;
            totalRow.querySelector('.total-complete-days').textContent = totalCompleteDays;
            totalRow.querySelector('.total-beatmung-hours').textContent = totalBeatmungHours;
            totalRow.querySelector('.total-beatmung-patients').textContent = totalBeatmungPatients;
            
            // Berechne Prozentsatz und Durchschnitte
            const totalBeatmungPercentage = totalCases > 0
                ? ((totalBeatmungPatients / totalCases) * 100).toFixed(1)
                : '0.0';
            totalRow.querySelector('.total-beatmung-percentage').textContent = totalBeatmungPercentage;
            
            const totalAvgBeatmungDays = totalBeatmungPatients > 0
                ? (totalBeatmungDays / totalBeatmungPatients).toFixed(1)
                : '0.0';
            totalRow.querySelector('.total-avg-beatmung-days').textContent = totalAvgBeatmungDays;
            
            totalRow.querySelector('.total-crrt-days').textContent = totalCrrtDays;
            totalRow.querySelector('.total-ecmo-days').textContent = totalEcmoDays;
            totalRow.querySelector('.total-tiss').textContent = totalTissPoints;
            
            const totalTissPerCase = totalCases > 0
                ? (totalTissPoints / totalCases).toFixed(1)
                : '0.0';
            totalRow.querySelector('.total-tiss-per-case').textContent = totalTissPerCase;
    
        } catch (error) {
            console.error('Error updating ICU severity totals:', error);
        }
    }

    async createIMCSeverityTable() {
        try {
            // 1. Erstelle Tabellen-Container
            const table = document.createElement('section');
            table.className = 'statistics-table severity-table';
            table.id = `imc-severity-${this.selectedYear}`;
            
            // Definiere Monate für die Zeilen
            const months = [
                'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
            ];
        
            // Generiere die Monatszeilen
            let monthRows = '';
            months.forEach((month, idx) => {
                monthRows += `
                    <tr id="imc-severity-row-${this.selectedYear}-${idx + 1}">
                        <td>${month}</td>
                        <td class="cases-input" contenteditable="true">0</td>
                        <td class="tiss-input" contenteditable="true">0</td>
                        <td class="value tiss-per-case">0.0</td>
                    </tr>
                `;
            });
            
            table.innerHTML = `
                <h2>Schweregradstatistik ${this.selectedYear}, Operative IMC</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Monat</th>
                                <th>Fälle</th>
                                <th>TISS-28-Punkte</th>
                                <th>TISS-28-Punkte pro Fall</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthRows}
                            <tr id="imc-severity-total-${this.selectedYear}" class="summary">
                                <td>Gesamt</td>
                                <td class="total-cases">0</td>
                                <td class="total-tiss">0</td>
                                <td class="total-tiss-per-case">0.0</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
    
            // Füge Tabelle zum DOM hinzu
            if (this.mainContainer) {
                this.mainContainer.appendChild(table);
            } else {
                throw new Error('Main container not found');
            }
    
            // Lade und setze die Werte für jeden Monat
            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                const monthNumber = monthIndex + 1;
                
                try {
                    // Lade die gespeicherten manuellen Eingaben
                    const [cases, tissPoints] = await Promise.all([
                        db.getFallbuchCasesMonthly(this.selectedYear, monthNumber, 'IMC'),
                        db.getTISS28PointsMonthly(this.selectedYear, monthNumber, 'IMC')
                    ]);
            
                    console.log(`Loaded IMC values for ${this.selectedYear}-${monthNumber}:`, { cases, tissPoints });
            
                    // Setze die Werte in die Eingabefelder des entsprechenden Monats
                    const row = table.querySelector(`#imc-severity-row-${this.selectedYear}-${monthNumber}`);
                    if (row) {
                        // Setze manuelle Eingaben
                        const casesInput = row.querySelector('.cases-input');
                        const tissInput = row.querySelector('.tiss-input');
                        
                        if (casesInput && cases !== null) {
                            casesInput.textContent = cases;
                        }
                        if (tissInput && tissPoints !== null) {
                            tissInput.textContent = tissPoints;
                        }
    
                        // Berechne TISS pro Fall
                        if (cases > 0 && tissPoints) {
                            row.querySelector('.tiss-per-case').textContent = 
                                (tissPoints / cases).toFixed(1);
                        }
                    }
                } catch (error) {
                    console.error(`Error loading IMC data for month ${monthNumber}:`, error);
                }
            }
    
            // Initialisiere die Event Listener für die Eingabefelder
            await this.initializeIMCSeverityListeners(this.selectedYear);
            
            // Berechne die Gesamtsummen
            await this.updateIMCSeverityTotals(this.selectedYear);
    
            console.log(`IMC Severity Table for ${this.selectedYear} created and initialized`);
            
        } catch (error) {
            console.error('Error creating IMC severity table:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = 'Fehler beim Erstellen der IMC-Schweregradstatistik';
            this.mainContainer?.appendChild(errorDiv);
        }
    }

    async initializeICUSeverityListeners() {
        try {
            // Für jeden Monat einen Event-Listener erstellen
            for (let month = 1; month <= 12; month++) {
                const row = document.getElementById(`icu-severity-row-${this.selectedYear}-${month}`);
                if (!row) {
                    console.warn(`Row not found for month ${month}`);
                    continue;
                }
    
                // Event-Listener für Fallzahlen
                const casesInput = row.querySelector('.cases-input');
                if (casesInput) {
                    casesInput.addEventListener('blur', async () => {
                        try {
                            const value = parseInt(casesInput.textContent);
                            if (!isNaN(value)) {
                                console.log(`Saving cases for ${this.selectedYear}-${month}: ${value}`);
                                
                                // Aktualisiere TISS pro Fall für diese Zeile
                                const tissValue = parseInt(row.querySelector('.tiss-input')?.textContent || '0');
                                const tissPerCase = value > 0 ? (tissValue / value).toFixed(1) : '0.0';
                                row.querySelector('.tiss-per-case').textContent = tissPerCase;
    
                                // Speichern in der Datenbank
                                await db.saveFallbuchCasesMonthly(this.selectedYear, month, 'ICU', value);
                                
                                // Wichtig: Expliziter Aufruf der Gesamtberechnung
                                console.log('Triggering total recalculation after cases update');
                                await this.updateICUSeverityTotals();
                            }
                        } catch (error) {
                            console.error(`Error handling cases input for month ${month}:`, error);
                        }
                    });
                }
    
                // Event-Listener für TISS-Punkte
                const tissInput = row.querySelector('.tiss-input');
                if (tissInput) {
                    tissInput.addEventListener('blur', async () => {
                        try {
                            const value = parseInt(tissInput.textContent);
                            if (!isNaN(value)) {
                                console.log(`Saving TISS points for ${this.selectedYear}-${month}: ${value}`);
                                
                                // Aktualisiere TISS pro Fall für diese Zeile
                                const casesValue = parseInt(row.querySelector('.cases-input')?.textContent || '0');
                                const tissPerCase = casesValue > 0 ? (value / casesValue).toFixed(1) : '0.0';
                                row.querySelector('.tiss-per-case').textContent = tissPerCase;
    
                                // Speichern in der Datenbank 
                                await db.saveTISS28PointsMonthly(this.selectedYear, month, 'ICU', value);
                                
                                // Wichtig: Expliziter Aufruf der Gesamtberechnung
                                console.log('Triggering total recalculation after TISS update');
                                await this.updateICUSeverityTotals();
                            }
                        } catch (error) {
                            console.error(`Error handling TISS input for month ${month}:`, error);
                        }
                    });
                }
            }
    
            console.log(`Initialized listeners for ${this.selectedYear} for all months`);
    
        } catch (error) {
            console.error('Error initializing ICU severity listeners:', error);
            throw error;
        }
    }

    async initializeIMCSeverityListeners() {
        try {
            for (let month = 1; month <= 12; month++) {
                const row = document.getElementById(`imc-severity-row-${this.selectedYear}-${month}`);
                if (!row) {
                    console.warn(`IMC row not found for month ${month}`);
                    continue;
                }

                const casesInput = row.querySelector('.cases-input');
                if (casesInput) {
                    casesInput.addEventListener('blur', async () => {
                        try {
                            const value = parseInt(casesInput.textContent);
                            if (!isNaN(value)) {
                                console.log(`Saving IMC cases for ${this.selectedYear}-${month}: ${value}`);
                                
                                // Aktualisiere TISS pro Fall für diese Zeile
                                const tissValue = parseInt(row.querySelector('.tiss-input')?.textContent || '0');
                                const tissPerCase = value > 0 ? (tissValue / value).toFixed(1) : '0.0';
                                row.querySelector('.tiss-per-case').textContent = tissPerCase;

                                await db.saveFallbuchCasesMonthly(this.selectedYear, month, 'IMC', value);
                                
                                console.log('Triggering IMC total recalculation after cases update');
                                await this.updateIMCSeverityTotals(this.selectedYear);
                            }
                        } catch (error) {
                            console.error(`Error handling IMC cases input for month ${month}:`, error);
                        }
                    });
                }

                const tissInput = row.querySelector('.tiss-input');
                if (tissInput) {
                    tissInput.addEventListener('blur', async () => {
                        try {
                            const value = parseInt(tissInput.textContent);
                            if (!isNaN(value)) {
                                console.log(`Saving IMC TISS points for ${year}-${month}: ${value}`);
                                
                                // Aktualisiere TISS pro Fall für diese Zeile
                                const casesValue = parseInt(row.querySelector('.cases-input')?.textContent || '0');
                                const tissPerCase = casesValue > 0 ? (value / casesValue).toFixed(1) : '0.0';
                                row.querySelector('.tiss-per-case').textContent = tissPerCase;

                                await db.saveTISS28PointsMonthly(this.selectedYear, month, 'IMC', value);
                                
                                console.log('Triggering IMC total recalculation after TISS update');
                                await this.updateIMCSeverityTotals(this.selectedYear);
                            }
                        } catch (error) {
                            console.error(`Error handling IMC TISS input for month ${month}:`, error);
                        }
                    });
                }
            }

            console.log(`Initialized IMC listeners for ${this.selectedYear} for all months`);

        } catch (error) {
            console.error('Error initializing IMC severity listeners:', error);
            throw error;
        }
    }

    async updateIMCSeverityTotals() {
        try {
            const totalRow = document.querySelector(`#imc-severity-total-${this.selectedYear}`);
            if (!totalRow) return;
    
            // Initialisiere die Summen
            let totalCases = 0;
            let totalTissPoints = 0;
    
            // Sammle die Werte aus allen Monatszeilen
            for (let month = 1; month <= 12; month++) {
                const row = document.querySelector(`#imc-severity-row-${this.selectedYear}-${month}`);
                if (!row) continue;
    
                totalCases += parseInt(row.querySelector('.cases-input').textContent) || 0;
                totalTissPoints += parseInt(row.querySelector('.tiss-input').textContent) || 0;
            }
    
            // Setze die Gesamtwerte
            totalRow.querySelector('.total-cases').textContent = totalCases;
            totalRow.querySelector('.total-tiss').textContent = totalTissPoints;
            
            const totalTissPerCase = totalCases > 0
                ? (totalTissPoints / totalCases).toFixed(1)
                : '0.0';
            totalRow.querySelector('.total-tiss-per-case').textContent = totalTissPerCase;
    
        } catch (error) {
            console.error('Error updating IMC severity totals:', error);
        }
    }

    async updateICUSeverityStatistics(year) {
        try {
            const row = document.getElementById(`icu-severity-row-${year}`);
            if (!row) return;
    
            // Hole die Basis-Statistiken
            const [beatmungStats, crrtStats, ecmoStats] = await Promise.all([
                db.getYearlyStatistics(year, 'beatmung'),
                db.getYearlyStatistics(year, 'crrt'),
                db.getYearlyStatistics(year, 'ila_ecmo')
            ]);
    
            // Hole Fallbuch und TISS Daten
            const totalCases = await db.getFallbuchCases(year, 'ICU') || 0;
            const tissPoints = await db.getTISS28Points(year, 'ICU') || 0;
    
            console.log('ICU Statistics Debug:', {
                year,
                beatmungStats,
                totalCases,
                tissPoints
            });
    
            // Definiere uniqueBeatmungCases außerhalb des if-Blocks
            let uniqueBeatmungCases = new Set();
            let beatmungPercentage = '0.0';
            let avgBeatmungDays = '0.0';
    
            if (beatmungStats?.statistics) {
                // Beatmungsstatistiken - Berücksichtige fortgeführte Fälle
                uniqueBeatmungCases = new Set([
                    ...beatmungStats.statistics.uniqueCases,
                    ...(beatmungStats.statistics.continuedCases || [])
                ]);
    
                // Basis-Statistiken
                row.querySelector('.beatmung-days').textContent = 
                    beatmungStats.statistics.startedDays || '0';
                row.querySelector('.complete-days').textContent = 
                    Math.floor(beatmungStats.statistics.totalHours / 24) || '0';
                row.querySelector('.beatmung-hours').textContent = 
                    beatmungStats.statistics.totalHours || '0';
    
                // Anzahl Beatmungspatienten (inkl. fortgeführte Fälle)
                row.querySelector('.beatmung-patients').textContent = 
                    uniqueBeatmungCases.size || '0';
    
                // Prozentsatz der Beatmungspatienten
                beatmungPercentage = totalCases > 0
                    ? ((uniqueBeatmungCases.size / totalCases) * 100).toFixed(1)
                    : '0.0';
                row.querySelector('.beatmung-percentage').textContent = beatmungPercentage;
    
                // Durchschnittliche Beatmungsdauer
                avgBeatmungDays = uniqueBeatmungCases.size > 0
                    ? (beatmungStats.statistics.startedDays / uniqueBeatmungCases.size).toFixed(1)
                    : '0.0';
                row.querySelector('.avg-beatmung-days').textContent = avgBeatmungDays;
            }
    
            // CRRT Statistiken
            if (crrtStats?.statistics) {
                const uniqueCrrtCases = new Set([
                    ...crrtStats.statistics.uniqueCases,
                    ...(crrtStats.statistics.continuedCases || [])
                ]);
                row.querySelector('.crrt-days').textContent = 
                    crrtStats.statistics.startedDays || '0';
            }
    
            // ECMO Statistiken
            if (ecmoStats?.statistics) {
                const uniqueEcmoCases = new Set([
                    ...ecmoStats.statistics.uniqueCases,
                    ...(ecmoStats.statistics.continuedCases || [])
                ]);
                row.querySelector('.ecmo-days').textContent = 
                    ecmoStats.statistics.startedDays || '0';
            }
    
            // TISS-28 pro Fall (basiert auf Fallbuch)
            const tissPerCase = totalCases > 0 ? (tissPoints / totalCases).toFixed(1) : '0.0';
            row.querySelector('.tiss-per-case').textContent = tissPerCase;
    
            // Debug-Logging
            console.log('Updated ICU severity statistics:', {
                year,
                beatmungCases: uniqueBeatmungCases.size,
                totalCases,
                beatmungPercentage,
                avgBeatmungDays,
                tissPerCase
            });
    
        } catch (error) {
            console.error('Error updating ICU severity statistics:', error);
            throw error;
        }
    }

    async updateIMCSeverityStatistics(year) {
        try {
            const row = document.getElementById(`imc-severity-row-${year}`);
            if (!row) {
                console.log(`Row not found for IMC year ${year}`);
                return;
            }
    
            console.log('Starting IMC statistics update for year:', year);
    
            // Hole Basis-Daten
            const [totalCases, tissPoints] = await Promise.all([
                db.getFallbuchCases(year, 'IMC'),
                db.getTISS28Points(year, 'IMC')
            ]);
    
            // Debug-Info
            console.log('IMC Statistics Debug:', {
                year,
                totalCases,
                tissPoints
            });
    
            // Fülle die Basiswerte
            if (row.querySelector('.cases-input') && totalCases !== null) {
                row.querySelector('.cases-input').textContent = totalCases;
            }
            if (row.querySelector('.tiss-input') && tissPoints !== null) {
                row.querySelector('.tiss-input').textContent = tissPoints;
            }
    
            // TISS pro Fall berechnen
            const tissPerCase = totalCases > 0 ? (tissPoints / totalCases).toFixed(1) : '0.0';
            const tissPerCaseElement = row.querySelector('.tiss-per-case');
            
            if (tissPerCaseElement) {
                tissPerCaseElement.textContent = tissPerCase;
                console.log('Updated IMC TISS per case value:', tissPerCase);
            }
    
            // Debug-Logging für vollständiges Update
            console.log('Updated IMC severity statistics:', {
                year,
                totalCases,
                tissPoints,
                tissPerCase
            });
    
        } catch (error) {
            console.error('Error updating IMC severity statistics:', error);
            throw error;
        }
    }

    async updateAllTables() {
        try {
            console.log(`Updating all tables for year ${year = this.selectedYear}`);
            const therapyTypes = await db.getActiveTherapyTypes();
    
            // Update therapy statistics tables
            for (const therapy of therapyTypes) {
                await this.updateTherapyStatisticsTable(therapy.id, year = this.selectedYear);
            }
    
            // Update severity statistics tables
            await this.updateICUSeverityStatistics(year = this.selectedYear);
            await this.updateIMCSeverityStatistics(year = this.selectedYear);
    
            // Icons nach Updates neu initialisieren
            lucide.createIcons();
    
            console.log('All tables updated successfully');
        } catch (error) {
            console.error('Error updating tables:', error);
            throw error;
        }
    }

    async updateTherapyStatisticsTable(therapyId, year) {
        try {
            const table = document.getElementById(`${therapyId}-statistics-${year}`);
            if (!table) {
                console.warn(`Table for ${therapyId} not found`);
                return;
            }

            // Update monthly rows
            for (let month = 1; month <= 12; month++) {
                const monthlyStats = await db.getMonthlyStatistics(year, month, therapyId);
                if (monthlyStats?.statistics) {
                    const row = table.querySelector(`tr[data-month="${month}"]`);
                    if (row) {
                        row.querySelector('.hours').textContent = monthlyStats.statistics.totalHours || '0';
                        row.querySelector('.started-days').textContent = monthlyStats.statistics.startedDays || '0';
                        row.querySelector('.complete-days').textContent = 
                            Math.floor(monthlyStats.statistics.totalHours / 24) || '0';
                        row.querySelector('.unique-cases').textContent = 
                            monthlyStats.statistics.uniqueCases?.length || '0';
                        
                        const avgDays = monthlyStats.statistics.uniqueCases?.length > 0
                            ? (monthlyStats.statistics.startedDays / monthlyStats.statistics.uniqueCases.length).toFixed(1)
                            : '0.0';
                        row.querySelector('.days-per-case').textContent = avgDays;
                    }
                }
            }

            // Update summary rows
            const yearlyStats = await db.getYearlyStatistics(year, therapyId);
            if (yearlyStats?.statistics) {
                const totalRow = table.querySelector('tr.summary');
                const avgRow = table.querySelector('tr.average');

                if (totalRow) {
                    totalRow.querySelector('.hours').textContent = yearlyStats.statistics.totalHours || '0';
                    totalRow.querySelector('.started-days').textContent = yearlyStats.statistics.startedDays || '0';
                    totalRow.querySelector('.complete-days').textContent = 
                        Math.floor(yearlyStats.statistics.totalHours / 24) || '0';
                    totalRow.querySelector('.unique-cases').textContent = 
                        yearlyStats.statistics.uniqueCases?.length || '0';
                    
                    const avgDays = yearlyStats.statistics.uniqueCases?.length > 0
                        ? (yearlyStats.statistics.startedDays / yearlyStats.statistics.uniqueCases.length).toFixed(1)
                        : '0.0';
                    totalRow.querySelector('.days-per-case').textContent = avgDays;
                }

                if (avgRow) {
                    avgRow.querySelector('.hours').textContent = 
                        (yearlyStats.statistics.totalHours / 12).toFixed(1);
                    avgRow.querySelector('.started-days').textContent = 
                        (yearlyStats.statistics.startedDays / 12).toFixed(1);
                    avgRow.querySelector('.complete-days').textContent = 
                        (Math.floor(yearlyStats.statistics.totalHours / 24) / 12).toFixed(1);
                    avgRow.querySelector('.unique-cases').textContent = 
                        (yearlyStats.statistics.uniqueCases?.length / 12).toFixed(1);
                    avgRow.querySelector('.days-per-case').textContent = 
                        yearlyStats.statistics.daysPerCase?.toFixed(1) || '0.0';
                }
            }

            console.log(`Updated statistics table for ${therapyId}`);
        } catch (error) {
            console.error(`Error updating therapy statistics table for ${therapyId}:`, error);
            throw error;
        }
    }
}


// Initialisierung beim Laden der Seite
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const statisticsManager = new StatisticsManager();
        // Erst initialize für die Basisfunktionalität
        await statisticsManager.initialize();
        // Dann den YearSelector initialisieren
        await statisticsManager.initializeYearSelector();

    } catch (error) {
        console.error('Error initializing statistics:', error);
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.textContent = 'Fehler beim Laden der Statistiken';
        document.getElementById('statistics-container').prepend(errorContainer);
    }
});