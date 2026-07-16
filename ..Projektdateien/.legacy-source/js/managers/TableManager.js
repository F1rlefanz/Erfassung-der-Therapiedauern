// js/managers/TableManager.js

import { saveData } from '../utils/dataUtils.js';
import { state, activeTherapies, saveActiveTherapiesState } from '../state.js';
import { db } from '../dbConfig.js';

export class TableManager {
    constructor(container) {
        if (!container) {
            throw new Error('Container Element ist erforderlich');
        }
        this.container = container;
    }

    /**
     * Löscht alle bestehenden Tabellen
     */
    clearTables() {
        this.container.innerHTML = '';
    }

    /**
     * Generiert eine neue Tabelle für einen Therapietyp
     */
    generateTable(id, title) {
        const tableContainer = document.createElement('section');
        tableContainer.id = id;
        tableContainer.className = 'table-container';
        
        // Debug-Log
        console.log('Generiere Tabelle:', id);
        
        const tableHTML = this._generateTableHTML(id, title);
        tableContainer.innerHTML = tableHTML;
        
        // Debug-Log
        console.log('Generierte Stundenfelder:', 
            tableContainer.querySelectorAll('.hour').length);
        
        this.container.appendChild(tableContainer);
    }

    /**
     * Generiert das HTML-Template für eine Tabelle
     */
    _generateTableHTML(id, title) {
        return `
            <h2>${title}</h2>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nummer</th>
                            <th>Name</th>
                            ${Array.from({ length: 24 }, (_, i) => 
                                `<th>${String(i).padStart(2, '0')}</th>`
                            ).join('')}
                            <th>Gesamtzeit</th>
                            <th>Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="table-statistics">
                            <td colspan="2" class="fallzahl-container">
                                Fallzahl: <span class="fallzahl-wert">0</span> Patienten
                            </td>
                            <td colspan="24" class="gesamtzeit-container">
                                Gesamtzeit aller Patienten: 
                                <span class="gesamtzeit-gesamtwert">0</span> Stunden
                            </td>
                            <td colspan="2"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <button type="button" onclick="window.addRow('${id}')">
                Zeile hinzufügen
            </button>
        `;
    }

    /**
     * Fügt eine neue Zeile zur Tabelle hinzu
     */
    addRow(tableId) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return null;

        const row = document.createElement('tr');
        row.innerHTML = this._generateRowHTML();

        const statsRow = tbody.querySelector('.table-statistics');
        tbody.insertBefore(row, statsRow);

        this._addHourEventListeners(row);
        this._addInputEventListeners(row);
        this._createActionMenu(row);
        
        return row;
    }

    /**
     * Generiert das HTML für eine neue Tabellenzeile
     */
    _generateRowHTML() {
        return `
            <td><input type="text" placeholder="Nummer"></td>
            <td><input type="text" placeholder="Name"></td>
            ${Array(24).fill('<td><div class="hour"></div></td>').join('')}
            <td class="gesamtzeit">0</td>
            <td class="actions"></td>
        `;
    }

    /**
     * Aktualisiert den Inhalt einer bestehenden Tabelle
     */
    async updateTableContent(therapyId, entry) {
        console.log(`Aktualisiere Tabelleninhalt für ${therapyId}`, entry);
    
        const tbody = document.querySelector(`#${therapyId} tbody`);
        if (!tbody) {
            console.error(`Table body nicht gefunden für: ${therapyId}`);
            return;
        }
    
        // Behalte die Statistik-Zeile
        const statsRow = tbody.querySelector('.table-statistics');
        
        // Entferne alle anderen Zeilen
        tbody.querySelectorAll('tr:not(.table-statistics)').forEach(row => row.remove());
    
        // Aktuelle Stunde für auto-continued Markierung
        const currentHour = new Date().getHours();
    
        // Füge Patientenzeilen hinzu
        if (entry?.patients) {
            entry.patients.forEach(patient => {
                console.log(`Erstelle Zeile für Patient:`, patient);
    
                const row = this._createPatientRow(patient, currentHour);
                tbody.insertBefore(row, statsRow);
                this._addHourEventListeners(row);
                this._addInputEventListeners(row);
                this._createActionMenu(row);
    
                if (patient.hours[currentHour]) {
                    const key = `${therapyId}-${patient.caseNumber}`;
                    activeTherapies.activePatients.set(key, new Date());
                    console.log(`Patient ${patient.caseNumber} zur aktiven Therapie hinzugefügt`);
                }
            });
        }
    
        this._updateGesamtzeit(tbody);
    }

    /**
     * Erstellt eine neue Patientenzeile
     */
    _createPatientRow(patient, currentHour) {
        // Debugging
        console.log('Creating patient row with data:', patient);
    
        const row = document.createElement('tr');
        
        // HTML escapen um XSS zu verhindern
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
    
        row.innerHTML = `
            <td><input type="text" value="${escapeHtml(patient.caseNumber || '')}" placeholder="Nummer"></td>
            <td><input type="text" value="${escapeHtml(patient.name || '')}" placeholder="Name"></td>
            ${patient.hours.map((active, index) => {
                const isCurrentHour = index <= currentHour;
                const classes = [
                    'hour',
                    active ? 'active' : '',
                    (active && isCurrentHour) ? 'auto-continued' : ''
                ].filter(Boolean).join(' ');
                return `<td><div class="${classes}"></div></td>`;
            }).join('')}
            <td class="gesamtzeit">${patient.hours.filter(h => h).length}</td>
            <td class="actions"></td>
        `;
    
        return row;
    }

    /**
     * Fügt Event Listener für die Stunden-Marker hinzu
     */
    _addHourEventListeners(row) {
        if (row.classList.contains('therapy-ended')) return;
        
        row.querySelectorAll('.hour').forEach((hour, hourIndex) => {
            hour.addEventListener('mousedown', async (event) => {
                await this._handleHourClick(event, hour, row, hourIndex);
            });
            
            hour.addEventListener('mouseover', async (event) => {
                await this._handleHourHover(event, hour, row);
            });
        });
    }

    /**
     * Fügt Event Listener für die Fallnummer und Namenfelder hinzu
     */

    _addInputEventListeners(row) {
        row.querySelectorAll('input').forEach(input => {
            // Bei Änderung während der Eingabe
            input.addEventListener('input', async () => {
                console.log('Input event - Speichere Daten...');
                await this._updateStatistics(row);
            });
    
            // Beim Verlassen des Feldes
            input.addEventListener('change', async () => {
                console.log('Change event - Speichere Daten...');
                await this._updateStatistics(row);
            });
    
            // Bei Enter-Taste
            input.addEventListener('keypress', async (event) => {
                if (event.key === 'Enter') {
                    console.log('Enter pressed - Speichere Daten...');
                    await this._updateStatistics(row);
                }
            });
        });
    }

    /**
     * Behandelt Klick-Events auf Stunden-Marker
     */
    async _handleHourClick(event, hour, row, hourIndex) {
        event.preventDefault();
        
        if (row.classList.contains('therapy-ended')) return;
        
        const caseNumber = row.querySelector('input').value;
        if (!caseNumber) {
            alert('Bitte erst Fallnummer eingeben');
            return;
        }
        
        const therapyId = row.closest('.table-container').id;
        const key = `${therapyId}-${caseNumber}`;
        
        hour.classList.toggle('active');
        hour.classList.remove('auto-continued');
        
        if (hour.classList.contains('active')) {
            activeTherapies.activePatients.set(key, new Date());
        } else if (hourIndex === hour.parentElement.parentElement.querySelectorAll('.hour.active').length - 1) {
            activeTherapies.activePatients.delete(key);
            row.querySelectorAll('.hour').forEach(h => h.classList.remove('auto-continued'));
        }
        
        await this._updateStatistics(row);
    }

    /**
     * Behandelt Hover-Events auf Stunden-Marker
     */
    async _handleHourHover(event, hour, row) {
        if (event.buttons === 1 && !row.classList.contains('therapy-ended')) {
            const caseNumber = row.querySelector('input').value;
            if (!caseNumber) return;
            
            const therapyId = row.closest('.table-container').id;
            const key = `${therapyId}-${caseNumber}`;
            
            hour.classList.toggle('active');
            hour.classList.remove('auto-continued');
            
            if (hour.classList.contains('active')) {
                activeTherapies.activePatients.set(key, new Date());
            }
            
            await this._updateStatistics(row);
        }
    }

    /**
     * Aktualisiert die Statistiken nach Änderungen
     */
    async _updateStatistics(row) {
        await this._updateTotal(row);
        await this._updateGesamtzeit(row.closest('tbody'));
        await saveData();
        saveActiveTherapiesState();
    }

    /**
     * Erstellt das Aktionsmenü für eine Zeile
     */
    _createActionMenu(row) {
        const actionsCell = row.querySelector('td:last-child');
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'relative inline-block text-left';
        
        dropdownContainer.innerHTML = this._generateActionMenuHTML();
        
        this._setupActionMenuEventListeners(dropdownContainer, row);
        
        actionsCell.innerHTML = '';
        actionsCell.appendChild(dropdownContainer);
        
        window.lucide.createIcons();
    }

    /**
     * Generiert das HTML für das Aktionsmenü
     */
    _generateActionMenuHTML() {
        return `
            <button class="inline-flex justify-center rounded-md bg-[#34495e] px-3 py-2 text-white hover:bg-[#2c3e50] focus:outline-none">
                <i data-lucide="more-vertical" class="h-5 w-5"></i>
            </button>
            <div class="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 hidden position-fix">
                <div class="py-1" role="menu">
                    <button class="stop-therapy text-red-600 w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center" role="menuitem">
                        <i data-lucide="stop-circle" class="inline-block mr-2"></i>
                        Therapie beenden
                    </button>
                    <div class="border-t border-gray-100"></div>
                    <button class="delete-row w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center" role="menuitem">
                        <i data-lucide="trash-2" class="inline-block mr-2"></i>
                        Zeile löschen
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Fügt Event Listener für das Aktionsmenü hinzu
     */
    _setupActionMenuEventListeners(container, row) {
        // Die Selektoren müssen mit den Klassen im HTML übereinstimmen
        const menuButton = container.querySelector('button'); // Der erste Button
        const menuContent = container.querySelector('div[role="menu"]').parentElement;
        const stopButton = container.querySelector('.stop-therapy'); // Diese Klasse haben wir behalten
        const deleteButton = container.querySelector('.delete-row'); // Diese Klasse haben wir behalten
    
        if (!menuButton || !menuContent || !stopButton || !deleteButton) {
            console.error('Konnte nicht alle erforderlichen Elemente finden');
            return;
        }
    
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuContent.classList.toggle('hidden');
        });
    
        document.addEventListener('click', () => {
            menuContent.classList.add('hidden');
        });
    
        stopButton.addEventListener('click', async () => {
            await this._handleStopTherapy(row, menuContent);
        });
    
        deleteButton.addEventListener('click', async () => {
            await this._handleDeleteRow(row, menuContent);
        });
    }
    /**
     * Behandelt das Beenden einer Therapie
     */
    async _handleStopTherapy(row, menuContent) {
        const caseNumber = row.querySelector('input').value;
        const therapyId = row.closest('.table-container').id;
        const key = `${therapyId}-${caseNumber}`;
        
        if (confirm(`Therapie für Patient ${caseNumber} wirklich beenden?`)) {
            try {
                activeTherapies.activePatients.delete(key);
                
                const now = new Date();
                const endHour = now.getHours();
                
                row.querySelectorAll('.hour').forEach((hour, index) => {
                    if (index > endHour) {
                        hour.classList.remove('active');
                    }
                });
                
                await this._updateStatistics(row);
                row.classList.add('therapy-ended');
                menuContent.classList.add('hidden');
                window.lucide.createIcons();
            } catch (error) {
                console.error('Fehler beim Beenden der Therapie:', error);
                alert('Fehler beim Beenden der Therapie');
            }
        }
    }

    /**
     * Behandelt das Löschen einer Zeile
     */
    async _handleDeleteRow(row, menuContent) {
        const caseNumber = row.querySelector('input').value;
        const therapyId = row.closest('.table-container').id;
        
        try {
            if (confirm('Zeile wirklich löschen?')) {
                row.remove();
                const tbody = document.querySelector(`#${therapyId} tbody`);
                this._updateGesamtzeit(tbody);
                
                if (caseNumber) {
                    await db.deleteDailyEntryPatient(state.dateInput.value, therapyId, caseNumber);
                }
                
                await saveData();
                menuContent.classList.add('hidden');
            }
        } catch (error) {
            console.error('Fehler beim Löschen der Zeile:', error);
            alert('Fehler beim Löschen der Zeile');
        }
    }

    /**
     * Aktualisiert die Gesamtzeit einer Zeile
     */
    async _updateTotal(row) {
        if (!row) return;
        const hours = row.querySelectorAll('.hour.active').length;
        const gesamtzeitCell = row.querySelector('.gesamtzeit');
        if (gesamtzeitCell) {
            gesamtzeitCell.textContent = hours;
        }
    }

    /**
     * Aktualisiert die Gesamtzeit einer Tabelle
     */
    _updateGesamtzeit(tbody) {
        if (!tbody) return;

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
}