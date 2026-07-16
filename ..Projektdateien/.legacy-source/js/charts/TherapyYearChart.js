// js/charts/TherapyYearChart.js
import { hooks } from '../hooks.js';
import { db } from '../dbConfig.js';

const TherapyYearChart = () => {
    const [data, setData] = hooks.useState([]);
    const [loading, setLoading] = hooks.useState(true);
    const [error, setError] = hooks.useState(null);
    const [selectedYear, setSelectedYear] = hooks.useState(new Date().getFullYear());
    const [RechartsComponents, setRechartsComponents] = hooks.useState(null);
    const [rechartsLoaded, setRechartsLoaded] = hooks.useState(false);

    // Recharts laden
    hooks.useEffect(() => {
        let mounted = true;
        const waitForRecharts = () => {
            if (window.Recharts) {
                setRechartsComponents(window.Recharts);
                setRechartsLoaded(true);
                console.log('Recharts erfolgreich geladen');
            } else {
                if (mounted) {
                    setTimeout(waitForRecharts, 100);
                }
            }
        };
        waitForRecharts();
        return () => {
            mounted = false;
        };
    }, []);

    // Jahr-Change Event Handler
    hooks.useEffect(() => {
        const handleYearChange = (event) => {
            const { year } = event.detail;
            console.log('TherapyYearChart: Jahr geändert zu', year);
            setSelectedYear(year);
        };

        window.addEventListener('yearChanged', handleYearChange);
        return () => window.removeEventListener('yearChanged', handleYearChange);
    }, []);

    // Daten laden
    hooks.useEffect(() => {
        if (!rechartsLoaded) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const therapyTypes = await db.getActiveTherapyTypes();
                const monthlyData = [];

                // Erstelle Basis-Datenpunkte für alle Monate
                for (let month = 1; month <= 12; month++) {
                    const monthData = {
                        month: new Date(2000, month - 1).toLocaleString('de-DE', { month: 'short' })
                    };
                    
                    therapyTypes.forEach(therapy => {
                        monthData[therapy.displayName] = 0;
                    });
                    
                    monthlyData.push(monthData);
                }

                // Fülle die tatsächlichen Daten ein
                for (let month = 1; month <= 12; month++) {
                    for (const therapy of therapyTypes) {
                        const stats = await db.getMonthlyStatistics(selectedYear, month, therapy.id);
                        if (stats?.statistics?.totalHours) {
                            monthlyData[month - 1][therapy.displayName] = stats.statistics.totalHours;
                        }
                    }
                }

                setData(monthlyData);
                setError(null);
            } catch (err) {
                console.error('Fehler beim Laden der Daten:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedYear, rechartsLoaded]);

    // Debug Output
    console.log('Chart Data:', {
        dataAvailable: Array.isArray(data) && data.length > 0,
        dataLength: data.length,
        sampleData: data[0],
        dimensions: {
            container: document.querySelector('.chart-wrapper')?.getBoundingClientRect(),
            innerContainer: document.querySelector('.chart-wrapper > div')?.getBoundingClientRect()
        }
    });

    if (!rechartsLoaded || loading) {
        return React.createElement('div', { 
            className: "text-center p-4 text-text bg-background rounded shadow" 
        }, 'Lade Daten...');
    }
    
    if (error) {
        return React.createElement('div', { 
            className: "text-center p-4 bg-background text-error rounded shadow border border-error" 
        }, `Fehler: ${error}`);
    }

    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = RechartsComponents;

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
            React.createElement(
                'h3',
                { 
                    className: "text-lg font-bold mb-4 text-primary",
                    key: "title",
                    style: { flexShrink: 0 }
                },
                `Therapiestunden im Jahresverlauf ${selectedYear}`
            ),
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
                        LineChart,
                        {
                            data: data,
                            margin: { top: 20, right: 30, left: 20, bottom: 20 }
                        },
                        [
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
                                contentStyle: {
                                    backgroundColor: 'var(--background-color)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-color)',
                                    borderRadius: '4px',
                                    padding: '8px'
                                },
                                key: "tooltip"
                            }),
                            React.createElement(Legend, {
                                verticalAlign: "bottom",
                                height: 36,
                                key: "legend"
                            }),
                            React.createElement(Line, {
                                key: "line1",
                                type: "monotone",
                                dataKey: "Beatmungsdauer",
                                stroke: "#8884d8",
                                strokeWidth: 2,
                                dot: { r: 4 }
                            }),
                            React.createElement(Line, {
                                key: "line2",
                                type: "monotone",
                                dataKey: "Nierenersatzverfahren",
                                stroke: "#2ecc71",
                                strokeWidth: 2,
                                dot: { r: 4 }
                            }),
                            React.createElement(Line, {
                                key: "line3",
                                type: "monotone",
                                dataKey: "Extrakorporale Lungenunterstützung",
                                stroke: "#f39c12",
                                strokeWidth: 2,
                                dot: { r: 4 }
                            })
                        ]
                    )
                )
            )
        ]
    );
};

export default TherapyYearChart;