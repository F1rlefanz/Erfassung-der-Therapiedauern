// js/statistics/StatisticsManager.js

import { ProjectionManager } from '../projections/ProjectionManager.js';

export class StatisticsManager {
    constructor() {
        this.projectionManager = new ProjectionManager();
    }

    async initializeTable(tableId, data, options = {}) {
        try {
            const table = document.getElementById(tableId);
            if (!table) {
                throw new Error(`Tabelle ${tableId} nicht gefunden`);
            }

            // Statistik-Tabelle mit Projektionen neu rendern
            const root = createSafeRoot(table, 'StatisticsTable');
            root.render(
                React.createElement(ReactErrorBoundary, null,
                    React.createElement(StatisticsTableWithProjections, {
                        therapyType: options.therapyType,
                        year: options.year,
                        data: data
                    })
                )
            );

        } catch (error) {
            console.error('Fehler beim Initialisieren der Statistik-Tabelle:', error);
            throw error;
        }
    }
}