import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateWorkplace,
  upsertPayCheck,
  isDuplicateRecord,
  runMigration,
  validateRecord,
  validateWorkplace,
  getWorkplaces,
  saveWorkplace,
  getRecords,
  getRecordById,
  saveRecord,
  updateRecord,
  deleteRecord,
  getPayChecks,
  getSettings,
  patchSettings,
} from "@/lib/repository";
import * as storage from "@/lib/storage";

// storage.ts의 실제 계약(packet 0002, src/lib/storage.ts로 검증됨)은 동기 함수다:
// readRaw<T>(key, fallback, isValid): T / writeRaw(key, value): {ok, reason?: 'quota'|'size'}
// 아래 목은 그 실제 시그니처에 맞춰 가짜 영속 저장소를 흉내낸다.
vi.mock("@/lib/storage");

function setupFakeStorage() {
  const store: Record<string, unknown> = {};

  vi.mocked(storage.readRaw).mockImplementation(((key: string, fallback: unknown) => {
    return key in store ? store[key] : fallback;
  }) as typeof storage.readRaw);

  vi.mocked(storage.writeRaw).mockImplementation(((key: string, value: unknown) => {
    store[key] = value;
    return { ok: true };
  }) as typeof storage.writeRaw);

  vi.mocked(storage.getItem).mockImplementation(((key: string) => {
    return key in store ? store[key] : null;
  }) as typeof storage.getItem);

  return store;
}

describe("Collection Repository · Validation · Schema Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-1: updateWorkplace preserves createdAt, updates updatedAt
  // ─────────────────────────────────────────────────────────────

  it("AC-1[P0]: updateWorkplace should preserve createdAt and update updatedAt", async () => {
    const store = setupFakeStorage();
    const workplaceId = "wp-1";
    const originalCreatedAt = new Date("2026-03-01T10:00:00.000Z").toISOString();
    store["apg:workplaces:v1"] = [
      {
        id: workplaceId,
        name: "Original",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: originalCreatedAt,
        updatedAt: originalCreatedAt,
      },
    ];

    const result = await updateWorkplace(workplaceId, { hourlyWage: 12000 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.createdAt).toBe(originalCreatedAt);
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(originalCreatedAt).getTime());
    expect(result.hourlyWage).toBe(12000);
    expect(result.name).toBe("Original"); // unchanged field preserved
  });

  it("AC-1b[P0]: updateWorkplace should return writeRaw error without throwing", async () => {
    setupFakeStorage();
    const workplaceId = "wp-1";
    vi.mocked(storage.readRaw).mockReturnValueOnce([
      {
        id: workplaceId,
        name: "Test",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ] as any);
    vi.mocked(storage.writeRaw).mockReturnValueOnce({ ok: false, reason: "quota" });

    const result = await updateWorkplace(workplaceId, { hourlyWage: 12000 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("quota");
  });

  // ─────────────────────────────────────────────────────────────
  // AC-2: upsertPayCheck idempotency by workplaceId+yearMonth
  // ─────────────────────────────────────────────────────────────

  it("AC-2[P0]: upsertPayCheck should create new paycheck with createdAt === updatedAt", async () => {
    setupFakeStorage();
    const workplaceId = "wp-1";
    const yearMonth = "2026-03";

    const result = await upsertPayCheck(workplaceId, yearMonth, {
      actualPaidAmount: 5000000,
      calculatedGross: 5200000,
      calculatedNet: 4420000,
      diff: -200000,
      suspects: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.id).toBeDefined();
    expect(result.workplaceId).toBe(workplaceId);
    expect(result.yearMonth).toBe(yearMonth);
    expect(result.createdAt).toBe(result.updatedAt);
  });

  it("AC-2b[P0]: upsertPayCheck should update existing by workplaceId+yearMonth, preserve id/createdAt, and keep a single row", async () => {
    const store = setupFakeStorage();
    const workplaceId = "wp-1";
    const yearMonth = "2026-03";

    const first = await upsertPayCheck(workplaceId, yearMonth, {
      actualPaidAmount: 5000000,
      calculatedGross: 5200000,
      calculatedNet: 4420000,
      diff: -200000,
      suspects: [],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");

    const second = await upsertPayCheck(workplaceId, yearMonth, {
      actualPaidAmount: 5100000, // changed
      calculatedGross: 5300000,
      calculatedNet: 4505000,
      diff: -200000,
      suspects: [],
    });

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("unreachable");
    expect(second.id).toBe(first.id); // id unchanged
    expect(second.createdAt).toBe(first.createdAt); // createdAt unchanged
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.updatedAt).getTime());
    expect(second.actualPaidAmount).toBe(5100000); // new value

    const stored = store["apg:paychecks:v1"] as unknown[];
    expect(stored).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────
  // AC-3: isDuplicateRecord with self-exclusion
  // ─────────────────────────────────────────────────────────────

  it("AC-3[P0]: isDuplicateRecord should return false when only self matches", async () => {
    const store = setupFakeStorage();
    const recordId = "rec-1";
    store["apg:records:v1"] = [
      {
        id: recordId,
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ];

    const result = await isDuplicateRecord({
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
    });

    expect(result).toBe(false);
  });

  it("AC-3b[P0]: isDuplicateRecord should return true when other record matches", async () => {
    const store = setupFakeStorage();
    const recordId = "rec-1";
    store["apg:records:v1"] = [
      {
        id: recordId,
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
      {
        id: "rec-2",
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "21:00",
        breakMinutes: 15,
        isHoliday: false,
        memo: "",
        createdAt: "2026-03-01T11:00:00.000Z",
        updatedAt: "2026-03-01T11:00:00.000Z",
      },
    ];

    const result = await isDuplicateRecord({
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
    });

    expect(result).toBe(true);
  });

  it("AC-3c[P0]: isDuplicateRecord without id should find duplicates", async () => {
    const store = setupFakeStorage();
    store["apg:records:v1"] = [
      {
        id: "rec-1",
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ];

    const result = await isDuplicateRecord({
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
    });

    expect(result).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // AC-4: runMigration backfills updatedAt, removes metadata from settings
  // ─────────────────────────────────────────────────────────────

  it("AC-4[P0]: runMigration should backfill missing updatedAt from createdAt", async () => {
    setupFakeStorage();
    const workplaceWithoutUpdatedAt = {
      id: "wp-1",
      name: "Test",
      hourlyWage: 10000,
      createdAt: "2026-03-01T10:00:00.000Z",
      // updatedAt missing
    };
    const recordWithoutUpdatedAt = {
      id: "rec-1",
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: "2026-03-01T11:00:00.000Z",
      // updatedAt missing
    };

    vi.mocked(storage.getItem).mockImplementation(((key: string) => {
      if (key === "apg:workplaces:v1") return [workplaceWithoutUpdatedAt];
      if (key === "apg:records:v1") return [recordWithoutUpdatedAt];
      if (key === "apg:paychecks:v1") return [];
      if (key === "apg:settings:v1") return {};
      return null;
    }) as typeof storage.getItem);

    const writeCalls: any[] = [];
    vi.mocked(storage.writeRaw).mockImplementation(((key: string, data: unknown) => {
      writeCalls.push([key, data]);
      return { ok: true };
    }) as typeof storage.writeRaw);

    await runMigration();

    const workplaceCall = writeCalls.find((call) => call[0] === "apg:workplaces:v1");
    expect(workplaceCall).toBeDefined();
    expect(workplaceCall[1][0].updatedAt).toBe("2026-03-01T10:00:00.000Z"); // backfilled from createdAt

    const recordCall = writeCalls.find((call) => call[0] === "apg:records:v1");
    expect(recordCall).toBeDefined();
    expect(recordCall[1][0].updatedAt).toBe("2026-03-01T11:00:00.000Z"); // backfilled from createdAt
  });

  it("AC-4b[P0]: runMigration should remove id/createdAt/updatedAt from settings", async () => {
    setupFakeStorage();
    const settingsWithMetadata = {
      id: "settings-1",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T11:00:00.000Z",
      onboardingSeenAt: null,
      disclaimerAckAt: null,
      activeWorkplaceId: null,
      rewardUnlocks: {},
      schemaVersion: 1,
    };

    vi.mocked(storage.getItem).mockImplementation(((key: string) => {
      if (key === "apg:settings:v1") return settingsWithMetadata;
      return [];
    }) as typeof storage.getItem);

    const writeCalls: any[] = [];
    vi.mocked(storage.writeRaw).mockImplementation(((key: string, data: unknown) => {
      writeCalls.push([key, data]);
      return { ok: true };
    }) as typeof storage.writeRaw);

    await runMigration();

    const settingsCall = writeCalls.find((call) => call[0] === "apg:settings:v1");
    expect(settingsCall).toBeDefined();
    const migratedSettings = settingsCall[1];
    expect(migratedSettings).not.toHaveProperty("id");
    expect(migratedSettings).not.toHaveProperty("createdAt");
    expect(migratedSettings).not.toHaveProperty("updatedAt");
    expect(migratedSettings.schemaVersion).toBe(1); // other fields preserved
  });

  // ─────────────────────────────────────────────────────────────
  // AC-5: validateRecord with specific error messages
  // ─────────────────────────────────────────────────────────────

  it("AC-5[P0]: validateRecord should reject invalid time format", () => {
    const invalidCases = [
      { startTime: "25:00", endTime: "22:00" }, // hour > 23
      { startTime: "18:60", endTime: "22:00" }, // minute > 59
      { startTime: "18:00", endTime: "24:30" }, // end hour invalid
      { startTime: "not-a-time", endTime: "22:00" }, // format error
    ];

    for (const testCase of invalidCases) {
      const result = validateRecord({
        workplaceId: "wp-1",
        date: "2026-03-02",
        ...testCase,
        breakMinutes: 30,
      });

      expect(result).toBe("시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요");
    }
  });

  it("AC-5b[P0]: validateRecord should reject break time > work time", () => {
    // 18:00 ~ 19:00 = 60 minutes work, 120 minutes break = invalid
    const result = validateRecord({
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "19:00",
      breakMinutes: 120,
    });

    expect(result).toBe("휴게시간이 근무시간보다 길 수 없어요");
  });

  it("AC-5c[P0]: validateRecord should return null for valid record", () => {
    const result = validateRecord({
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
    });

    expect(result).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-6: All write paths check writeRaw result, no throw, no React import
  // ─────────────────────────────────────────────────────────────

  it("AC-6[P0]: saveWorkplace should return writeRaw error result without throwing", async () => {
    setupFakeStorage();
    vi.mocked(storage.writeRaw).mockReturnValueOnce({ ok: false, reason: "quota" });

    const consoleSpy = vi.spyOn(console, "error");

    let threw = false;
    let result: Awaited<ReturnType<typeof saveWorkplace>> | undefined;
    try {
      result = await saveWorkplace({
        name: "Test Workplace",
        hourlyWage: 10000,
      });
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result?.ok).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("AC-6b[P0]: saveRecord should return writeRaw error result without throwing", async () => {
    setupFakeStorage();
    vi.mocked(storage.writeRaw).mockReturnValueOnce({ ok: false, reason: "size" });

    const consoleSpy = vi.spyOn(console, "error");

    let threw = false;
    let result: Awaited<ReturnType<typeof saveRecord>> | undefined;
    try {
      result = await saveRecord({
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
      });
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result?.ok).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────
  // Additional CRUD operations
  // ─────────────────────────────────────────────────────────────

  it("getRecordById should return record by id", async () => {
    const store = setupFakeStorage();
    const recordId = "rec-1";
    const record = {
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      isHoliday: false,
      memo: "",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    };
    store["apg:records:v1"] = [record];

    const result = await getRecordById(recordId);

    expect(result).toEqual(record);
  });

  it("getRecordById should return undefined when not found", async () => {
    setupFakeStorage();

    const result = await getRecordById("nonexistent");

    expect(result).toBeUndefined();
  });

  it("updateRecord should preserve createdAt and update updatedAt", async () => {
    const store = setupFakeStorage();
    const recordId = "rec-1";
    const originalCreatedAt = "2026-03-01T10:00:00.000Z";
    store["apg:records:v1"] = [
      {
        id: recordId,
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: originalCreatedAt,
        updatedAt: originalCreatedAt,
      },
    ];

    const result = await updateRecord(recordId, { breakMinutes: 60 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.createdAt).toBe(originalCreatedAt);
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(originalCreatedAt).getTime());
    expect(result.breakMinutes).toBe(60);
  });

  it("deleteRecord should remove record and return success", async () => {
    const store = setupFakeStorage();
    const recordId = "rec-1";
    store["apg:records:v1"] = [
      {
        id: recordId,
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ];

    const result = await deleteRecord(recordId);

    expect(result.ok).toBe(true);
    expect(store["apg:records:v1"]).toEqual([]);
  });

  it("getSettings should exclude id/createdAt/updatedAt metadata", async () => {
    const store = setupFakeStorage();
    store["apg:settings:v1"] = {
      id: "settings-1",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T11:00:00.000Z",
      onboardingSeenAt: null,
      disclaimerAckAt: null,
      activeWorkplaceId: null,
      rewardUnlocks: {},
      schemaVersion: 1,
    };

    const result = await getSettings();

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result.schemaVersion).toBe(1);
  });

  it("patchSettings should merge partial updates", async () => {
    const store = setupFakeStorage();
    store["apg:settings:v1"] = {
      onboardingSeenAt: null,
      disclaimerAckAt: null,
      activeWorkplaceId: null,
      rewardUnlocks: {},
      schemaVersion: 1,
    };

    const result = await patchSettings({ activeWorkplaceId: "wp-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.activeWorkplaceId).toBe("wp-1");
    expect(result.schemaVersion).toBe(1); // unchanged field preserved
  });

  it("validateWorkplace should validate required fields and values", () => {
    // Empty name
    let error = validateWorkplace({ name: "", hourlyWage: 10000 });
    expect(error).toBeDefined();
    expect(typeof error).toBe("string");

    // Invalid hourly wage
    error = validateWorkplace({ name: "Test", hourlyWage: 0 });
    expect(error).toBeDefined();

    // Valid workplace
    const valid = validateWorkplace({ name: "Test", hourlyWage: 10000 });
    expect(valid).toBeNull();
  });

  it("getWorkplaces should return all workplaces from storage", async () => {
    const store = setupFakeStorage();
    store["apg:workplaces:v1"] = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
      {
        id: "wp-2",
        name: "Workplace 2",
        hourlyWage: 12000,
        isFiveOrMore: false,
        payday: 25,
        taxType: "none",
        colorToken: "green",
        createdAt: "2026-03-01T11:00:00.000Z",
        updatedAt: "2026-03-01T11:00:00.000Z",
      },
    ];

    const result = await getWorkplaces();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("wp-1");
    expect(result[1].id).toBe("wp-2");
  });

  it("getRecords should return all records from storage", async () => {
    const store = setupFakeStorage();
    store["apg:records:v1"] = [
      {
        id: "rec-1",
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        isHoliday: false,
        memo: "",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ];

    const result = await getRecords();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rec-1");
  });

  it("getPayChecks should return all paychecks from storage", async () => {
    const store = setupFakeStorage();
    store["apg:paychecks:v1"] = [
      {
        id: "pc-1",
        workplaceId: "wp-1",
        yearMonth: "2026-03",
        actualPaidAmount: 5000000,
        calculatedGross: 5200000,
        calculatedNet: 4420000,
        diff: -200000,
        suspects: [],
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ];

    const result = await getPayChecks();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pc-1");
  });
});
