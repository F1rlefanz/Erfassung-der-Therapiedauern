// js/charts/TherapyYearComparisonChart.js
import { hooks } from '../hooks.js';
import { db } from '../dbConfig.js';
import { yearlyDBManager } from '../yearlyDBManager.js';

const TherapyYearComparisonChart = () => {
    console.log('Chart-Komponente wird initialisiert');

    const [data, setData] = hooks.useState([]);
    const [loading, setLoading] = hooks.useState(true);
    const [error, setError] = hooks.useState(null);
    const [selectedYear, setSelectedYear] = hooks.useState(null);
    const [comparisonYear, setComparisonYear] = hooks.useState(null);
    const [availableYears, setAvailableYears] = hooks.useState([]);
    const [RechartsComponents, setRechartsComponents] = hooks.useState(null);

    // Debug-Hook für Recharts-Verfügbarkeit
    hooks.useEffect(() => {
        console.log('Chart versucht zu rendern');
        console.log('Recharts verfügbar:', !!window.Recharts);
        
        const waitForRecharts = () => {
            if (window.Recharts) {
                console.log('Recharts gefunden, setze Komponenten');
                setRechartsComponents(window.Recharts);
            } else {
                console.log('Warte auf Recharts...');
                setTimeout(waitForRecharts, 100);
            }
        };
        waitForRecharts();
    }, []);

    // Recharts laden
    hooks.useEffect(() => {
        const waitForRecharts = () => {
            if (window.Recharts) {
                setRechartsComponents(window.Recharts);
            } else {
                setTimeout(waitForRecharts, 100);
            }
        };
        waitForRecharts();
    }, []);

    // Initiale Jahre laden und setzen
    hooks.useEffect(() => {
        async function initYears() {
            try {
                const years = await yearlyDBManager.getAvailableYears();
                const currentYear = new Date().getFullYear();
                
                // Setze das aktuelle Jahr, falls verfügbar, sonst das neueste
                const availableCurrentYear = years.find(y => y === currentYear);
                const initSelectedYear = availableCurrentYear || years[0];
                
                // Setze das Vorjahr, falls verfügbar, sonst das zweitneueste
                const availablePreviousYear = years.find(y => y === currentYear - 1);
                const initComparisonYear = availablePreviousYear || years[1];
                
                setSelectedYear(initSelectedYear);
                setComparisonYear(initComparisonYear);
                setAvailableYears(years.sort((a, b) => a - b)); // Chronologisch sortieren
            } catch (err) {
                console.error('Fehler beim Laden der verfügbaren Jahre:', err);
                setError('Jahre konnten nicht geladen werden');
            }
        }
        initYears();
    }, []);

    // Jahr-Change Event Handler
    hooks.useEffect(() => {
        const handleYearChange = (event) => {
            const { year } = event.detail;
            setSelectedYear(year);
            // Setze Vergleichsjahr auf das vorherige Jahr des gewählten Jahres
            const prevYear = availableYears.findLast(y => y < year);
            if (prevYear) {
                setComparisonYear(prevYear);
            }
        };

        window.addEventListener('yearChanged', handleYearChange);
        return () => window.removeEventListener('yearChanged', handleYearChange);
    }, [availableYears]);

    // Daten laden wenn sich Jahre ändern
    hooks.useEffect(() => {
        if (!RechartsComponents || !selectedYear || !comparisonYear) return;
    
        async function fetchData() {
            try {
                setLoading(true);
                console.log('YearComparison: Lade Daten für Jahre:', selectedYear, comparisonYear);
                const therapyTypes = await db.getActiveTherapyTypes();
                console.log('YearComparison: Gefundene Therapietypen:', therapyTypes);
                const monthlyData = [];

                // Ensure chronological order
                const years = [comparisonYear, selectedYear].sort((a, b) => a - b);

                for (let month = 1; month <= 12; month++) {
                    const monthData = {
                        month: new Date(2000, month - 1).toLocaleString('de-DE', { month: 'short' }),
                    };

                    // Füge Daten für beide Jahre hinzu
                    for (const year of years) {
                        monthData[`Jahr ${year}`] = {};
                        for (const therapy of therapyTypes) {
                            const stats = await db.getMonthlyStatistics(year, month, therapy.id);
                            monthData[`Jahr ${year}`][therapy.displayName] = 
                                stats?.statistics?.totalHours || 0;
                        }
                    }

                    monthlyData.push(monthData);
                }

                console.log('YearComparison: Geladene Daten:', monthlyData);
            setData(monthlyData);
            setError(null);
        } catch (err) {
            console.error('YearComparison: Fehler beim Laden der Daten:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    fetchData();
}, [selectedYear, comparisonYear, RechartsComponents]);

    // Debug-Logging hinzufügen
    console.log('Yearly Comparison Data:', {
        dataAvailable: Array.isArray(data) && data.length > 0,
        dataLength: data.length,
        sampleData: data[0],
        dimensions: {
            container: document.querySelector('.chart-wrapper')?.getBoundingClientRect(),
            innerContainer: document.querySelector('.chart-wrapper > div')?.getBoundingClientRect()
        }
    });

    if (!RechartsComponents || loading) {
        return React.createElement('div', { 
            className: "text-center p-4 text-text bg-background rounded shadow" 
        }, 'Lade Daten...');
    }
    
    if (error) {
        return React.createElement('div', { 
            className: "text-center p-4 bg-background text-error border-error rounded shadow" 
        }, `Fehler: ${error}`);
    }

    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = RechartsComponents;
    
    // Custom Tooltip Component definieren
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;

        // Gruppiere die Daten nach Jahren
        const yearGroups = payload.reduce((acc, entry) => {
            const [year] = entry.name.split('.');
            if (!acc[year]) acc[year] = [];
            acc[year].push(entry);
            return acc;
        }, {});

        return React.createElement(
            'div',
            { 
                style: {
                    backgroundColor: 'var(--background-color)',
                    border: '1px solid var(--primary-color)',
                    padding: '10px',
                    borderRadius: '4px'
                }
            },
            [
                React.createElement('p', { 
                    key: 'title',
                    className: "font-bold text-text" 
                }, label),
                ...Object.entries(yearGroups).map(([year, entries], idx) => 
                    React.createElement('div', { key: year },
                        [
                            React.createElement('p', { 
                                key: `year-${idx}`,
                                className: "text-primary font-bold mt-2" 
                            }, year),
                            ...entries.map((entry, i) => 
                                React.createElement('p', { 
                                    key: `value-${i}`,
                                    className: "text-text" 
                                }, `${entry.name.split('.')[1]}: ${entry.value.toFixed(1)} Stunden`)
                            )
                        ]
                    )
                )
            ]
        );
    };
    return React.createElement(
        'div',
        { 
            className: "flex flex-col w-full bg-background rounded-lg shadow-lg p-4",
            style: {
                height: '60px',
                minHeight: '600px'
            }
        },
        [
            // Header mit Jahr-Auswahl
            React.createElement(
                'div',
                { 
                    className: "flex items-center justify-between w-full mb-4",
                    key: "header",
                    style: { flexShrink: 0 }
                },
                [
                    React.createElement(
                        'h3',
                        { 
                            className: "text-lg font-bold text-primary",
                            key: "title" 
                        },
                        `Jahresvergleich ${[comparisonYear, selectedYear].sort((a,b) => a-b).join(" vs. ")}`
                    ),
                    // Vergleichsjahr-Auswahl
                    React.createElement(
                        'select',
                        {
                            style: {
                                backgroundColor: 'var(--background-color)',
                                color: 'var(--text-color)',
                                border: '1px solid var(--primary-color)',
                                padding: '8px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            },
                            value: comparisonYear,
                            onChange: (e) => setComparisonYear(parseInt(e.target.value)),
                            key: "year-select"
                        },
                        availableYears
                            .filter(year => year !== selectedYear)
                            .map(year => 
                                React.createElement(
                                    'option',
                                    {
                                        value: year,
                                        key: year,
                                        style: {
                                            backgroundColor: 'var(--background-color)',
                                            color: 'var(--text-color)'
                                        }
                                    },
                                    `Vergleich mit ${year}`
                                )
                            )
                    )
                ]
            ),
            // Chart-Container
            React.createElement(
                'div',
                {
                    className: "flex-1 w-full",
                    key: "chart-container",
                    style: {
                        minHeight: '600px',
                    }
                },
                React.createElement(
                    ResponsiveContainer,
                    {
                        width: "100%",
                        height: "100%",
                        minHeight: 500
                    },
                    React.createElement(
                        BarChart,
                        {
                            data: data,
                            margin: { top: 20, right: 30, left: 20, bottom: 20 }
                        },
                        [
                            // Basis-Elemente
                            React.createElement(CartesianGrid, { 
                                strokeDasharray: "3 3",
                                stroke: "var(--border-color)",
                                key: "grid" 
                            }),
                            React.createElement(XAxis, { 
                                dataKey: "month",
                                stroke: "var(--text-color)",
                                key: "xAxis" 
                            }),
                            React.createElement(YAxis, { 
                                stroke: "var(--text-color)",
                                key: "yAxis"
                            }),
                            React.createElement(Tooltip, { 
                                content: CustomTooltip,
                                key: "tooltip"
                            }),
                            React.createElement(Legend, { 
                                key: "legend",
                                formatter: (value) => {
                                    const [year, therapy] = value.split('.');
                                    return `${therapy} (${year})`;
                                }
                            }),
                            // Bars für das erste Jahr (chronologisch)
                            ...Object.entries({
                                beatmung: ["#8884d8", "Beatmungsdauer"],
                                nieren: ["#2ecc71", "Nierenersatzverfahren"],
                                lunge: ["#f39c12", "Extrakorporale Lungenunterstützung"]
                            }).flatMap(([key, [color, name]], index) => [
                                // Bars für Vergleichsjahr
                                React.createElement(Bar, {
                                    key: `bar1-${key}`,
                                    dataKey: `Jahr ${comparisonYear}.${name}`,
                                    stackId: "a",
                                    fill: color
                                }),
                                // Bars für ausgewähltes Jahr
                                React.createElement(Bar, {
                                    key: `bar2-${key}`,
                                    dataKey: `Jahr ${selectedYear}.${name}`,
                                    stackId: "b",
                                    fill: color,
                                    opacity: 0.7
                                })
                            ])
                        ]
                    )
                )
            )
        ]
    );
};

export default TherapyYearComparisonChart;