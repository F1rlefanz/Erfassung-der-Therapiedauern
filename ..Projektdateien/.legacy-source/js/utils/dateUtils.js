// js/dateUtils.js
export function normalizeDate(date) {
    // Stellt sicher, dass das Datum auf 12:00 Uhr mittags gesetzt wird
    // Dies verhindert Zeitzonenverschiebungen
    const normalized = new Date(date);
    normalized.setHours(12, 0, 0, 0);
    return normalized;
}

// Bestehende Funktion anpassen
export function formatDateForInput(date) {
    const normalized = normalizeDate(date);
    const day = String(normalized.getDate()).padStart(2, '0');
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const year = normalized.getFullYear();
    return `${year}-${month}-${day}`;
}

export function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return new Date(`${year}-${month}-${day}`);
}