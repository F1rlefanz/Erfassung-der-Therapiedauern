// js/components/settings-component.js
import { hooks } from '../hooks.js';
import { db } from '../dbConfig.js';
import { ThemeManager } from '../theme-manager.js';
import ExportDialog from '../exports/components/ExportDialog.js';
const createPortal = window.ReactDOM.createPortal;

const SettingsComponent = () => {
    // State Management
    const [settings, setSettings] = hooks.useState({
        colorScheme: 'standard',
        defaultView: 'daily',
    });
    const [showExportDialog, setShowExportDialog] = hooks.useState(false);
    const [loadingStates, setLoadingStates] = hooks.useState({
        initial: true,
        saving: false,
        importing: false
    });
    const [error, setError] = hooks.useState(null);

    // Monitoring des Dialog-States
    hooks.useEffect(() => {
        console.log('SettingsComponent: showExportDialog state changed:', showExportDialog);
    }, [showExportDialog]);

    // Initialer Load der Einstellungen
    hooks.useEffect(() => {
        const loadSettings = async () => {
            try {
                setLoadingStates(prev => ({ ...prev, initial: true }));
                const dbSettings = await db.getSettings();
                setSettings(prev => ({ ...prev, ...dbSettings }));
            } catch (err) {
                console.error('Fehler beim Laden der Einstellungen:', err);
                setError('Einstellungen konnten nicht geladen werden');
            } finally {
                setLoadingStates(prev => ({ ...prev, initial: false }));
            }
        };

        loadSettings();
        
        // Icons initialisieren
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, []);

    // Handler
    const handleExportClick = () => {
        // Logging hier einfügen
        console.log('Settings: Export Dialog wird geöffnet', {
            showExportDialog,
            handleClose: typeof handleExportClose === 'function'
        });
        setShowExportDialog(true);
    };

    const handleExportClose = () => {
        console.log('Export Dialog close requested');
        setShowExportDialog(false);
    };

    // Speichern von Einstellungen
    const saveSettings = async (type, value) => {
        try {
            setLoadingStates(prev => ({ ...prev, saving: true }));
            setError(null);

            setSettings(prev => ({
                ...prev,
                [type]: value
            }));

            await db.saveSettings({
                [type]: value
            });

            if (type === 'colorScheme') {
                ThemeManager.applyColorScheme(value);
            }
        } catch (err) {
            console.error('Fehler beim Speichern:', err);
            setError('Einstellungen konnten nicht gespeichert werden');
            // Zurück zum vorherigen Wert
            setSettings(prev => ({
                ...prev,
                [type]: settings[type]
            }));
        } finally {
            setLoadingStates(prev => ({ ...prev, saving: false }));
        }
    };

    // Datenimport
    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setLoadingStates(prev => ({ ...prev, importing: true }));
            setError(null);

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    // Validiere Import-Daten
                    if (!importData.settings || !importData.dailyEntries || !importData.statistics) {
                        throw new Error('Ungültiges Backup-Format');
                    }

                    // Importiere die Daten
                    await db.importData(importData);
                    
                    // Lade Seite neu um Änderungen zu übernehmen
                    window.location.reload();
                    
                } catch (err) {
                    console.error('Fehler beim Parsen der Import-Datei:', err);
                    setError('Die Datei konnte nicht importiert werden');
                }
            };
            
            reader.readAsText(file);

        } catch (err) {
            console.error('Fehler beim Import:', err);
            setError('Daten konnten nicht importiert werden');
        } finally {
            setLoadingStates(prev => ({ ...prev, importing: false }));
            // Input zurücksetzen
            event.target.value = '';
        }
    };

    // Render Loading State
    if (loadingStates.initial) {
        return React.createElement('div', {
            className: 'settings-container flex items-center justify-center p-8'
        }, [
            React.createElement('span', {
                key: 'loading',
                className: 'text-lg text-[#ecf0f1]'
            }, 'Lade Einstellungen...')
        ]);
    }

    // Render Error State
    if (error) {
        return React.createElement('div', {
            className: 'settings-container p-8'
        }, [
            React.createElement('div', {
                key: 'error',
                className: 'bg-[#e74c3c] text-white p-4 rounded-lg shadow-lg'
            }, [
                React.createElement('p', { key: 'error-msg' }, error),
                React.createElement('button', {
                    key: 'retry',
                    onClick: () => window.location.reload(),
                    className: 'mt-4 px-4 py-2 bg-white text-[#e74c3c] rounded hover:bg-gray-100'
                }, 'Neu laden')
            ])
        ]);
    }

    // Hauptkomponente
    return React.createElement('div', {
        className: 'settings-container p-6 space-y-6'
    }, [
        // Darstellung Sektion
        React.createElement('section', {
            key: 'display-section',
            className: 'settings-section'
        }, [
            React.createElement('div', {
                key: 'display-header',
                className: 'flex items-center gap-2 mb-4'
            }, [
                React.createElement('i', {
                    key: 'palette-icon',
                    'data-lucide': 'palette',
                    className: 'w-6 h-6 text-[#9b59b6]'
                }),
                React.createElement('h2', {
                    className: 'text-xl font-bold text-[#ecf0f1]'
                }, 'Darstellung')
            ]),
            React.createElement('div', {
                key: 'theme-buttons',
                className: 'theme-buttons'
            }, [
                createThemeButton('standard', 'Standard', 'monitor'),
                createThemeButton('dark', 'Dunkel', 'moon'),
                createThemeButton('light', 'Hell', 'sun')
            ])
        ]),

        // Datenmanagement Sektion
        React.createElement('section', {
            key: 'data-section',
            className: 'settings-section'
        }, [
            React.createElement('div', {
                key: 'data-header',
                className: 'flex items-center gap-2 mb-4'
            }, [
                React.createElement('i', {
                    key: 'database-icon',
                    'data-lucide': 'database',
                    className: 'w-6 h-6 text-[#9b59b6]'
                }),
                React.createElement('h2', {
                    className: 'text-xl font-bold text-[#ecf0f1]'
                }, 'Datenmanagement')
            ]),
            React.createElement('div', {
                key: 'data-buttons',
                className: 'flex flex-col gap-4'
            }, [
                // Export Button
                React.createElement('button', {
                    key: 'export-button',
                    onClick: handleExportClick,
                    disabled: loadingStates.importing,
                    className: `
                        w-full flex items-center gap-2 p-3 
                        bg-[#9b59b6] hover:bg-[#8e44ad] 
                        text-white rounded-lg transition-colors
                        ${loadingStates.importing ? 'opacity-50 cursor-not-allowed' : ''}
                    `
                }, [
                    React.createElement('i', {
                        key: 'download-icon',
                        'data-lucide': 'download',
                        className: 'w-5 h-5'
                    }),
                    'Datenexport öffnen'
                ]),

            // Export Dialog
            console.log('SettingsComponent rendering, will show dialog:', showExportDialog),
            showExportDialog && createPortal(
                React.createElement(ExportDialog, {
                    key: 'export-dialog',
                    isOpen: showExportDialog, 
                    onClose: handleExportClose
                }),
                document.body
            ),

                // Import Button und versteckter File Input
                React.createElement('div', {
                    key: 'import-container',
                    className: 'relative'
                }, [
                    React.createElement('input', {
                        key: 'file-input',
                        type: 'file',
                        accept: '.json',
                        onChange: handleImport,
                        disabled: loadingStates.importing,
                        className: 'hidden',
                        id: 'import-file'
                    }),
                    React.createElement('button', {
                        key: 'import-button',
                        onClick: () => document.getElementById('import-file').click(),
                        disabled: loadingStates.importing,
                        className: `
                            w-full flex items-center gap-2 p-3 
                            bg-[#9b59b6] hover:bg-[#8e44ad] 
                            text-white rounded-lg transition-colors
                            ${loadingStates.importing ? 'opacity-50 cursor-not-allowed' : ''}
                        `
                    }, [
                        React.createElement('i', {
                            key: 'upload-icon',
                            'data-lucide': 'upload',
                            className: 'w-5 h-5'
                        }),
                        loadingStates.importing ? 'Importiere...' : 'Daten importieren'
                    ])
                ])
            ])
        ])
    ]);

    // Hilfsfunktion für Theme-Buttons
    function createThemeButton(value, label, icon) {
        const isSelected = settings.colorScheme === value;
        return React.createElement('button', {
            key: value,
            onClick: () => saveSettings('colorScheme', value),
            disabled: loadingStates.saving,
            className: `
                flex items-center gap-2 px-4 py-2 rounded-lg
                transition-colors duration-200
                ${isSelected 
                    ? 'bg-[#9b59b6] text-white' 
                    : 'bg-[#4a5568] hover:bg-[#8e44ad] text-white'}
                ${loadingStates.saving ? 'opacity-50 cursor-not-allowed' : ''}
            `
        }, [
            React.createElement('i', {
                key: `${value}-icon`,
                'data-lucide': icon,
                className: 'w-5 h-5'
            }),
            React.createElement('span', {
                key: `${value}-text`
            }, label),
            isSelected && React.createElement('i', {
                key: `${value}-check`,
                'data-lucide': 'check',
                className: 'w-4 h-4 ml-2'
            })
        ]);
    }
};

export default SettingsComponent;