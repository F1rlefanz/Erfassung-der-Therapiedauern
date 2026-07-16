// dbConfig.js
import { yearlyDBManager } from './yearlyDBManager.js';
import { globalState } from './state.js';
import { setupStores } from './dbUtils.js';

const DB_CONFIG = {
    name: 'TherapyTrackingDB',
    version: 6,
    stores: {
        therapyTypes: {
            keyPath: 'id',
            indexes: [
                { name: 'name', unique: false },
                { name: 'active', unique: false }
            ]
        },
        dailyEntries: {
            keyPath: ['date', 'therapyType'],
            indexes: [
                { name: 'date', unique: false },
                { name: 'therapyType', unique: false }
            ]
        },
        statistics: {
            keyPath: ['date', 'therapyType', 'type', 'month'],
            indexes: [
                { name: 'date', unique: false },
                { name: 'therapyType', unique: false },
                { name: 'type', unique: false },
                { name: 'month', unique: false } 
            ]
        },
        monthlyStats: {
            keyPath: ['year', 'month', 'therapyType'],
            indexes: [
                { name: 'year', unique: false },
                { name: 'therapyType', unique: false }
            ]
        },
        yearlyStats: {
            keyPath: ['year', 'therapyType'],
            indexes: [
                { name: 'year', unique: false },
                { name: 'therapyType', unique: false }
            ]
        },

        settings: {
            keyPath: 'id',
            indexes: []
        },
        // Store für Übernahme-Informationen
        transitionData: {
            keyPath: ['date', 'therapyType'],
            indexes: [
                { name: 'date', unique: false },
                { name: 'therapyType', unique: false },
                { name: 'transitionType', unique: false } // 'monthStart', 'monthEnd'
            ]
        }
    }
};

    // Hilfsfunktion zum Prüfen ob ein Datum ein Monatswechsel ist
    function isMonthTransition(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getMonth() !== d2.getMonth() || d1.getFullYear() !== d2.getFullYear();
    }

    class TherapyTrackingDB {
        constructor() {
            this.currentDB = null;
        }
    
        // Hilfsfunktion um die aktuelle DB zu erhalten
        async getCurrentDB() {
            // Wenn keine DB gesetzt ist, das aktuelle Jahr nehmen
            const year = globalState.selectedYear || new Date().getFullYear();
            console.log(`Hole DB für Jahr ${year}, aktuell selected: ${globalState.selectedYear}`);
            try {
                const db = await yearlyDBManager.ensureYearDB(year);
                console.log('Verfügbare Stores:', Array.from(db.objectStoreNames));
                return db;
            } catch (error) {
                console.error(`Fehler beim Zugriff auf DB für Jahr ${year}:`, error);
                throw error;
            }
        }
    

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

                request.onerror = (event) => {
                    console.error('Database error:', event.target.error);
                    reject(new Error('Failed to open database: ' + event.target.error));
                };

                request.onblocked = (event) => {
                    console.error('Database blocked:', event);
                    reject(new Error('Database blocked. Please close other tabs with this site'));
                };
                
                request.onsuccess = (event) => {
                    this.db = event.target.result;

                    this.db.onerror = (event) => {
                        console.error('Database error:', event.target.error);
                    };

                    resolve(this.db);
                };
                
                request.onupgradeneeded = (event) => {
                    console.log('Database upgrade needed');
                    setupStores(event.target.result, DB_CONFIG.stores);
                };
            } catch (error) {
                console.error('Error during database initialization:', error);
                reject(error);
            }
        });

        try {
            await this.initPromise;
            return this.db;
        } catch (error) {
            this.initPromise = null;
            throw error;
        }
    }

    async ensureInit() {
        return this.getCurrentDB();
    }

    async _performTransaction(storeName, mode, operation) {
        try {
            const db = await this.getCurrentDB();
            
            return new Promise((resolve, reject) => {
                try {
                    console.log(`Starting transaction for store: ${storeName}, mode: ${mode}`);
                    const transaction = db.transaction(storeName, mode);
                    const store = transaction.objectStore(storeName);
                    
                    let result;
                    try {
                        result = operation(store);
                    } catch (error) {
                        console.error(`Error in store operation:`, error);
                        reject(error);
                        return;
                    }

                    transaction.oncomplete = () => {
                        console.log(`Transaction completed for store: ${storeName}`);
                        resolve(result);
                    };
                    
                    transaction.onerror = (event) => {
                        console.error(`Transaction error for store ${storeName}:`, event.target.error);
                        reject(event.target.error);
                    };

                    transaction.onabort = (event) => {
                        console.error(`Transaction aborted for store ${storeName}:`, event.target.error);
                        reject(event.target.error);
                    };
                } catch (error) {
                    console.error(`Error creating transaction:`, error);
                    reject(error);
                }
            });
        } catch (error) {
            console.error(`Error in _performTransaction:`, error);
            throw error;
        }
    }

    async addTherapyType(therapyType) {
        try {
            await this.ensureInit();
            return await this._performTransaction('therapyTypes', 'readwrite', store => {
                return new Promise((resolve, reject) => {
                    const request = store.add({
                        id: therapyType.id,
                        name: therapyType.name,
                        displayName: therapyType.displayName,
                        active: true
                    });
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error adding therapy type:', error);
            throw error;
        }
    }

    async getActiveTherapyTypes() {
        try {
            await this.ensureInit();
            return await this._performTransaction('therapyTypes', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    
                    request.onsuccess = () => {
                        const results = request.result || [];
                        resolve(results.filter(type => type.active));
                    };
                    
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting active therapy types:', error);
            throw error;
        }
    }

    async saveDailyEntry(date, therapyType, entry) {
        try {
            await this.ensureInit();
            const dailyStats = this._calculateDailyStatistics(entry);
            
            return await this._performTransaction('dailyEntries', 'readwrite', store => {
                return new Promise((resolve, reject) => {
                    const request = store.put({
                        date,
                        therapyType,
                        patients: entry.patients,
                        statistics: dailyStats
                    });
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error saving daily entry:', error);
            throw error;
        }
    }

    async getDailyEntry(date, therapyType) {
        try {
            await this.ensureInit();
            console.log(`Lade Daten für ${date}, ${therapyType}`); // Neuer Log
            return this._performTransaction('dailyEntries', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const request = store.get([date, therapyType]);
                    request.onsuccess = () => {
                        console.log(`Geladene Daten für ${date}, ${therapyType}:`, request.result); // Neuer Log
                        resolve(request.result);
                    };
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting daily entry:', error);
            throw error;
        }
    }

    async getDailyEntriesInRange(startDate, endDate, therapyType) {
        try {
            await this.ensureInit();
            return this._performTransaction('dailyEntries', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const range = IDBKeyRange.bound(
                        [startDate], 
                        [endDate + '\uffff']
                    );
                    const entries = [];
                    const request = store.openCursor(range);
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            if (cursor.value.therapyType === therapyType) {
                                entries.push(cursor.value);
                            }
                            cursor.continue();
                        } else {
                            resolve(entries);
                        }
                    };
                    
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting daily entries in range:', error);
            throw error;
        }
    }

    async updateMonthlyStatistics(year, month, therapyType) {
        try {
            await this.ensureInit();
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            const dailyEntries = await this.getDailyEntriesInRange(
                monthStart.toISOString().split('T')[0],
                monthEnd.toISOString().split('T')[0],
                therapyType
            );

            const monthlyStats = this._aggregateMonthlyStatistics(dailyEntries);
            
            return this._performTransaction('monthlyStats', 'readwrite', store => {
                return store.put({
                    year,
                    month,
                    therapyType,
                    statistics: monthlyStats
                });
            });
        } catch (error) {
            console.error('Error updating monthly statistics:', error);
            throw error;
        }
    }

    async updateYearlyStatistics(year, therapyType) {
        try {
            await this.ensureInit();
            const monthlyStats = await this._getMonthlyStatsForYear(year, therapyType);
            const yearlyStats = this._aggregateYearlyStatistics(monthlyStats);
            
            return this._performTransaction('yearlyStats', 'readwrite', store => {
                return store.put({
                    year,
                    therapyType,
                    statistics: yearlyStats
                });
            });
        } catch (error) {
            console.error('Error updating yearly statistics:', error);
            throw error;
        }
    }

    _calculateDailyStatistics(entry) {
        const uniqueCases = new Set(entry.patients.map(p => p.caseNumber));
        const uniqueCasesList = Array.from(uniqueCases);
        const totalHours = entry.patients.reduce((sum, p) => 
            sum + p.hours.filter(h => h).length, 0);
        const startedDays = uniqueCasesList.length;

        return {
            uniqueCases: uniqueCasesList,
            totalCases: uniqueCasesList.length,
            totalHours: totalHours,
            startedDays: startedDays
        };
    }

    _aggregateMonthlyStatistics(dailyEntries) {
        const uniqueCases = new Set();
        let totalHours = 0;
        let startedDays = 0;

        dailyEntries.forEach(entry => {
            entry.statistics.uniqueCases.forEach(caseNumber => {
                uniqueCases.add(caseNumber);
            });
            totalHours += entry.statistics.totalHours;
            startedDays += entry.statistics.startedDays;
        });

        return {
            uniqueCases: Array.from(uniqueCases),
            totalCases: uniqueCases.size,
            totalHours: totalHours,
            startedDays: startedDays
        };
    }

    _aggregateYearlyStatistics(monthlyStats) {
        const uniqueCases = new Set();
        let totalHours = 0;
        let startedDays = 0;

        monthlyStats.forEach(stat => {
            stat.statistics.uniqueCases.forEach(caseNumber => {
                uniqueCases.add(caseNumber);
            });
            totalHours += stat.statistics.totalHours;
            startedDays += stat.statistics.startedDays;
        });

        return {
            uniqueCases: Array.from(uniqueCases),
            totalCases: uniqueCases.size,
            totalHours: totalHours,
            startedDays: startedDays,
            averages: {
                hoursPerMonth: totalHours / 12,
                daysPerMonth: startedDays / 12
            }
        };
    }
    
    async getContinuedCases(date, therapyType) {
        try {
            // Hole den vorherigen Tag
            const previousDay = new Date(date);
            previousDay.setDate(previousDay.getDate() - 1);
            const previousDayStr = previousDay.toISOString().split('T')[0];

            console.log(`Checking continued cases from ${previousDayStr} to ${date} for ${therapyType}`);
            
            const entry = await this.getDailyEntry(previousDayStr, therapyType);
            const continuedCases = new Set();

            if (entry?.patients) {
                entry.patients.forEach(patient => {
                    // Patient wurde in der letzten Stunde des Vortags behandelt
                    if (patient.hours[23] && patient.caseNumber) {
                        continuedCases.add(patient.caseNumber);
                        console.log(`Found continued case: ${patient.caseNumber}`);
                    }
                });
            }

            return continuedCases;
        } catch (error) {
            console.error('Error getting continued cases:', error);
            throw error;
        }
    }

    async saveTransitionData(date, therapyType, data) {
        try {
            await this._performTransaction('transitionData', 'readwrite', store => {
                return store.put({
                    date,
                    therapyType,
                    transitionType: 'monthStart',
                    continuedCases: Array.from(data.continuedCases || []),
                    totalHours: data.totalHours || 0,
                    timestamp: new Date().toISOString()
                });
            });

            console.log(`Saved transition data for ${date}, ${therapyType}:`, data);
        } catch (error) {
            console.error('Error saving transition data:', error);
            throw error;
        }
    }

    async getTransitionData(date, therapyType) {
        try {
            return await this._performTransaction('transitionData', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const request = store.get([date, therapyType]);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting transition data:', error);
            throw error;
        }
    }


    async getMonthlyStatsForYear(year, therapyType) {
        try {
            await this.ensureInit();
            return this._performTransaction('monthlyStats', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const range = IDBKeyRange.bound([year, 1], [year, 12]);
                    const request = store.getAll(range);
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting monthly stats for year:', error);
            throw error;
        }
    }

    async deleteDailyEntryPatient(date, therapyType, caseNumber) {
        try {
            const entry = await this.getDailyEntry(date, therapyType);
            if (!entry || !entry.patients) return;
    
            // Filtere den zu löschenden Patienten heraus
            entry.patients = entry.patients.filter(p => p.caseNumber !== caseNumber);
            
            // Aktualisiere den Eintrag in der Datenbank
            await this._performTransaction('dailyEntries', 'readwrite', store => {
                return store.put(entry);
            });
        } catch (error) {
            console.error('Error deleting patient from daily entry:', error);
            throw error;
        }
    }

    async getMonthlyStatistics(year, month, therapyType) {
        try {
            await this.ensureInit();
            return this._performTransaction('monthlyStats', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const key = [year, month, therapyType];
                    const request = store.get(key);
                    
                    request.onsuccess = () => {
                        // Wenn Ergebnis existiert, füge month hinzu
                        if (request.result?.statistics) {
                            resolve({
                                ...request.result,
                                statistics: {
                                    month,  // Monat hinzufügen
                                    ...request.result.statistics
                                }
                            });
                        } else {
                            resolve(request.result);
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting monthly statistics:', error);
            throw error;
        }
    }

    async getYearlyStatistics(year, therapyType) {
        try {
            await this.ensureInit();
            return this._performTransaction('yearlyStats', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const key = [year, therapyType];
                    const request = store.get(key);
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting yearly statistics:', error);
            throw error;
        }
    }

    async calculateMonthlyStatistics(year, month, therapyType) {
        try {
            // Korrekte Monatsgrenzen setzen
            const monthStart = new Date(Date.UTC(year, month - 1, 1));
            const monthEnd = new Date(Date.UTC(year, month - 1 + 1, 0));
            
            // ISO-String bis zum Datum kürzen
            const startStr = monthStart.toISOString().split('T')[0];
            const endStr = monthEnd.toISOString().split('T')[0];
            
            console.log(`Berechne Statistiken von ${startStr} bis ${endStr}`);
            
            // Hole alle Einträge für diesen Monat
            const dailyEntries = await this.getDailyEntriesInRange(
                startStr,
                endStr,
                therapyType
            );
    
            console.log('Gefundene Einträge:', dailyEntries);
    
            // Initialisiere Statistik-Objekt
            const stats = {
                totalHours: 0,
                startedDays: 0,
                uniqueCases: new Set(),
                continuedFromPreviousMonth: new Set()
            };
    
            // Prüfe vorherigen Monat auf fortgeführte Fälle
            const previousMonth = new Date(Date.UTC(year, month - 2, 1));
            const lastDayPreviousMonth = new Date(Date.UTC(year, month - 1, 0));
            const previousMonthEntries = await this.getDailyEntriesInRange(
                previousMonth.toISOString().split('T')[0],
                lastDayPreviousMonth.toISOString().split('T')[0],
                therapyType
            );
    
            // Markiere fortgeführte Fälle
            if (previousMonthEntries.length > 0) {
                previousMonthEntries.forEach(entry => {
                    if (!entry.patients) return;
                    
                    entry.patients.forEach(patient => {
                        if (patient.caseNumber) {
                            stats.continuedFromPreviousMonth.add(patient.caseNumber);
                        }
                    });
                });
            }
    
            // Verarbeite tägliche Einträge
            for (const entry of dailyEntries) {
                if (!entry.patients) continue;
    
                entry.patients.forEach(patient => {
                    if (!patient.caseNumber) return;
    
                    // Zähle Stunden für diesen Tag
                    const activeHours = patient.hours.filter(h => h).length;
                    stats.totalHours += activeHours;
    
                    // Markiere als begonnenen Tag wenn Stunden > 0
                    if (activeHours > 0) {
                        stats.startedDays++;
                    }
    
                    // Erfasse neue Fälle (nicht aus Vormonat)
                    if (!stats.continuedFromPreviousMonth.has(patient.caseNumber)) {
                        stats.uniqueCases.add(patient.caseNumber);
                    }
                });
            }
    
            // Berechne Durchschnittswerte
            stats.avgDaysPerCase = stats.uniqueCases.size > 0 
                ? stats.startedDays / stats.uniqueCases.size 
                : 0;
    
            // Debug-Logging
            console.log('Berechnete Monatsstatistik:', {
                year,
                month,
                therapyType,
                totalHours: stats.totalHours,
                startedDays: stats.startedDays,
                completeDays: Math.floor(stats.totalHours / 24),
                uniqueCases: stats.uniqueCases.size,
                continuedCases: stats.continuedFromPreviousMonth.size
            });
    
            // Konvertiere Sets zu Arrays für Speicherung
            const statsForStorage = {
                ...stats,
                uniqueCases: Array.from(stats.uniqueCases),
                continuedFromPreviousMonth: Array.from(stats.continuedFromPreviousMonth),
                completeDays: Math.floor(stats.totalHours / 24)
            };
    
            // Speichere Statistiken
            await this._performTransaction('monthlyStats', 'readwrite', store => {
                return store.put({
                    year,
                    month, 
                    therapyType,
                    statistics: statsForStorage,
                    lastUpdate: new Date().toISOString()
                });
            });
    
            return statsForStorage;
    
        } catch (error) {
            console.error('Fehler bei Monatsstatistik-Berechnung:', error);
            throw error;
        }
    }

    async calculateYearlyStatistics(year, therapyType) {
        try {
            const yearStats = {
                totalHours: 0,
                startedDays: 0,
                completeDays: 0,
                uniqueCases: new Set(),
                continuedCases: new Set(),
                daysPerCase: 0,
                monthlyBreakdown: []
            };
    
            // Sammle alle Monatsstatistiken
            for (let month = 1; month <= 12; month++) {
                const monthStats = await this.getMonthlyStatistics(year, month, therapyType);
                if (monthStats?.statistics) {
                    yearStats.totalHours += monthStats.statistics.totalHours;
                    yearStats.startedDays += monthStats.statistics.startedDays;
                    yearStats.completeDays += monthStats.statistics.completeDays;
    
                    // Neue Fälle zum Set hinzufügen
                    monthStats.statistics.uniqueCases.forEach(caseNumber => 
                        yearStats.uniqueCases.add(caseNumber)
                    );
    
                    // Fortgeführte Fälle separat tracken
                    if (monthStats.statistics.continuedCases) {
                        monthStats.statistics.continuedCases.forEach(caseNumber =>
                            yearStats.continuedCases.add(caseNumber)
                        );
                    }
    
                    // Monatliche Aufschlüsselung speichern
                    yearStats.monthlyBreakdown.push({
                        month,
                        newCases: monthStats.statistics.uniqueCases.length,
                        continuedCases: monthStats.statistics.continuedCases?.length || 0,
                        totalHours: monthStats.statistics.totalHours,
                        startedDays: monthStats.statistics.startedDays
                    });
                }
            }
    
            // Berechne durchschnittliche Tage pro Fall
            // Berücksichtige sowohl neue als auch fortgeführte Fälle für die Berechnung
            const totalUniqueCases = new Set([
                ...Array.from(yearStats.uniqueCases),
                ...Array.from(yearStats.continuedCases)
            ]);
    
            yearStats.daysPerCase = totalUniqueCases.size > 0 
                ? yearStats.startedDays / totalUniqueCases.size 
                : 0;
    
            // Debug-Logging
            console.log(`Yearly statistics for ${year} ${therapyType}:`, {
                newCases: yearStats.uniqueCases.size,
                continuedCases: yearStats.continuedCases.size,
                totalUniqueCases: totalUniqueCases.size,
                totalHours: yearStats.totalHours,
                startedDays: yearStats.startedDays,
                avgDaysPerCase: yearStats.daysPerCase
            });
    
            // Konvertiere Sets zu Arrays für die Speicherung
            const statsForStorage = {
                ...yearStats,
                uniqueCases: Array.from(yearStats.uniqueCases),
                continuedCases: Array.from(yearStats.continuedCases),
                totalCases: totalUniqueCases.size,
                averages: {
                    hoursPerMonth: yearStats.totalHours / 12,
                    daysPerMonth: yearStats.startedDays / 12,
                    daysPerCase: yearStats.daysPerCase
                }
            };
    
            // Speichere die Jahresstatistik
            await this._performTransaction('yearlyStats', 'readwrite', store => {
                return store.put({
                    year,
                    therapyType,
                    statistics: statsForStorage,
                    lastUpdate: new Date().toISOString()
                });
            });
    
            return statsForStorage;
        } catch (error) {
            console.error('Error calculating yearly statistics:', error);
            throw error;
        }
    }

    // Hilfsfunktion zum Aktualisieren aller Statistiken für einen Zeitraum
    async updateAllStatistics(startDate, endDate, therapyType) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const currentMonth = start.getMonth() + 1;
            const currentYear = start.getFullYear();

            // Aktualisiere Monatsstatistiken
            await this.calculateMonthlyStatistics(currentYear, currentMonth, therapyType);

            // Aktualisiere Jahresstatistik
            await this.calculateYearlyStatistics(currentYear, therapyType);

            return true;
        } catch (error) {
            console.error('Error updating all statistics:', error);
            throw error;
        }
    }
    
    async saveFallbuchCases(year, unit, count) {
        try {
            await this.ensureInit();
            return await this._performTransaction('statistics', 'readwrite', store => {
                return store.put({
                    date: year.toString(),
                    therapyType: unit,
                    type: 'fallbuch',
                    value: count
                });
            });
        } catch (error) {
            console.error('Error saving Fallbuch cases:', error);
            throw error;
        }
    }

    async getFallbuchCases(year, unit) {
        try {
            await this.ensureInit();
            const result = await this._performTransaction('statistics', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    // Erstelle einen zusammengesetzten Schlüssel: [Jahr, Einheit, 'fallbuch']
                    // z.B. ['2024', 'ICU', 'fallbuch']
                    const request = store.get([year.toString(), unit, 'fallbuch']);
                    
                    request.onsuccess = () => {
                        console.log(`Retrieved ${unit} cases for ${year}:`, request.result);
                        resolve(request.result?.value || 0);
                    };
                    request.onerror = () => reject(request.error);
                });
            });
            return result;
        } catch (error) {
            console.error('Error getting Fallbuch cases:', error);
            throw error;
        }
    }
    
    async saveFallbuchCasesMonthly(year, month, unit, count) {
        try {
            await this.ensureInit();
            return await this._performTransaction('statistics', 'readwrite', store => {
                return store.put({
                    date: year.toString(),
                    month: month,
                    therapyType: unit,
                    type: 'fallbuch',
                    value: count
                });
            });
        } catch (error) {
            console.error('Error saving monthly Fallbuch cases:', error);
            throw error;
        }
    }

    async getFallbuchCasesMonthly(year, month, unit) {
        try {
            await this.ensureInit();
            const result = await this._performTransaction('statistics', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const key = [year.toString(), unit, 'fallbuch', month];
                    const request = store.get(key);
                    
                    request.onsuccess = () => {
                        console.log(`Retrieved ${unit} cases for ${year}-${month}:`, request.result);
                        resolve(request.result?.value || 0);
                    };
                    request.onerror = () => reject(request.error);
                });
            });
            return result;
        } catch (error) {
            console.error('Error getting monthly Fallbuch cases:', error);
            throw error;
        }
    }

    async saveTISS28PointsMonthly(year, month, unit, points) {
        try {
            await this.ensureInit();
            return await this._performTransaction('statistics', 'readwrite', store => {
                return store.put({
                    date: year.toString(),
                    month: month,
                    therapyType: unit,
                    type: 'tiss28',
                    value: points
                });
            });
        } catch (error) {
            console.error('Error saving monthly TISS-28 points:', error);
            throw error;
        }
    }

    async getTISS28PointsMonthly(year, month, unit) {
        try {
            await this.ensureInit();
            const result = await this._performTransaction('statistics', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const key = [year.toString(), unit, 'tiss28', month];
                    const request = store.get(key);
                    
                    request.onsuccess = () => {
                        console.log(`Retrieved ${unit} TISS points for ${year}-${month}:`, request.result);
                        resolve(request.result?.value || 0);
                    };
                    request.onerror = () => reject(request.error);
                });
            });
            return result;
        } catch (error) {
            console.error('Error getting monthly TISS-28 points:', error);
            throw error;
        }
    }

    // Hilfsfunktion zum Abrufen aller monatlichen Werte eines Jahres
    async getYearlyMonthlyValues(year, unit, type) {
        try {
            await this.ensureInit();
            const values = await this._performTransaction('statistics', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const monthlyValues = new Array(12).fill(0);
                    let completed = 0;
                    
                    for (let month = 1; month <= 12; month++) {
                        const key = [year.toString(), unit, type, month];
                        const request = store.get(key);
                        
                        request.onsuccess = () => {
                            monthlyValues[month - 1] = request.result?.value || 0;
                            completed++;
                            
                            if (completed === 12) {
                                resolve(monthlyValues);
                            }
                        };
                        
                        request.onerror = () => reject(request.error);
                    }
                });
            });
            return values;
        } catch (error) {
            console.error('Error getting yearly monthly values:', error);
            throw error;
        }
    }

    async saveTISS28Points(year, unit, points) {
        try {
            await this.ensureInit();
            return await this._performTransaction('statistics', 'readwrite', store => {
                return store.put({
                    date: year.toString(),
                    therapyType: unit,
                    type: 'tiss28',
                    value: points
                });
            });
        } catch (error) {
            console.error('Error saving TISS-28 points:', error);
            throw error;
        }
    }

    async getTISS28Points(year, unit) {
        try {
            await this.ensureInit();
            const result = await this._performTransaction('statistics', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    // Erstelle einen zusammengesetzten Schlüssel: [Jahr, Einheit, 'tiss28']
                    // z.B. ['2024', 'ICU', 'tiss28']
                    const request = store.get([year.toString(), unit, 'tiss28']);
                    
                    request.onsuccess = () => {
                        console.log(`Retrieved ${unit} TISS points for ${year}:`, request.result);
                        resolve(request.result?.value || 0);
                    };
                    request.onerror = () => reject(request.error);
                });
            });
            return result;
        } catch (error) {
            console.error('Error getting TISS-28 points:', error);
            throw error;
        }
    }

    async getSettings() {
        try {
            await this.ensureInit();
            return this._performTransaction('settings', 'readonly', store => {
                return new Promise((resolve, reject) => {
                    const request = store.get('userSettings');
                    
                    request.onsuccess = () => {
                        resolve(request.result?.settings || {
                            colorScheme: 'standard',
                            defaultView: 'daily',
                            graphPreferences: {
                                showLegend: true,
                                showGrid: true,
                                animate: true,
                                defaultChartType: 'line'
                            }
                        });
                    };
                    request.onerror = () => reject(request.error);
                });
            });
        } catch (error) {
            console.error('Error getting settings:', error);
            throw error;
        }
    }
    
    async saveSettings(settings) {
        try {
            await this.ensureInit();
            return this._performTransaction('settings', 'readwrite', store => {
                return new Promise((resolve, reject) => {
                    // Hole aktuelle Einstellungen
                    const getRequest = store.get('userSettings');
                    
                    getRequest.onsuccess = () => {
                        const currentSettings = getRequest.result?.settings || {};
                        // Merge neue mit bestehenden Einstellungen
                        const updatedSettings = {
                            ...currentSettings,
                            ...settings
                        };
                        
                        // Speichere aktualisierte Einstellungen
                        const putRequest = store.put({
                            id: 'userSettings',
                            settings: updatedSettings
                        });
                        
                        putRequest.onsuccess = () => resolve(updatedSettings);
                        putRequest.onerror = () => reject(putRequest.error);
                    };
                    
                    getRequest.onerror = () => reject(getRequest.error);
                });
            });
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    // Funktion für Jahreswechsel
    async switchYear(year) {
        try {
            console.log(`Wechsle zu Jahr ${year}`);
            this.currentDB = await yearlyDBManager.ensureYearDB(year);
            return this.currentDB;
        } catch (error) {
            console.error(`Fehler beim Wechsel zu Jahr ${year}:`, error);
            throw error;
        }
    }
}

// Erstelle eine zentrale Instanz
const dbInstance = new TherapyTrackingDB();

export const db = dbInstance;
window.db = dbInstance;