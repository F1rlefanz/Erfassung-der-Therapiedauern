// dbUtils.js
export function setupStores(db, stores) {
    Object.entries(stores).forEach(([storeName, storeConfig]) => {
        try {
            if (db.objectStoreNames.contains(storeName)) {
                console.log(`Lösche existierenden Store: ${storeName}`);
                db.deleteObjectStore(storeName);
            }
            
            console.log(`Erstelle Store: ${storeName}`);
            const store = db.createObjectStore(storeName, { 
                keyPath: storeConfig.keyPath 
            });
            
            // Erstelle Indizes
            storeConfig.indexes?.forEach(index => {
                console.log(`Erstelle Index: ${index.name} für Store: ${storeName}`);
                store.createIndex(index.name, index.name, { 
                    unique: index.unique 
                });
            });
        } catch (error) {
            console.error(`Fehler beim Erstellen von Store ${storeName}:`, error);
            throw error;
        }
    });
}