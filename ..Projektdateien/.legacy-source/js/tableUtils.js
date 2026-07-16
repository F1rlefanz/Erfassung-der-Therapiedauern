// tableUtils.js
import { saveData } from './utils/dataUtils.js';
import { state, activeTherapies, saveActiveTherapiesState } from './state.js';
import { db } from './dbConfig.js';

export function generateTable(tablesContainer, id, title) {
    const tableContainer = document.createElement('section');
    tableContainer.id = id;
    tableContainer.className = 'table-container';
    tableContainer.innerHTML = `
        <h2 class="section-title">${title}</h2>
        <div class="table-wrapper">
            <table class="table">
                <thead>
                    <tr>
                        <th>Nummer</th>
                        <th>Name</th>
                        ${Array.from({ length: 24 }, (_, i) => `<th>${String(i).padStart(2, '0')}</th>`).join('')}
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
                            Gesamtzeit aller Patienten: <span class="gesamtzeit-gesamtwert">0</span> Stunden
                        </td>
                        <td colspan="2"></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <button type="button" class="button primary mt-4" onclick="window.addRow('${id}')">
            <i data-lucide="plus" class="button-icon"></i>
            Zeile hinzufügen
        </button>
    `;
    tablesContainer.appendChild(tableContainer);
}

export function createActionMenu(row) {
    const actionsCell = row.querySelector('td:last-child');
    
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'relative dropdown';
    
    dropdownContainer.innerHTML = `
        <button class="button icon-button" type="button">
            <i data-lucide="more-vertical" class="w-5 h-5"></i>
        </button>
        <div class="dropdown-menu hidden">
            <div class="py-1" role="menu">
                <button class="stop-therapy dropdown-item text-error flex items-center" role="menuitem">
                    <i data-lucide="stop-circle" class="button-icon"></i>
                    Therapie beenden
                </button>
                <div class="border-t border"></div>
                <button class="delete-row dropdown-item flex items-center" role="menuitem">
                    <i data-lucide="trash-2" class="button-icon"></i>
                    Zeile löschen
                </button>
            </div>
        </div>
    `;

    // Toggle Dropdown
    const menuButton = dropdownContainer.querySelector('button');
    const menuContent = dropdownContainer.querySelector('.dropdown-menu');
    
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        menuContent.classList.toggle('hidden');
    });
    
    document.addEventListener('click', () => {
        menuContent.classList.add('hidden');
    });
    
    // Event Listener für Stop Button
    dropdownContainer.querySelector('.stop-therapy').addEventListener('click', async () => {
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
                
                await updateTotal(row);
                await updateGesamtzeit(row.closest('tbody'));
                await saveData();
                saveActiveTherapiesState();
                
                row.classList.add('therapy-ended');
                menuContent.classList.add('hidden');
                window.lucide.createIcons();
            } catch (error) {
                console.error('Fehler beim Beenden der Therapie:', error);
                showErrorMessage('Fehler beim Beenden der Therapie');
            }
        }
    });
    
    // Event Listener für Löschen-Button
    dropdownContainer.querySelector('.delete-row').addEventListener('click', async () => {
        const caseNumber = row.querySelector('input').value;
        const therapyId = row.closest('.table-container').id;
        
        try {
            if (confirm('Zeile wirklich löschen?')) {
                row.remove();
                const tbody = document.querySelector(`#${therapyId} tbody`);
                updateGesamtzeit(tbody);
                
                if (caseNumber) {
                    await db.deleteDailyEntryPatient(state.dateInput.value, therapyId, caseNumber);
                }
                
                await saveData();
                menuContent.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error deleting row:', error);
            showErrorMessage('Fehler beim Löschen der Zeile');
        }
    });
    
    actionsCell.innerHTML = '';
    actionsCell.appendChild(dropdownContainer);
    
    window.lucide.createIcons();
}

export function addRow(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="input" placeholder="Nummer"></td>
        <td><input type="text" class="input" placeholder="Name"></td>
        ${Array(24).fill('<td><div class="hour"></div></td>').join('')}
        <td class="gesamtzeit text-center">0</td>
        <td class="actions"></td>
    `;

    const statsRow = tbody.querySelector('.table-statistics');
    tbody.insertBefore(row, statsRow);

    addHourEventListeners(row);
    createActionMenu(row);
    
    return row;
}

export function addHourEventListeners(row) {
    if (row.classList.contains('therapy-ended')) return;
    
    row.querySelectorAll('.hour').forEach((hour, hourIndex) => {
        hour.addEventListener('mousedown', async function(event) {
            event.preventDefault();
            
            if (row.classList.contains('therapy-ended')) return;
            
            const caseNumber = row.querySelector('input').value;
            if (!caseNumber) {
                showErrorMessage('Bitte erst Fallnummer eingeben');
                return;
            }
            
            const therapyId = row.closest('.table-container').id;
            const key = `${therapyId}-${caseNumber}`;
            
            this.classList.toggle('active');
            this.classList.remove('auto-continued');
            
            if (this.classList.contains('active')) {
                activeTherapies.activePatients.set(key, new Date());
            } else if (hourIndex === this.parentElement.parentElement.querySelectorAll('.hour.active').length - 1) {
                activeTherapies.activePatients.delete(key);
                row.querySelectorAll('.hour').forEach(h => h.classList.remove('auto-continued'));
            }
            
            await updateTotal(row);
            await updateGesamtzeit(row.closest('tbody'));
            await saveData();
            saveActiveTherapiesState();
        });
        
        hour.addEventListener('mouseover', async function(event) {
            if (event.buttons === 1 && !row.classList.contains('therapy-ended')) {
                const caseNumber = row.querySelector('input').value;
                if (!caseNumber) return;
                
                const therapyId = row.closest('.table-container').id;
                const key = `${therapyId}-${caseNumber}`;
                
                this.classList.toggle('active');
                this.classList.remove('auto-continued');
                
                if (this.classList.contains('active')) {
                    activeTherapies.activePatients.set(key, new Date());
                }
                
                await updateTotal(row);
                await updateGesamtzeit(row.closest('tbody'));
                await saveData();
                saveActiveTherapiesState();
            }
        });
    });
}

export function updateTotal(row) {
    if (!row) return;
    const hours = row.querySelectorAll('.hour.active').length;
    const gesamtzeitCell = row.querySelector('.gesamtzeit');
    if (gesamtzeitCell) {
        gesamtzeitCell.textContent = hours;
    }
}

export function updateGesamtzeit(tbody) {
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

function showErrorMessage(message) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    document.body.appendChild(errorMessage);
    
    setTimeout(() => {
        errorMessage.remove();
    }, 3000);
}