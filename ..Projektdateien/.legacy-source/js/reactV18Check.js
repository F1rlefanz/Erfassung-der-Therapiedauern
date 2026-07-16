// js/reactV18Check.js

export class ReactInitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReactInitError';
    }
}

export class ComponentMountError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ComponentMountError';
    }
}

export const ReactVersionChecker = {
    minVersion: '18.2.0',
    versionLogged: false,

    checkVersion() {
        if (!window.React || !window.ReactDOM) {
            throw new ReactInitError('React oder ReactDOM nicht gefunden');
        }

        if (!window.ReactDOM.createRoot) {
            throw new ReactInitError('React 18 oder höher wird benötigt (createRoot nicht gefunden)');
        }

        // Versionsprüfung
        const currentVersion = window.React.version;
        if (this.compareVersions(currentVersion, this.minVersion) < 0) {
            throw new ReactInitError(`React Version ${currentVersion} ist zu niedrig. Minimum: ${this.minVersion}`);
        }

        // Log Version nur einmal
        if (!this.versionLogged) {
            console.log('React Version:', currentVersion);
            this.versionLogged = true;
        }
        
        return true;
    },

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }
        return 0;
    }
};

export class ReactErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Detaillierte Error-Logs
        console.error('React Fehler Details:', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
        });
    
        // Zusätzliche Debug-Infos
        console.debug('React Version:', React.version);
        console.debug('Recharts Status:', !!window.Recharts);
    }

    render() {
        if (this.state.hasError) {
            return React.createElement(
                'div',
                { 
                    className: 'error-boundary p-4 bg-red-500 text-white rounded shadow-lg'
                },
                [
                    React.createElement('h3', { 
                        className: 'text-lg font-bold mb-2',
                        key: 'error-title'
                    }, 'Ein Fehler ist aufgetreten'),
                    React.createElement('p', { 
                        className: 'mb-4',
                        key: 'error-message'
                    }, this.state.error?.message || 'Unbekannter Fehler'),
                    React.createElement('button', {
                        className: 'px-4 py-2 bg-white text-red-500 rounded hover:bg-red-100',
                        onClick: () => window.location.reload(),
                        key: 'reload-button'
                    }, 'Seite neu laden')
                ]
            );
        }

        return this.props.children;
    }
}

// js/reactV18Check.js

export function createSafeRoot(container, componentName = 'Unbekannt') {
    if (!container) {
        throw new ComponentMountError(`Container für ${componentName} nicht gefunden`);
    }

    try {
        ReactVersionChecker.checkVersion();
        
        // Prüfe ob bereits ein Root existiert
        if (container._reactRoot) {
            console.log(`Root für ${componentName} existiert bereits, verwende existierenden Root`);
            return container._reactRoot;
        }

        // Erstelle neuen Root nur wenn noch keiner existiert
        const root = window.ReactDOM.createRoot(container);
        container._reactRoot = root;
        return root;

    } catch (error) {
        console.error(`Fehler beim Erstellen der Root für ${componentName}:`, error);
        container.innerHTML = `
            <div class="error-message bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
                <h3 class="font-bold">Fehler beim Laden der Komponente ${componentName}</h3>
                <p>${error.message}</p>
            </div>
        `;
        throw error;
    }
}