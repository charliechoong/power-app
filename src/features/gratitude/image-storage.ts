"use client";

const DATABASE = "commonplace-gratitude-images";
const STORE = "images";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function getLocalGratitudeImage(id: string): Promise<Blob | undefined> {
  return transact("readonly", (store) => store.get(id));
}
export function putLocalGratitudeImage(
  id: string,
  blob: Blob,
): Promise<IDBValidKey> {
  return transact("readwrite", (store) => store.put(blob, id));
}
export function deleteLocalGratitudeImage(id: string): Promise<undefined> {
  return transact("readwrite", (store) => store.delete(id));
}
