"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOfflineSnapshot, syncOfflineOperations } from "@/server/actions/offline";
import { offlineStore } from "./store";
import { hashMatricule, snapshotState, verifyOffline } from "./verify";
import type { OfflineSnapshot, QueuedOperation, SyncIssue } from "./types";
import type { ControlCheck } from "@/lib/control-types";

const REFRESH_MS = 10 * 60_000;

function isNetworkError(error: unknown) {
  return error instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

/**
 * Mode hors ligne du poste de contrôle (même principe que l'appel hors ligne de
 * LAKOL : file d'opérations à identifiant unique, renvoyée au retour du réseau),
 * complété par une vérification locale à partir d'un instantané des abonnements.
 */
export function useOfflineControl(agentId: string) {
  const [online, setOnline] = useState(true);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const reloadLocal = useCallback(async () => {
    try {
      const [snap, q, iss] = await Promise.all([offlineStore.getSnapshot(agentId), offlineStore.queue(agentId), offlineStore.getIssues(agentId)]);
      setSnapshot(snap ?? null);
      setQueue(q);
      setIssues(iss);
    } catch {
      /* IndexedDB indisponible (navigation privée) : mode hors ligne désactivé. */
    }
  }, [agentId]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const res = await getOfflineSnapshot();
      if (res.ok && res.data.agent_id === agentId) {
        await offlineStore.setSnapshot(res.data);
        setSnapshot(res.data);
        setOnline(true);
      }
    } catch (e) {
      if (isNetworkError(e)) setOnline(false);
    }
  }, [agentId]);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await offlineStore.queue(agentId).catch(() => [] as QueuedOperation[]);
    if (pending.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const res = await syncOfflineOperations(pending);
      if (!res.ok) return;
      setOnline(true);
      const now = new Date().toISOString();
      const newIssues: SyncIssue[] = [];
      for (const r of res.data) {
        const op = pending.find((p) => p.id === r.id);
        if (!op) continue;
        if (r.result !== "applied") newIssues.push({ ...op, result: r.result, reason: r.reason, syncedAt: now });
        await offlineStore.dequeue(r.id);
      }
      if (newIssues.length) {
        const all = [...(await offlineStore.getIssues(agentId)), ...newIssues];
        await offlineStore.setIssues(agentId, all);
      }
      setLastSyncAt(now);
      await reloadLocal();
    } catch (e) {
      if (isNetworkError(e)) setOnline(false);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [agentId, reloadLocal]);

  useEffect(() => {
    const init = async () => {
      setOnline(navigator.onLine);
      await reloadLocal();
      if (navigator.onLine) {
        await sync();
        await refreshSnapshot();
      }
    };
    void init();
    const onOnline = () => {
      setOnline(true);
      void sync().then(refreshSnapshot);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const id = window.setInterval(() => {
      if (navigator.onLine) void sync().then(refreshSnapshot);
    }, REFRESH_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(id);
    };
  }, [reloadLocal, refreshSnapshot, sync]);

  /** Vérification locale. Renvoie null si aucun instantané n'est disponible. */
  const verifyLocally = useCallback(
    async (matricule: string): Promise<{ check: ControlCheck; state: ReturnType<typeof snapshotState> } | null> => {
      const snap = snapshot ?? (await offlineStore.getSnapshot(agentId).catch(() => undefined));
      if (!snap) return null;
      const now = new Date();
      const state = snapshotState(snap, now);
      const hash = await hashMatricule(snap.salt, matricule);
      const q = await offlineStore.queue(agentId).catch(() => queue);
      return { check: verifyOffline({ snapshot: snap, matricule, hash, queue: q, now }), state };
    },
    [agentId, snapshot, queue],
  );

  const enqueue = useCallback(
    async (kind: "entry" | "exit", matricule: string) => {
      const op: QueuedOperation = { id: crypto.randomUUID(), agentId, kind, matricule, occurredAt: new Date().toISOString() };
      await offlineStore.enqueue(op);
      await reloadLocal();
      return op;
    },
    [agentId, reloadLocal],
  );

  const dismissIssues = useCallback(async () => {
    await offlineStore.setIssues(agentId, []);
    setIssues([]);
  }, [agentId]);

  return { online, setOnline, snapshot, queue, issues, syncing, lastSyncAt, sync, verifyLocally, enqueue, dismissIssues };
}
