import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  deleteWorkplaceCascade,
  resolveActiveWorkplaceId,
  countLinked,
  canAddWorkplace,
} from "@/lib/workplaceIntegrity";
import * as repository from "@/lib/repository";
import * as storage from "@/lib/storage";
import type { Workplace, WorkRecord, PayCheck, AppSettings } from "@/lib/types";
import { STORAGE_KEYS, MAX_WORKPLACES } from "@/lib/types";

// Mock repository and storage
vi.mock("@/lib/repository");
vi.mock("@/lib/storage");

function setupFakeStorage() {
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.WORKPLACES]: [],
    [STORAGE_KEYS.RECORDS]: [],
    [STORAGE_KEYS.PAYCHECKS]: [],
    [STORAGE_KEYS.SETTINGS]: {
      onboardingSeenAt: null,
      disclaimerAckAt: null,
      activeWorkplaceId: null,
      rewardUnlocks: {},
      schemaVersion: 1,
    },
  };

  vi.mocked(repository.getWorkplaces).mockImplementation(async () => {
    return (store[STORAGE_KEYS.WORKPLACES] as Workplace[]) || [];
  });

  vi.mocked(repository.getRecords).mockImplementation(async () => {
    return (store[STORAGE_KEYS.RECORDS] as WorkRecord[]) || [];
  });

  vi.mocked(repository.getPayChecks).mockImplementation(async () => {
    return (store[STORAGE_KEYS.PAYCHECKS] as PayCheck[]) || [];
  });

  vi.mocked(repository.getSettings).mockImplementation(async () => {
    return (store[STORAGE_KEYS.SETTINGS] as AppSettings) || {};
  });

  vi.mocked(storage.readRaw).mockImplementation(((key: string, fallback: unknown) => {
    return key in store ? store[key] : fallback;
  }) as typeof storage.readRaw);

  vi.mocked(storage.writeRaw).mockImplementation(((key: string, value: unknown) => {
    store[key] = value;
    return { ok: true };
  }) as typeof storage.writeRaw);

  vi.mocked(repository.patchSettings).mockImplementation(async (patch: Partial<AppSettings>) => {
    const current = store[STORAGE_KEYS.SETTINGS] as AppSettings;
    const updated = { ...current, ...patch };
    store[STORAGE_KEYS.SETTINGS] = updated;
    return { ok: true, ...updated };
  });

  return store;
}

describe("Workplace Integrity · Cascading Delete & Active Pointer Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-1: deleteWorkplaceCascade removes workplace and all linked records/paychecks
  // ─────────────────────────────────────────────────────────────

  it("AC-1[P0]: deleteWorkplaceCascade should remove workplace and all linked records/paychecks", async () => {
    const store = setupFakeStorage();

    // Setup: wp-1 (3 records + 2 paychecks), wp-2 (2 records + 1 paycheck)
    const workplaces: Workplace[] = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "wp-2",
        name: "Workplace 2",
        hourlyWage: 12000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "green",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ];

    const records: WorkRecord[] = [
      {
        id: "rec-wp1-1",
        workplaceId: "wp-1",
        date: "2026-01-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-01-02T10:00:00.000Z",
        updatedAt: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "rec-wp1-2",
        workplaceId: "wp-1",
        date: "2026-01-03",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-01-03T10:00:00.000Z",
        updatedAt: "2026-01-03T10:00:00.000Z",
      },
      {
        id: "rec-wp1-3",
        workplaceId: "wp-1",
        date: "2026-01-04",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-01-04T10:00:00.000Z",
        updatedAt: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "rec-wp2-1",
        workplaceId: "wp-2",
        date: "2026-02-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-02-02T10:00:00.000Z",
        updatedAt: "2026-02-02T10:00:00.000Z",
      },
      {
        id: "rec-wp2-2",
        workplaceId: "wp-2",
        date: "2026-02-03",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-02-03T10:00:00.000Z",
        updatedAt: "2026-02-03T10:00:00.000Z",
      },
    ];

    const paychecks: PayCheck[] = [
      {
        id: "pc-wp1-1",
        workplaceId: "wp-1",
        yearMonth: "2026-01",
        actualPaidAmount: 5000000,
        calculatedGross: 5200000,
        calculatedNet: 4420000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
      },
      {
        id: "pc-wp1-2",
        workplaceId: "wp-1",
        yearMonth: "2026-02",
        actualPaidAmount: 5100000,
        calculatedGross: 5300000,
        calculatedNet: 4505000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-02-28T10:00:00.000Z",
        updatedAt: "2026-02-28T10:00:00.000Z",
      },
      {
        id: "pc-wp2-1",
        workplaceId: "wp-2",
        yearMonth: "2026-02",
        actualPaidAmount: 4500000,
        calculatedGross: 4700000,
        calculatedNet: 3990000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-02-28T11:00:00.000Z",
        updatedAt: "2026-02-28T11:00:00.000Z",
      },
    ];

    store[STORAGE_KEYS.WORKPLACES] = workplaces;
    store[STORAGE_KEYS.RECORDS] = records;
    store[STORAGE_KEYS.PAYCHECKS] = paychecks;

    // Execute
    const result = await deleteWorkplaceCascade("wp-1");

    // Verify success
    expect(result.ok).toBe(true);

    // Verify workplace removed
    const remainingWorkplaces = store[STORAGE_KEYS.WORKPLACES] as Workplace[];
    expect(remainingWorkplaces).toHaveLength(1);
    expect(remainingWorkplaces[0].id).toBe("wp-2");

    // Verify linked records removed (3 -> 2)
    const remainingRecords = store[STORAGE_KEYS.RECORDS] as WorkRecord[];
    expect(remainingRecords).toHaveLength(2);
    expect(remainingRecords.every((r) => r.workplaceId !== "wp-1")).toBe(true);

    // Verify linked paychecks removed (3 -> 1)
    const remainingPaychecks = store[STORAGE_KEYS.PAYCHECKS] as PayCheck[];
    expect(remainingPaychecks).toHaveLength(1);
    expect(remainingPaychecks[0].id).toBe("pc-wp2-1");
  });

  // ─────────────────────────────────────────────────────────────
  // AC-2: Failed write rollback — restore all 3 keys, no orphan records
  // ─────────────────────────────────────────────────────────────

  it("AC-2[P0]: deleteWorkplaceCascade should rollback all 3 keys on first write failure", async () => {
    const store = setupFakeStorage();

    const workplaces: Workplace[] = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const records: WorkRecord[] = [
      {
        id: "rec-1",
        workplaceId: "wp-1",
        date: "2026-01-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-01-02T10:00:00.000Z",
        updatedAt: "2026-01-02T10:00:00.000Z",
      },
    ];

    store[STORAGE_KEYS.WORKPLACES] = workplaces;
    store[STORAGE_KEYS.RECORDS] = records;

    // Mock writeRaw to fail on first call
    let writeCallCount = 0;
    vi.mocked(storage.writeRaw).mockImplementation(((key: string, value: unknown) => {
      writeCallCount++;
      if (writeCallCount === 1) {
        return { ok: false, reason: "quota" };
      }
      store[key] = value;
      return { ok: true };
    }) as typeof storage.writeRaw);

    // Execute
    const result = await deleteWorkplaceCascade("wp-1");

    // Verify failure
    expect(result.ok).toBe(false);

    // Verify rollback — all 3 keys restored
    const restoredWorkplaces = store[STORAGE_KEYS.WORKPLACES] as Workplace[];
    expect(restoredWorkplaces).toHaveLength(1);
    expect(restoredWorkplaces[0].id).toBe("wp-1");

    const restoredRecords = store[STORAGE_KEYS.RECORDS] as WorkRecord[];
    expect(restoredRecords).toHaveLength(1);
    expect(restoredRecords[0].id).toBe("rec-1");

    // No orphan records with deleted workplace
    expect(restoredRecords.every((r) => r.workplaceId === "wp-1")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // AC-3: Delete active workplace → resolve to next by createdAt
  // ─────────────────────────────────────────────────────────────

  it("AC-3[P0]: deleteWorkplaceCascade should switch active to next workplace by createdAt", async () => {
    const store = setupFakeStorage();

    const workplaces: Workplace[] = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "wp-2",
        name: "Workplace 2",
        hourlyWage: 12000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "green",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "wp-3",
        name: "Workplace 3",
        hourlyWage: 11000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "purple",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ];

    store[STORAGE_KEYS.WORKPLACES] = workplaces;
    const settings = store[STORAGE_KEYS.SETTINGS] as AppSettings;
    settings.activeWorkplaceId = "wp-1";

    // Execute
    const result = await deleteWorkplaceCascade("wp-1");

    // Verify success
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    // Verify active switched to wp-2 (first by createdAt after deletion)
    expect(result.nextActiveId).toBe("wp-2");

    // Verify settings updated (patchSettings was called with activeWorkplaceId="wp-2")
    const settingsCalls = vi.mocked(repository.patchSettings).mock.calls;
    expect(settingsCalls.some((call) => call[0]?.activeWorkplaceId === "wp-2")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // AC-4: Delete all workplaces → activeWorkplaceId = null, or non-active unchanged
  // ─────────────────────────────────────────────────────────────

  it("AC-4[P0]: deleteWorkplaceCascade should set activeWorkplaceId=null when deleting all workplaces", async () => {
    const store = setupFakeStorage();

    const workplaces: Workplace[] = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    store[STORAGE_KEYS.WORKPLACES] = workplaces;
    const settings = store[STORAGE_KEYS.SETTINGS] as AppSettings;
    settings.activeWorkplaceId = "wp-1";

    // Execute
    const result = await deleteWorkplaceCascade("wp-1");

    // Verify success
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    // Verify nextActiveId = null
    expect(result.nextActiveId).toBeNull();

    // Verify patchSettings called with activeWorkplaceId=null
    const settingsCalls = vi.mocked(repository.patchSettings).mock.calls;
    expect(settingsCalls.some((call) => call[0]?.activeWorkplaceId === null)).toBe(true);
  });

  it("AC-4b[P0]: deleteWorkplaceCascade should not change activeWorkplaceId when deleting non-active workplace", async () => {
    const store = setupFakeStorage();

    const workplaces: Workplace[] = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "wp-2",
        name: "Workplace 2",
        hourlyWage: 12000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "green",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ];

    store[STORAGE_KEYS.WORKPLACES] = workplaces;
    const settings = store[STORAGE_KEYS.SETTINGS] as AppSettings;
    settings.activeWorkplaceId = "wp-2"; // Not wp-1

    // Execute
    const result = await deleteWorkplaceCascade("wp-1");

    // Verify success
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    // Verify activeWorkplaceId unchanged (still wp-2)
    expect(result.nextActiveId).toBe("wp-2");
  });

  // ─────────────────────────────────────────────────────────────
  // AC-5: canAddWorkplace returns false at 5, true at 4
  // ─────────────────────────────────────────────────────────────

  it("AC-5[P0]: canAddWorkplace should return false when at MAX_WORKPLACES (5)", async () => {
    const store = setupFakeStorage();

    // Create 5 workplaces
    const workplaces: Workplace[] = Array.from({ length: MAX_WORKPLACES }, (_, i) => ({
      id: `wp-${i + 1}`,
      name: `Workplace ${i + 1}`,
      hourlyWage: 10000 + i * 1000,
      isFiveOrMore: false,
      payday: 25,
      taxType: "none" as const,
      colorToken: "blue",
      createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    store[STORAGE_KEYS.WORKPLACES] = workplaces;

    const result = await canAddWorkplace();

    expect(result).toBe(false);
  });

  it("AC-5b[P0]: canAddWorkplace should return true when below MAX_WORKPLACES", async () => {
    const store = setupFakeStorage();

    // Create 4 workplaces
    const workplaces: Workplace[] = Array.from({ length: MAX_WORKPLACES - 1 }, (_, i) => ({
      id: `wp-${i + 1}`,
      name: `Workplace ${i + 1}`,
      hourlyWage: 10000 + i * 1000,
      isFiveOrMore: false,
      payday: 25,
      taxType: "none" as const,
      colorToken: "blue",
      createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    store[STORAGE_KEYS.WORKPLACES] = workplaces;

    const result = await canAddWorkplace();

    expect(result).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // AC-6: No console.error, no throw
  // ─────────────────────────────────────────────────────────────

  it("AC-6[P0]: all functions should not console.error or throw", async () => {
    setupFakeStorage();

    const consoleSpy = vi.spyOn(console, "error");
    let threwError = false;

    try {
      await deleteWorkplaceCascade("nonexistent");
      await resolveActiveWorkplaceId();
      await countLinked("nonexistent");
      await canAddWorkplace();
    } catch (e) {
      threwError = true;
    }

    expect(threwError).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────
  // Utility functions: resolveActiveWorkplaceId, countLinked
  // ─────────────────────────────────────────────────────────────

  it("resolveActiveWorkplaceId should return activeWorkplaceId from settings", async () => {
    const store = setupFakeStorage();
    const settings = store[STORAGE_KEYS.SETTINGS] as AppSettings;
    settings.activeWorkplaceId = "wp-1";

    const result = await resolveActiveWorkplaceId();

    expect(result).toBe("wp-1");
  });

  it("resolveActiveWorkplaceId should return null when no active workplace", async () => {
    setupFakeStorage();

    const result = await resolveActiveWorkplaceId();

    expect(result).toBeNull();
  });

  it("countLinked should return count of linked records and paychecks", async () => {
    const store = setupFakeStorage();

    const records: WorkRecord[] = [
      {
        id: "rec-1",
        workplaceId: "wp-1",
        date: "2026-01-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-01-02T10:00:00.000Z",
        updatedAt: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "rec-2",
        workplaceId: "wp-1",
        date: "2026-01-03",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-01-03T10:00:00.000Z",
        updatedAt: "2026-01-03T10:00:00.000Z",
      },
      {
        id: "rec-3",
        workplaceId: "wp-2",
        date: "2026-02-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-02-02T10:00:00.000Z",
        updatedAt: "2026-02-02T10:00:00.000Z",
      },
    ];

    const paychecks: PayCheck[] = [
      {
        id: "pc-1",
        workplaceId: "wp-1",
        yearMonth: "2026-01",
        actualPaidAmount: 5000000,
        calculatedGross: 5200000,
        calculatedNet: 4420000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
      },
      {
        id: "pc-2",
        workplaceId: "wp-1",
        yearMonth: "2026-02",
        actualPaidAmount: 5100000,
        calculatedGross: 5300000,
        calculatedNet: 4505000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-02-28T10:00:00.000Z",
        updatedAt: "2026-02-28T10:00:00.000Z",
      },
      {
        id: "pc-3",
        workplaceId: "wp-2",
        yearMonth: "2026-02",
        actualPaidAmount: 4500000,
        calculatedGross: 4700000,
        calculatedNet: 3990000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-02-28T11:00:00.000Z",
        updatedAt: "2026-02-28T11:00:00.000Z",
      },
    ];

    store[STORAGE_KEYS.RECORDS] = records;
    store[STORAGE_KEYS.PAYCHECKS] = paychecks;

    // wp-1 has 2 records + 2 paychecks = 4
    const result = await countLinked("wp-1");

    expect(result).toBe(4);
  });

  it("countLinked should return 0 for workplace with no linked data", async () => {
    setupFakeStorage();

    const result = await countLinked("wp-nonexistent");

    expect(result).toBe(0);
  });
});
