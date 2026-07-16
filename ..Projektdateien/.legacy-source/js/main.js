// js/main.js

import { 
    state, 
    initializeState,
    activeTherapies,
    loadActiveTherapiesState, 
    saveActiveTherapiesState 
} from './state.js';

import { formatDateForInput, parseDate } from './utils/dateUtils.js';
import { TableManager } from './managers/TableManager.js';
import { TherapyManager } from './managers/TherapyManager.js';
import { db } from './dbConfig.js';
import { ReactErrorBoundary, createSafeRoot } from './reactV18Check.js';

class ApplicationManager {
    constructor() {
        this.tableManager = new TableManager(document.getElementById('tables-container'));
        this.therapyManager = new TherapyManager();
        this.initialized = false;
    }

    async initialize() {
        try {
            if (this.initialized) return;

            await this._initializeDatabase();
            await this._initializeState();
            await this._initializeUI();
            await this._setupEventListeners();
            
            this.initialized = true;
            console.log('Anwendung erfolgreich initialisiert');
        } catch (error) {
            console.error('Fehler bei der Initialisierung:', error);
            this._handleInitializationError(error);
        }
    }

    async _initializeDatabase() {
        await db.ensureInit();
        await this.therapyManager.initializeTherapyTypes();
    }

    async _initializeState() {
        const elements = this._getRequiredElements();
        initializeState(elements);
        loadActiveTherapiesState();
    }

    async _initializeUI() {
        await this._initializeRetryContinuationButton();
        await this.setDate();
        this._initializeAutomaticUpdate();
    }

    _getRequiredElements() {
        const elements = {
            dateInput: document.getElementById('date'),
            startDateInput: document.getElementById('start-date'),
            endDateInput: document.getElementById('end-date'),
            filterDurationInput: document.getElementById('filter-duration'),
            filterTreatmentInput: document.getElementById('filter-treatment')
        };

        // Validiere ob alle erforderlichen Elemente existieren
        Object.entries(elements).forEach(([key, element]) => {
            if (!element) {
                throw new Error(`Erforderliches Element nicht gefunden: ${key}`);
            }
        });

        return elements;
    }

    async _initializeRetryContinuationButton() {
        const container = document.getElementById('retry-continuation-root');
        if (!container) return;

        try {
            const { default: RetryContinuationButton } = await import(
                './components/retry-continuation-button.js'
            );
            const root = createSafeRoot(container, 'RetryContinuationButton');
            root.render(
                React.createElement(ReactErrorBoundary, null,
                    React.createElement(RetryContinuationButton)
                )
            );
        } catch (error) {
            console.error('Fehler beim Initialisieren des Retry-Buttons:', error);
        }
    }

    _initializeAutomaticUpdate() {
        setInterval(() => this.therapyManager.automaticHourUpdate(), 60000);
    }

    async _setupEventListeners() {
        // Navigation Buttons
        document.getElementById('prev-day')?.addEventListener('click', 
            () => this.changeDate(-1));
        document.getElementById('next-day')?.addEventListener('click', 
            () => this.changeDate(1));
        document.getElementById('today-button')?.addEventListener('click', 
            () => this.goToToday());
    
        // Datums Input Listener
        state.dateInput?.addEventListener('change', async (event) => {
            console.log('Datum manuell geändert zu:', event.target.value);
            await this.loadData(event.target.value);
        }); // <-- Hier fehlte die Klammer
    
        // Export Button
        document.getElementById('modal-export-button')?.addEventListener('click', 
            () => this.therapyManager.handleExport());
    
        // Jahreswechsel Event
        window.addEventListener('yearChanged', this._handleYearChange.bind(this));
    
        // Fenster schließen
        window.addEventListener('beforeunload', () => {
            saveActiveTherapiesState();
        });
    }

    async _handleYearChange(event) {
        const { year, db } = event.detail;
        console.log(`Jahr wurde zu ${year} gewechselt, lade Daten neu...`);
        
        try {
            await this.loadData(state.dateInput.value);
            lucide.createIcons();
        } catch (error) {
            console.error('Fehler beim Neuladen der Daten:', error);
            throw error;
        }
    }

    async setDate() {
        try {
            const today = new Date();
            state.dateInput.value = formatDateForInput(today);
            await this.loadData(state.dateInput.value);
        } catch (error) {
            console.error('Fehler beim Setzen des Datums:', error);
            throw error;
        }
    }

    async changeDate(days) {
        try {
            const currentDate = parseDate(state.dateInput.value);
            currentDate.setDate(currentDate.getDate() + days);
            const newDate = formatDateForInput(currentDate);
            state.dateInput.value = newDate;
            await this.loadData(newDate);
        } catch (error) {
            console.error('Fehler beim Ändern des Datums:', error);
            throw error;
        }
    }

    async goToToday() {
        try {
            await this.setDate();
        } catch (error) {
            console.error('Fehler beim Springen zum heutigen Tag:', error);
            throw error;
        }
    }

    async loadData(date) {
        try {
            console.log(`Lade Daten für Datum: ${date}`);
            
            const therapyTypes = await db.getActiveTherapyTypes();
            this.tableManager.clearTables();
            
            for (const therapy of therapyTypes) {
                await this._loadTherapyData(therapy, date);
            }
            
            // Prüfe auf Vortages-Daten bei neuem Tag
            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                await this.therapyManager.handleAutomaticContinuation(date);
            }
            
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            throw error;
        }
    }

    async _loadTherapyData(therapy, date) {
        try {
            console.log(`Lade Therapiedaten für ${therapy.id} am ${date}`);
            
            this.tableManager.generateTable(therapy.id, therapy.displayName);
            
            const entry = await db.getDailyEntry(date, therapy.id);
            console.log(`Geladene Daten für ${therapy.id}:`, entry);
            
            if (entry?.patients?.length > 0) {
                console.log(`Aktualisiere Tabelle für ${therapy.id} mit ${entry.patients.length} Patienten`);
                this.tableManager.updateTableContent(therapy.id, entry);
            } else {
                console.log(`Keine Patienten für ${therapy.id} gefunden`);
            }
        } catch (error) {
            console.error(`Fehler beim Laden der Daten für ${therapy.id}:`, error);
        }
    }

    _handleInitializationError(error) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'fixed top-0 left-0 right-0 p-4 text-center text-white bg-red-500 error-message';
        errorContainer.textContent = 'Fehler beim Initialisieren der Anwendung. Bitte laden Sie die Seite neu.';
        document.body.prepend(errorContainer);
        throw error;
    }
}

// Anwendung initialisieren
const app = new ApplicationManager();

// Globale Funktion für das Hinzufügen von Zeilen
window.addRow = (tableId) => {
    return app.tableManager.addRow(tableId);
};

document.addEventListener('DOMContentLoaded', () => app.initialize());