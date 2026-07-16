// js/components/year-selector-component.js 
import { hooks } from '../hooks.js';
import { yearlyDBManager } from '../yearlyDBManager.js';
import { globalState } from '../state.js';

const YearSelector = () => {
    const [availableYears, setAvailableYears] = hooks.useState([]);
    const [selectedYear, setSelectedYear] = hooks.useState(new Date().getFullYear());
    const [isDropdownOpen, setIsDropdownOpen] = hooks.useState(false);
    const dropdownRef = hooks.useRef(null);
    const [isLoading, setIsLoading] = hooks.useState(false);

    // Bestehender useEffect für Click-Outside
    hooks.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Bestehender useEffect für Initial Load
    hooks.useEffect(() => {
        const loadYears = async () => {
            try {
                const years = await yearlyDBManager.getAvailableYears();
                setAvailableYears(years);
                
                if (globalState.setAvailableYears) {
                    globalState.setAvailableYears(years);
                }
            } catch (error) {
                console.error('Fehler beim Laden der Jahre:', error);
            }
        };

        loadYears();
        lucide.createIcons();
    }, []);

    // Neuer useEffect für Icon-Updates
    hooks.useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, [isDropdownOpen, selectedYear]);

    // Jahr wechseln
    const handleYearChange = async (year) => {
        if (isLoading) return;
        
        try {
            setIsLoading(true);
            
            // Dropdown schließen BEVOR der Jahreswechsel startet
            setIsDropdownOpen(false);
            
            // Kleine Verzögerung für saubere Animation
            await new Promise(resolve => setTimeout(resolve, 100));
            
            setSelectedYear(year);
            
            if (globalState.setSelectedYear) {
                globalState.setSelectedYear(year);
            }
    
            const db = await yearlyDBManager.ensureYearDB(year);
            globalState.currentDB = db;
            
            window.dispatchEvent(new CustomEvent('yearChanged', { 
                detail: { year, db } 
            }));
    
        } catch (error) {
            console.error('Fehler beim Jahreswechsel:', error);
            alert('Das Jahr konnte nicht gewechselt werden. Bitte versuchen Sie es erneut.');
        } finally {
            setIsLoading(false);
        }
    };

    // Dropdown Toggle Handler mit Verzögerung
    const handleDropdownToggle = () => {
        if (!isLoading) {
            // Kleine Verzögerung um Race Conditions zu vermeiden
            setTimeout(() => {
                setIsDropdownOpen(prev => !prev);
            }, 10);
        }
    };

    return React.createElement(
        'div',
        { 
            ref: dropdownRef,
            className: 'relative'
        },
        [
            // Dropdown Button
            React.createElement(
                'button',
                {
                    key: 'year-dropdown-button',
                    onClick: handleDropdownToggle,
                    className: `flex items-center gap-2 px-4 py-2 rounded 
                               bg-[#9b59b6] text-white hover:bg-[#8e44ad] transition-colors
                               ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`,
                    type: 'button',
                    disabled: isLoading
                },
                [
                    React.createElement('i', {
                        key: 'calendar-icon',
                        'data-lucide': isLoading ? 'loader' : 'calendar',
                        className: `w-5 h-5 ${isLoading ? 'animate-spin' : ''}`
                    }),
                    `Jahr: ${selectedYear}`,
                    React.createElement('i', {
                        key: 'chevron-icon',
                        'data-lucide': isDropdownOpen ? 'chevron-up' : 'chevron-down',
                        className: 'w-4 h-4'
                    })
                ]
            ),

            // Dropdown Menu mit bedingtem Rendering
            isDropdownOpen && !isLoading && React.createElement(
                'div',
                {
                    key: 'dropdown-menu',
                    className: `absolute left-0 z-20 w-48 mt-2 py-2 rounded shadow-lg 
                               border border-[--primary-color] bg-[--background-color]`
                },
                [
                    // Jahre
                    ...availableYears.map(year => 
                        React.createElement(
                            'button',
                            {
                                key: year,
                                onClick: () => handleYearChange(year),
                                className: `w-full px-4 py-2 text-left hover:bg-[--secondary-color] 
                                          text-[--text-color] transition-colors
                                          ${selectedYear === year ? 'bg-[--primary-color]' : ''}`,
                                type: 'button'
                            },
                            year.toString()
                        )
                    ),
                    // Neues Jahr Button
                    React.createElement(
                        'button',
                        {
                            key: 'new-year',
                            onClick: () => handleYearChange(new Date().getFullYear() + 1),
                            className: `w-full px-4 py-2 text-left hover:bg-[--secondary-color]
                                      text-[--text-color] transition-colors border-t 
                                      border-[--border-color]`,
                            type: 'button'
                        },
                        'Neues Jahr'
                    )
                ]
            )
        ]
    );
};

export default YearSelector;