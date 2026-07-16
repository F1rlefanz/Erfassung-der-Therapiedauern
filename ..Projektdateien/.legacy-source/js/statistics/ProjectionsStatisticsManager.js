// js/statistics/ProjectionsStatisticsManager.js

import { ProjectionManager } from '../projections/ProjectionManager.js';
import { ReactErrorBoundary, createSafeRoot } from '../reactV18Check.js';
import StatisticsTableWithProjections from '../projections/components/StatisticsTableWithProjections.js';

export class ProjectionsStatisticsManager {
    constructor() {
        this.projectionManager = new ProjectionManager();
    }

    async initializeTable(tableId, data, options = {}) {
        try {
            console.log(`Initializing table ${tableId} with options:`, options);
            
            const table = document.getElementById(tableId);
            if (!table) {
                console.warn(`Table ${tableId} not found, skipping projections`);
                return;
            }
    
            // Datenvalidierung
            if (!Array.isArray(data)) {
                console.error('Invalid data format:', data);
                throw new Error('Ungültiges Datenformat');
            }
    
            // React-Root erstellen und Komponente rendern
            const root = createSafeRoot(table, 'StatisticsTable');
            if (!root) {
                throw new Error('Konnte React Root nicht erstellen');
            }
    
            root.render(
                React.createElement(ReactErrorBoundary, null,
                    React.createElement(StatisticsTableWithProjections, {
                        therapyType: options.therapyType,
                        year: options.year,
                        data: data
                    })
                )
            );
    
            console.log(`Table ${tableId} initialized successfully`);
        } catch (error) {
            console.error('Error initializing table:', error);
            throw error;
        }
    }
}