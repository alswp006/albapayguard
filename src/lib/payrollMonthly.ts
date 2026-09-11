/**
 * 급여 계산 엔진 ② 주휴수당·최저임금·월 집계
 *
 * 주휴수당 귀속 규칙: 각 주(월요일 시작)의 주휴수당은 그 주의 월요일이 속한
 * 달로 귀속된다. 그래서 records에 포함된 근무일이 어느 달이든, weeks/weeklyHolidayPay는
 * weekStart(월요일)의 연-월이 대상 yearMonth와 일치하는 주만 포함한다.
 * daily/basePay 등 일별 집계는 근무일 자체가 대상 yearMonth에 속하는 기록만 포함한다.
 *
 * 금지 사항: 저장소(src/lib/storage.ts 등)·UI import 금지. payrollDaily만 import.
 */

import { calcDaily } from "@/lib/payrollDaily";
import type { WorkRecord, Workplace, DailyPay, WeeklyHoliday, MonthlyPayroll } from "@/lib/types";
import { MINIMUM_WAGE_BY_YEAR } from "@/lib/types";
import type { PayrollEntry } from "@/lib/contract";

function minimumWageForYearMonth(yearMonth: string): number {
  const year = Number(yearMonth.slice(0, 4));
  return MINIMUM_WAGE_BY_YEAR[year] ?? MINIMUM_WAGE_BY_YEAR[2026];
}

/**
 * ISO 주(월요일 시작)의 시작일을 "YYYY-MM-DD"로 반환한다.
 * UTC 기준으로 계산해 로컬 타임존 오프셋에 의한 날짜 밀림을 방지한다.
 */
export function getWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=일 ~ 6=토
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** 근무 기록을 주(월요일 시작) 단위로 묶는다. */
export function groupByWeek(records: WorkRecord[]): Map<string, WorkRecord[]> {
  const groups = new Map<string, WorkRecord[]>();
  for (const record of records) {
    const weekStart = getWeekStart(record.date);
    const bucket = groups.get(weekStart);
    if (bucket) bucket.push(record);
    else groups.set(weekStart, [record]);
  }
  return groups;
}

const WEEKLY_HOLIDAY_ELIGIBLE_MINUTES = 15 * 60;
const WEEKLY_HOLIDAY_CAP_MINUTES = 40 * 60;

/** 주휴수당: 주 실근로 ≥ 15h면 min(주분,2400)/5/60×시급 floor, 미만이면 0 */
export function calcWeeklyHoliday(
  weeklyMinutes: number,
  wage: number
): { eligible: boolean; amount: number } {
  if (weeklyMinutes < WEEKLY_HOLIDAY_ELIGIBLE_MINUTES) {
    return { eligible: false, amount: 0 };
  }
  const cappedMinutes = Math.min(weeklyMinutes, WEEKLY_HOLIDAY_CAP_MINUTES);
  const amount = Math.floor((cappedMinutes * wage) / 5 / 60);
  return { eligible: true, amount };
}

const FREELANCE_3_3_NET_RATE = 0.967;

export function calcMonthly(
  records: WorkRecord[],
  workplace: Workplace,
  yearMonth: string
): MonthlyPayroll {
  const wage = workplace.hourlyWage;
  const dailyWorkplace = { wage, isFiveOrMore: workplace.isFiveOrMore };
  const minimumWage = minimumWageForYearMonth(yearMonth);

  const payByRecord = new Map<WorkRecord, DailyPay>();
  for (const record of records) {
    const raw = calcDaily(
      { startTime: record.startTime, endTime: record.endTime, breakMinutes: record.breakMinutes },
      dailyWorkplace
    );
    if (!raw) continue;
    payByRecord.set(record, {
      date: record.date,
      workedMinutes: raw.workedMinutes,
      nightMinutes: raw.nightMinutes,
      overtimeMinutes: raw.overtimeMinutes ?? 0,
      basePay: raw.basePay,
      nightPay: raw.nightPay,
      overtimePay: raw.overtimePay ?? 0,
      holidayPay: raw.holidayPay ?? 0,
      total: raw.total,
    });
  }

  const validRecords = Array.from(payByRecord.keys());
  const weekGroups = groupByWeek(validRecords);

  const weeks: WeeklyHoliday[] = [];
  let weeklyHolidayPay = 0;
  for (const [weekStart, weekRecords] of weekGroups) {
    if (weekStart.slice(0, 7) !== yearMonth) continue; // 해당 주 월요일이 속한 월에만 귀속
    const weeklyMinutes = weekRecords.reduce(
      (sum, r) => sum + (payByRecord.get(r)?.workedMinutes ?? 0),
      0
    );
    const { eligible, amount } = calcWeeklyHoliday(weeklyMinutes, wage);
    weeks.push({ weekStart, weeklyMinutes, eligible, amount });
    weeklyHolidayPay += amount;
  }
  weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const daily: DailyPay[] = [];
  for (const record of records) {
    if (record.date.slice(0, 7) !== yearMonth) continue;
    const pay = payByRecord.get(record);
    if (pay) daily.push(pay);
  }
  daily.sort((a, b) => a.date.localeCompare(b.date));

  const basePay = daily.reduce((sum, d) => sum + d.basePay, 0);
  const nightPay = daily.reduce((sum, d) => sum + d.nightPay, 0);
  const overtimePay = daily.reduce((sum, d) => sum + d.overtimePay, 0);
  const holidayPay = daily.reduce((sum, d) => sum + d.holidayPay, 0);
  const totalMinutes = daily.reduce((sum, d) => sum + d.workedMinutes, 0);

  const gross = basePay + nightPay + overtimePay + holidayPay + weeklyHolidayPay;
  const isBelowMinimumWage = wage < minimumWage;
  const minimumWageShortfall = isBelowMinimumWage
    ? Math.floor(((minimumWage - wage) * totalMinutes) / 60)
    : 0;
  const net =
    workplace.taxType === "freelance3_3" ? Math.floor(gross * FREELANCE_3_3_NET_RATE) : gross;

  return {
    yearMonth,
    daily,
    weeks,
    basePay,
    nightPay,
    overtimePay,
    holidayPay,
    weeklyHolidayPay,
    gross,
    net,
    totalMinutes,
    minimumWage,
    isBelowMinimumWage,
    minimumWageShortfall,
  };
}

/**
 * 월 통계 산출 — 패킷 간 계약(contract.ts) 진입점.
 * calculateDailyPayroll(payrollDaily.ts)이 만든 PayrollEntry[]를 받아 월 합계를 낸다.
 * totalWages는 기본급만, grossPay는 sundayPay/weeklyRest/minWageGap 가산까지 더한 값이다.
 */
export function calculateMonthlyPayroll(
  entries: PayrollEntry[]
): { totalWages: number; minWageAdjustment: number; grossPay: number } {
  let totalWages = 0;
  let minWageAdjustment = 0;
  let grossPay = 0;

  for (const entry of entries) {
    const wages = Number.isFinite(entry.dailyWages) ? entry.dailyWages : 0;
    const sundayPay = entry.adjustments?.sundayPay ?? 0;
    const weeklyRest = entry.adjustments?.weeklyRest ?? 0;
    const minWageGap = entry.adjustments?.minWageGap ?? 0;

    totalWages += wages;
    minWageAdjustment += minWageGap;
    grossPay += wages + sundayPay + weeklyRest + minWageGap;
  }

  return { totalWages, minWageAdjustment, grossPay };
}
