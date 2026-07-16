// dataUtils.js
import { ValidationRules } from '../validationRules.js';
import { formatDateForInput } from './dateUtils.js';
import { db } from '../dbConfig.js';
import { yearlyDBManager } from '../yearlyDBManager.js';
import { state, activeTherapies, saveActiveTherapiesState } from '../state.js';
import { updateTotal, updateGesamtzeit } from '../tableUtils.js';
export { exportData } from './exportUtils.js';
/**
 * Sammelt die Daten aus allen Therapie-Tabellen
 */
export function collectData() {
    try {
        const date = state.dateInput.value;
        const data = {};

        document.querySelectorAll('.table-container').forEach(container => {
            const therapyId = container.id;
            const patients = [];

            container.querySelectorAll('tr:not(.table-statistics)').forEach(row => {
                const patient = {
                    caseNumber: row.querySelector('td:first-child input')?.value?.trim() || '',
                    name: row.querySelector('td:nth-child(2) input')?.value?.trim() || '',
                    hours: Array.from(row.querySelectorAll('.hour')).map(hour => 
                        hour.classList.contains('active')
                    )
                };

                if (patient.caseNumber || patient.name || patient.hours.some(h => h)) {
                    patients.push(patient);
                }
            });

            if (patients.length > 0) {
                data[therapyId] = patients;
            }
        });

        return { date, data };
    } catch (error) {
        console.error('Error collecting data:', error);
        showErrorMessage('Fehler beim Sammeln der Daten');
        throw error;
    }
}

/**
 * Speichert die Therapiedaten und aktualisiert die Statistiken
 */
export async function saveData() {
    try {
        const date = state.dateInput.value;
        console.log(`Speichere Daten für: ${date}`);
        
        const collectedData = collectData();
        const data = collectedData.data;

        // Debug-Logging
        console.log('Zu speichernde Daten:', data);
        
        // Prüfe auf neues Jahr
        const year = parseInt(date.split('-')[0]);
        if (!yearlyDBManager.databases.has(year)) {
            await yearlyDBManager.initializeYear(year);
            window.dispatchEvent(new CustomEvent('yearAdded', { detail: { year } }));
        }
        
        // Speichern und Statistiken aktualisieren für jede Therapieart
        for (const [therapyType, patients] of Object.entries(data)) {
            try {
                // Validiere Patientendaten vor dem Speichern
                const validatedPatients = patients.map(patient => ({
                    ...patient,
                    name: patient.name?.trim() || '',
                    caseNumber: patient.caseNumber?.trim() || '',
                    hours: Array.isArray(patient.hours) ? patient.hours : new Array(24).fill(false)
                }));

                await db.saveDailyEntry(date, therapyType, { 
                    patients: validatedPatients 
                });
                
                await updateStatistics(year, parseInt(date.split('-')[1]), therapyType, validatedPatients);
                await updateUI(therapyType, validatedPatients);
            } catch (error) {
                console.error(`Fehler bei Therapieart ${therapyType}:`, error);
            }
        }

        showSuccessMessage('Daten erfolgreich gespeichert');
    } catch (error) {
        console.error('Error saving data:', error);
        showErrorMessage('Fehler beim Speichern der Daten');
        throw error;
    }
}

/**
 * Aktualisiert die Statistiken für eine Therapieart
 */
async function updateStatistics(year, month, therapyType, patients) {
    try {
        await db.calculateMonthlyStatistics(year, month, therapyType);
        await db.calculateYearlyStatistics(year, therapyType);
    } catch (error) {
        console.error(`Fehler bei Statistik-Update für ${therapyType}:`, error);
        throw error;
    }
}

/**
 * Aktualisiert die UI-Elemente
 */
async function updateUI(therapyType, patients) {
    try {
        const container = document.getElementById(therapyType);
        if (!container) return;

        const stats = ValidationRules.calculateDailyStatistics(patients);
        
        updateStatElement(container, '.fallzahl-wert', stats.uniqueCases);
        updateStatElement(container, '.gesamtzeit-gesamtwert', stats.totalHours);
    } catch (error) {
        console.error(`Fehler beim UI-Update für ${therapyType}:`, error);
        throw error;
    }
}

/**
 * Aktualisiert ein einzelnes Statistik-Element
 */
function updateStatElement(container, selector, value) {
    const element = container.querySelector(selector);
    if (element) {
        element.textContent = value;
        element.classList.add('updated');
        setTimeout(() => element.classList.remove('updated'), 1000);
    }
}

/**
 * Lädt die Daten vom Vortag
 */
export async function loadPreviousDayData(date) {
    try {
        const previousDay = new Date(date);
        previousDay.setDate(previousDay.getDate() - 1);
        const prevDateStr = formatDateForInput(previousDay);
        
        console.debug('=== loadPreviousDayData Debug ===');
        console.debug(`Aktuelles Datum: ${date}`);
        console.debug(`Vortag: ${prevDateStr}`);
        
        const therapyTypes = await db.getActiveTherapyTypes();
        const previousData = {};
        
        for (const therapy of therapyTypes) {
            console.debug(`\nPrüfe Therapie: ${therapy.id}`);
            const entry = await db.getDailyEntry(prevDateStr, therapy.id);
            
            if (entry?.patients) {
                previousData[therapy.id] = entry.patients.filter(patient => {
                    console.debug(`Patient ${patient.caseNumber}:`);
                    const lastHourActive = patient.hours[23];
                    return lastHourActive;
                });
            }
        }
        
        return previousData;
    } catch (error) {
        console.error('Fehler beim Laden der Vortages-Daten:', error);
        showErrorMessage('Fehler beim Laden der Vortages-Daten');
        throw error;
    }
}

/**
 * Automatische Aktualisierung der aktiven Therapien
 */
export async function automaticHourUpdate() {
    if (activeTherapies.isUpdating) return;
    
    try {
        activeTherapies.isUpdating = true;
        const currentHour = new Date().getHours();
        
        if (currentHour === activeTherapies.currentHour) return;
        
        activeTherapies.currentHour = currentHour;
        
        for (const [key, startTime] of activeTherapies.activePatients) {
            const [therapyId, caseNumber] = key.split('-');
            const row = document.querySelector(
                `#${therapyId} tr:has(.input[value="${caseNumber}"])`
            );
            
            if (!row) continue;
            
            const hourCell = row.querySelector(`.hour:nth-child(${currentHour + 1})`);
            if (hourCell && !hourCell.classList.contains('active')) {
                hourCell.classList.add('active', 'auto-continued');
                await updateTotal(row);
                await updateGesamtzeit(row.closest('tbody'));
            }
        }
        
        await saveData();
    } catch (error) {
        console.error('Fehler bei automatischer Aktualisierung:', error);
        showErrorMessage('Fehler bei automatischer Aktualisierung');
    } finally {
        activeTherapies.isUpdating = false;
        saveActiveTherapiesState();
    }
}

/**
 * Zeigt eine Erfolgsmeldung an
 */
function showSuccessMessage(message) {
    showMessage(message, 'success-message');
}

/**
 * Zeigt eine Fehlermeldung an
 */
function showErrorMessage(message) {
    showMessage(message, 'error-message');
}

/**
 * Zeigt eine Nachricht in der UI an
 */
function showMessage(message, className) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => messageElement.remove(), 300);
    }, 3000);
}