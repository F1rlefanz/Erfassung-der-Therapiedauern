// state.js
export const state = {
    dateInput: null,
    startDateInput: null,
    endDateInput: null,
    filterDurationInput: null,
    filterTreatmentInput: null
};

export const activeTherapies = {
  currentHour: new Date().getHours(),
  activePatients: new Map(),
  isUpdating: false
};

// Globaler State für Jahr
export const globalState = {
  selectedYear: new Date().getFullYear(),
  availableYears: [],
  setSelectedYear: null,
  setAvailableYears: null,
  currentDB: null,
  setCurrentDB: null  
};

// Initialisierung für bestehenden State
export function initializeState(elements) {
  if (!elements.dateInput || !elements.startDateInput || !elements.endDateInput || 
      !elements.filterDurationInput || !elements.filterTreatmentInput) {
      throw new Error('Missing required elements for state initialization');
  }
  
  state.dateInput = elements.dateInput;
  state.startDateInput = elements.startDateInput;
  state.endDateInput = elements.endDateInput;
  state.filterDurationInput = elements.filterDurationInput;
  state.filterTreatmentInput = elements.filterTreatmentInput;
}

// Initialisierung für globalen State
export function initializeGlobalState(setYear, setYears, setDB) {
  console.log('Initialisiere globalen State');
  globalState.setSelectedYear = setYear;
  globalState.setAvailableYears = setYears;
  globalState.setCurrentDB = setDB;
}

// Funktion zum Aktualisieren der aktiven DB
export async function updateCurrentDB(year) {
  try {
      const db = await yearlyDBManager.ensureYearDB(year);
      globalState.currentDB = db;
      if (globalState.setCurrentDB) {
          globalState.setCurrentDB(db);
      }
      return db;
  } catch (error) {
      console.error('Fehler beim Aktualisieren der aktiven DB:', error);
      throw error;
  }
}

// Funktionen für activeTherapies
export function saveActiveTherapiesState() {
  const serializedState = {
      currentHour: activeTherapies.currentHour,
      activePatients: Array.from(activeTherapies.activePatients.entries())
  };
  localStorage.setItem('activeTherapies', JSON.stringify(serializedState));
}

export function loadActiveTherapiesState() {
  const saved = localStorage.getItem('activeTherapies');
  if (saved) {
      const parsed = JSON.parse(saved);
      activeTherapies.currentHour = parsed.currentHour;
      activeTherapies.activePatients = new Map(parsed.activePatients);
  }
}

// Hilfsfunktionen für Jahr-Management
export function updateSelectedYear(year) {
  globalState.selectedYear = year;
  if (globalState.setSelectedYear) {
      globalState.setSelectedYear(year);
  }
}

export function updateAvailableYears(years) {
  globalState.availableYears = years;
  if (globalState.setAvailableYears) {
      globalState.setAvailableYears(years);
  }
}