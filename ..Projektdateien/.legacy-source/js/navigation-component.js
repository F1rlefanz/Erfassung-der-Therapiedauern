// navigation-component.js
import { hooks } from './hooks.js';
import { yearlyDBManager } from './yearlyDBManager.js';
import { globalState, updateCurrentDB } from './state.js';

export const Navigation = () => {
    const [availableYears, setAvailableYears] = hooks.useState([]);
    const [selectedYear, setSelectedYear] = hooks.useState(new Date().getFullYear());
    const [isYearDropdownOpen, setIsYearDropdownOpen] = hooks.useState(false);
    
    hooks.useEffect(() => {
        async function loadYears() {
            try {
                const years = await yearlyDBManager.getAvailableYears();
                setAvailableYears(years);
                if (globalState.setSelectedYear) globalState.setSelectedYear(selectedYear);
                if (globalState.setAvailableYears) globalState.setAvailableYears(years);
            } catch (error) {
                console.error('Fehler beim Laden der Jahre:', error);
            }
        }
        loadYears();
        lucide.createIcons();
    }, []);


    // Neuer useEffect für das yearAdded Event
    hooks.useEffect(() => {
        const handleYearAdded = (event) => {
            const { year } = event.detail;
            setAvailableYears(prev => {
                // Prüfen ob das Jahr bereits vorhanden ist
                if (!prev.includes(year)) {
                    const newYears = [...prev, year].sort((a,b) => b-a);
                    // Update auch im globalState
                    if (globalState.setAvailableYears) {
                        globalState.setAvailableYears(newYears);
                    }
                    return newYears;
                }
                return prev;
            });
        };

        window.addEventListener('yearAdded', handleYearAdded);
        return () => window.removeEventListener('yearAdded', handleYearAdded);
    }, []);

    const handleYearChange = async (year) => {
        try {
            setSelectedYear(year);
            setIsYearDropdownOpen(false);
            
            if (globalState.setSelectedYear) {
                globalState.setSelectedYear(year);
            }
            
            // DB wechseln und global speichern
            const db = await yearlyDBManager.ensureYearDB(year);
            globalState.currentDB = db;
    
            // Event auslösen für andere Komponenten
            window.dispatchEvent(new CustomEvent('yearChanged', { 
                detail: { year, db } 
            }));
            
        } catch (error) {
            console.error('Fehler beim Jahreswechsel:', error);
        }
    };

    const currentPath = window.location.pathname;
    const isInSubfolder = currentPath.includes('/html/');
    
    const navItems = [
        { name: 'Home', path: isInSubfolder ? '../index.html' : './index.html', icon: 'home' },
        { name: 'Therapiedauer', path: isInSubfolder ? './therapiedauer.html' : './html/therapiedauer.html', icon: 'clock' },
        { name: 'Statistiken', path: isInSubfolder ? './statistik.html' : './html/statistik.html', icon: 'table-properties' },
        { name: 'Graphen', path: isInSubfolder ? './graphen.html' : './html/graphen.html', icon: 'bar-chart-2' },
        { name: 'Einstellungen', path: isInSubfolder ? './settings.html' : './html/settings.html', icon: 'settings' }
    ];

    return React.createElement('div', { 
        className: 'nav-container' 
    }, [
        React.createElement('nav', { 
            className: 'nav-inner shadow-lg'
        }, [
            React.createElement('div', {
                className: 'flex items-center justify-between h-16 px-4 mx-auto max-w-7xl'
            }, [
                // Logo
                React.createElement('span', {
                    className: 'text-[#9b59b6] text-xl font-bold'
                }, 'Therapie-Tracking'),
    
                // Navigation Links Container
                React.createElement('div', {
                    className: 'flex items-center space-x-4'
                }, navItems.map(item => 
                    React.createElement('a', {
                        href: item.path,
                        className: `flex items-center px-3 py-2 rounded ${
                            currentPath.endsWith(item.path) 
                                ? 'bg-[#9b59b6] text-white'
                                : 'text-gray-300 hover:bg-[#8e44ad]'
                        }`,
                        key: item.path
                    }, [
                        React.createElement('i', {
                            'data-lucide': item.icon,
                            className: 'w-5 h-5 mr-2',
                            key: `${item.path}-icon`
                        }),
                        item.name
                    ])
                ))
            ])
        ])
    ]);
}
export default Navigation;