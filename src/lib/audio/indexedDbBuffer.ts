/**
 * IndexedDB Audio Buffer
 * Persists recorded audio takes locally before they are successfully uploaded.
 * This guarantees zero data loss if the browser tab is closed during upload.
 */

const DB_NAME = "IIITHSpeechCorpus";
const STORE_NAME = "pending_uploads";
const DB_VERSION = 1;

export interface PendingTake {
  clientUploadId: string;
  sentenceId: string;
  speakerId: string;
  languageId: string;
  emotionId: string;
  gender: string;
  sampleNumber: number;
  durationSeconds: number;
  blob: Blob;
  checksum: string;
  timestamp: number;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clientUploadId" });
      }
    };
  });
}

export async function saveTakeToIndexedDB(take: PendingTake): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(take);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeTakeFromIndexedDB(clientUploadId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(clientUploadId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingTakes(): Promise<PendingTake[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
