// js/managers/TherapyManager.js

import { db } from '../dbConfig.js';
import { state, activeTherapies, saveActiveTherapiesState } from '../state.js';
import { loadPreviousDayData, saveData, exportData } from '../utils/dataUtils.js';

export class TherapyManager {
    constructor() {
        this.processedDates = new Set();
    }

    /**
     * Initialisiert die Standard-Therapietypen
     */
    async initializeTherapyTypes() {
        try {
            const defaultTherapies = [
                { 
                    id: 'beatmung', 
                    name: 'Beatmung',
                    displayName: 'Beatmungsdauer' 
                },
                { 
                    id: 'crrt', 
                    name: 'CRRT',
                    displayName: 'Nierenersatzverfahren' 
                },
                { 
                    id: 'ila_ecmo', 
                    name: 'iLA/ECMO',
                    displayName: 'Extrakorporale Lungenunterstützung' 
                }
            ];

            console.log('Prüfe existierende Therapietypen...');
            const existingTypes = await db.getActiveTherapyTypes();
            
            for (const therapy of defaultTherapies) {
                const exists = existingTypes.some(t => t.id === therapy.id);
                if (!exists) {
                    console.log(`Füge neuen Therapietyp hinzu: ${therapy.id}`);
                    await db.addTherapyType(therapy);
                }
            }
        } catch (error) {
            console.error('Fehler bei der Initialisierung der Therapietypen:', error);
            throw error;
        }
    }

    /**
     * Prüft ob ein Datum bereits verarbeitet wurde
     */
    hasProcessedDate(date) {
        return this.processedDates.has(date);
    }

    /**
     * Markiert ein Datum als verarbeitet
     */
    markDateAsProcessed(date) {
        this.processedDates.add(date);
    }

    /**
     * Automatische Aktualisierung der Therapien
     */
    async automaticHourUpdate() {
        if (activeTherapies.isUpdating) return;
        
        try {
            activeTherapies.isUpdating = true;
            const currentHour = new Date().getHours();
            
            if (currentHour === activeTherapies.currentHour) return;
            
            activeTherapies.currentHour = currentHour;
            
            for (const [key, startTime] of activeTherapies.activePatients) {
                const [therapyId, caseNumber] = key.split('-');
                const row = document.querySelector(
                    `#${therapyId} tr:has(input[value="${caseNumber}"])`
                );
                
                if (!row) continue;
                
                const hourCell = row.querySelector(`td:nth-child(${currentHour + 3}) .hour`);
                if (hourCell && !hourCell.classList.contains('active')) {
                    hourCell.classList.add('active');
                    hourCell.classList.add('auto-continued');
                    await this._updateRowStatistics(row);
                }
            }
        } catch (error) {
            console.error('Fehler bei automatischer Aktualisierung:', error);
        } finally {
            activeTherapies.isUpdating = false;
            saveActiveTherapiesState();
        }
    }

    /**
     * Aktualisiert die Statistiken einer Zeile
     */
    async _updateRowStatistics(row) {
        const hours = row.querySelectorAll('.hour.active').length;
        const gesamtzeitCell = row.querySelector('.gesamtzeit');
        if (gesamtzeitCell) {
            gesamtzeitCell.textContent = hours;
        }

        const tbody = row.closest('tbody');
        if (tbody) {
            this._updateTableStatistics(tbody);
        }
        
        await saveData();
    }

    /**
     * Aktualisiert die Statistiken einer Tabelle
     */
    _updateTableStatistics(tbody) {
        let gesamtzeit = 0;
        const fallnummern = new Set();
        
        tbody.querySelectorAll('tr:not(.table-statistics)').forEach(row => {
            const gesamtzeitCell = row.querySelector('.gesamtzeit');
            if (gesamtzeitCell) {
                gesamtzeit += parseInt(gesamtzeitCell.textContent || 0, 10);
            }
            
            const fallnummerInput = row.querySelector('td:first-child input');
            if (fallnummerInput?.value.trim()) {
                fallnummern.add(fallnummerInput.value.trim());
            }
        });
        
        const gesamtzeitElement = tbody.querySelector('.gesamtzeit-gesamtwert');
        if (gesamtzeitElement) {
            gesamtzeitElement.textContent = gesamtzeit;
        }
        
        const fallzahlElement = tbody.querySelector('.fallzahl-wert');
        if (fallzahlElement) {
            fallzahlElement.textContent = fallnummern.size;
        }
    }

    /**
     * Behandelt die automatische Übernahme von Vortages-Daten
     */
    async handleAutomaticContinuation(date) {
        if (this.hasProcessedDate(date)) {
            console.log('Datum wurde bereits verarbeitet, überspringe...');
            return;
        }

        try {
            console.log('Lade Vortages-Daten...');
            const previousData = await loadPreviousDayData(date);
            
            if (Object.keys(previousData).length > 0) {
                const patientList = this._formatPatientList(previousData);
                
                if (confirm(this._generateConfirmMessage(patientList))) {
                    await this._continuePreviousTherapies(previousData);
                }
            }
            
            this.markDateAsProcessed(date);
            
        } catch (error) {
            console.error('Fehler bei automatischer Übernahme:', error);
            alert('Fehler bei der Übernahme der Vortages-Daten');
        }
    }

    /**
     * Formatiert die Patientenliste für die Anzeige
     */
    _formatPatientList(previousData) {
        return Object.entries(previousData)
            .map(([therapy, patients]) => 
                patients.map(p => `- ${p.name} (${p.caseNumber}) - ${therapy}`)
            )
            .flat()
            .join('\n');
    }

    /**
     * Generiert die Bestätigungsmeldung
     */
    _generateConfirmMessage(patientList) {
        return `Folgende Patienten von gestern übernehmen?\n\n${patientList}`;
    }

    /**
     * Führt die Therapien vom Vortag fort
     */
    async _continuePreviousTherapies(previousData) {
        const currentHour = new Date().getHours();

        for (const [therapyId, patients] of Object.entries(previousData)) {
            for (const patient of patients) {
                await this._continuePatientTherapy(therapyId, patient, currentHour);
            }
        }

        await saveData();
        saveActiveTherapiesState();
    }

    /**
     * Führt die Therapie eines einzelnen Patienten fort
     */
    async _continuePatientTherapy(therapyId, patient, currentHour) {
        const table = document.getElementById(therapyId);
        if (!table) return;

        const row = this._addNewRow(table);
        if (!row) return;

        // Patientendaten einfügen
        const inputs = row.querySelectorAll('input');
        inputs[0].value = patient.caseNumber;
        inputs[1].value = patient.name;

        // Stunden aktivieren
        row.querySelectorAll('.hour').forEach((hour, index) => {
            if (index <= currentHour) {
                hour.classList.add('active', 'auto-continued');
            }
        });

        // Zur aktiven Therapie hinzufügen
        const key = `${therapyId}-${patient.caseNumber}`;
        activeTherapies.activePatients.set(key, new Date());

        await this._updateRowStatistics(row);
    }

    /**
     * Fügt eine neue Zeile zu einer Tabelle hinzu
     */
    _addNewRow(table) {
        const addButton = table.querySelector('button');
        if (addButton && typeof window.addRow === 'function') {
            return window.addRow(table.id);
        }
        return null;
    }

    /**
     * Exportiert die Daten im gewählten Format
     */
    async handleExport() {
        try {
            await exportData();
        } catch (error) {
            console.error('Fehler beim Exportieren:', error);
            alert('Fehler beim Exportieren der Daten: ' + error.message);
        }
    }
}