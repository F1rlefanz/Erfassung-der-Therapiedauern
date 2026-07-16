// js/index.js
import { db } from './dbConfig.js';
import { formatDateForInput } from './utils/dateUtils.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialisiere Icons
        lucide.createIcons();

        // Lade aktuelle Übersicht
        await updateDashboard();

        // Aktualisiere die Zeit
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
});

async function updateDashboard() {
    try {
        const today = formatDateForInput(new Date());
        const therapyTypes = await db.getActiveTherapyTypes();
        let todayCount = 0;
        let activeCount = 0;

        // Zähle Therapien für heute
        for (const therapy of therapyTypes) {
            const entry = await db.getDailyEntry(today, therapy.id);
            if (entry?.patients) {
                todayCount += entry.patients.length;
                activeCount += entry.patients.filter(p => 
                    p.hours[new Date().getHours()]
                ).length;
            }
        }

        // Aktualisiere UI
        document.getElementById('today-count').textContent = todayCount;
        document.getElementById('active-count').textContent = activeCount;

    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('de-DE');
    document.getElementById('last-update').textContent = timeString;

    // Aktualisiere alle 60 Sekunden
    setTimeout(updateLastUpdateTime, 60000);
}