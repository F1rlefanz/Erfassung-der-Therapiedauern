// settings.js
import { db } from './dbConfig.js';
import { ReactErrorBoundary, createSafeRoot } from './reactV18Check.js';

let settingsRoot = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.ensureInit();

        const { default: SettingsComponent } = await import('./components/settings-component.js');
        const settingsContainer = document.getElementById('settings-root');
        
        settingsRoot = createSafeRoot(settingsContainer, 'Settings');
        settingsRoot.render(
            React.createElement(ReactErrorBoundary, null,
                React.createElement(SettingsComponent)
            )
        );

    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
        const settingsContainer = document.getElementById('settings-root');
        if (settingsContainer) {
            settingsContainer.innerHTML = `
                <div class="error-message bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
                    <h3 class="font-bold">Fehler beim Laden der Einstellungen</h3>
                    <p>${error.message}</p>
                    <button onclick="window.location.reload()" 
                            class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                        Neu laden
                    </button>
                </div>
            `;
        }
    }
});

// Cleanup bei Page Unload
window.addEventListener('unload', () => {
    if (settingsRoot) {
        try {
            settingsRoot.unmount();
        } catch (error) {
            console.error('Fehler beim Unmounting der Settings:', error);
        }
    }
});