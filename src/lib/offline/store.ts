"use client";

import type { OfflineSnapshot, QueuedOperation, SyncIssue } from "./types";

/**
 * Stockage local (IndexedDB) du mode hors ligne. Contient l'instantané (matricules
 * hachés) et la file des opérations non synchronisées. Effacé à la déconnexion.
 */
const DB_NAME = "stade26-hors-ligne";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: "kv" | "queue", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const offlineStore = {
  getSnapshot: (agentId: string) => run<OfflineSnapshot | undefined>("kv", "readonly", (s) => s.get(`snapshot:${agentId}`)),
  setSnapshot: (snapshot: OfflineSnapshot) => run("kv", "readwrite", (s) => s.put(snapshot, `snapshot:${snapshot.agent_id}`)),
  getIssues: async (agentId: string) => (await run<SyncIssue[] | undefined>("kv", "readonly", (s) => s.get(`issues:${agentId}`))) ?? [],
  setIssues: (agentId: string, issues: SyncIssue[]) => run("kv", "readwrite", (s) => s.put(issues.slice(-50), `issues:${agentId}`)),
  queue: async (agentId: string) =>
    ((await run<QueuedOperation[]>("queue", "readonly", (s) => s.getAll())) ?? []).filter((op) => op.agentId === agentId),
  enqueue: (op: QueuedOperation) => run("queue", "readwrite", (s) => s.put(op)),
  dequeue: (id: string) => run("queue", "readwrite", (s) => s.delete(id)),
  /** Opérations en attente, tous comptes confondus (avant déconnexion). */
  pendingCount: async () => run<number>("queue", "readonly", (s) => s.count()),
  /** Efface tout (déconnexion) : instantané, file, incidents. */
  clear: async () => {
    await run("kv", "readwrite", (s) => s.clear());
    await run("queue", "readwrite", (s) => s.clear());
  },
};
