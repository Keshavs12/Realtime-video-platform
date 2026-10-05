/**
 * IndexedDB Local Storage Manager for SuperCall Meeting Recordings.
 * Stores recorded WebM video blobs locally in the user's browser,
 * allowing instant playback, offline storage, and downloads without paid cloud storage.
 */

export interface SavedRecording {
  id: string;
  roomCode: string;
  title: string;
  blob: Blob;
  durationSeconds: number;
  recordedAt: string; // ISO String
  sizeBytes: number;
}

const DB_NAME = "SuperCallRecordingsDB";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this browser"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("recordedAt", "recordedAt", { unique: false });
        store.createIndex("roomCode", "roomCode", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Saves a new meeting recording blob into IndexedDB.
 */
export async function saveRecording(
  data: Omit<SavedRecording, "id">
): Promise<SavedRecording> {
  const db = await openDB();
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  const id = `rec_${Date.now()}_${suffix}`;
  const item: SavedRecording = {
    ...data,
    id,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error || new Error("Failed to save recording in IndexedDB"));
  });
}

/**
 * Retrieves all saved meeting recordings ordered from newest to oldest.
 */
export async function getAllRecordings(): Promise<SavedRecording[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items: SavedRecording[] = request.result || [];
      // Sort newest first
      items.sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      resolve(items);
    };
    request.onerror = () => reject(request.error || new Error("Failed to get recordings from IndexedDB"));
  });
}

/**
 * Retrieves a single recording by its ID.
 */
export async function getRecordingById(
  id: string
): Promise<SavedRecording | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Failed to get recording by id from IndexedDB"));
  });
}

/**
 * Deletes a recorded meeting from IndexedDB.
 */
export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Failed to delete recording from IndexedDB"));
  });
}

/**
 * Helper to format file size in B, KB, MB, GB.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Helper to format seconds into MM:SS or HH:MM:SS.
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}
