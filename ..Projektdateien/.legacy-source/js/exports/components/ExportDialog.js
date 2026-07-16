// js/exports/components/ExportDialog.js

import { hooks } from '../../hooks.js';
import { ExportManager } from '../ExportManager.js';
import { ExportFormat, ExportOptions } from '../interfaces/ExportTypes.js';
import { formatUtils } from '../utils/FormatUtils.js';

// Initiale Datentypen für den Export
const INITIAL_DATA_TYPES = {
    therapyStats: true,
    icuStats: true, 
    imcStats: true,
    rawData: false
};

// Styling Definitionen
const STYLES = {
    // Dialog Container
    modal: 'fixed inset-0 w-full h-full z-[9999] bg-[rgba(0,0,0,0.5)] flex items-center justify-center p-4',
    dialog: 'bg-[#34495e] rounded-lg p-6 w-full max-w-lg shadow-xl transform transition-all',
    
    // Header Styles
    header: 'flex justify-between items-center mb-6',
    title: 'text-xl font-bold text-white',
    closeBtn: 'p-2 rounded-full hover:bg-[#4a5568] transition-colors',
    
    // Formular Elemente
    section: 'mb-6 space-y-4', 
    label: 'block text-white mb-2',
    inputGroup: 'grid grid-cols-2 gap-4',
    input: 'w-full px-3 py-2 bg-[#2d3748] text-white rounded border border-[#4a5568]',
    
    // Checkbox Gruppe
    checkboxGroup: 'space-y-2',
    checkboxLabel: 'flex items-center space-x-2 text-white cursor-pointer',
    checkbox: 'rounded border-[#4a5568]',
    
    // Fortschrittsanzeige
    progressContainer: 'mb-6',
    progressBar: 'w-full bg-[#2d3748] rounded-full h-2',
    progressFill: 'bg-[#9b59b6] rounded-full h-2 transition-all duration-300',
    progressText: 'text-sm text-gray-400 mt-1',
    
    // Fehlermeldung
    error: 'mb-6 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded text-red-500',
    
    // Button Container und Buttons
    actions: 'flex justify-end space-x-4',
    cancelBtn: 'px-4 py-2 rounded text-white bg-[#2d3748] hover:bg-[#4a5568] transition-colors',
    exportBtn: 'px-4 py-2 rounded text-white bg-[#9b59b6] hover:bg-[#8e44ad] transition-colors flex items-center space-x-2'
};
const ExportDialog = ({ isOpen, onClose }) => {
    // Debug Logger
    const logger = {
        debug: true,
        log: (message, data) => {
            if (logger.debug) {
                console.log(`ExportDialog: ${message}`, data || '');
            }
        }
    };

    logger.log('ExportDialog wird initialisiert', { isOpen, onClose });

    // State Hooks
    const [dateRange, setDateRange] = hooks.useState({
        from: new Date(),
        to: new Date()
    });

    const [selectedFormat, setSelectedFormat] = hooks.useState(ExportFormat.PDF);
    const [selectedDataTypes, setSelectedDataTypes] = hooks.useState(INITIAL_DATA_TYPES);
    const [isExporting, setIsExporting] = hooks.useState(false);
    const [error, setError] = hooks.useState(null);
    const [progress, setProgress] = hooks.useState(0);

    // ExportManager Instanz
    const exportManager = hooks.useMemo(() => new ExportManager(), []);

    // Effect für DOM-Überprüfung
    hooks.useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                const modalElement = document.querySelector(`[class*="fixed"]`);
                const dialogElement = document.querySelector(`[class*="bg-[#34495e]"]`);
    
                logger.log('DOM Check:', {
                    bodyChildren: document.body.children.length,
                    modalFound: !!modalElement,
                    modalStyles: modalElement ? {
                        position: window.getComputedStyle(modalElement).position,
                        background: window.getComputedStyle(modalElement).backgroundColor,
                        zIndex: window.getComputedStyle(modalElement).zIndex,
                        width: window.getComputedStyle(modalElement).width,
                        height: window.getComputedStyle(modalElement).height
                    } : null,
                    dialogFound: !!dialogElement,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    }
                });
            }, 0);
        }
    }, [isOpen]);

    // Export Handler
    const handleExport = async () => {
        try {
            setIsExporting(true);
            setError(null);
            setProgress(0);

            const options = ExportOptions.fromObject({
                dateRange,
                format: selectedFormat,
                dataTypes: selectedDataTypes
            });

            setProgress(10);
            const result = await exportManager.exportData(options);
            setProgress(90);

            await downloadExport(result, selectedFormat);
            
            setProgress(100);
            setTimeout(() => {
                onClose();
                setProgress(0);
            }, 1000);

        } catch (error) {
            console.error('Export fehlgeschlagen:', error);
            setError(error.message);
        } finally {
            setIsExporting(false);
        }
    };

    // Download Helper
    const downloadExport = async (data, format) => {
        const timestamp = formatUtils.formatTimestamp(new Date()).replace(/[:.]/g, '-');
        const filename = `therapie-export_${timestamp}`;

        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.${format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    // Früher Return wenn Dialog nicht geöffnet
    if (!isOpen) {
        logger.log('Dialog nicht geöffnet, return null');
        return null;
    }

    // Haupt-Render des Dialogs
    return React.createElement(React.Fragment, null,
        React.createElement('div', {
            className: STYLES.modal,
            style: {
                backgroundColor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(2px)'
            },
            onClick: e => {
                if (e.target === e.currentTarget && !isExporting) {
                    onClose();
                }
            }
        }, [
            React.createElement('div', {
                className: STYLES.dialog,
                onClick: e => e.stopPropagation()
            }, [
                // Header mit Titel und Schließen-Button
                React.createElement('div', {
                    key: 'header',
                    className: STYLES.header
                }, [
                    React.createElement('h2', {
                        className: STYLES.title
                    }, 'Daten exportieren'),
                    !isExporting && React.createElement('button', {
                        onClick: onClose,
                        className: STYLES.closeBtn
                    }, React.createElement('i', {
                        'data-lucide': 'x',
                        className: 'w-6 h-6 text-gray-400 hover:text-white'
                    }))
                ]),

                // Datumsauswahl
                React.createElement('div', {
                    key: 'date-range',
                    className: STYLES.section
                }, [
                    React.createElement('label', {
                        className: STYLES.label
                    }, 'Zeitraum'),
                    React.createElement('div', {
                        className: STYLES.inputGroup
                    }, [
                        React.createElement('input', {
                            type: 'date',
                            value: formatUtils.formatDateForInput(dateRange.from),
                            onChange: e => setDateRange(prev => ({
                                ...prev,
                                from: new Date(e.target.value)
                            })),
                            className: STYLES.input,
                            disabled: isExporting
                        }),
                        React.createElement('input', {
                            type: 'date',
                            value: formatUtils.formatDateForInput(dateRange.to),
                            onChange: e => setDateRange(prev => ({
                                ...prev,
                                to: new Date(e.target.value)
                            })),
                            className: STYLES.input,
                            disabled: isExporting
                        })
                    ])
                ]),

                // Format-Auswahl
                React.createElement('div', {
                    key: 'format',
                    className: STYLES.section
                }, [
                    React.createElement('label', {
                        className: STYLES.label
                    }, 'Exportformat'),
                    React.createElement('select', {
                        value: selectedFormat,
                        onChange: e => setSelectedFormat(e.target.value),
                        className: STYLES.input,
                        disabled: isExporting
                    }, Object.values(ExportFormat).map(format =>
                        React.createElement('option', {
                            key: format,
                            value: format
                        }, format.toUpperCase())
                    ))
                ]),

                // Datentyp-Auswahl
                React.createElement('div', {
                    key: 'data-types',
                    className: STYLES.section
                }, [
                    React.createElement('label', {
                        className: STYLES.label
                    }, 'Zu exportierende Daten'),
                    React.createElement('div', {
                        className: STYLES.checkboxGroup
                    }, Object.entries(selectedDataTypes).map(([type, selected]) =>
                        React.createElement('label', {
                            key: type,
                            className: STYLES.checkboxLabel
                        }, [
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: selected,
                                onChange: e => setSelectedDataTypes(prev => ({
                                    ...prev,
                                    [type]: e.target.checked
                                })),
                                disabled: isExporting,
                                className: STYLES.checkbox
                            }),
                            React.createElement('span', null,
                                type === 'therapyStats' ? 'Therapiestatistiken' :
                                type === 'icuStats' ? 'ICU Schweregrad' :
                                type === 'imcStats' ? 'IMC Schweregrad' : 'Rohdaten'
                            )
                        ])
                    ))
                ]),

                // Fortschrittsanzeige (bedingt gerendert)
                progress > 0 && React.createElement('div', {
                    key: 'progress',
                    className: STYLES.progressContainer
                }, [
                    React.createElement('div', {
                        className: STYLES.progressBar
                    }, React.createElement('div', {
                        className: STYLES.progressFill,
                        style: { width: `${progress}%` }
                    })),
                    React.createElement('span', {
                        className: STYLES.progressText
                    }, `${progress}% abgeschlossen`)
                ]),

                // Fehleranzeige (bedingt gerendert)
                error && React.createElement('div', {
                    key: 'error',
                    className: STYLES.error
                }, error),

                // Aktions-Buttons
                React.createElement('div', {
                    key: 'actions',
                    className: STYLES.actions
                }, [
                    React.createElement('button', {
                        onClick: onClose,
                        disabled: isExporting,
                        className: `${STYLES.cancelBtn} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`
                    }, 'Abbrechen'),
                    React.createElement('button', {
                        onClick: handleExport,
                        disabled: isExporting,
                        className: `${STYLES.exportBtn} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`
                    }, [
                        React.createElement('i', {
                            key: 'icon',
                            'data-lucide': isExporting ? 'loader' : 'download',
                            className: `w-5 h-5 ${isExporting ? 'animate-spin' : ''}`
                        }),
                        React.createElement('span', {
                            key: 'text'
                        }, isExporting ? 'Exportiere...' : 'Exportieren')
                    ])
                ])
            ])
        ])
    );
};

export default ExportDialog;