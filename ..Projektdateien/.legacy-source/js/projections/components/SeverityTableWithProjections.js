// js/projections/components/SeverityTableWithProjections.js

import { hooks } from '../../hooks.js';
import ProjectionToggle from './ProjectionToggle.js';

function SeverityTableWithProjections({tableType, year, data: initialData}) {
    const [data, setData] = hooks.useState(initialData);
    const [showProjections, setShowProjections] = hooks.useState(false);

    // Konfiguration der Spalten basierend auf dem Tabellentyp
    const columnConfig = hooks.useMemo(() => {
        if (tableType === 'ICU') {
            return [
                { key: 'month', label: 'Monat' },
                { key: 'cases', label: 'Fälle', editable: true },
                { key: 'startedVentDays', label: 'Begonnene Beatmungstage' },
                { key: 'completeVentDays', label: 'Ganze Beatmungstage' },
                { key: 'ventHours', label: 'Beatmungsstunden total' },
                { key: 'ventPatients', label: 'Beatmungspatienten' },
                { key: 'ventPercentage', label: 'Anteil Beatmungspatienten in %' },
                { key: 'avgVentDuration', label: 'Durchschnittliche Beatmungsdauer in Tagen' },
                { key: 'crrtDays', label: 'Hämofiltrationstage' },
                { key: 'ecmoDays', label: 'ECMO-Tage' },
                { key: 'tissPoints', label: 'TISS-28-Punkte', editable: true },
                { key: 'tissPerCase', label: 'TISS-28-Punkte pro Fall' }
            ];
        } else if (tableType === 'IMC') {
            return [
                { key: 'month', label: 'Monat' },
                { key: 'cases', label: 'Fälle', editable: true },
                { key: 'tissPoints', label: 'TISS-28-Punkte', editable: true },
                { key: 'tissPerCase', label: 'TISS-28-Punkte pro Fall' }
            ];
        }
        return [];
    }, [tableType]);

    // Containerbreite und Scrolling
    const containerStyle = hooks.useMemo(() => ({
        overflowX: 'auto',
        maxWidth: '100%'
    }), []);

    const tableStyle = hooks.useMemo(() => ({
        tableLayout: 'auto',
        width: 'auto',
        minWidth: '100%'
    }), []);

    // Spaltenheader mit optionalen Hochrechnungsspalten
    const columnHeaders = hooks.useMemo(() => {
        console.log("Creating headers with showProjections:", showProjections); // Debug
        const headers = columnConfig.flatMap(col => {
            // Debug-Logging
            console.log("Processing column:", col.key, "showProjections:", showProjections);
            
            const columns = [
                { key: col.key, label: col.label }
            ];
            
            if (showProjections && col.key !== 'month' && !col.noProjection) {
                columns.push({ 
                    key: `${col.key}-projection`, 
                    label: 'Hochrechnung' 
                });
            }
            
            return columns;
        });
        
        console.log("Final headers:", headers); // Debug
        return headers;
    }, [columnConfig, showProjections]);

    // Monatsname formatieren
    const formatMonth = (monthNum) => {
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        return months[monthNum - 1] || '';
    };

    // Funktion für die Hochrechnung
    const calculateProjection = (currentValue, currentMonth) => {
        if (currentMonth === 0) return 0;
        const monthlyAverage = currentValue / currentMonth;
        return monthlyAverage * 12;
    };
    // Datenstruktur vorbereiten und validieren
    const formattedData = hooks.useMemo(() => {
        if (!Array.isArray(data)) return [];
    
        // 12 Monate erstellen
        const months = Array.from({length: 12}, (_, i) => i + 1);
        
        return months.map(monthNum => {
            // Existierende Daten für diesen Monat finden
            const monthData = data.find(d => d.month === monthNum) || {};
            
            // Basis-Struktur erstellen basierend auf Tabellentyp
            if (tableType === 'ICU') {
                return {
                    month: monthNum,
                    cases: monthData.cases || 0,
                    startedVentDays: monthData.startedVentDays || 0,
                    completeVentDays: monthData.completeVentDays || 0,
                    ventHours: monthData.ventHours || 0,
                    ventPatients: monthData.ventPatients || 0,
                    ventPercentage: monthData.cases ? 
                        ((monthData.ventPatients / monthData.cases) * 100).toFixed(1) + '%' : 
                        '0.0%',
                    avgVentDuration: monthData.ventPatients ? 
                        (monthData.startedVentDays / monthData.ventPatients).toFixed(1) : 
                        '0.0',
                    crrtDays: monthData.crrtDays || 0,
                    ecmoDays: monthData.ecmoDays || 0,
                    tissPoints: monthData.tissPoints || 0,
                    tissPerCase: monthData.cases ? 
                        (monthData.tissPoints / monthData.cases).toFixed(1) : 
                        '0.0'
                };
            } else {
                return {
                    month: monthNum,
                    cases: monthData.cases || 0,
                    tissPoints: monthData.tissPoints || 0,
                    tissPerCase: monthData.cases ? 
                        (monthData.tissPoints / monthData.cases).toFixed(1) : 
                        '0.0'
                };
            }
        });
    }, [data, tableType]);

    // Gesamtwerte berechnen
    const totals = hooks.useMemo(() => {
        // Erst normale Summierung für alle anderen Werte
        const sums = formattedData.reduce((acc, row) => {
            Object.keys(row).forEach(key => {
                // Überspringe Monat und berechnete Verhältniswerte
                if (key === 'month' || 
                    key === 'ventPercentage' || 
                    key === 'tissPerCase') return;
                
                acc[key] = (acc[key] || 0) + parseFloat(row[key] || 0);
            });
            return acc;
        }, {});
    
        // Dann Berechnung der Verhältniswerte aus den Summen
        // Anteil Beatmungspatienten in %
        if (sums.cases > 0) {
            sums.ventPercentage = ((sums.ventPatients / sums.cases) * 100).toFixed(1) + '%';
        } else {
            sums.ventPercentage = '0.0%';
        }
    
        // TISS-28-Punkte pro Fall
        if (sums.cases > 0) {
            sums.tissPerCase = (sums.tissPoints / sums.cases).toFixed(1);
        } else {
            sums.tissPerCase = '0.0';
        }
    
        return sums;
    }, [formattedData]);

    // Durchschnitte berechnen
    const averages = hooks.useMemo(() => {
        const avg = {};
        Object.keys(totals).forEach(key => {
            avg[key] = totals[key] / 12;
        });
        return avg;
    }, [totals]);

    const saveEditableValue = async (monthNum, key, newValue) => {
        try {
            const numValue = parseInt(newValue, 10);
            if (isNaN(numValue)) {
                console.error('Invalid number input');
                return;
            }

            // Daten in DB speichern
            if (key === 'cases') {
                await db.saveFallbuchCasesMonthly(year, monthNum, tableType, numValue);
            } else if (key === 'tissPoints') {
                await db.saveTISS28PointsMonthly(year, monthNum, tableType, numValue);
            }

            // Daten für den spezifischen Monat aktualisieren
            const updatedData = [...data];
            const monthData = updatedData[monthNum - 1];

            // Wert aktualisieren
            monthData[key] = numValue;

            // Abgeleitete Werte neu berechnen
            if (key === 'cases' || key === 'tissPoints') {
                monthData.tissPerCase = monthData.cases && monthData.tissPoints 
                    ? (monthData.tissPoints / monthData.cases).toFixed(1) 
                    : '0.0';
            }

            if (tableType === 'ICU' && key === 'cases') {
                monthData.ventPercentage = monthData.cases 
                    ? ((monthData.ventPatients / monthData.cases) * 100).toFixed(1) + '%'
                    : '0.0%';
            }

            // State aktualisieren
            setData(updatedData);

        } catch (error) {
            console.error('Error saving editable value:', error);
        }
    };

    // Render-Funktion für eine einzelne Zelle
    const renderCell = (value, isProjection = false, key, monthNum) => {
        const columnDef = columnConfig.find(col => col.key === key);
        const isEditable = columnDef?.editable;
    
        if (isEditable) {
            return React.createElement('td', {
                key,
                className: `p-2 border text-right text-white ${key}-input`,
                contentEditable: true,
                suppressContentEditableWarning: true,
                onBlur: async (e) => {
                    await saveEditableValue(monthNum, key, e.target.textContent);
                },
                dangerouslySetInnerHTML: { __html: value }
            });
        }
        let displayValue = value;
        if (typeof value === 'number') {
            displayValue = value.toFixed(1);
        }
        
        const className = `p-2 border text-right ${
            isProjection ? 'text-[#9b59b6] italic' : 'text-white'
        }`;
    
        return React.createElement('td', {
            key,  // Key hier hinzufügen
            className
        }, isProjection ? `≈ ${displayValue}` : displayValue);
    };
    

    return React.createElement(
        'div',
        { 
            className: 'statistics-table-container p-4',
            style: containerStyle
        },
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
                    { className: 'w-full border-collapse',
                        style: tableStyle },
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
                                            className: 'p-2 border text-left font-bold text-white truncate',
                                            title: header.label,  // Tooltip hinzufügen
                                            style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
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
                                        columnHeaders.map(header => {
                                            if (header.key === 'month') {
                                                return React.createElement('td', {
                                                    key: `${header.key}-${row.month}`,  // Eindeutiger Key
                                                    className: 'p-2 border text-white'
                                                }, formatMonth(row.month));
                                            }

                                            const isProjection = header.key.includes('-projection');
                                            const baseKey = isProjection ? 
                                                header.key.replace('-projection', '') : 
                                                header.key;
                                            
                                                if (isProjection) {
                                                    return renderCell(
                                                        calculateProjection(row[baseKey], row.month),
                                                        true,
                                                        header.key,
                                                        row.month
                                                );
                                            }
                                            
                                            return renderCell(
                                                row[baseKey], 
                                                false,
                                                header.key,
                                                row.month 
                                            );
                                        })
                                        
                                    )
                                ),

                                // Gesamtzeile
                                React.createElement('tr',
                                    { 
                                        key: 'summary',
                                        className: 'bg-[#7b3b96] font-bold text-white'
                                    },
                                    columnHeaders.map(header => {
                                        if (header.key === 'month') {
                                            return React.createElement('td', {
                                                key: `${header.key}-total`,  // Eindeutiger Key
                                                className: 'p-2 border text-white'
                                            }, 'Gesamt');
                                        }

                                        const isProjection = header.key.includes('-projection');
                                        const baseKey = isProjection ? 
                                            header.key.replace('-projection', '') : 
                                            header.key;
                                    
                                            if (isProjection) {
                                                return renderCell(
                                                    calculateProjection(totals[baseKey], new Date().getMonth() + 1),
                                                    true,
                                                    `${header.key}-total`,
                                                    13 
                                            );
                                        }
                                    
                                        return renderCell(
                                            totals[baseKey],
                                            false,
                                            `${header.key}-total`,
                                            13
                                        );
                                    })
                                ),
                                React.createElement('tr',
                                    { 
                                        key: 'average',
                                        className: 'bg-[#8e44ad] font-bold italic'
                                    },
                                    columnHeaders.map(header => {
                                        if (header.key === 'month') {
                                            return React.createElement('td', {
                                                key: `${header.key}-average`,
                                                className: 'p-2 border text-white'
                                            }, 'Durchschnitt pro Monat');
                                        }
                                
                                        const isProjection = header.key.includes('-projection');
                                        const baseKey = isProjection ? 
                                            header.key.replace('-projection', '') : 
                                            header.key;
                                
                                        // Spezielle Behandlung für Prozent- und pro-Fall-Werte
                                        if (baseKey === 'ventPercentage') {
                                            const avgPatients = averages['ventPatients'] || 0;
                                            const avgCases = averages['cases'] || 0;
                                            const value = avgCases > 0 ? ((avgPatients / avgCases) * 100).toFixed(1) + '%' : '0.0%';
                                            return renderCell(value, isProjection, `${header.key}-average`, 13);
                                        }
                                        
                                        if (baseKey === 'tissPerCase') {
                                            const avgTiss = averages['tissPoints'] || 0;
                                            const avgCases = averages['cases'] || 0;
                                            const value = avgCases > 0 ? (avgTiss / avgCases).toFixed(1) : '0.0';
                                            return renderCell(value, isProjection, `${header.key}-average`, 13);
                                        }
                                
                                        return renderCell(
                                            averages[baseKey],
                                            isProjection,
                                            `${header.key}-average`,
                                            13
                                        );
                                    })
                                )
                            ]
                        )
                    ]
                )
            )
        ]
    );
}

export default SeverityTableWithProjections;