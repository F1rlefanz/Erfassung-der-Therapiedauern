import { hooks } from '../../hooks.js';
import { ExportFormat } from '../interfaces/ExportTypes.js';
import { formatUtils } from '../utils/FormatUtils.js';

// Styling-Konstanten
const STYLES = {
    container: 'space-y-6',
    section: 'space-y-4',
    label: 'block text-white mb-2',
    inputGroup: 'grid grid-cols-2 gap-4',
    input: 'w-full px-3 py-2 bg-[#2d3748] text-white rounded border border-[#4a5568]',
    select: 'w-full px-3 py-2 bg-[#2d3748] text-white rounded border border-[#4a5568]',
    checkboxGroup: 'space-y-2',
    checkboxLabel: 'flex items-center space-x-2 text-white cursor-pointer',
    checkbox: 'rounded border-[#4a5568]',
    error: 'text-red-500 text-sm mt-1'
};

const INITIAL_DATA_TYPES = {
    therapyStats: true,
    icuStats: true,
    imcStats: true,
    rawData: false
};

const FilterOptions = ({ onFilterChange, disabled = false }) => {
    // State für Filteroptionen
    const [dateRange, setDateRange] = hooks.useState({
        from: new Date(),
        to: new Date()
    });
    const [selectedFormat, setSelectedFormat] = hooks.useState(ExportFormat.PDF);
    const [selectedDataTypes, setSelectedDataTypes] = hooks.useState(INITIAL_DATA_TYPES);
    const [errors, setErrors] = hooks.useState({});

    // Effect für Validierung und Callback
    hooks.useEffect(() => {
        const validationErrors = validateFilters();
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length === 0) {
            onFilterChange({
                dateRange,
                format: selectedFormat,
                dataTypes: selectedDataTypes
            });
        }
    }, [dateRange, selectedFormat, selectedDataTypes]);

    // Validierungsfunktion
    const validateFilters = () => {
        const errors = {};

        // Datum validieren
        if (!dateRange.from) {
            errors.dateFrom = 'Startdatum erforderlich';
        }
        if (!dateRange.to) {
            errors.dateTo = 'Enddatum erforderlich';
        }
        if (dateRange.from && dateRange.to && dateRange.from > dateRange.to) {
            errors.dateRange = 'Startdatum muss vor Enddatum liegen';
        }

        // Maximaler Zeitraum (2 Jahre)
        if (dateRange.from && dateRange.to) {
            const diffMonths = (dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24 * 30.44);
            if (diffMonths > 24) {
                errors.dateRange = 'Zeitraum darf maximal 2 Jahre betragen';
            }
        }

        // Mindestens ein Datentyp muss ausgewählt sein
        if (!Object.values(selectedDataTypes).some(v => v)) {
            errors.dataTypes = 'Mindestens ein Datentyp muss ausgewählt sein';
        }

        return errors;
    };

    // Handler für Datumsänderungen
    const handleDateChange = (field, value) => {
        setDateRange(prev => ({
            ...prev,
            [field]: value ? new Date(value) : null
        }));
    };

    // Handler für Formatänderungen
    const handleFormatChange = (event) => {
        setSelectedFormat(event.target.value);
    };

    // Handler für Datentyp-Änderungen
    const handleDataTypeChange = (type, checked) => {
        setSelectedDataTypes(prev => ({
            ...prev,
            [type]: checked
        }));
    };

    return (
        <div className={STYLES.container}>
            {/* Zeitraum */}
            <div className={STYLES.section}>
                <label className={STYLES.label}>Zeitraum</label>
                <div className={STYLES.inputGroup}>
                    <div>
                        <input
                            type="date"
                            value={formatUtils.formatDate(dateRange.from)}
                            onChange={(e) => handleDateChange('from', e.target.value)}
                            className={STYLES.input}
                            disabled={disabled}
                        />
                        {errors.dateFrom && (
                            <span className={STYLES.error}>{errors.dateFrom}</span>
                        )}
                    </div>
                    <div>
                        <input
                            type="date"
                            value={formatUtils.formatDate(dateRange.to)}
                            onChange={(e) => handleDateChange('to', e.target.value)}
                            className={STYLES.input}
                            disabled={disabled}
                        />
                        {errors.dateTo && (
                            <span className={STYLES.error}>{errors.dateTo}</span>
                        )}
                    </div>
                </div>
                {errors.dateRange && (
                    <span className={STYLES.error}>{errors.dateRange}</span>
                )}
            </div>

            {/* Exportformat */}
            <div className={STYLES.section}>
                <label className={STYLES.label}>Exportformat</label>
                <select
                    value={selectedFormat}
                    onChange={handleFormatChange}
                    className={STYLES.select}
                    disabled={disabled}
                >
                    {Object.values(ExportFormat).map(format => (
                        <option key={format} value={format}>
                            {format.toUpperCase()}
                        </option>
                    ))}
                </select>
            </div>

            {/* Datentypen */}
            <div className={STYLES.section}>
                <label className={STYLES.label}>Zu exportierende Daten</label>
                <div className={STYLES.checkboxGroup}>
                    {Object.entries(selectedDataTypes).map(([type, selected]) => (
                        <label key={type} className={STYLES.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => handleDataTypeChange(type, e.target.checked)}
                                disabled={disabled}
                                className={STYLES.checkbox}
                            />
                            <span>
                                {type === 'therapyStats' ? 'Therapiestatistiken' :
                                 type === 'icuStats' ? 'ICU Schweregrad' :
                                 type === 'imcStats' ? 'IMC Schweregrad' : 'Rohdaten'}
                            </span>
                        </label>
                    ))}
                </div>
                {errors.dataTypes && (
                    <span className={STYLES.error}>{errors.dataTypes}</span>
                )}
            </div>
        </div>
    );
};

export default FilterOptions;