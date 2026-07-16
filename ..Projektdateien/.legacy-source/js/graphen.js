// js/graphen.js
import { renderComponent, cleanupRoot } from './renderUtils.js';
import YearSelector from './components/year-selector-component.js';
import TherapyYearChart from './charts/TherapyYearChart.js';
import MonthlyDistributionChart from './charts/MonthlyDistributionChart.js';
import TherapyYearComparisonChart from './charts/TherapyYearComparisonChart.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Container-Definitionen 
        const containers = {
            yearSelector: document.getElementById('year-selector-root'),
            yearlyChart: document.getElementById('yearly-chart'),
            monthlyChart: document.getElementById('monthly-chart'),
            comparisonChart: document.getElementById('comparison-chart')
        };

        // Cleanup beim Verlassen der Seite
        window.addEventListener('beforeunload', () => {
            Object.values(containers).forEach(container => {
                if (container) cleanupRoot(container);
            });
        });

        // Komponenten-Map
        const components = {
            yearSelector: YearSelector,
            yearlyChart: TherapyYearChart,
            monthlyChart: MonthlyDistributionChart,
            comparisonChart: TherapyYearComparisonChart
        };

        // Komponenten rendern
        Object.entries(containers).forEach(([key, container]) => {
            if (container) {
                const Component = components[key];
                if (Component) {
                    renderComponent(container, Component);
                }
            }
        });

        // Event Listener für Jahreswechsel
        window.addEventListener('yearChanged', async (event) => {
            const { year, db } = event.detail;
            console.log(`Jahr wurde zu ${year} gewechselt, Graphen werden neu geladen...`);
            
            try {
                // Icons aktualisieren
                lucide.createIcons();
                console.log('Graphen für Jahr', year, 'erfolgreich aktualisiert');
            } catch (error) {
                console.error('Fehler beim Neuladen der Graphen:', error);
                alert('Fehler beim Neuladen der Graphen');
            }
        });

    } catch (error) {
        console.error('Fehler beim Laden der Graphen:', error);
        alert('Fehler beim Laden der Seite');
    }
});