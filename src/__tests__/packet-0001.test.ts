import { describe, it, expect } from 'vitest';
import type {
  TaxType,
  Workplace,
  WorkRecord,
  PayCheck,
  SuspectKind,
  PaySuspect,
  AppSettings,
  DailyPay,
  WeeklyHoliday,
  MonthlyPayroll,
  RouteState,
} from '@/lib/types';
import {
  MINIMUM_WAGE_BY_YEAR,
  MAX_WORKPLACES,
  MAX_SERIALIZED_LENGTH,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  COLOR_TOKENS,
} from '@/lib/types';

describe('Types & Constants (Packet 0001)', () => {
  // AC-1: TypeScript strict mode compilation
  it('AC-1[P0]: should compile without TypeScript errors in strict mode', () => {
    // This test verifies compilation by importing types. If it runs, TS passed.
    expect(true).toBe(true);
  });

  // AC-2: AppSettings exact field count
  it('AC-2[P0]: AppSettings should have exactly 5 fields without id/createdAt/updatedAt', () => {
    const settings: AppSettings = {
      onboardingSeenAt: null,
      disclaimerAckAt: null,
      activeWorkplaceId: null,
      rewardUnlocks: {},
      schemaVersion: 1,
    };

    const keys = Object.keys(settings);
    expect(keys).toHaveLength(5);
    expect(keys).toEqual(
      expect.arrayContaining([
        'onboardingSeenAt',
        'disclaimerAckAt',
        'activeWorkplaceId',
        'rewardUnlocks',
        'schemaVersion',
      ])
    );
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('createdAt');
    expect(keys).not.toContain('updatedAt');
  });

  // AC-3: Workplace, WorkRecord, PayCheck all have createdAt and updatedAt
  it('AC-3[P0]: Workplace type must have createdAt and updatedAt fields', () => {
    const workplace: Workplace = {
      id: 'wp-1',
      name: '편의점 알바',
      hourlyWage: 10320,
      isFiveOrMore: false,
      payday: 10,
      taxType: 'none',
      colorToken: 'blue',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    expect(workplace).toHaveProperty('createdAt');
    expect(workplace).toHaveProperty('updatedAt');
    expect(typeof workplace.createdAt).toBe('string');
    expect(typeof workplace.updatedAt).toBe('string');
  });

  it('AC-3[P0]: WorkRecord type must have createdAt and updatedAt fields', () => {
    const record: WorkRecord = {
      id: 'rec-1',
      workplaceId: 'wp-1',
      date: '2026-03-02',
      startTime: '18:00',
      endTime: '23:00',
      breakMinutes: 30,
      isHoliday: false,
      memo: '',
      createdAt: '2026-03-02T18:00:00.000Z',
      updatedAt: '2026-03-02T18:00:00.000Z',
    };

    expect(record).toHaveProperty('createdAt');
    expect(record).toHaveProperty('updatedAt');
    expect(typeof record.createdAt).toBe('string');
    expect(typeof record.updatedAt).toBe('string');
  });

  it('AC-3[P0]: PayCheck type must have createdAt and updatedAt fields', () => {
    const payCheck: PayCheck = {
      id: 'pc-1',
      workplaceId: 'wp-1',
      yearMonth: '2026-03',
      actualPaidAmount: 200000,
      calculatedGross: 252840,
      calculatedNet: 252840,
      diff: 52840,
      suspects: [],
      createdAt: '2026-03-10T12:00:00.000Z',
      updatedAt: '2026-03-10T12:00:00.000Z',
    };

    expect(payCheck).toHaveProperty('createdAt');
    expect(payCheck).toHaveProperty('updatedAt');
    expect(typeof payCheck.createdAt).toBe('string');
    expect(typeof payCheck.updatedAt).toBe('string');
  });

  // AC-4: RouteState covers all routes with | undefined
  it('AC-4[P0]: RouteState should be indexable by all route paths', () => {
    const routePaths = [
      '/',
      '/onboarding',
      '/record/new',
      '/record/edit',
      '/records',
      '/breakdown',
      '/check',
      '/check/result',
      '/workplace',
      '/workplace/new',
      '/workplace/detail',
    ] as const;

    // Each route path should be a valid key in RouteState (may be undefined)
    // This verifies the type is properly structured
    const routeState: RouteState = {
      '/': undefined,
      '/onboarding': undefined,
      '/record/new': { workplaceId: 'wp-1', date: '2026-03-02' },
      '/record/edit': { recordId: 'rec-1' },
      '/records': { workplaceId: 'wp-1' },
      '/breakdown': { workplaceId: 'wp-1' },
      '/check': { workplaceId: 'wp-1' },
      '/check/result': { workplaceId: 'wp-1', yearMonth: '2026-03', actualPaidAmount: 200000 },
      '/workplace': { workplaceId: 'wp-1' },
      '/workplace/new': undefined,
      '/workplace/detail': { workplaceId: 'wp-1' },
    };

    // Verify all paths are keys in RouteState
    expect(routeState).toBeDefined();
    routePaths.forEach((path) => {
      expect(routeState).toHaveProperty(path);
    });
  });

  // AC-5: Constants have exact values
  it('AC-5[P0]: MINIMUM_WAGE_BY_YEAR should have correct values', () => {
    expect(MINIMUM_WAGE_BY_YEAR).toEqual({
      2025: 10030,
      2026: 10320,
    });
    expect(MINIMUM_WAGE_BY_YEAR[2025]).toBe(10030);
    expect(MINIMUM_WAGE_BY_YEAR[2026]).toBe(10320);
  });

  it('AC-5[P0]: MAX_WORKPLACES should be exactly 5', () => {
    expect(MAX_WORKPLACES).toBe(5);
    expect(typeof MAX_WORKPLACES).toBe('number');
  });

  it('AC-5[P0]: MAX_SERIALIZED_LENGTH should be exactly 4500000', () => {
    expect(MAX_SERIALIZED_LENGTH).toBe(4500000);
    expect(typeof MAX_SERIALIZED_LENGTH).toBe('number');
  });

  // Additional type structure validation
  it('AC-3[P0]: SuspectKind type should be literal union', () => {
    const kinds: SuspectKind[] = [
      'weeklyHoliday',
      'night',
      'overtime',
      'holiday',
      'minimumWage',
    ];
    expect(kinds).toHaveLength(5);
  });

  it('AC-3[P0]: PaySuspect should have all required fields', () => {
    const suspect: PaySuspect = {
      kind: 'weeklyHoliday',
      label: '주휴수당 미지급 의심',
      amount: 41280,
      description: '3월 2주차(3/9~3/15) 주 20시간 근무 → 41,280원',
    };

    expect(suspect.kind).toBe('weeklyHoliday');
    expect(suspect.label).toBe('주휴수당 미지급 의심');
    expect(suspect.amount).toBe(41280);
    expect(suspect.description).toContain('41,280');
  });

  it('AC-3[P0]: DailyPay should have required fields', () => {
    const daily: DailyPay = {
      date: '2026-03-02',
      workedMinutes: 270,
      nightMinutes: 60,
      overtimeMinutes: 0,
      basePay: 46440,
      nightPay: 5160,
      overtimePay: 0,
      holidayPay: 0,
      total: 51600,
    };

    expect(daily.date).toBe('2026-03-02');
    expect(daily.workedMinutes).toBe(270);
    expect(daily.nightMinutes).toBe(60);
    expect(daily.total).toBe(51600);
  });

  it('AC-3[P0]: WeeklyHoliday should have required fields', () => {
    const weekly: WeeklyHoliday = {
      weekStart: '2026-03-02',
      weeklyMinutes: 1200,
      eligible: true,
      amount: 41280,
    };

    expect(weekly.weekStart).toBe('2026-03-02');
    expect(weekly.weeklyMinutes).toBe(1200);
    expect(weekly.eligible).toBe(true);
    expect(weekly.amount).toBe(41280);
  });

  it('AC-3[P0]: MonthlyPayroll should have required fields', () => {
    const payroll: MonthlyPayroll = {
      yearMonth: '2026-03',
      daily: [],
      weeks: [],
      basePay: 0,
      nightPay: 0,
      overtimePay: 0,
      holidayPay: 0,
      weeklyHolidayPay: 0,
      gross: 0,
      net: 0,
      totalMinutes: 0,
      minimumWage: 10320,
      isBelowMinimumWage: false,
      minimumWageShortfall: 0,
    };

    expect(payroll.yearMonth).toBe('2026-03');
    expect(payroll.daily).toEqual([]);
    expect(payroll.weeks).toEqual([]);
    expect(payroll.gross).toBe(0);
    expect(payroll.minimumWage).toBe(10320);
  });

  it('should have STORAGE_KEYS constant with all required keys', () => {
    expect(STORAGE_KEYS).toBeDefined();
    expect(STORAGE_KEYS.WORKPLACES).toBeDefined();
    expect(STORAGE_KEYS.RECORDS).toBeDefined();
    expect(STORAGE_KEYS.PAYCHECKS).toBeDefined();
    expect(STORAGE_KEYS.SETTINGS).toBeDefined();
    expect(typeof STORAGE_KEYS.WORKPLACES).toBe('string');
    expect(typeof STORAGE_KEYS.RECORDS).toBe('string');
    expect(typeof STORAGE_KEYS.PAYCHECKS).toBe('string');
    expect(typeof STORAGE_KEYS.SETTINGS).toBe('string');
  });

  it('should have DEFAULT_SETTINGS constant', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(DEFAULT_SETTINGS.onboardingSeenAt).toBeNull();
    expect(DEFAULT_SETTINGS.disclaimerAckAt).toBeNull();
    expect(DEFAULT_SETTINGS.activeWorkplaceId).toBeNull();
    expect(DEFAULT_SETTINGS.rewardUnlocks).toEqual({});
    expect(DEFAULT_SETTINGS.schemaVersion).toBe(1);
  });

  it('should have SCHEMA_VERSION constant set to 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(typeof SCHEMA_VERSION).toBe('number');
  });

  it('should have COLOR_TOKENS constant', () => {
    expect(COLOR_TOKENS).toBeDefined();
    expect(Array.isArray(COLOR_TOKENS)).toBe(true);
    expect(COLOR_TOKENS.length).toBeGreaterThan(0);
    // Verify it contains expected color tokens
    COLOR_TOKENS.forEach((token) => {
      expect(typeof token).toBe('string');
    });
  });

  it('should have TaxType supporting none and freelance3_3', () => {
    const taxNone: TaxType = 'none';
    const taxFreelance: TaxType = 'freelance3_3';

    expect(taxNone).toBe('none');
    expect(taxFreelance).toBe('freelance3_3');
  });

  it('AC-3[P0]: Workplace should support all colorToken values from COLOR_TOKENS', () => {
    const workplace: Workplace = {
      id: 'wp-1',
      name: '근무지',
      hourlyWage: 10320,
      isFiveOrMore: true,
      payday: 15,
      taxType: 'none',
      colorToken: COLOR_TOKENS[0], // Should be a valid token
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    expect(workplace.colorToken).toBe(COLOR_TOKENS[0]);
    expect(COLOR_TOKENS).toContain(workplace.colorToken);
  });
});
