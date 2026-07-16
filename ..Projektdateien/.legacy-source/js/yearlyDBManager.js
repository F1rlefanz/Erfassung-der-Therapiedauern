// yearlyDBManager.js
import { DB_STORES } from './dbStores.js';
import { setupStores } from './dbUtils.js';

// Statische Version außerhalb der Klasse definieren
export const DB_VERSION = 1;

export class YearlyDBManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.databases = new Map(); // Speichert DB-Instanzen nach Jahren
        this._initPromises = new Map(); // Speichert Initialisierungs-Promises
        this.currentVersion = 1; // Track current version
    }

    async initializeYear(year) {
        try {
            console.log(`Initialisiere Datenbank für Jahr ${year}`);
            
            // Prüfe ob bereits eine Initialisierung läuft
            if (this._initPromises.has(year)) {
                console.log(`Initialisierung für ${year} läuft bereits, warte...`);
                return this._initPromises.get(year);
            }

            const dbConfig = {
                name: `TherapyTracking_${year}`,
                version: DB_VERSION, // Statische Version verwenden
                stores: DB_STORES
            };

            // Erstelle Promise für die Initialisierung  
            const initPromise = this._createDatabase(dbConfig);
            this._initPromises.set(year, initPromise);

            try {
                const db = await initPromise;
                this.databases.set(year, db);
                console.log(`Datenbank für Jahr ${year} erfolgreich initialisiert`);
                return db;
            } finally {
                this._initPromises.delete(year);
            }

        } catch (error) {
            console.error(`Fehler bei der Initialisierung der Datenbank für Jahr ${year}:`, error);
            throw error;
        }
    }

    /**
     * Erstellt eine neue IndexedDB Datenbank
     * @private
     * @param {Object} config - Datenbank-Konfiguration
     * @returns {Promise<IDBDatabase>}
     */
    async _createDatabase(config) {
        return new Promise((resolve, reject) => {
            console.log(`Erstelle/Öffne Datenbank: ${config.name} Version ${config.version}`);
            
            const request = indexedDB.open(config.name, config.version);
    
            request.onerror = () => {
                console.error(`Fehler beim Öffnen der Datenbank ${config.name}:`, request.error);
                reject(request.error);
            };
    
            request.onsuccess = () => {
                const db = request.result;
                
                // Validiere dass alle Stores existieren
                const expectedStores = Object.keys(config.stores);
                const actualStores = Array.from(db.objectStoreNames);
                const missingStores = expectedStores.filter(
                    store => !actualStores.includes(store)
                );
                
                if (missingStores.length > 0) {
                    console.error(`Fehlende Stores: ${missingStores.join(', ')}`);
                    db.close();
                    
                    // Keine Versionserhöhung mehr, stattdessen:
                    throw new Error(`Fehlende Stores gefunden: ${missingStores.join(', ')}`);
                }
                
                console.log(`Datenbank ${config.name} Version ${db.version} erfolgreich geöffnet`);
                console.log('Verfügbare Stores:', Array.from(db.objectStoreNames));
                resolve(db);
            };
    
            request.onupgradeneeded = (event) => {
                console.log(`Upgrade der Datenbank ${config.name} auf Version ${event.newVersion}`);
                setupStores(event.target.result, config.stores);
            };
        });
    }

    /**
     * Prüft und listet alle verfügbaren Jahres-Datenbanken
     * @returns {Promise<number[]>} Array der verfügbaren Jahre
     */
    async getAvailableYears() {
        try {
            console.log('Suche verfügbare Jahres-Datenbanken');
            const dbs = await window.indexedDB.databases();
            const years = dbs
                .filter(db => db.name.startsWith('TherapyTracking_'))
                .map(db => parseInt(db.name.split('_')[1]))
                .sort((a, b) => b - a); // Neueste zuerst
            
            console.log('Gefundene Jahre:', years);
            return years;
        } catch (error) {
            console.error('Fehler beim Abrufen der verfügbaren Jahre:', error);
            throw error;
        }
    }

    /**
     * Stellt sicher, dass eine Datenbank für das angegebene Jahr existiert
     * @param {number} year - Das gewünschte Jahr
     * @returns {Promise<IDBDatabase>} Die Datenbank für das Jahr
     */
    async ensureYearDB(year) {
        try {
            console.log(`Stelle sicher, dass DB für Jahr ${year} existiert`);
            
            if (!this.databases.has(year)) {
                console.log(`DB für ${year} nicht im Cache, initialisiere...`);
                await this.initializeYear(year);
            }
            
            return this.databases.get(year);
        } catch (error) {
            console.error(`Fehler beim Sicherstellen der DB für Jahr ${year}:`, error);
            throw error;
        }
    }

}

// Erstelle eine einzelne Instanz
const yearlyDBManagerInstance = new YearlyDBManager();

// Exportiere die Instanz
export const yearlyDBManager = yearlyDBManagerInstance;