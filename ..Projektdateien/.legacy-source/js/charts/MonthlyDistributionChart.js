// js/charts/MonthlyDistributionChart.js
import { hooks } from '../hooks.js';
import { db } from '../dbConfig.js';
import { normalizeDate, formatDateForInput } from '../utils/dateUtils.js';

const MonthlyDistributionChart = () => {
    console.log('Chart-Komponente wird initialisiert');

    const [data, setData] = hooks.useState([]);
    const [loading, setLoading] = hooks.useState(true);
    const [error, setError] = hooks.useState(null);
    const [selectedYear, setSelectedYear] = hooks.useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = hooks.useState(new Date().getMonth() + 1);
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

    // Jahr-Change Event Handler
    hooks.useEffect(() => {
        const handleYearChange = (event) => {
            const { year } = event.detail;
            console.log('MonthlyDistributionChart: Jahr geändert zu', year);
            setSelectedYear(year);
        };

        window.addEventListener('yearChanged', handleYearChange);
        return () => window.removeEventListener('yearChanged', handleYearChange);
    }, []);

    // Daten laden
    hooks.useEffect(() => {
        if (!RechartsComponents) return;
    
        async function fetchData() {
            try {
                setLoading(true);
                console.log('MonthlyDistribution: Lade Daten für Jahr/Monat:', selectedYear, selectedMonth);
                const therapyTypes = await db.getActiveTherapyTypes();
                console.log('MonthlyDistribution: Gefundene Therapietypen:', therapyTypes);
                const distribution = Array(31).fill(0).map((_, idx) => ({
                    day: idx + 1,
                    Beatmungsdauer: 0,
                    Nierenersatzverfahren: 0,
                    'Extrakorporale Lungenunterstützung': 0
                }));

                for (const therapy of therapyTypes) {
                    let date = normalizeDate(new Date(selectedYear, selectedMonth - 1, 1));
                    const endDate = normalizeDate(new Date(selectedYear, selectedMonth, 0));
                    
                    while (date <= endDate) {
                        const dateStr = formatDateForInput(date);
                        const entry = await db.getDailyEntry(dateStr, therapy.id);
                        
                        if (entry?.patients) {
                            const totalHours = entry.patients.reduce((sum, patient) => 
                                sum + patient.hours.filter(h => h).length, 0);
                            
                            const dayIndex = normalizeDate(date).getDate() - 1;
                            distribution[dayIndex][therapy.displayName] = totalHours;
                        }
                        
                        const nextDate = new Date(date);
                        nextDate.setDate(date.getDate() + 1);
                        date = normalizeDate(nextDate);
                    }
                }

                console.log('MonthlyDistribution: Berechnete Verteilung:', distribution);
                setData(distribution);
                setError(null);
            } catch (err) {
                console.error('MonthlyDistribution: Fehler beim Laden der Daten:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
    
        fetchData();
    }, [selectedYear, selectedMonth, RechartsComponents]);

    // Debug-Logging hinzufügen
    console.log('Monthly Distribution Data:', {
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

    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

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
            // Header-Bereich
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
                        `Tägliche Verteilung - ${months[selectedMonth - 1]} ${selectedYear}`
                    ),
                    // Dropdown
                    React.createElement(
                        'select',
                        {
                            style: {
                                backgroundColor: 'var(--background-color)',
                                color: 'var(--text-color)',
                                padding: '0.5rem',
                                borderRadius: '0.25rem',
                                border: '1px solid var(--primary-color)'
                            },
                            value: selectedMonth,
                            onChange: (e) => setSelectedMonth(parseInt(e.target.value)),
                            key: "monthSelect"
                        },
                        months.map((month, idx) => 
                            React.createElement(
                                'option',
                                {
                                    value: idx + 1,
                                    key: idx,
                                    style: {
                                        backgroundColor: 'var(--background-color)',
                                        color: 'var(--text-color)'
                                    }
                                },
                                month
                            )
                        )
                    )
                ]
            ),
            // Chart Container
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
                            React.createElement(CartesianGrid, { 
                                className: "stroke-border",
                                strokeDasharray: "3 3",
                                key: "grid" 
                            }),
                            // Verbesserte Achsen
                            React.createElement(XAxis, { 
                                dataKey: "day",
                                stroke: "var(--text-color)",
                                tick: {
                                    fill: "var(--text-color)"
                                },
                                key: "xAxis" 
                            }),
                            React.createElement(YAxis, { 
                                stroke: "var(--text-color)",
                                tick: {
                                    fill: "var(--text-color)"
                                },
                                key: "yAxis"
                            }),
                            React.createElement(Tooltip, { 
                                key: "tooltip",
                                contentStyle: {
                                    backgroundColor: 'var(--background-color)',
                                    borderColor: 'var(--primary-color)',
                                    color: 'var(--text-color)'
                                }
                            }),
                            React.createElement(Legend, { 
                                key: "legend",
                                className: "text-text"
                            }),
                            // Verbesserte Balken-Farben
                            React.createElement(Bar, {
                                key: "bar1",
                                dataKey: "Beatmungsdauer",
                                fill: "#8884d8", // Kräftiges Violett
                                stackId: "a"
                            }),
                            React.createElement(Bar, {
                                key: "bar2",
                                dataKey: "Nierenersatzverfahren",
                                fill: "#2ecc71", // Kräftiges Grün
                                stackId: "a"
                            }),
                            React.createElement(Bar, {
                                key: "bar3",
                                dataKey: "Extrakorporale Lungenunterstützung",
                                fill: "#f39c12", // Kräftiges Orange
                                stackId: "a"
                            })
                        ]
                    )
                )
            )
        ]
    );
};

export default MonthlyDistributionChart;