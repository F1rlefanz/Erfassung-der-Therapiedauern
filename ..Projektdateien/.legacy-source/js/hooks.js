// js/hooks.js

// Einfache Validierung beim Import
if (!window.React) {
    throw new Error('React muss vor hooks.js geladen werden');
}
//Validierungsfunktion
function validateHooks() {
    const requiredHooks = [
        'useState',
        'useEffect',
        'useCallback',
        'useMemo',
        'useRef'
    ];

    const missingHooks = requiredHooks.filter(hook => !window.React[hook]);
    
    if (missingHooks.length > 0) {
        throw new Error(`Fehlende React Hooks: ${missingHooks.join(', ')}`);
    }
}

// Validierung beim Import durchführen
validateHooks();

// Zentrale Hook-Sammlung
export const hooks = {
    // Basis-Hooks
    useState: window.React.useState,
    useEffect: window.React.useEffect,
    useCallback: window.React.useCallback,
    useMemo: window.React.useMemo,
    useRef: window.React.useRef,
    
    // Zusätzliche Hooks
    useContext: window.React.useContext,
    useReducer: window.React.useReducer,
    useLayoutEffect: window.React.useLayoutEffect,
    useImperativeHandle: window.React.useImperativeHandle,
    useDebugValue: window.React.useDebugValue,
    
    // React 18 spezifische Hooks
    useTransition: window.React.useTransition,
    useDeferredValue: window.React.useDeferredValue,
    useId: window.React.useId,
    useSyncExternalStore: window.React.useSyncExternalStore,
    useInsertionEffect: window.React.useInsertionEffect
};

//Debugging-Unterstützung
export const debugHooks = {
    getHookNames() {
        return Object.keys(hooks);
    },

    checkHookAvailability(hookName) {
        return hookName in hooks;
    },

    validateHook(hookName) {
        if (!this.checkHookAvailability(hookName)) {
            throw new Error(`Hook ${hookName} ist nicht verfügbar`);
        }
        return true;
    },

    logHookUsage(hookName) {
        console.log(`Hook ${hookName} wurde verwendet`);
        console.log('React Version:', window.React.version);
        console.log('Hook verfügbar:', this.checkHookAvailability(hookName));
    },

    getHookInfo(hookName) {
        return {
            available: this.checkHookAvailability(hookName),
            type: typeof hooks[hookName],
            isBound: hooks[hookName]?.hasOwnProperty('prototype'),
            reactVersion: window.React.version
        };
    },

    validateAllHooks() {
        const results = [];
        for (const hookName of this.getHookNames()) {
            try {
                this.validateHook(hookName);
                results.push({ hook: hookName, status: 'OK' });
            } catch (error) {
                results.push({ hook: hookName, status: 'Fehler', error: error.message });
            }
        }
        return results;
    }
};