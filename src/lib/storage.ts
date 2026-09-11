import type { Workplace, WorkRecord, PayCheck, AppSettings } from '@/lib/types';
import { MAX_SERIALIZED_LENGTH } from '@/lib/types';

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// ---------------------------------------------------------------------------
// Raw I/O — 손상 복구 & 쓰기 가드
// ---------------------------------------------------------------------------

export interface WriteRawResult {
  ok: boolean;
  reason?: 'quota' | 'size';
}

let corruptionFlag = false;

export function consumeCorruptionFlag(): boolean {
  const flag = corruptionFlag;
  corruptionFlag = false;
  return flag;
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

export function writeRaw(key: string, value: unknown): WriteRawResult {
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_SERIALIZED_LENGTH) {
    return { ok: false, reason: 'size' };
  }
  try {
    localStorage.setItem(key, serialized);
    return { ok: true };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return { ok: false, reason: 'quota' };
    }
    return { ok: false, reason: 'quota' };
  }
}

export function readRaw<T>(
  key: string,
  fallback: T,
  isValid: (data: unknown) => data is T
): T {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return fallback;
  }

  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parseFailed = true;
  }

  if (parseFailed || !isValid(parsed)) {
    corruptionFlag = true;
    const backupKey = `${key}:corrupt:${Date.now()}`;
    try {
      localStorage.setItem(backupKey, raw);
    } catch {
      // 백업 실패는 무시하고 폴백 복구를 계속한다
    }
    writeRaw(key, fallback);
    return fallback;
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// 타입 가드
// ---------------------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string';
}

function isWorkplace(v: unknown): v is Workplace {
  if (typeof v !== 'object' || v === null) return false;
  const w = v as Record<string, unknown>;
  return (
    isNonEmptyString(w.id) &&
    isNonEmptyString(w.name) &&
    typeof w.hourlyWage === 'number' &&
    typeof w.isFiveOrMore === 'boolean' &&
    typeof w.payday === 'number' &&
    (w.taxType === 'none' || w.taxType === 'freelance3_3') &&
    isNonEmptyString(w.colorToken) &&
    isNonEmptyString(w.createdAt) &&
    isNonEmptyString(w.updatedAt)
  );
}

export function isWorkplaceArray(data: unknown): data is Workplace[] {
  return Array.isArray(data) && data.every(isWorkplace);
}

function isWorkRecord(v: unknown): v is WorkRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    isNonEmptyString(r.id) &&
    isNonEmptyString(r.workplaceId) &&
    isNonEmptyString(r.date) &&
    isNonEmptyString(r.startTime) &&
    isNonEmptyString(r.endTime) &&
    typeof r.breakMinutes === 'number' &&
    typeof r.isHoliday === 'boolean' &&
    typeof r.memo === 'string' &&
    isNonEmptyString(r.createdAt) &&
    isNonEmptyString(r.updatedAt)
  );
}

export function isRecordArray(data: unknown): data is WorkRecord[] {
  return Array.isArray(data) && data.every(isWorkRecord);
}

function isPaySuspect(v: unknown): v is PayCheck['suspects'][number] {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isNonEmptyString(s.kind) &&
    isNonEmptyString(s.label) &&
    typeof s.amount === 'number' &&
    isNonEmptyString(s.description)
  );
}

function isPayCheck(v: unknown): v is PayCheck {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isNonEmptyString(p.id) &&
    isNonEmptyString(p.workplaceId) &&
    isNonEmptyString(p.yearMonth) &&
    typeof p.actualPaidAmount === 'number' &&
    typeof p.calculatedGross === 'number' &&
    typeof p.calculatedNet === 'number' &&
    typeof p.diff === 'number' &&
    Array.isArray(p.suspects) &&
    p.suspects.every(isPaySuspect) &&
    isNonEmptyString(p.createdAt) &&
    isNonEmptyString(p.updatedAt)
  );
}

export function isPayCheckArray(data: unknown): data is PayCheck[] {
  return Array.isArray(data) && data.every(isPayCheck);
}

export function isSettingsObject(data: unknown): data is AppSettings {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const s = data as Record<string, unknown>;
  return (
    (s.onboardingSeenAt === null || isNonEmptyString(s.onboardingSeenAt)) &&
    (s.disclaimerAckAt === null || isNonEmptyString(s.disclaimerAckAt)) &&
    (s.activeWorkplaceId === null || isNonEmptyString(s.activeWorkplaceId)) &&
    typeof s.rewardUnlocks === 'object' &&
    s.rewardUnlocks !== null &&
    typeof s.schemaVersion === 'number'
  );
}
