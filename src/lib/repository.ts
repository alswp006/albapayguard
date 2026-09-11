import type { AppSettings, PayAnalysis, PayCheck, Workplace, WorkRecord } from '@/lib/types';
import { COLOR_TOKENS, DEFAULT_SETTINGS, MAX_WORKPLACES, STORAGE_KEYS } from '@/lib/types';
import {
  getItem,
  isPayCheckArray,
  isRecordArray,
  isSettingsObject,
  isWorkplaceArray,
  readRaw,
  writeRaw,
} from '@/lib/storage';

// ---------------------------------------------------------------------------
// 공용 결과 타입 — 모든 쓰기 경로는 throw 대신 이 형태를 반환한다
// ---------------------------------------------------------------------------

export type WriteOutcome<T> = ({ ok: true } & T) | { ok: false; reason: string };

function nowIso(): string {
  return new Date().toISOString();
}

function failFromWrite(reason: string | undefined): { ok: false; reason: string } {
  return { ok: false, reason: reason ?? 'unknown' };
}

// ---------------------------------------------------------------------------
// Workplace
// ---------------------------------------------------------------------------

export type NewWorkplaceInput = Partial<Omit<Workplace, 'id' | 'createdAt' | 'updatedAt'>> &
  Pick<Workplace, 'name' | 'hourlyWage'>;

export async function getWorkplaces(): Promise<Workplace[]> {
  return readRaw(STORAGE_KEYS.WORKPLACES, [], isWorkplaceArray);
}

export async function saveWorkplace(input: NewWorkplaceInput): Promise<WriteOutcome<Workplace>> {
  const workplaces = readRaw(STORAGE_KEYS.WORKPLACES, [], isWorkplaceArray);
  if (workplaces.length >= MAX_WORKPLACES) {
    return { ok: false, reason: 'max_workplaces' };
  }
  const now = nowIso();
  const workplace: Workplace = {
    id: crypto.randomUUID(),
    name: input.name,
    hourlyWage: input.hourlyWage,
    isFiveOrMore: input.isFiveOrMore ?? false,
    payday: input.payday ?? 25,
    taxType: input.taxType ?? 'none',
    colorToken: input.colorToken ?? COLOR_TOKENS[workplaces.length % COLOR_TOKENS.length],
    createdAt: now,
    updatedAt: now,
  };
  const write = writeRaw(STORAGE_KEYS.WORKPLACES, [...workplaces, workplace]);
  if (!write.ok) return failFromWrite(write.reason);
  return { ok: true, ...workplace };
}

export async function updateWorkplace(
  id: string,
  patch: Partial<Omit<Workplace, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<WriteOutcome<Workplace>> {
  const workplaces = readRaw(STORAGE_KEYS.WORKPLACES, [], isWorkplaceArray);
  const index = workplaces.findIndex((w) => w.id === id);
  if (index === -1) return { ok: false, reason: 'not_found' };

  const updated: Workplace = { ...workplaces[index], ...patch, id, createdAt: workplaces[index].createdAt, updatedAt: nowIso() };
  const next = [...workplaces];
  next[index] = updated;

  const write = writeRaw(STORAGE_KEYS.WORKPLACES, next);
  if (!write.ok) return failFromWrite(write.reason);
  return { ok: true, ...updated };
}

export async function deleteWorkplace(id: string): Promise<{ ok: boolean; reason?: string }> {
  // F1 AC-3: workplaces/records/payChecks/settings 중 어느 하나라도 쓰기 실패하면
  // 세 키(workplaces/records/payChecks) 모두 삭제 전 값으로 롤백한다 — 그래서 각 키를
  // 쓰기 전 스냅샷으로 남겨두고, 실패 시 전부 되쓴다.
  const workplacesSnapshot = readRaw(STORAGE_KEYS.WORKPLACES, [], isWorkplaceArray);
  const recordsSnapshot = readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
  const payChecksSnapshot = readRaw(STORAGE_KEYS.PAYCHECKS, [], isPayCheckArray);

  const nextWorkplaces = workplacesSnapshot.filter((w) => w.id !== id);
  const nextRecords = recordsSnapshot.filter((r) => r.workplaceId !== id);
  const nextPayChecks = payChecksSnapshot.filter((p) => p.workplaceId !== id);

  function rollback(): void {
    writeRaw(STORAGE_KEYS.WORKPLACES, workplacesSnapshot);
    writeRaw(STORAGE_KEYS.RECORDS, recordsSnapshot);
    writeRaw(STORAGE_KEYS.PAYCHECKS, payChecksSnapshot);
  }

  const writeWorkplaces = writeRaw(STORAGE_KEYS.WORKPLACES, nextWorkplaces);
  if (!writeWorkplaces.ok) return { ok: false, reason: writeWorkplaces.reason ?? 'unknown' };

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

  const settings = readRaw(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS, isSettingsObject);
  if (settings.activeWorkplaceId === id) {
    const sorted = [...nextWorkplaces].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const nextActive = sorted[0]?.id ?? null;
    const writeSettings = writeRaw(STORAGE_KEYS.SETTINGS, { ...settings, activeWorkplaceId: nextActive });
    if (!writeSettings.ok) {
      rollback();
      return { ok: false, reason: writeSettings.reason ?? 'unknown' };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// WorkRecord
// ---------------------------------------------------------------------------

export type NewRecordInput = Partial<Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>> &
  Pick<WorkRecord, 'workplaceId' | 'date' | 'startTime' | 'endTime' | 'breakMinutes'>;

export async function getRecords(): Promise<WorkRecord[]> {
  return readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
}

export async function getRecordById(id: string): Promise<WorkRecord | undefined> {
  const records = readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
  return records.find((r) => r.id === id);
}

export async function saveRecord(input: NewRecordInput): Promise<WriteOutcome<WorkRecord>> {
  const records = readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
  const now = nowIso();
  const record: WorkRecord = {
    id: crypto.randomUUID(),
    workplaceId: input.workplaceId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    isHoliday: input.isHoliday ?? false,
    memo: input.memo ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const write = writeRaw(STORAGE_KEYS.RECORDS, [...records, record]);
  if (!write.ok) return failFromWrite(write.reason);
  return { ok: true, ...record };
}

export async function updateRecord(
  id: string,
  patch: Partial<Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<WriteOutcome<WorkRecord>> {
  const records = readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return { ok: false, reason: 'not_found' };

  const updated: WorkRecord = { ...records[index], ...patch, id, createdAt: records[index].createdAt, updatedAt: nowIso() };
  const next = [...records];
  next[index] = updated;

  const write = writeRaw(STORAGE_KEYS.RECORDS, next);
  if (!write.ok) return failFromWrite(write.reason);
  return { ok: true, ...updated };
}

export async function deleteRecord(id: string): Promise<{ ok: boolean; reason?: string }> {
  const records = readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
  const next = records.filter((r) => r.id !== id);
  const write = writeRaw(STORAGE_KEYS.RECORDS, next);
  if (!write.ok) return { ok: false, reason: write.reason ?? 'unknown' };
  return { ok: true };
}

export async function isDuplicateRecord(params: {
  id?: string;
  workplaceId: string;
  date: string;
  startTime: string;
}): Promise<boolean> {
  const records = readRaw(STORAGE_KEYS.RECORDS, [], isRecordArray);
  return records.some(
    (r) =>
      r.id !== params.id &&
      r.workplaceId === params.workplaceId &&
      r.date === params.date &&
      r.startTime === params.startTime
  );
}

// ---------------------------------------------------------------------------
// PayCheck
// ---------------------------------------------------------------------------

export async function getPayChecks(): Promise<PayCheck[]> {
  return readRaw(STORAGE_KEYS.PAYCHECKS, [], isPayCheckArray);
}

export async function upsertPayCheck(
  workplaceId: string,
  yearMonth: string,
  data: Omit<PayAnalysis, 'workplaceId' | 'yearMonth'>
): Promise<WriteOutcome<PayCheck>> {
  const payChecks = readRaw(STORAGE_KEYS.PAYCHECKS, [], isPayCheckArray);
  const index = payChecks.findIndex((p) => p.workplaceId === workplaceId && p.yearMonth === yearMonth);
  const now = nowIso();

  let updated: PayCheck;
  let next: PayCheck[];
  if (index === -1) {
    updated = { id: crypto.randomUUID(), workplaceId, yearMonth, ...data, createdAt: now, updatedAt: now };
    next = [...payChecks, updated];
  } else {
    const existing = payChecks[index];
    updated = { ...existing, ...data, workplaceId, yearMonth, id: existing.id, createdAt: existing.createdAt, updatedAt: now };
    next = [...payChecks];
    next[index] = updated;
  }

  const write = writeRaw(STORAGE_KEYS.PAYCHECKS, next);
  if (!write.ok) return failFromWrite(write.reason);
  return { ok: true, ...updated };
}

// ---------------------------------------------------------------------------
// AppSettings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const raw = readRaw(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS, isSettingsObject);
  const { onboardingSeenAt, disclaimerAckAt, activeWorkplaceId, rewardUnlocks, schemaVersion } = raw;
  return { onboardingSeenAt, disclaimerAckAt, activeWorkplaceId, rewardUnlocks, schemaVersion };
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<WriteOutcome<AppSettings>> {
  const current = readRaw(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS, isSettingsObject);
  const updated: AppSettings = { ...current, ...patch };
  const write = writeRaw(STORAGE_KEYS.SETTINGS, updated);
  if (!write.ok) return failFromWrite(write.reason);
  return { ok: true, ...updated };
}

// ---------------------------------------------------------------------------
// 스키마 마이그레이션 — readRaw의 엄격한 타입 가드를 거치지 않고(누락 필드가
// 있으면 corrupt로 취급돼 fallback으로 날아가버린다) getItem으로 원시 데이터를
// 그대로 읽어 보정한 뒤 writeRaw로 되쓴다.
// ---------------------------------------------------------------------------

function backfillUpdatedAt(item: unknown): unknown {
  if (typeof item !== 'object' || item === null) return item;
  const obj = item as Record<string, unknown>;
  if (obj.updatedAt === undefined && obj.createdAt !== undefined) {
    return { ...obj, updatedAt: obj.createdAt };
  }
  return obj;
}

function migrateEntityCollection(key: string): void {
  const raw = getItem<unknown[]>(key);
  if (!Array.isArray(raw)) return;
  writeRaw(key, raw.map(backfillUpdatedAt));
}

function migrateSettings(): void {
  const raw = getItem<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return;
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = raw;
  writeRaw(STORAGE_KEYS.SETTINGS, rest);
}

export async function runMigration(): Promise<void> {
  migrateEntityCollection(STORAGE_KEYS.WORKPLACES);
  migrateEntityCollection(STORAGE_KEYS.RECORDS);
  migrateEntityCollection(STORAGE_KEYS.PAYCHECKS);
  migrateSettings();
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

export function validateWorkplace(input: { name: string; hourlyWage: number }): string | null {
  if (!input.name || input.name.trim() === '') {
    return '근무지 이름을 입력해주세요';
  }
  if (!input.hourlyWage || input.hourlyWage <= 0) {
    return '시급을 1원 이상 입력해주세요';
  }
  return null;
}

const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validateRecord(input: {
  workplaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}): string | null {
  if (!TIME_FORMAT.test(input.startTime) || !TIME_FORMAT.test(input.endTime)) {
    return '시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요';
  }

  let workedMinutes = toMinutes(input.endTime) - toMinutes(input.startTime);
  if (workedMinutes <= 0) {
    workedMinutes += 24 * 60; // 자정을 넘기는 근무
  }

  if (input.breakMinutes > workedMinutes) {
    return '휴게시간이 근무시간보다 길 수 없어요';
  }

  return null;
}
