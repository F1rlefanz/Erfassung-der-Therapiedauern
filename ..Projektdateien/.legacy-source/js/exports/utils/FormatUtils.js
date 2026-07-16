// js/exports/utils/FormatUtils.js

/**
 * Formatierungshilfsfunktionen für den Export
 * Stellt zentrale Funktionen für einheitliche Formatierung bereit
 */
class FormatUtils {
    constructor() {
        // Formatierungsoptionen für Zahlen
        this.numberFormat = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });

        // Formatierung für ganze Zahlen
        this.integerFormat = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        // Formatierung für Prozente
        this.percentFormat = new Intl.NumberFormat('de-DE', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });

        // Formatierung für Datumswerte
        this.dateFormat = new Intl.DateTimeFormat('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        // Formatierung für Zeitstempel
        this.timestampFormat = new Intl.DateTimeFormat('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Deutsche Monatsnamen
        this.months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
    }

    /**
     * Formatiert eine Dezimalzahl
     * @param {number} value - Zu formatierende Zahl
     * @param {boolean} [asInteger=false] - Als Ganzzahl formatieren
     * @returns {string} Formatierte Zahl oder '-' bei ungültigem Wert
     */
    formatNumber(value, asInteger = false) {
        try {
            if (value === null || value === undefined || isNaN(value)) {
                return '-';
            }
            return (asInteger ? this.integerFormat : this.numberFormat)
                .format(value);
        } catch (error) {
            console.error('Fehler bei Zahlenformatierung:', error);
            return '-';
        }
    }

    /**
     * Formatiert einen Prozentwert
     * @param {number} value - Dezimalwert (z.B. 0.756 für 75.6%)
     * @returns {string} Formatierter Prozentwert oder '-' bei ungültigem Wert
     */
    formatPercent(value) {
        try {
            if (value === null || value === undefined || isNaN(value)) {
                return '-';
            }
            return this.percentFormat.format(value);
        } catch (error) {
            console.error('Fehler bei Prozentformatierung:', error);
            return '-';
        }
    }

    /**
     * Formatiert ein Datum
     * @param {Date|string} date - Datum oder ISO-String
     * @returns {string} Formatiertes Datum oder '-' bei ungültigem Wert
     */
    formatDate(date) {
        try {
            if (!date) return '-';
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) return '-';
            return this.dateFormat.format(dateObj);
        } catch (error) {
            console.error('Fehler bei Datumsformatierung:', error);
            return '-';
        }
    }

    /**
     * Formatiert ein Datum speziell für HTML5 date-Input Felder
     * @param {Date|string} date - Datum oder ISO-String
     * @returns {string} Formatiertes Datum im Format YYYY-MM-DD
     */
    formatDateForInput(date) {
        try {
            if (!date) return '';
            const d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return '';
            
            // Führende Nullen hinzufügen
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            
            // Format YYYY-MM-DD zurückgeben
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Fehler bei Datumsformatierung für Input:', error);
            return '';
        }
    }

    /**
     * Formatiert einen Zeitstempel mit Uhrzeit
     * @param {Date|string} timestamp - Zeitstempel oder ISO-String
     * @returns {string} Formatierter Zeitstempel oder '-' bei ungültigem Wert
     */
    formatTimestamp(timestamp) {
        try {
            if (!timestamp) return '-';
            const dateObj = timestamp instanceof Date ? 
                timestamp : new Date(timestamp);
            if (isNaN(dateObj.getTime())) return '-';
            return this.timestampFormat.format(dateObj);
        } catch (error) {
            console.error('Fehler bei Zeitstempel-Formatierung:', error);
            return '-';
        }
    }

    /**
     * Liefert den deutschen Monatsnamen
     * @param {number} monthIndex - Monatsnummer (1-12)
     * @returns {string} Deutscher Monatsname oder '-' bei ungültigem Index
     */
    getMonthName(monthIndex) {
        try {
            if (monthIndex < 1 || monthIndex > 12) return '-';
            return this.months[monthIndex - 1];
        } catch (error) {
            console.error('Fehler bei Monatsname:', error);
            return '-';
        }
    }

    /**
     * Formatiert einen Durchschnittswert
     * @param {number} total - Gesamtwert
     * @param {number} count - Anzahl der Werte
     * @returns {string} Formatierter Durchschnitt oder '-' bei ungültigen Werten
     */
    formatAverage(total, count) {
        try {
            if (!count || isNaN(total) || isNaN(count)) return '-';
            return this.formatNumber(total / count);
        } catch (error) {
            console.error('Fehler bei Durchschnitts-Berechnung:', error);
            return '-';
        }
    }

    /**
     * Prüft ob ein Wert eine gültige Zahl ist
     * @param {any} value - Zu prüfender Wert
     * @returns {boolean} true wenn gültige Zahl
     */
    isValidNumber(value) {
        return value !== null && 
               value !== undefined && 
               !isNaN(value) &&
               isFinite(value);
    }
}

// Singleton-Instanz exportieren
export const formatUtils = new FormatUtils();