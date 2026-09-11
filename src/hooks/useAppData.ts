import { useContext, useMemo } from 'react';
import { AppDataContext, type AppDataContextValue } from '@/providers/AppDataProvider';
import { calcMonthly } from '@/lib/payrollMonthly';
import type { MonthlyPayroll } from '@/lib/types';

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData는 AppDataProvider 내부에서만 호출할 수 있어요');
  }
  return ctx;
}

/** workplaceId의 해당 월 급여를 계산한다 — 페이지가 storage/payrollMonthly를 직접 호출하지 않도록. */
export function useMonthlyPayroll(
  workplaceId: string | null,
  yearMonth: string
): MonthlyPayroll | null {
  const { workplaces, records } = useAppData();
  return useMemo(() => {
    const workplace = workplaces.find((w) => w.id === workplaceId);
    if (!workplace) return null;
    const scoped = records.filter((r) => r.workplaceId === workplaceId);
    return calcMonthly(scoped, workplace, yearMonth);
  }, [workplaces, records, workplaceId, yearMonth]);
}
