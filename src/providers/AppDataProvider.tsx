import { createContext, useEffect, useState, type ReactNode } from 'react';
import { Toast } from '@toss/tds-mobile';
import type { AppSettings, PayAnalysis, PayCheck, Workplace, WorkRecord } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import {
  runMigration,
  getWorkplaces,
  getRecords,
  getPayChecks,
  getSettings,
  saveWorkplace,
  updateWorkplace,
  deleteWorkplace,
  saveRecord,
  updateRecord,
  deleteRecord,
  upsertPayCheck,
  patchSettings as patchSettingsRepo,
  type NewWorkplaceInput,
  type NewRecordInput,
  type WriteOutcome,
} from '@/lib/repository';
import { consumeCorruptionFlag } from '@/lib/storage';

export interface AppDataContextValue {
  loading: boolean;
  workplaces: Workplace[];
  records: WorkRecord[];
  payChecks: PayCheck[];
  settings: AppSettings;
  addWorkplace: (input: NewWorkplaceInput) => Promise<WriteOutcome<Workplace>>;
  editWorkplace: (
    id: string,
    patch: Partial<Omit<Workplace, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<WriteOutcome<Workplace>>;
  removeWorkplace: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  addRecord: (input: NewRecordInput) => Promise<WriteOutcome<WorkRecord>>;
  editRecord: (
    id: string,
    patch: Partial<Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<WriteOutcome<WorkRecord>>;
  removeRecord: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  savePayCheck: (
    workplaceId: string,
    yearMonth: string,
    data: Omit<PayAnalysis, 'workplaceId' | 'yearMonth'>
  ) => Promise<WriteOutcome<PayCheck>>;
  setActiveWorkplace: (id: string | null) => Promise<WriteOutcome<AppSettings>>;
  patchSettings: (patch: Partial<AppSettings>) => Promise<WriteOutcome<AppSettings>>;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

const QUOTA_REASONS = new Set(['quota', 'size']);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [payChecks, setPayChecks] = useState<PayCheck[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [corruptToastOpen, setCorruptToastOpen] = useState(false);
  const [quotaToastOpen, setQuotaToastOpen] = useState(false);
  const [deleteFailToastOpen, setDeleteFailToastOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await runMigration();
        const [wp, rec, pay, st] = await Promise.all([
          getWorkplaces(),
          getRecords(),
          getPayChecks(),
          getSettings(),
        ]);
        if (cancelled) return;
        setWorkplaces(wp);
        setRecords(rec);
        setPayChecks(pay);
        setSettings(st);
        if (consumeCorruptionFlag()) {
          setCorruptToastOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function flagWriteFailure(reason: string | undefined) {
    if (reason && QUOTA_REASONS.has(reason)) {
      setQuotaToastOpen(true);
    }
  }

  async function addWorkplace(input: NewWorkplaceInput): Promise<WriteOutcome<Workplace>> {
    const result = await saveWorkplace(input);
    if (result.ok) {
      const { ok: _ok, ...workplace } = result;
      setWorkplaces((prev) => [...prev, workplace as Workplace]);
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function editWorkplace(
    id: string,
    patch: Partial<Omit<Workplace, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<WriteOutcome<Workplace>> {
    const result = await updateWorkplace(id, patch);
    if (result.ok) {
      const { ok: _ok, ...workplace } = result;
      setWorkplaces((prev) => prev.map((w) => (w.id === id ? (workplace as Workplace) : w)));
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function removeWorkplace(id: string): Promise<{ ok: boolean; reason?: string }> {
    const result = await deleteWorkplace(id);
    if (result.ok) {
      setWorkplaces((prev) => prev.filter((w) => w.id !== id));
      setRecords((prev) => prev.filter((r) => r.workplaceId !== id));
      setPayChecks((prev) => prev.filter((p) => p.workplaceId !== id));
      setSettings((prev) => {
        if (prev.activeWorkplaceId !== id) return prev;
        // F1 AC-9: 활성 근무지 삭제 시 createdAt 오름차순 첫 근무지로 재지정(repository.deleteWorkplace가
        // 이미 storage에 반영했다 — 로컬 상태도 동일 규칙으로 맞춘다).
        const remaining = workplaces
          .filter((w) => w.id !== id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return { ...prev, activeWorkplaceId: remaining[0]?.id ?? null };
      });
    } else {
      setDeleteFailToastOpen(true);
    }
    return result;
  }

  async function addRecord(input: NewRecordInput): Promise<WriteOutcome<WorkRecord>> {
    const result = await saveRecord(input);
    if (result.ok) {
      const { ok: _ok, ...record } = result;
      setRecords((prev) => [...prev, record as WorkRecord]);
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function editRecord(
    id: string,
    patch: Partial<Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<WriteOutcome<WorkRecord>> {
    const result = await updateRecord(id, patch);
    if (result.ok) {
      const { ok: _ok, ...record } = result;
      setRecords((prev) => prev.map((r) => (r.id === id ? (record as WorkRecord) : r)));
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function removeRecord(id: string): Promise<{ ok: boolean; reason?: string }> {
    const result = await deleteRecord(id);
    if (result.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function savePayCheck(
    workplaceId: string,
    yearMonth: string,
    data: Omit<PayAnalysis, 'workplaceId' | 'yearMonth'>
  ): Promise<WriteOutcome<PayCheck>> {
    const result = await upsertPayCheck(workplaceId, yearMonth, data);
    if (result.ok) {
      const { ok: _ok, ...payCheck } = result;
      setPayChecks((prev) => {
        const index = prev.findIndex(
          (p) => p.workplaceId === workplaceId && p.yearMonth === yearMonth
        );
        if (index === -1) return [...prev, payCheck as PayCheck];
        const next = [...prev];
        next[index] = payCheck as PayCheck;
        return next;
      });
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function setActiveWorkplace(id: string | null): Promise<WriteOutcome<AppSettings>> {
    const result = await patchSettingsRepo({ activeWorkplaceId: id });
    if (result.ok) {
      const { ok: _ok, ...next } = result;
      setSettings(next as AppSettings);
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  async function patchSettingsAction(patch: Partial<AppSettings>): Promise<WriteOutcome<AppSettings>> {
    const result = await patchSettingsRepo(patch);
    if (result.ok) {
      const { ok: _ok, ...next } = result;
      setSettings(next as AppSettings);
    } else {
      flagWriteFailure(result.reason);
    }
    return result;
  }

  const value: AppDataContextValue = {
    loading,
    workplaces,
    records,
    payChecks,
    settings,
    addWorkplace,
    editWorkplace,
    removeWorkplace,
    addRecord,
    editRecord,
    removeRecord,
    savePayCheck,
    setActiveWorkplace,
    patchSettings: patchSettingsAction,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
      <Toast
        open={corruptToastOpen}
        position="top"
        text="일부 데이터를 불러오지 못했어요"
        duration={3000}
        onClose={() => setCorruptToastOpen(false)}
      />
      <Toast
        open={quotaToastOpen}
        position="bottom"
        text="저장 공간이 부족합니다. 오래된 기록을 삭제해주세요"
        duration={3000}
        onClose={() => setQuotaToastOpen(false)}
      />
      <Toast
        open={deleteFailToastOpen}
        position="bottom"
        text="삭제하지 못했어요. 다시 시도해주세요"
        duration={3000}
        onClose={() => setDeleteFailToastOpen(false)}
      />
    </AppDataContext.Provider>
  );
}
