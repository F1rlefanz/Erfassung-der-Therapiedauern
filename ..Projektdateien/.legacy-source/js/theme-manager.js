// js/theme-manager.js
export const ThemeManager = {
    applyColorScheme: (scheme) => {
        const root = document.documentElement;

        // Theme-Klasse für Tailwind setzen
        root.classList.remove('light', 'dark', 'standard');
        root.classList.add(scheme);
        
        switch(scheme) {
            case 'dark':
                root.style.setProperty('--primary-color', '#9b59b6');
                root.style.setProperty('--secondary-color', '#8e44ad');
                root.style.setProperty('--background-color', '#1a1a1a');
                root.style.setProperty('--text-color', '#ffffff');
                root.style.setProperty('--border-color', '#333333');
                root.dataset.theme = 'dark';
                break;
                
            case 'light':
                root.style.setProperty('--primary-color', '#9b59b6');
                root.style.setProperty('--secondary-color', '#8e44ad');
                root.style.setProperty('--background-color', '#ffffff');
                root.style.setProperty('--text-color', '#333333');
                root.style.setProperty('--border-color', '#e0e0e0');
                root.dataset.theme = 'light';
                break;
                
            default: // Standard
                root.style.setProperty('--primary-color', '#9b59b6');
                root.style.setProperty('--secondary-color', '#8e44ad');
                root.style.setProperty('--background-color', '#34495e');
                root.style.setProperty('--text-color', '#ecf0f1');
                root.style.setProperty('--border-color', '#7f8c8d');
                root.dataset.theme = 'standard';
        }
    },

    initializeTheme: async (db) => {
        try {
            const settings = await db.getSettings();
            const savedTheme = settings?.colorScheme || 'standard';
            ThemeManager.applyColorScheme(savedTheme);
            return savedTheme;
        } catch (error) {
            console.error('Error initializing theme:', error);
            ThemeManager.applyColorScheme('standard');
            return 'standard';
        }
    }
};