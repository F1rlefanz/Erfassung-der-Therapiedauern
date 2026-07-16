// js/projections/components/StatisticsTableWithProjections.js

import { hooks } from '../../hooks.js';
import ProjectionToggle from './ProjectionToggle.js';

function StatisticsTableWithProjections({therapyType, year, data}) {
    const [showProjections, setShowProjections] = hooks.useState(false);

    // Erstmal die Datenstruktur validieren und ggf. ergänzen  
    const formattedData = hooks.useMemo(() => {
        if (!Array.isArray(data)) return [];
    
        // 12 Monate erstellen, falls nicht alle vorhanden
        const months = Array.from({length: 12}, (_, i) => i + 1);
        
        return months.map(monthNum => {
            // Finde existierende Daten für diesen Monat
            const monthData = data.find(d => d.month === monthNum) || {};
            
            // Basis-Struktur mit Defaults
            return {
                month: monthNum,
                hours: monthData.totalHours || 0,
                startedDays: monthData.startedDays || 0,
                completeDays: monthData.completeDays || 0,
                uniqueCases: Array.isArray(monthData.uniqueCases) 
                    ? monthData.uniqueCases.length 
                    : (monthData.uniqueCases || 0),
                daysPerCase: monthData.uniqueCases?.length > 0
                    ? (monthData.startedDays / monthData.uniqueCases.length).toFixed(1)
                    : '0.0',
                historicalData: monthData.historicalData
            };
        });
    }, [data]);

    const columnHeaders = hooks.useMemo(() => {
        const baseHeaders = [
            { 
                key: 'month', 
                label: 'Monat',
                tooltip: 'Monat des Jahres'
            },
            { 
                key: 'hours', 
                label: `${therapyType}stunden`,
                tooltip: `Gesamtanzahl der ${therapyType}stunden in diesem Monat`
            },
            showProjections && { 
                key: 'hours-projection', 
                label: 'Hochrechnung',
                tooltip: 'Hochgerechneter Jahreswert basierend auf den bisherigen Monaten'
            },
            { 
                key: 'startedDays', 
                label: `Begonnene ${therapyType}tage`,
                tooltip: `Tage an denen eine ${therapyType} begonnen wurde`
            },
            showProjections && { 
                key: 'startedDays-projection', 
                label: 'Hochrechnung',
                tooltip: 'Hochgerechneter Jahreswert basierend auf den bisherigen Monaten'
            },
            { 
                key: 'completeDays', 
                label: `Ganze ${therapyType}tage`,
                tooltip: `Tage mit durchgehender ${therapyType} über 24 Stunden`
            },
            showProjections && { 
                key: 'completeDays-projection', 
                label: 'Hochrechnung',
                tooltip: 'Hochgerechneter Jahreswert basierend auf den bisherigen Monaten'
            },
            { 
                key: 'uniqueCases', 
                label: `${therapyType}patienten`,
                tooltip: `Anzahl der verschiedenen Patienten mit ${therapyType}`
            },
            showProjections && { 
                key: 'uniqueCases-projection', 
                label: 'Hochrechnung',
                tooltip: 'Hochgerechneter Jahreswert basierend auf den bisherigen Monaten'
            },
            { 
                key: 'daysPerCase', 
                label: `${therapyType}dauer in Tagen`,
                tooltip: `Durchschnittliche ${therapyType}dauer pro Patient in Tagen`
            },
            showProjections && { 
                key: 'daysPerCase-projection', 
                label: 'Hochrechnung',
                tooltip: 'Hochgerechneter Jahreswert basierend auf den bisherigen Monaten'
            }
        ].filter(Boolean);
    
        return baseHeaders;
    }, [therapyType, showProjections]);

    // Funktion für die Hochrechnung
    const calculateProjection = (currentValue, currentMonth) => {
        if (currentMonth === 0) return 0;
        const monthlyAverage = currentValue / currentMonth;
        return monthlyAverage * 12;
    };

    // Monatsname formatieren
    const formatMonth = (monthNum) => {
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        return months[monthNum - 1] || '';
    };

    // Berechne die Gesamtwerte für Zusammenfassungszeilen
    const totals = formattedData.reduce((acc, row) => {
        acc.hours += row.hours;
        acc.startedDays += row.startedDays;
        acc.completeDays += row.completeDays;
        acc.uniqueCases += row.uniqueCases;
        acc.daysPerCase = acc.uniqueCases > 0 
            ? (acc.startedDays / acc.uniqueCases)
            : 0;
        return acc;
    }, {
        hours: 0,
        startedDays: 0,
        completeDays: 0,
        uniqueCases: 0,
        daysPerCase: 0
    });

    // Berechne die Durchschnitte
    const averages = {
        hours: totals.hours / 12,
        startedDays: totals.startedDays / 12,
        completeDays: totals.completeDays / 12,
        uniqueCases: totals.uniqueCases / 12,
        daysPerCase: totals.uniqueCases > 0 
            ? totals.startedDays / totals.uniqueCases 
            : 0
    };

    return React.createElement(
        'div',
        { className: 'statistics-table-container p-4' },
        [
            // Toggle für Projektionen 
            React.createElement(ProjectionToggle, { 
                key: 'toggle',
                onChange: setShowProjections,
                value: showProjections
            }),

            // Tabelle
            React.createElement('div',
                { className: 'statistics-table mt-4', key: 'table' },
                React.createElement('table', 
                    { className: 'w-full border-collapse' },
                    [
                        // Header
                        React.createElement('thead', 
                            { key: 'thead' },
                            React.createElement('tr', 
                                null,
                                columnHeaders.map(header => 
                                    React.createElement('th', 
                                        { 
                                            key: header.key,
                                            className: 'p-2 border text-left font-bold text-white',
                                            'data-tooltip': header.tooltip
                                        },
                                        header.label
                                    )
                                )
                            )
                        ),

                        // Body
                        React.createElement('tbody',
                            { key: 'tbody' },
                            [
                                // Monatszeilen
                                ...formattedData.map((row, idx) => 
                                    React.createElement('tr',
                                        { 
                                            key: `month-${idx}`,
                                            className: idx % 2 === 0 ? 'bg-[#2d3748]' : 'bg-[#34495e]'
                                        },
                                        [
                                            React.createElement('td', { 
                                                key: 'month',
                                                className: 'p-2 border text-white'
                                            }, formatMonth(row.month)),
                                            
                                            // Stunden + Hochrechnung
                                            React.createElement('td', { 
                                                key: 'hours',
                                                className: 'p-2 border text-right text-white'
                                            }, row.hours.toFixed(1)),
                                            showProjections && React.createElement('td', {
                                                key: 'hours-projection',
                                                className: 'p-2 border text-right text-[#9b59b6] italic'
                                            }, `≈ ${calculateProjection(row.hours, row.month).toFixed(1)}`),
                                            
                                            // Begonnene Tage + Hochrechnung
                                            React.createElement('td', {
                                                key: 'startedDays',
                                                className: 'p-2 border text-right text-white'
                                            }, row.startedDays),
                                            showProjections && React.createElement('td', {
                                                key: 'startedDays-projection',
                                                className: 'p-2 border text-right text-[#9b59b6] italic'
                                            }, `≈ ${calculateProjection(row.startedDays, row.month).toFixed(1)}`),
                                            
                                            // Ganze Tage + Hochrechnung
                                            React.createElement('td', {
                                                key: 'completeDays',
                                                className: 'p-2 border text-right'
                                            }, row.completeDays),
                                            showProjections && React.createElement('td', {
                                                key: 'completeDays-projection',
                                                className: 'p-2 border text-right text-[#9b59b6] italic'
                                            }, `≈ ${calculateProjection(row.completeDays, row.month).toFixed(1)}`),
                                            
                                            // Patienten + Hochrechnung
                                            React.createElement('td', {
                                                key: 'uniqueCases',
                                                className: 'p-2 border text-right text-white'
                                            }, row.uniqueCases),
                                            showProjections && React.createElement('td', {
                                                key: 'uniqueCases-projection',
                                                className: 'p-2 border text-right text-[#9b59b6] italic'
                                            }, `≈ ${calculateProjection(row.uniqueCases, row.month).toFixed(1)}`),
                                            
                                            // Tage pro Patient + Hochrechnung
                                            React.createElement('td', {
                                                key: 'daysPerCase',
                                                className: 'p-2 border text-right text-white'
                                            }, row.daysPerCase),
                                            showProjections && React.createElement('td', {
                                                key: 'daysPerCase-projection',
                                                className: 'p-2 border text-right text-[#9b59b6] italic'
                                            }, `≈ ${calculateProjection(parseFloat(row.daysPerCase), row.month).toFixed(1)}`)
                                        ].filter(Boolean)
                                    )
                                ),

                                // Gesamtzeile
                                React.createElement('tr',
                                    { 
                                        key: 'summary',
                                        className: 'bg-[#7b3b96] font-bold text-white'
                                    },
                                    [
                                        React.createElement('td', { key: 'label', className: 'p-2 border text-white' }, 'Gesamt'),
                                        
                                        // Gesamt + Hochrechnungen für jede Spalte
                                        ...Object.entries(totals).flatMap(([key, value]) => [
                                            React.createElement('td', {
                                                key: key,
                                                className: 'p-2 border text-right text-white'
                                            }, value.toFixed(1)),
                                            showProjections && React.createElement('td', {
                                                key: `${key}-projection`,
                                                className: 'p-2 border text-right text-white italic'
                                            }, `≈ ${calculateProjection(value, new Date().getMonth() + 1).toFixed(1)}`)
                                        ].filter(Boolean))
                                    ]
                                ),

                                // Durchschnittszeile
                                React.createElement('tr',
                                    { 
                                        key: 'average',
                                        className: 'bg-[#8e44ad] font-bold italic text-white'
                                    },
                                    [
                                        React.createElement('td', { key: 'label', className: 'p-2 border text-white' }, 'Durchschnitt pro Monat'),
                                        
                                        // Durchschnitte + Hochrechnungen für jede Spalte
                                        ...Object.entries(averages).flatMap(([key, value]) => [
                                            React.createElement('td', {
                                                key: key,
                                                className: 'p-2 border text-right text-white'
                                            }, value.toFixed(1)),
                                            showProjections && React.createElement('td', {
                                                key: `${key}-projection`,
                                                className: 'p-2 border text-right text-white italic'
                                            }, `≈ ${calculateProjection(value, new Date().getMonth() + 1).toFixed(1)}`)
                                        ].filter(Boolean))
                                    ]
                                )
                            ]
                        )
                    ]
                )
            )
        ]
    );
}

export default StatisticsTableWithProjections;