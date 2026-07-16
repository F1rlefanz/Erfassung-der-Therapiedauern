// js/components/retry-continuation-button.js
import { hooks } from '../hooks.js';
import { TherapyManager } from '../managers/TherapyManager.js';
import { state } from '../state.js';

const RetryContinuationButton = () => {
    const [isLoading, setIsLoading] = hooks.useState(false);
    const [error, setError] = hooks.useState(null);

    hooks.useEffect(() => {
        lucide.createIcons();
    });

    const handleRetry = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            localStorage.removeItem('processedDates');
            
            const therapyManager = new TherapyManager();
            await therapyManager.handleAutomaticContinuation(state.dateInput.value);
            
        } catch (err) {
            console.error('Fehler beim Wiederholen der Übernahme:', err);
            setError('Übernahme fehlgeschlagen');
        } finally {
            setIsLoading(false);
        }
    };

    return React.createElement(
        'button',
        {
            onClick: handleRetry,
            disabled: isLoading,
            className: "arrow-button flex items-center gap-2",
            type: "button",
            'aria-label': "Übernahme wiederholen",
            title: "Übernahme vom Vortag wiederholen"
        },
        React.createElement('i', {
            'data-lucide': isLoading ? "loader" : "corner-left-down",
            className: isLoading ? "animate-spin" : ""
        })
    );
};

export default RetryContinuationButton;