import { openDB, IDBPDatabase } from "idb";
import { PropertyRecord } from "./types";

const DB_NAME = "land-scout-pro";
const DB_VERSION = 1;
const STORE = "properties";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
      }
    });
  }
  return dbPromise;
}

// LocalStorage is used as a fast, synchronous fallback/mirror so the app
// never loses data even if IndexedDB is unavailable (some in-app browsers
// restrict it) or a write is interrupted.
const LS_KEY = "land-scout-pro:properties";

function readLocalStorage(): PropertyRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PropertyRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStorage(all: PropertyRecord[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable - IndexedDB remains the source of truth.
  }
}

export async function saveProperty(property: PropertyRecord): Promise<void> {
  property.updatedAt = Date.now();
  try {
    const db = await getDb();
    await db.put(STORE, property);
  } catch (err) {
    console.error("IndexedDB save failed, relying on localStorage fallback", err);
  }
  const all = readLocalStorage();
  const idx = all.findIndex((p) => p.id === property.id);
  if (idx >= 0) all[idx] = property;
  else all.push(property);
  writeLocalStorage(all);
}

export async function getAllProperties(): Promise<PropertyRecord[]> {
  try {
    const db = await getDb();
    const all = await db.getAll(STORE);
    if (all && all.length > 0) return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error("IndexedDB read failed, using localStorage fallback", err);
  }
  return readLocalStorage().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProperty(id: string): Promise<PropertyRecord | undefined> {
  try {
    const db = await getDb();
    const rec = await db.get(STORE, id);
    if (rec) return rec;
  } catch (err) {
    console.error("IndexedDB get failed, using localStorage fallback", err);
  }
  return readLocalStorage().find((p) => p.id === id);
}

export async function deleteProperty(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, id);
  } catch (err) {
    console.error("IndexedDB delete failed", err);
  }
  const all = readLocalStorage().filter((p) => p.id !== id);
  writeLocalStorage(all);
}
