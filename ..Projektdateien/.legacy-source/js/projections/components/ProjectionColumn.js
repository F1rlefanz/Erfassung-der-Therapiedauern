// js/projections/components/ProjectionColumn.js

import { hooks } from '../../hooks.js';

const ProjectionColumn = ({ currentValue, currentMonth, historicalData }) => {
    const [projectedValue, setProjectedValue] = hooks.useState(null);

    hooks.useEffect(() => {
        const calculateProjection = () => {
            try {
                // Nur berechnen wenn Werte vorhanden sind
                if (currentValue <= 0) {
                    return;
                }

                console.log('Berechne Hochrechnung für:', {
                    monat: currentMonth,
                    aktuellerWert: currentValue
                });

                // Lineare Hochrechnung
                const monthlyAverage = currentValue / currentMonth;
                const remainingMonths = 12 - currentMonth;
                const projection = currentValue + (monthlyAverage * remainingMonths);

                setProjectedValue(projection);
                console.log('Hochrechnung berechnet:', {
                    durchschnittProMonat: monthlyAverage,
                    verbleibeneMonate: remainingMonths,
                    hochgerechneterWert: projection
                });

            } catch (error) {
                console.error('Fehler bei Hochrechnung:', error);
            }
        };
        
        calculateProjection();
    }, [currentValue, currentMonth]);

    // Wenn keine Werte vorhanden
    if (currentValue <= 0) {
        return React.createElement('td', { 
            className: 'p-2 border text-right text-gray-400'
        }, '-');
    }

    // Zeige Hochrechnung
    return React.createElement('td', {
        className: 'p-2 border text-right text-[#9b59b6] italic font-mono'
    }, projectedValue ? `≈ ${projectedValue.toFixed(1)}` : '-');
};

export default ProjectionColumn;