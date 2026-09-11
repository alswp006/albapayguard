import { MAX_WORKPLACES, STORAGE_KEYS } from '@/lib/types';
import { getPayChecks, getRecords, getSettings, getWorkplaces, patchSettings } from '@/lib/repository';
import { writeRaw } from '@/lib/storage';

// ---------------------------------------------------------------------------
// 근무지 연쇄 삭제 & 활성 포인터 정합성
// ---------------------------------------------------------------------------

export type DeleteWorkplaceCascadeResult =
  | { ok: true; nextActiveId: string | null }
  | { ok: false; reason: string };

export async function resolveActiveWorkplaceId(): Promise<string | null> {
  const settings = await getSettings();
  return settings.activeWorkplaceId;
}

export async function countLinked(workplaceId: string): Promise<number> {
  const [records, payChecks] = await Promise.all([getRecords(), getPayChecks()]);
  const recordCount = records.filter((r) => r.workplaceId === workplaceId).length;
  const payCheckCount = payChecks.filter((p) => p.workplaceId === workplaceId).length;
  return recordCount + payCheckCount;
}

export async function canAddWorkplace(): Promise<boolean> {
  const workplaces = await getWorkplaces();
  return workplaces.length < MAX_WORKPLACES;
}

export async function deleteWorkplaceCascade(workplaceId: string): Promise<DeleteWorkplaceCascadeResult> {
  const [workplacesSnapshot, recordsSnapshot, payChecksSnapshot] = await Promise.all([
    getWorkplaces(),
    getRecords(),
    getPayChecks(),
  ]);

  const nextWorkplaces = workplacesSnapshot.filter((w) => w.id !== workplaceId);
  const nextRecords = recordsSnapshot.filter((r) => r.workplaceId !== workplaceId);
  const nextPayChecks = payChecksSnapshot.filter((p) => p.workplaceId !== workplaceId);

  function rollback(): void {
    writeRaw(STORAGE_KEYS.WORKPLACES, workplacesSnapshot);
    writeRaw(STORAGE_KEYS.RECORDS, recordsSnapshot);
    writeRaw(STORAGE_KEYS.PAYCHECKS, payChecksSnapshot);
  }

  const writeWorkplaces = writeRaw(STORAGE_KEYS.WORKPLACES, nextWorkplaces);
  if (!writeWorkplaces.ok) {
    return { ok: false, reason: writeWorkplaces.reason ?? 'unknown' };
  }

  const writeRecords = writeRaw(STORAGE_KEYS.RECORDS, nextRecords);
  if (!writeRecords.ok) {
    rollback();
    return { ok: false, reason: writeRecords.reason ?? 'unknown' };
  }

  const writePayChecks = writeRaw(STORAGE_KEYS.PAYCHECKS, nextPayChecks);
  if (!writePayChecks.ok) {
    rollback();
    return { ok: false, reason: writePayChecks.reason ?? 'unknown' };
  }

  const settings = await getSettings();
  let nextActiveId = settings.activeWorkplaceId;

  if (settings.activeWorkplaceId === workplaceId) {
    const sorted = [...nextWorkplaces].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    nextActiveId = sorted[0]?.id ?? null;

    const patchResult = await patchSettings({ activeWorkplaceId: nextActiveId });
    if (!patchResult.ok) {
      rollback();
      return { ok: false, reason: patchResult.reason ?? 'unknown' };
    }
  }

  return { ok: true, nextActiveId };
}
