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

vi.mock("@/lib/storage");

describe("Collection Repository · Validation · Schema Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ─────────────────────────────────────────────────────────────
  // AC-1: updateWorkplace preserves createdAt, updates updatedAt
  // ─────────────────────────────────────────────────────────────

  it("AC-1[P0]: updateWorkplace should preserve createdAt and update updatedAt", async () => {
    const workplaceId = "wp-1";
    const originalCreatedAt = new Date("2026-03-01T10:00:00Z").getTime();
    const originalWorkplace = {
      id: workplaceId,
      name: "Original",
      hourlyWage: 10000,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    };

    const newUpdatedTime = originalCreatedAt + 60000; // 1 minute later

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [originalWorkplace],
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({ ok: true });

    const result = await updateWorkplace(workplaceId, { hourlyWage: 12000 });

    expect(result.ok).toBe(true);
    expect(result.createdAt).toBe(originalCreatedAt);
    expect(result.updatedAt).toBeGreaterThan(originalCreatedAt);
    expect(result.hourlyWage).toBe(12000);
    expect(result.name).toBe("Original"); // unchanged field preserved
  });

  it("AC-1b[P0]: updateWorkplace should return writeRaw error without throwing", async () => {
    const workplaceId = "wp-1";
    const originalWorkplace = {
      id: workplaceId,
      name: "Test",
      hourlyWage: 10000,
      createdAt: 1000,
      updatedAt: 1000,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [originalWorkplace],
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({
      ok: false,
      reason: "storage_full",
    });

    const result = await updateWorkplace(workplaceId, { hourlyWage: 12000 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("storage_full");
  });

  // ─────────────────────────────────────────────────────────────
  // AC-2: upsertPayCheck idempotency by workplaceId+yearMonth
  // ─────────────────────────────────────────────────────────────

  it("AC-2[P0]: upsertPayCheck should create new paycheck with createdAt === updatedAt", async () => {
    const workplaceId = "wp-1";
    const yearMonth = "2026-03";

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [],
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({ ok: true });

    const result = await upsertPayCheck(workplaceId, yearMonth, {
      actualPaidAmount: 5000000,
      calculatedGross: 5200000,
      calculatedNet: 4420000,
      diff: -200000,
      suspects: [],
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.workplaceId).toBe(workplaceId);
    expect(result.yearMonth).toBe(yearMonth);
    expect(result.createdAt).toBe(result.updatedAt);
  });

  it("AC-2b[P0]: upsertPayCheck should update existing by workplaceId+yearMonth, preserve id/createdAt", async () => {
    const workplaceId = "wp-1";
    const yearMonth = "2026-03";
    const originalCreatedAt = 1000;

    const existingPayCheck = {
      id: "pc-1",
      workplaceId,
      yearMonth,
      actualPaidAmount: 5000000,
      calculatedGross: 5200000,
      calculatedNet: 4420000,
      diff: -200000,
      suspects: [],
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    };

    // First call: read returns existing
    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [existingPayCheck],
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({ ok: true });

    const result = await upsertPayCheck(workplaceId, yearMonth, {
      actualPaidAmount: 5100000, // changed
      calculatedGross: 5300000,
      calculatedNet: 4505000,
      diff: -200000,
      suspects: [],
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe("pc-1"); // id unchanged
    expect(result.createdAt).toBe(originalCreatedAt); // createdAt unchanged
    expect(result.updatedAt).toBeGreaterThan(originalCreatedAt); // updatedAt updated
    expect(result.actualPaidAmount).toBe(5100000); // new value
  });

  // ─────────────────────────────────────────────────────────────
  // AC-3: isDuplicateRecord with self-exclusion
  // ─────────────────────────────────────────────────────────────

  it("AC-3[P0]: isDuplicateRecord should return false when only self matches", async () => {
    const recordId = "rec-1";
    const self = {
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: 1000,
      updatedAt: 1000,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [self],
    });

    const result = await isDuplicateRecord({
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
    });

    expect(result).toBe(false);
  });

  it("AC-3b[P0]: isDuplicateRecord should return true when other record matches", async () => {
    const recordId = "rec-1";
    const self = {
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const other = {
      id: "rec-2",
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "21:00",
      breakMinutes: 15,
      createdAt: 2000,
      updatedAt: 2000,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [self, other],
    });

    const result = await isDuplicateRecord({
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
    });

    expect(result).toBe(true);
  });

  it("AC-3c[P0]: isDuplicateRecord without id should find duplicates", async () => {
    const record1 = {
      id: "rec-1",
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: 1000,
      updatedAt: 1000,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [record1],
    });

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
    const workplaceWithoutUpdatedAt = {
      id: "wp-1",
      name: "Test",
      hourlyWage: 10000,
      createdAt: 1000,
      // updatedAt missing
    };
    const recordWithoutUpdatedAt = {
      id: "rec-1",
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: 2000,
      // updatedAt missing
    };

    vi.mocked(storage.readRaw)
      .mockResolvedValueOnce({ ok: true, data: [workplaceWithoutUpdatedAt] })
      .mockResolvedValueOnce({ ok: true, data: [recordWithoutUpdatedAt] })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: {} });

    const writeCalls: any[] = [];
    vi.mocked(storage.writeRaw).mockImplementation((key, data) => {
      writeCalls.push([key, data]);
      return Promise.resolve({ ok: true });
    });

    await runMigration();

    // Verify workplaces were migrated with updatedAt filled
    const workplaceCall = writeCalls.find((call) => call[0] === "apg:workplaces:v1");
    expect(workplaceCall).toBeDefined();
    const migratedWorkplace = workplaceCall[1][0];
    expect(migratedWorkplace.updatedAt).toBe(1000); // backfilled from createdAt

    // Verify records were migrated with updatedAt filled
    const recordCall = writeCalls.find((call) => call[0] === "apg:records:v1");
    expect(recordCall).toBeDefined();
    const migratedRecord = recordCall[1][0];
    expect(migratedRecord.updatedAt).toBe(2000); // backfilled from createdAt
  });

  it("AC-4b[P0]: runMigration should remove id/createdAt/updatedAt from settings", async () => {
    const settingsWithMetadata = {
      id: "settings-1",
      createdAt: 1000,
      updatedAt: 2000,
      hourlyWage: 10000,
      weeklyHours: 40,
      currency: "KRW",
    };

    vi.mocked(storage.readRaw)
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: settingsWithMetadata });

    const writeCalls: any[] = [];
    vi.mocked(storage.writeRaw).mockImplementation((key, data) => {
      writeCalls.push([key, data]);
      return Promise.resolve({ ok: true });
    });

    await runMigration();

    // Verify settings metadata was removed
    const settingsCall = writeCalls.find((call) => call[0] === "apg:settings:v1");
    expect(settingsCall).toBeDefined();
    const migratedSettings = settingsCall[1];
    expect(migratedSettings).not.toHaveProperty("id");
    expect(migratedSettings).not.toHaveProperty("createdAt");
    expect(migratedSettings).not.toHaveProperty("updatedAt");
    expect(migratedSettings.hourlyWage).toBe(10000); // other fields preserved
    expect(migratedSettings.weeklyHours).toBe(40);
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
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({
      ok: false,
      reason: "quota_exceeded",
    });

    const consoleSpy = vi.spyOn(console, "error");

    let threw = false;
    try {
      await saveWorkplace({
        name: "Test Workplace",
        hourlyWage: 10000,
      });
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("AC-6b[P0]: saveRecord should return writeRaw error result without throwing", async () => {
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({
      ok: false,
      reason: "write_failed",
    });

    const consoleSpy = vi.spyOn(console, "error");

    let threw = false;
    try {
      await saveRecord({
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
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────
  // Additional CRUD operations
  // ─────────────────────────────────────────────────────────────

  it("getRecordById should return record by id", async () => {
    const recordId = "rec-1";
    const record = {
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: 1000,
      updatedAt: 1000,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [record],
    });

    const result = await getRecordById(recordId);

    expect(result).toEqual(record);
  });

  it("getRecordById should return undefined when not found", async () => {
    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [],
    });

    const result = await getRecordById("nonexistent");

    expect(result).toBeUndefined();
  });

  it("updateRecord should preserve createdAt and update updatedAt", async () => {
    const recordId = "rec-1";
    const originalCreatedAt = 1000;
    const original = {
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [original],
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({ ok: true });

    const result = await updateRecord(recordId, { breakMinutes: 60 });

    expect(result.ok).toBe(true);
    expect(result.createdAt).toBe(originalCreatedAt);
    expect(result.updatedAt).toBeGreaterThan(originalCreatedAt);
    expect(result.breakMinutes).toBe(60);
  });

  it("deleteRecord should remove record and return success", async () => {
    const recordId = "rec-1";
    const record = {
      id: recordId,
      workplaceId: "wp-1",
      date: "2026-03-02",
      startTime: "18:00",
      endTime: "22:00",
      breakMinutes: 30,
      createdAt: 1000,
      updatedAt: 1000,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: [record],
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({ ok: true });

    const result = await deleteRecord(recordId);

    expect(result.ok).toBe(true);
  });

  it("getSettings should exclude id/createdAt/updatedAt metadata", async () => {
    const settingsWithMetadata = {
      id: "settings-1",
      createdAt: 1000,
      updatedAt: 2000,
      hourlyWage: 10000,
      weeklyHours: 40,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: settingsWithMetadata,
    });

    const result = await getSettings();

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result.hourlyWage).toBe(10000);
    expect(result.weeklyHours).toBe(40);
  });

  it("patchSettings should merge partial updates with createdAt/updatedAt handling", async () => {
    const currentSettings = {
      id: "settings-1",
      createdAt: 1000,
      updatedAt: 1000,
      hourlyWage: 10000,
      weeklyHours: 40,
    };

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: currentSettings,
    });
    vi.mocked(storage.writeRaw).mockResolvedValueOnce({ ok: true });

    const result = await patchSettings({ hourlyWage: 12000 });

    expect(result.ok).toBe(true);
    expect(result.hourlyWage).toBe(12000);
    expect(result.weeklyHours).toBe(40); // unchanged field preserved
    expect(result.createdAt).toBe(1000); // createdAt unchanged
    expect(result.updatedAt).toBeGreaterThan(1000); // updatedAt updated
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
    const workplaces = [
      {
        id: "wp-1",
        name: "Workplace 1",
        hourlyWage: 10000,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: "wp-2",
        name: "Workplace 2",
        hourlyWage: 12000,
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: workplaces,
    });

    const result = await getWorkplaces();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("wp-1");
    expect(result[1].id).toBe("wp-2");
  });

  it("getRecords should return all records from storage", async () => {
    const records = [
      {
        id: "rec-1",
        workplaceId: "wp-1",
        date: "2026-03-02",
        startTime: "18:00",
        endTime: "22:00",
        breakMinutes: 30,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: records,
    });

    const result = await getRecords();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rec-1");
  });

  it("getPayChecks should return all paychecks from storage", async () => {
    const payChecks = [
      {
        id: "pc-1",
        workplaceId: "wp-1",
        yearMonth: "2026-03",
        actualPaidAmount: 5000000,
        calculatedGross: 5200000,
        calculatedNet: 4420000,
        diff: -200000,
        suspects: [],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    vi.mocked(storage.readRaw).mockResolvedValueOnce({
      ok: true,
      data: payChecks,
    });

    const result = await getPayChecks();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pc-1");
  });
});
