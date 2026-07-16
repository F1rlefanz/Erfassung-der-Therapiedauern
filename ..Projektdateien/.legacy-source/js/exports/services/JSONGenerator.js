// js/exports/services/JSONGenerator.js

import { formatUtils } from '../utils/FormatUtils.js';

/**
 * Generator für JSON-Exporte der Therapiestatistiken
 */
export class JSONGenerator {
    /**
     * Generiert strukturierte JSON-Datei
     * @param {Object} data - Die zu exportierenden Daten
     * @param {Object} options - Exportoptionen
     * @returns {Promise<Blob>} JSON-Datei als Blob
     * @throws {Error} Bei Fehlern während der Generierung
     */
    async generate(data, options) {
        if (!this._validateInput(data)) {
            throw new Error('Ungültige oder fehlende Eingabedaten');
        }

        try {
            // Erstelle Basis-Struktur
            const exportData = {
                metadata: this._formatMetadata(data.metadata),
                data: await this._formatData(data.data)
            };

            // JSON mit Einrückung für bessere Lesbarkeit
            const jsonString = JSON.stringify(exportData, null, 2);
            
            // Als Blob mit korrektem MIME-Type
            return new Blob([jsonString], {
                type: 'application/json;charset=utf-8'
            });

        } catch (error) {
            console.error('JSON-Generierung fehlgeschlagen:', error);
            throw new Error(`JSON-Erstellung fehlgeschlagen: ${error.message}`);
        }
    }

    /**
     * Validiert die Eingabedaten
     * @private
     */
    _validateInput(data) {
        return data?.metadata && 
               data?.data && 
               Object.keys(data.data).length > 0;
    }

    /**
     * Formatiert die Metadaten
     * @private
     */
    _formatMetadata(metadata) {
        return {
            version: '1.0',
            exportType: 'Therapiestatistiken',
            timestamp: formatUtils.formatTimestamp(metadata.exportDate),
            timerange: {
                from: formatUtils.formatDate(metadata.timerange.from),
                to: formatUtils.formatDate(metadata.timerange.to)
            },
            dataTypes: metadata.exportedTypes
        };
    }

    /**
     * Formatiert die Hauptdaten
     * @private
     */
    async _formatData(data) {
        const formattedData = {};

        // Therapiestatistiken
        if (data.therapyStats) {
            formattedData.therapyStats = {
                monthly: this._formatTherapyStats(data.therapyStats.monthly),
                yearly: this._formatYearlyStats(data.therapyStats.yearly)
            };
        }

        // ICU Statistiken
        if (data.icuStats) {
            formattedData.icuStats = this._formatICUStats(data.icuStats);
        }

        // IMC Statistiken  
        if (data.imcStats) {
            formattedData.imcStats = this._formatIMCStats(data.imcStats);
        }

        return formattedData;
    }

    /**
     * Formatiert Therapiestatistiken
     * @private
     */
    _formatTherapyStats(monthlyData) {
        const formattedStats = {};

        for (const [therapyType, data] of Object.entries(monthlyData)) {
            formattedStats[therapyType] = data.map(entry => ({
                month: formatUtils.getMonthName(entry.month),
                therapieStunden: formatUtils.formatNumber(entry.hours),
                begonneneTage: formatUtils.formatNumber(entry.startedDays),
                ganzeTherapieTage: formatUtils.formatNumber(entry.completeDays),
                patienten: formatUtils.formatNumber(entry.uniqueCases),
                therapieDauerProPatient: formatUtils.formatNumber(entry.daysPerCase)
            }));
        }

        return formattedStats;
    }

    /**
     * Formatiert ICU-Statistiken
     * @private
     */
    _formatICUStats(stats) {
        return {
            monthly: stats.monthly.map(entry => ({
                month: formatUtils.getMonthName(entry.month),
                faelle: formatUtils.formatNumber(entry.cases),
                beatmung: {
                    begonneneTage: formatUtils.formatNumber(entry.startedVentDays),
                    ganzeTageBeatmung: formatUtils.formatNumber(entry.completeVentDays), 
                    beatmungsstundenTotal: formatUtils.formatNumber(entry.ventHours),
                    beatmungspatienten: formatUtils.formatNumber(entry.ventPatients),
                    anteilBeatmungspatienten: formatUtils.formatPercent(entry.ventPercentage / 100),
                    durchschnittlicheBeatmungsdauer: formatUtils.formatNumber(entry.avgVentDuration)
                },
                haemofiltration: {
                    tage: formatUtils.formatNumber(entry.crrtDays)
                },
                ecmo: {
                    tage: formatUtils.formatNumber(entry.ecmoDays)
                },
                tiss28: {
                    punkteGesamt: formatUtils.formatNumber(entry.tissPoints),
                    punkteProFall: formatUtils.formatNumber(entry.tissPerCase)
                }
            }))
        };
    }

    /**
     * Formatiert IMC-Statistiken
     * @private
     */
    _formatIMCStats(stats) {
        return {
            monthly: stats.monthly.map(entry => ({
                month: formatUtils.getMonthName(entry.month),
                faelle: formatUtils.formatNumber(entry.cases),
                tiss28: {
                    punkteGesamt: formatUtils.formatNumber(entry.tissPoints),
                    punkteProFall: formatUtils.formatNumber(entry.tissPerCase)
                }
            }))
        };
    }

    /**
     * Formatiert Jahresstatistiken
     * @private
     */ 
    _formatYearlyStats(yearlyData) {
        const formattedStats = {};

        for (const [therapyType, stats] of Object.entries(yearlyData)) {
            formattedStats[therapyType] = {
                therapieStunden: formatUtils.formatNumber(stats.totalHours),
                begonneneTage: formatUtils.formatNumber(stats.startedDays),
                ganzeTherapieTage: formatUtils.formatNumber(stats.completeDays),
                patienten: {
                    gesamt: formatUtils.formatNumber(stats.uniqueCases.length),
                    fortgefuehrt: formatUtils.formatNumber(stats.continuedCases.length)
                },
                durchschnitt: {
                    stundenProMonat: formatUtils.formatNumber(stats.averages.hoursPerMonth),
                    tageProMonat: formatUtils.formatNumber(stats.averages.daysPerMonth),
                    therapieDauerProFall: formatUtils.formatNumber(stats.averages.daysPerCase)
                }
            };
        }

        return formattedStats;
    }
}