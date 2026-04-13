import { getDefaultAppState } from './config.js';

const DB_NAME = 'rn_wedding_generator';
const DB_VERSION = 1;
const STORE_NAME = 'app_store';
const STATE_KEY = 'state';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function () {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}

export async function loadAppState() {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(STATE_KEY);

        request.onsuccess = function () {
            const state = request.result;
            resolve(state || getDefaultAppState());
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}

export async function saveAppState(state) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        store.put(state, STATE_KEY);

        tx.oncomplete = function () {
            resolve();
        };

        tx.onerror = function () {
            reject(tx.error);
        };
    });
}

export async function clearAppState() {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        store.delete(STATE_KEY);

        tx.oncomplete = function () {
            resolve();
        };

        tx.onerror = function () {
            reject(tx.error);
        };
    });
}
