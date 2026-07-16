// js/exports/services/DBGenerator.js

import { formatUtils } from '../utils/FormatUtils.js';

/**
 * Generator für Datenbank-Backups der IndexedDB
 */
export class DBGenerator {
    constructor() {
        // Schema Version für Backup-Format
        this.BACKUP_VERSION = '1.0';
        
        // Store-Metadaten die gesichert werden müssen
        this.STORE_METADATA = [
            'keyPath',
            'autoIncrement',
            'indexes'
        ];
    }

    /**
     * Erzeugt ein vollständiges Backup der IndexedDB
     * @param {Object} data - Die zu exportierenden Daten 
     * @param {Object} options - Exportoptionen
     * @returns {Promise<Blob>} Backup-Datei als Blob
     * @throws {Error} Bei Fehlern während der Generierung
     */
    async generate(data, options) {
        if (!this._validateInput(data)) {
            throw new Error('Ungültige oder fehlende Eingabedaten');
        }

        try {
            // Erstelle Backup-Struktur
            const backup = {
                version: this.BACKUP_VERSION,
                metadata: this._formatMetadata(data.metadata),
                schema: await this._extractDBSchema(),
                data: await this._formatData(data.data)
            };

            // JSON mit Einrückung für bessere Lesbarkeit  
            const backupString = JSON.stringify(backup, null, 2);
            
            // Als Blob mit speziellem MIME-Type
            return new Blob([backupString], {
                type: 'application/x-indexeddb-backup+json;charset=utf-8'
            });

        } catch (error) {
            console.error('Backup-Generierung fehlgeschlagen:', error);
            throw new Error(`Datenbank-Backup fehlgeschlagen: ${error.message}`);
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
     * Formatiert die Metadaten
     * @private  
     */
    _formatMetadata(metadata) {
        return {
            version: this.BACKUP_VERSION,
            type: 'IndexedDB Backup',
            timestamp: formatUtils.formatTimestamp(metadata.exportDate),
            timerange: {
                from: formatUtils.formatDate(metadata.timerange.from),
                to: formatUtils.formatDate(metadata.timerange.to)
            },
            dataTypes: metadata.exportedTypes
        };
    }

    /**
     * Extrahiert das Datenbankschema
     * @private
     */
    async _extractDBSchema() {
        const db = await this._getDatabase();
        const schema = {
            name: db.name,
            version: db.version,
            stores: {}
        };

        // Extrahiere Metadaten für jeden Store
        Array.from(db.objectStoreNames).forEach(storeName => {
            const store = db.transaction(storeName).objectStore(storeName);
            
            schema.stores[storeName] = {
                keyPath: store.keyPath,
                autoIncrement: store.autoIncrement,
                indexes: this._extractIndexes(store)
            };
        });

        return schema;
    }

    /**
     * Extrahiert Index-Definitionen eines Stores
     * @private
     */
    _extractIndexes(store) {
        const indexes = [];
        
        Array.from(store.indexNames).forEach(indexName => {
            const index = store.index(indexName);
            indexes.push({
                name: index.name,
                keyPath: index.keyPath,
                unique: index.unique,
                multiEntry: index.multiEntry
            });
        });

        return indexes;
    }

    /**
     * Formatiert die Hauptdaten
     * @private
     */
    async _formatData(data) {
        const formattedData = {};

        // Therapiestatistiken
        if (data.therapyStats) {
            formattedData.therapyStats = await this._formatTherapyStats(data.therapyStats);
        }

        // ICU Statistiken  
        if (data.icuStats) {
            formattedData.icuStats = await this._formatICUStats(data.icuStats);
        }

        // IMC Statistiken
        if (data.imcStats) {
            formattedData.imcStats = await this._formatIMCStats(data.imcStats);
        }

        return formattedData;
    }

    /**
     * Formatiert Therapiestatistiken für DB-Export
     * @private 
     */
    async _formatTherapyStats(stats) {
        return {
            // Monatliche Daten
            monthly: stats.monthly,
            // Jahresstatistiken
            yearly: stats.yearly,
            // Ursprüngliche tägliche Einträge
            dailyEntries: await this._getDailyEntries(stats)  
        };
    }

    /**
     * Formatiert ICU-Statistiken für DB-Export
     * @private
     */
    async _formatICUStats(stats) {
        return {
            // Monatliche Statistiken
            monthly: stats.monthly,
            // Schweregradeinträge
            severityData: await this._getSeverityData('ICU', stats)
        };
    }

    /**  
     * Formatiert IMC-Statistiken für DB-Export
     * @private
     */
    async _formatIMCStats(stats) { 
        return {
            // Monatliche Statistiken
            monthly: stats.monthly,
            // Schweregradeinträge  
            severityData: await this._getSeverityData('IMC', stats)
        };
    }

    /**
     * Holt tägliche Einträge aus der DB
     * @private
     */  
    async _getDailyEntries(stats) {
        const db = await this._getDatabase();
        const entries = {};

        return new Promise((resolve, reject) => {
            const store = db.transaction('dailyEntries', 'readonly')
                        .objectStore('dailyEntries');

            // Lade alle Einträge
            store.openCursor().onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Gruppiere nach Datum
                    const date = cursor.key[0];
                    if (!entries[date]) {
                        entries[date] = {};
                    }
                    entries[date][cursor.key[1]] = cursor.value;
                    cursor.continue();
                } else {
                    // Cursor durchgelaufen - resolve Promise
                    resolve(entries);
                }
            };

            store.openCursor().onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Holt Schweregrad-Daten aus der DB
     * @private
     */
    async _getSeverityData(unit, stats) {
        const db = await this._getDatabase();
        const data = {};

        return new Promise((resolve, reject) => {
            const store = db.transaction('statistics', 'readonly')
                        .objectStore('statistics');
                        
            // Index für schnelleren Zugriff
            const index = store.index('therapyType');

            // Lade Einträge für diese Station
            index.openCursor(unit).onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const value = cursor.value;
                    // Gruppiere nach Datum  
                    if (!data[value.date]) {
                        data[value.date] = {};
                    }
                    data[value.date][value.type] = value;
                    cursor.continue();
                } else {
                    // Cursor durchgelaufen - resolve Promise 
                    resolve(data);
                }
            };

            index.openCursor(unit).onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Hilfsfunktion zum DB-Zugriff
     * @private
     */
    async _getDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TherapyTrackingDB');
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Stellt eine Datenbank aus Backup wieder her
     * @param {Object} backup - Das Backup-Objekt
     * @returns {Promise<void>}
     * @throws {Error} Bei Fehlern während der Wiederherstellung
     */
    async restoreFromBackup(backup) {
        if (!this._validateBackup(backup)) {
            throw new Error('Ungültiges oder beschädigtes Backup');
        }

        try {
            // Lösche existierende DB
            await this._deleteDatabase(backup.schema.name);
            
            // Erstelle neue DB mit Schema
            const db = await this._createDatabase(backup.schema);
            
            // Stelle Daten wieder her
            await this._restoreData(db, backup.data);
            
            console.log('Datenbank erfolgreich wiederhergestellt');
            
        } catch (error) {
            console.error('Wiederherstellung fehlgeschlagen:', error);
            throw new Error(`Datenbank konnte nicht wiederhergestellt werden: ${error.message}`);
        }
    }

    /**
     * Validiert ein Backup
     * @private
     */
    _validateBackup(backup) {
        return backup?.version &&
               backup?.schema?.name &&
               backup?.schema?.stores &&
               backup?.data;
    }

    /**
     * Löscht eine existierende Datenbank
     * @private
     */
    async _deleteDatabase(name) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Erstellt eine neue Datenbank mit Schema
     * @private
     */
    async _createDatabase(schema) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(schema.name, schema.version);
            
            request.onerror = () => reject(request.error);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Erstelle Stores und Indizes
                Object.entries(schema.stores).forEach(([name, store]) => {
                    const objectStore = db.createObjectStore(name, {
                        keyPath: store.keyPath,
                        autoIncrement: store.autoIncrement
                    });
                    
                    // Erstelle Indizes
                    store.indexes.forEach(index => {
                        objectStore.createIndex(index.name, index.keyPath, {
                            unique: index.unique,
                            multiEntry: index.multiEntry
                        });
                    });
                });
            };
            
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Stellt die Daten in der DB wieder her
     * @private
     */  
    async _restoreData(db, data) {
        // Stelle die Daten Store für Store wieder her
        const stores = Object.keys(data);
        for (const store of stores) {
            const transaction = db.transaction(store, 'readwrite');
            const objectStore = transaction.objectStore(store);
            
            // Füge Datensätze einzeln ein
            const entries = data[store];
            for (const entry of entries) {
                await new Promise((resolve, reject) => {
                    const request = objectStore.add(entry);
                    request.onerror = () => reject(request.error);  
                    request.onsuccess = () => resolve();
                });
            }
            
            // Warte auf Abschluss der Transaktion
            await new Promise((resolve, reject) => {
                transaction.onerror = () => reject(transaction.error);
                transaction.oncomplete = () => resolve();
            });
        }
    }
}