import type { AppSettings, PaySuspect, SuspectKind } from '@/lib/types';
import { getSettings, patchSettings } from '@/lib/repository';
import type { Record } from '@/lib/contract';
import { calculateDailyPayroll } from '@/lib/payrollDaily';

// ---------------------------------------------------------------------------
// 미지급 분석
// ---------------------------------------------------------------------------

export interface PayrollForAnalysis {
  calculatedNet: number;
  weeklyHoliday: number;
  night: number;
  overtime: number;
  holiday: number;
  minimumWage: number;
}

export interface PayAnalysisResult {
  diff: number;
  isUnderpaid: boolean;
  suspects: PaySuspect[];
}

const SUSPECT_LABELS: globalThis.Record<SuspectKind, { label: string; description: string }> = {
  weeklyHoliday: {
    label: '주휴수당',
    description: '주휴수당이 실지급액에 반영되지 않았을 수 있어요.',
  },
  night: {
    label: '야간수당',
    description: '야간 근무 가산수당이 실지급액에 반영되지 않았을 수 있어요.',
  },
  overtime: {
    label: '연장수당',
    description: '연장 근무 가산수당이 실지급액에 반영되지 않았을 수 있어요.',
  },
  holiday: {
    label: '휴일수당',
    description: '휴일 근무 가산수당이 실지급액에 반영되지 않았을 수 있어요.',
  },
  minimumWage: {
    label: '최저임금 미달분',
    description: '최저임금 기준보다 적게 지급됐을 수 있어요.',
  },
};

export function analyzePay(payroll: PayrollForAnalysis, actualPaidAmount: number): PayAnalysisResult {
  const diff = payroll.calculatedNet - actualPaidAmount;
  const isUnderpaid = diff > 0;

  const suspects: PaySuspect[] = [];
  if (isUnderpaid) {
    (Object.keys(SUSPECT_LABELS) as SuspectKind[]).forEach((kind) => {
      const amount = payroll[kind];
      if (amount > 0) {
        const { label, description } = SUSPECT_LABELS[kind];
        suspects.push({ kind, label, amount, description });
      }
    });
  }

  return { diff, isUnderpaid, suspects };
}

// ---------------------------------------------------------------------------
// 미지급 분석 — records + 실지급액(targetAmount) 기준 (contract.ts 진입점, 0012-0013 화면 사용)
// ---------------------------------------------------------------------------

export function analyzeUnpaid(
  records: Record[],
  targetAmount: number
): { unpaidDays: string[]; amountShortfall: number; estimatedReward: number } {
  const unpaidDays: string[] = [];
  let calculatedTotal = 0;

  for (const record of records) {
    const entry = calculateDailyPayroll(record);
    const minWageGap = entry.adjustments?.minWageGap ?? 0;
    calculatedTotal += entry.dailyWages + minWageGap;
    if (minWageGap > 0) {
      unpaidDays.push(entry.date);
    }
  }

  const amountShortfall = Math.max(calculatedTotal - targetAmount, 0);

  return { unpaidDays, amountShortfall, estimatedReward: amountShortfall };
}

// ---------------------------------------------------------------------------
// 리워드 해제 (24시간 만료)
// ---------------------------------------------------------------------------

const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

function unlockKey(workplaceId: string, yearMonth: string): string {
  return `${workplaceId}:${yearMonth}`;
}

export function isUnlocked(
  settings: Pick<AppSettings, 'rewardUnlocks'>,
  workplaceId: string,
  yearMonth: string
): boolean {
  const expireISO = settings.rewardUnlocks?.[unlockKey(workplaceId, yearMonth)];
  if (!expireISO) return false;
  const expireTime = new Date(expireISO).getTime();
  if (Number.isNaN(expireTime)) return false;
  return expireTime > Date.now();
}

export async function grantUnlock(workplaceId: string, yearMonth: string): Promise<void> {
  const current = await getSettings();
  const expireISO = new Date(Date.now() + UNLOCK_DURATION_MS).toISOString();
  await patchSettings({
    rewardUnlocks: { ...current.rewardUnlocks, [unlockKey(workplaceId, yearMonth)]: expireISO },
  });
}

// ---------------------------------------------------------------------------
// 금액 포맷 / 파싱
// ---------------------------------------------------------------------------

export function formatWon(amount: number): string {
  return amount.toLocaleString('en-US');
}

export function parseWon(value: string): number {
  const cleaned = value.split(',').join('');
  if (!/^\d+$/.test(cleaned)) return 0;
  return Number(cleaned);
}
