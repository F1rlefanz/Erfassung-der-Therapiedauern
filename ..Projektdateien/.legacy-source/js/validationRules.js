// js/validationRules.js
/**
 * Zentrale Klasse für Validierungsregeln und Statistikberechnungen
 */
export class ValidationRules {
    /**
     * Validiert eine Fallnummer auf Eindeutigkeit
     * @param {string} caseNumber - Zu validierende Fallnummer
     * @param {string} therapyType - Art der Therapie 
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @param {Object} db - Datenbankinstanz
     * @returns {Promise<Object>} Validierungsergebnis
     */
    static async validateCaseNumber(caseNumber, therapyType, date, db) {
        try {
            // Prüfe Eindeutigkeit pro Tag
            const dailyEntry = await db.getDailyEntry(date, therapyType);
            if (dailyEntry?.patients?.some(p => p.caseNumber === caseNumber)) {
                return {
                    valid: false,
                    error: 'Fallnummer existiert bereits für diesen Tag'
                };
            }

            // Prüfe Eindeutigkeit pro Monat
            const [year, month] = date.split('-');
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            const monthlyEntries = await db.getDailyEntriesInRange(
                monthStart.toISOString().split('T')[0],
                monthEnd.toISOString().split('T')[0],
                therapyType
            );

            const existingMonthlyCase = monthlyEntries?.some(entry =>
                entry.patients?.some(p => p.caseNumber === caseNumber)
            );

            if (existingMonthlyCase) {
                return {
                    valid: true,
                    warning: 'Fallnummer wurde bereits diesen Monat erfasst - wird für monatliche Statistik nur einmal gezählt'
                };
            }

            return { valid: true };
            
        } catch (error) {
            console.error('Fehler bei Fallnummer-Validierung:', error);
            return {
                valid: false,
                error: 'Technischer Fehler bei der Validierung'
            };
        }
    }

    /**
     * Berechnet statistische Kennzahlen für eine Gruppe von Patienten
     * @param {Array} patients - Array von Patientenobjekten
     * @returns {Object} Berechnete Statistiken
     */
    static calculateDailyStatistics(patients) {
        if (!Array.isArray(patients)) {
            console.error('Ungültiges Patientenarray');
            return {
                uniqueCases: 0,
                totalHours: 0,
                startedDays: 0,
                completeDays: 0
            };
        }

        try {
            // Eindeutige Fälle über Set
            const uniqueCases = new Set(
                patients
                    .filter(p => p?.caseNumber)
                    .map(p => p.caseNumber)
            );

            // Gesamtstunden
            const totalHours = patients.reduce((sum, p) => {
                if (!p?.hours || !Array.isArray(p.hours)) return sum;
                return sum + p.hours.filter(h => h).length;
            }, 0);

            // Begonnene Tage (mind. 1 Stunde)
            const startedDays = patients.filter(p => 
                p?.hours?.some(h => h)
            ).length;

            // Komplette Tage (24h)
            const completeDays = patients.filter(p =>
                p?.hours?.filter(h => h).length === 24
            ).length;

            return {
                uniqueCases: uniqueCases.size,
                totalHours,
                startedDays,
                completeDays,
                averageHoursPerCase: uniqueCases.size > 0 
                    ? (totalHours / uniqueCases.size).toFixed(1) 
                    : 0,
                completionRate: startedDays > 0 
                    ? (completeDays / startedDays * 100).toFixed(1) 
                    : 0
            };

        } catch (error) {
            console.error('Fehler bei Statistikberechnung:', error);
            return {
                uniqueCases: 0,
                totalHours: 0,
                startedDays: 0,
                completeDays: 0,
                averageHoursPerCase: 0,
                completionRate: 0
            };
        }
    }
}