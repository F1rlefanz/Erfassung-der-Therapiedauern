// dbStores.js
export const DB_STORES = {
    therapyTypes: {
        keyPath: 'id',
        indexes: [
            { name: 'name', unique: false },
            { name: 'active', unique: false }
        ]
    },
    dailyEntries: {
        keyPath: ['date', 'therapyType'],
        indexes: [
            { name: 'date', unique: false },
            { name: 'therapyType', unique: false }
        ]
    },
    statistics: {
        keyPath: ['date', 'therapyType', 'type', 'month'],
        indexes: [
            { name: 'date', unique: false },
            { name: 'therapyType', unique: false },
            { name: 'type', unique: false },
            { name: 'month', unique: false } 
        ]
    },
    monthlyStats: {
        keyPath: ['year', 'month', 'therapyType'],
        indexes: [
            { name: 'year', unique: false },
            { name: 'therapyType', unique: false }
        ]
    },
    yearlyStats: {
        keyPath: ['year', 'therapyType'],
        indexes: [
            { name: 'year', unique: false },
            { name: 'therapyType', unique: false }
        ]
    },
    settings: {
        keyPath: 'id',
        indexes: []
    },
    transitionData: {
        keyPath: ['date', 'therapyType'],
        indexes: [
            { name: 'date', unique: false },
            { name: 'therapyType', unique: false },
            { name: 'transitionType', unique: false }
        ]
    }
};