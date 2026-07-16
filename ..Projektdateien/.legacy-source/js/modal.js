// js/modal.js

class Modal {
    constructor() {
        this.modal = null;
        this.modalContent = null;
        this.openButton = null;
        this.closeButton = null;
        this.isInitialized = false;
    }

    initialize() {
        console.log("Initialisiere Modal");
        
        // Elemente finden
        this.modal = document.getElementById('export-modal');
        this.modalContent = this.modal?.querySelector('.modal-content');
        this.openButton = document.getElementById('open-export-modal');
        this.closeButton = this.modal?.querySelector('.modal-close');

        if (!this.modal || !this.modalContent || !this.openButton || !this.closeButton) {
            console.error("Erforderliche Modal-Elemente nicht gefunden");
            return;
        }

        // Event Listener hinzufügen
        this.setupEventListeners();
        
        // Initial geschlossen
        this.ensureModalClosed();
        
        this.isInitialized = true;
        console.log("Modal erfolgreich initialisiert");
    }

    setupEventListeners() {
        // Öffnen Button
        this.openButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.openModal();
        });

        // Schließen Button
        this.closeButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.closeModal();
        });

        // Außerhalb klicken
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.closeModal();
            }
        });

        // ESC Taste
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.closeModal();
            }
        });

        // Animation Ende
        this.modal.addEventListener('transitionend', () => {
            if (!this.modal.classList.contains('show')) {
                this.modal.classList.add('hidden');
            }
        });
    }

    openModal() {
        if (!this.isInitialized) {
            console.error("Modal nicht initialisiert");
            return;
        }

        console.log("Öffne Modal");
        
        // Vorbereiten
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        
        // Animation starten
        requestAnimationFrame(() => {
            this.modal.classList.add('show');
        });

        // Fokus setzen
        this.closeButton.focus();
        
        // Body Scrolling verhindern
        document.body.style.overflow = 'hidden';
        
        // ARIA
        this.modal.setAttribute('aria-hidden', 'false');
    }

    closeModal() {
        if (!this.isInitialized) {
            console.error("Modal nicht initialisiert");
            return;
        }

        console.log("Schließe Modal");
        
        // Animation starten
        this.modal.classList.remove('show');
        
        // Body Scrolling wiederherstellen
        document.body.style.overflow = '';
        
        // ARIA
        this.modal.setAttribute('aria-hidden', 'true');
    }

    ensureModalClosed() {
        console.log("Stelle sicher, dass Modal initial geschlossen ist");
        
        this.modal.classList.add('hidden');
        this.modal.classList.remove('show', 'flex');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    showLoadingState() {
        if (this.modalContent) {
            const loadingSpinner = document.createElement('div');
            loadingSpinner.className = 'absolute inset-0 flex items-center justify-center bg-opacity-50 spinner';
            this.modalContent.appendChild(loadingSpinner);
        }
    }

    hideLoadingState() {
        if (this.modalContent) {
            const spinner = this.modalContent.querySelector('.spinner');
            if (spinner) {
                spinner.remove();
            }
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'mt-4 error-message';
        errorElement.textContent = message;
        
        this.modalContent.appendChild(errorElement);
        
        setTimeout(() => {
            errorElement.remove();
        }, 3000);
    }
}

// Singleton-Instanz erstellen
const modalInstance = new Modal();

// Modal initialisieren wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    modalInstance.initialize();
});

// Exportiere Methoden für externe Nutzung
export const openModal = () => modalInstance.openModal();
export const closeModal = () => modalInstance.closeModal();