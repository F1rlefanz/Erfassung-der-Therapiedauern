/// js/renderUtils.js
import { ReactErrorBoundary, createSafeRoot } from './reactV18Check.js';
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper.js';

/**
 * Zentrale Funktion zum Rendern von React-Komponenten
 * Verhindert mehrfaches Aufrufen von createRoot
 * @param {HTMLElement} container - DOM-Element für das Rendering
 * @param {React.Component} Component - Zu rendernde React-Komponente
 */
export const renderComponent = (container, Component) => {
    if (!container) {
        console.warn(`Container für ${Component.name} nicht gefunden`);
        return;
    }
    
    try {
        // Root erstellen oder existierenden Root wiederverwenden
        const root = createSafeRoot(container, Component.name);
        
        // Komponente rendern
        root.render(
            React.createElement(ErrorBoundaryWrapper, null,
                React.createElement(Component)
            )
        );
        
        return root;
    } catch (error) {
        console.error(`Fehler beim Rendern von ${Component.name}:`, error);
        // Container bereinigen
        delete container._reactRoot;
        throw error;
    }
};

/**
 * Bereinigt den React-Root eines Containers
 * @param {HTMLElement} container - DOM-Element dessen Root bereinigt werden soll
 */
export const cleanupRoot = (container) => {
    if (container && container._reactRoot) {
        try {
            container._reactRoot.unmount();
            delete container._reactRoot;
        } catch (error) {
            console.warn('Fehler beim Cleanup des React-Root:', error);
        }
    }
};