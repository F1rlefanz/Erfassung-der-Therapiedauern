// navigation.js
import { Navigation } from './navigation-component.js';
import { ThemeManager } from './theme-manager.js';
import { db } from './dbConfig.js';
import { ReactErrorBoundary, createSafeRoot } from './reactV18Check.js';
import { initializeGlobalState } from './state.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const navigationRoot = document.getElementById('navigation-root');
        // Theme initialisieren
        await ThemeManager.initializeTheme(db);

        // Navigation rendern
        navigationRoot.classList.add('nav-container');
        const root = createSafeRoot(navigationRoot, 'Navigation');
        
        // Global State initialisieren
        const setYear = (year) => {
            console.log('Jahr geändert zu:', year);
            // Hier können wir weitere Aktionen bei Jahresänderung auslösen
        };
        
        const setYears = (years) => {
            console.log('Verfügbare Jahre:', years);
        };
        
        initializeGlobalState(setYear, setYears);

        root.render(
            React.createElement(ReactErrorBoundary, null,
                React.createElement(Navigation)
            )
        );

        // Icons neu initialisieren
        lucide.createIcons();
    } catch (error) {
        console.error('Fehler beim Initialisieren der Navigation:', error);
        const errorContainer = document.createElement('div');
        errorContainer.className = 'fixed top-0 left-0 right-0 p-4 text-center text-white bg-red-500 error-message';
        errorContainer.textContent = 'Fehler beim Laden der Navigation. Bitte laden Sie die Seite neu.';
        document.body.prepend(errorContainer);
    }
});