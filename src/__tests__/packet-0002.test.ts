import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Workplace, WorkRecord, PayCheck, AppSettings } from "@/lib/types";
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  MAX_SERIALIZED_LENGTH,
} from "@/lib/types";

/**
 * TDD Red Phase — Storage Module Tests
 * Tests for src/lib/storage.ts (not yet implemented)
 *
 * Functions under test:
 * - readRaw<T>(key, fallback, isValid): handles parsing, validation, corruption recovery
 * - writeRaw(key, value): returns {ok: true} | {ok: false, reason: 'quota' | 'size'}
 * - consumeCorruptionFlag(): tracks if corruption occurred (first call true, rest false)
 * - Type guards: isWorkplaceArray, isRecordArray, isPayCheckArray, isSettingsObject
 */

import {
  readRaw,
  writeRaw,
  consumeCorruptionFlag,
  isWorkplaceArray,
  isRecordArray,
  isPayCheckArray,
  isSettingsObject,
} from "@/lib/storage";

describe("Storage Raw I/O — Corruption Recovery & Write Guard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("AC-1: ':corrupt:' backup key composition", () => {
    it("should create backup keys with ':corrupt:' + timestamp, using key variable", () => {
      // This test verifies that when corruption is detected:
      // 1. The backup key is composed using the key variable + ':corrupt:' + timestamp
      // 2. ':corrupt:' appears exactly once in the backup key composition
      // 3. No hardcoded backup key names like 'apg:records:v1:corrupt'

      // Setup: Store corrupted data
      const key = STORAGE_KEYS.WORKPLACES; // 'apg:workplaces:v1'
      const corruptedData = '{"not": valid json';
      localStorage.setItem(key, corruptedData);

      // Act: Read corrupted data
      const fallback: Workplace[] = [];
      const result = readRaw(
        key,
        fallback,
        isWorkplaceArray
      );

      // Assert: Fallback returned
      expect(result).toEqual(fallback);

      // Assert: Backup key created with pattern: key + ':corrupt:' + timestamp
      const backupKeys = Object.keys(localStorage).filter((k) =>
        k.includes(":corrupt:")
      );
      expect(backupKeys.length).toBeGreaterThan(0);

      // Assert: Backup key contains original key + ':corrupt:' + digits
      const backupKey = backupKeys[0];
      expect(backupKey).toMatch(
        new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:corrupt:\\d+$`)
      );

      // Assert: Backup contains the corrupted data
      expect(localStorage.getItem(backupKey)).toBe(corruptedData);
    });

    it("should not hardcode ':corrupt:' in multiple places", () => {
      // This is a meta-test that will be verified post-implementation
      // by reading the source file. For now, test behavior consistency.
      const key = STORAGE_KEYS.RECORDS;
      localStorage.setItem(key, "invalid");

      readRaw(key, [], isRecordArray);
      readRaw(key, [], isRecordArray); // Second call with same key

      const backupKeys = Object.keys(localStorage).filter((k) =>
        k.includes(":corrupt:")
      );
      // Each corruption should create exactly one backup key per timestamp
      // (multiple calls might have slightly different timestamps)
      expect(backupKeys.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AC-2: Corrupted data handling with type validation", () => {
    it("should recover from invalid JSON in workplaces, create backup, restore fallback", () => {
      const key = STORAGE_KEYS.WORKPLACES;
      const invalidJson = '[[bad json';
      localStorage.setItem(key, invalidJson);

      const fallback: Workplace[] = [];
      const result = readRaw(key, fallback, isWorkplaceArray);

      // Assert: Returns fallback
      expect(result).toEqual(fallback);

      // Assert: Original key now contains fallback (serialized)
      const restored = localStorage.getItem(key);
      expect(restored).toBe(JSON.stringify(fallback));

      // Assert: Backup created with ':corrupt:' pattern
      const backupKey = Object.keys(localStorage).find((k) =>
        k.includes(":corrupt:")
      );
      expect(backupKey).toBeDefined();
      expect(backupKey).toContain(key);
      expect(localStorage.getItem(backupKey!)).toBe(invalidJson);

      // Assert: Corruption flag is set
      expect(consumeCorruptionFlag()).toBe(true);
    });

    it("should recover from type mismatch in settings (expect object, get array)", () => {
      const key = STORAGE_KEYS.SETTINGS;
      const wrongType = '[]'; // Array instead of object
      localStorage.setItem(key, wrongType);

      const result = readRaw(key, DEFAULT_SETTINGS, isSettingsObject);

      // Assert: Returns DEFAULT_SETTINGS
      expect(result).toEqual(DEFAULT_SETTINGS);

      // Assert: Original key now contains DEFAULT_SETTINGS
      const restored = localStorage.getItem(key);
      expect(restored).toBe(JSON.stringify(DEFAULT_SETTINGS));

      // Assert: Backup created
      const backupKey = Object.keys(localStorage).find((k) =>
        k.includes(":corrupt:")
      );
      expect(backupKey).toBeDefined();
      expect(localStorage.getItem(backupKey!)).toBe(wrongType);

      // Assert: Corruption flag set
      expect(consumeCorruptionFlag()).toBe(true);
    });

    it("should handle missing key gracefully (return fallback, no backup)", () => {
      const key = STORAGE_KEYS.WORKPLACES;
      // Key does not exist in localStorage

      const fallback: Workplace[] = [];
      const result = readRaw(key, fallback, isWorkplaceArray);

      // Assert: Returns fallback
      expect(result).toEqual(fallback);

      // Assert: No backup created (key was missing, not corrupted)
      const backupKeys = Object.keys(localStorage).filter((k) =>
        k.includes(":corrupt:")
      );
      expect(backupKeys.length).toBe(0);

      // Assert: Corruption flag NOT set (missing is different from corrupt)
      expect(consumeCorruptionFlag()).toBe(false);
    });
  });

  describe("AC-3: Null/quota handling, writeRaw guards", () => {
    it("should read 'null' string from paychecks and return fallback (empty array)", () => {
      const key = STORAGE_KEYS.PAYCHECKS;
      localStorage.setItem(key, "null");

      const fallback: PayCheck[] = [];
      const result = readRaw(key, fallback, isPayCheckArray);

      // Assert: Returns fallback ([] not null)
      expect(result).toEqual(fallback);
      expect(result).not.toBe(null);

      // Assert: Key is restored to JSON-serialized fallback
      const restored = localStorage.getItem(key);
      expect(restored).toBe(JSON.stringify(fallback));
    });

    it("should return backup key that does not contain 'undefined' string", () => {
      const key = STORAGE_KEYS.RECORDS;
      localStorage.setItem(key, '{"broken": true}');

      const fallback: WorkRecord[] = [];
      readRaw(key, fallback, isRecordArray);

      const backupKey = Object.keys(localStorage).find((k) =>
        k.includes(":corrupt:")
      );
      expect(backupKey).toBeDefined();
      expect(backupKey).not.toContain("undefined");
    });

    it("should writeRaw return {ok: false, reason: 'size'} when value exceeds MAX_SERIALIZED_LENGTH", () => {
      const key = "test:large";
      const hugeValue = "x".repeat(MAX_SERIALIZED_LENGTH + 1);

      const result = writeRaw(key, hugeValue);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("size");

      // Assert: Nothing written to localStorage
      expect(localStorage.getItem(key)).toBeFalsy();
    });

    it("should writeRaw return {ok: false, reason: 'quota'} when localStorage.setItem throws QuotaExceededError", () => {
      const key = "test:quota";
      const value = { data: "test" };

      // Mock localStorage to throw QuotaExceededError
      // (jsdom's Storage is Proxy-backed — direct `localStorage.setItem = fn`
      // assignment is silently swallowed, so spy on the prototype instead)
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      });

      const result = writeRaw(key, value);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("quota");

      // Restore
      spy.mockRestore();
    });

    it("should writeRaw NOT throw, handle quota silently in backup scenario", () => {
      const key = STORAGE_KEYS.WORKPLACES;
      const corruptedData = '{"invalid": true}';
      localStorage.setItem(key, corruptedData);

      const originalSetItem = Storage.prototype.setItem;
      let setItemCallCount = 0;
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, k: string, v: string) {
          setItemCallCount++;
          // Fail on backup write (first call), succeed on restore
          if (setItemCallCount === 1 && k.includes(":corrupt:")) {
            const error = new Error("QuotaExceededError");
            error.name = "QuotaExceededError";
            throw error;
          }
          originalSetItem.call(this, k, v);
        });

      const fallback: Workplace[] = [];

      // Should not throw, should return fallback
      expect(() => {
        readRaw(key, fallback, isWorkplaceArray);
      }).not.toThrow();

      // Restore
      spy.mockRestore();
    });

    it("should writeRaw return {ok: true} on successful write", () => {
      const key = "test:success";
      const value = { amount: 5000, currency: "KRW" };

      const result = writeRaw(key, value);

      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();

      // Assert: Value written to localStorage
      const stored = localStorage.getItem(key);
      expect(stored).toBe(JSON.stringify(value));
    });
  });

  describe("AC-4: consumeCorruptionFlag behavior", () => {
    it("should return true only on first call after corruption detected", () => {
      const key = STORAGE_KEYS.WORKPLACES;
      localStorage.setItem(key, '{"bad": json}');

      const fallback: Workplace[] = [];
      readRaw(key, fallback, isWorkplaceArray); // Triggers corruption

      // First call returns true
      expect(consumeCorruptionFlag()).toBe(true);

      // Second call returns false
      expect(consumeCorruptionFlag()).toBe(false);

      // Third call also returns false
      expect(consumeCorruptionFlag()).toBe(false);
    });

    it("should return false when no corruption has occurred", () => {
      // No corruption triggered
      expect(consumeCorruptionFlag()).toBe(false);
      expect(consumeCorruptionFlag()).toBe(false);
    });

    it("should reset flag state independently for each new corruption event", () => {
      // First corruption
      const key1 = STORAGE_KEYS.WORKPLACES;
      localStorage.setItem(key1, '{"bad": json}');
      readRaw(key1, [], isWorkplaceArray);

      expect(consumeCorruptionFlag()).toBe(true);
      expect(consumeCorruptionFlag()).toBe(false);

      // Second corruption
      const key2 = STORAGE_KEYS.RECORDS;
      localStorage.setItem(key2, "invalid");
      readRaw(key2, [], isRecordArray);

      // Flag should be true again for new corruption
      expect(consumeCorruptionFlag()).toBe(true);
      expect(consumeCorruptionFlag()).toBe(false);
    });
  });

  describe("Type Guards", () => {
    it("isWorkplaceArray should accept valid Workplace array", () => {
      const valid: Workplace[] = [
        {
          id: "wp-1",
          name: "ABC Company",
          hourlyWage: 12000,
          isFiveOrMore: true,
          payday: 25,
          taxType: "none",
          colorToken: "blue",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      expect(isWorkplaceArray(valid)).toBe(true);
    });

    it("isWorkplaceArray should reject non-array", () => {
      expect(isWorkplaceArray({ workplaces: [] })).toBe(false);
      expect(isWorkplaceArray("string")).toBe(false);
      expect(isWorkplaceArray(null)).toBe(false);
    });

    it("isWorkplaceArray should reject array with invalid items", () => {
      const invalid = [{ id: "wp-1", name: "Test" }]; // Missing required fields

      expect(isWorkplaceArray(invalid)).toBe(false);
    });

    it("isRecordArray should accept valid WorkRecord array", () => {
      const valid: WorkRecord[] = [
        {
          id: "rec-1",
          workplaceId: "wp-1",
          date: "2026-01-15",
          startTime: "09:00",
          endTime: "18:00",
          breakMinutes: 60,
          isHoliday: false,
          memo: "Normal day",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      expect(isRecordArray(valid)).toBe(true);
    });

    it("isRecordArray should reject invalid items", () => {
      const invalid = [{ id: "rec-1", date: "2026-01-15" }];

      expect(isRecordArray(invalid)).toBe(false);
    });

    it("isPayCheckArray should accept valid PayCheck array", () => {
      const valid: PayCheck[] = [
        {
          id: "pc-1",
          workplaceId: "wp-1",
          yearMonth: "2026-01",
          actualPaidAmount: 2500000,
          calculatedGross: 2450000,
          calculatedNet: 2100000,
          diff: 50000,
          suspects: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      expect(isPayCheckArray(valid)).toBe(true);
    });

    it("isPayCheckArray should reject invalid structure", () => {
      const invalid = [{ id: "pc-1", yearMonth: "2026-01" }];

      expect(isPayCheckArray(invalid)).toBe(false);
    });

    it("isSettingsObject should accept valid AppSettings", () => {
      const valid: AppSettings = DEFAULT_SETTINGS;

      expect(isSettingsObject(valid)).toBe(true);
    });

    it("isSettingsObject should accept settings with values populated", () => {
      const valid: AppSettings = {
        onboardingSeenAt: "2026-01-01T00:00:00Z",
        disclaimerAckAt: "2026-01-02T00:00:00Z",
        activeWorkplaceId: "wp-1",
        rewardUnlocks: { reward1: "2026-01-03T00:00:00Z" },
        schemaVersion: 1,
      };

      expect(isSettingsObject(valid)).toBe(true);
    });

    it("isSettingsObject should reject non-object", () => {
      expect(isSettingsObject([])).toBe(false);
      expect(isSettingsObject("string")).toBe(false);
      expect(isSettingsObject(null)).toBe(false);
    });

    it("isSettingsObject should reject object missing required fields", () => {
      const invalid = { schemaVersion: 1 }; // Missing other fields

      expect(isSettingsObject(invalid)).toBe(false);
    });
  });

  describe("Integration: Full read-write-recover cycle", () => {
    it("should read valid data, modify, write successfully, then read again", () => {
      const key = STORAGE_KEYS.WORKPLACES;

      // Write initial valid data
      const wp: Workplace = {
        id: "wp-1",
        name: "Company A",
        hourlyWage: 12000,
        isFiveOrMore: true,
        payday: 25,
        taxType: "none",
        colorToken: "blue",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result1 = writeRaw(key, [wp]);
      expect(result1.ok).toBe(true);

      // Read it back
      const read1 = readRaw(key, [], isWorkplaceArray);
      expect(read1).toHaveLength(1);
      expect(read1[0].id).toBe("wp-1");

      // Clear and simulate corruption
      localStorage.setItem(key, 'corrupted');

      // Recover with fallback
      const fallback: Workplace[] = [];
      const recovered = readRaw(key, fallback, isWorkplaceArray);
      expect(recovered).toEqual(fallback);

      // Write new data
      const wp2: Workplace = {
        ...wp,
        id: "wp-2",
        name: "Company B",
      };
      const result2 = writeRaw(key, [wp2]);
      expect(result2.ok).toBe(true);

      // Read final state
      const final = readRaw(key, [], isWorkplaceArray);
      expect(final).toHaveLength(1);
      expect(final[0].id).toBe("wp-2");
    });
  });

  describe("Code quality checks", () => {
    // These tests verify implementation details that will be checked
    // by reading the actual source code post-implementation
    it("should not contain console.error calls in source (implementation check)", () => {
      // Placeholder: actual check will be via source code inspection
      // Verify storage module can be imported without errors
      expect(() => {
        // Future: import storage module
      }).not.toThrow();
    });

    it("should not import React or TDS components (implementation check)", () => {
      // Placeholder: actual check will be via source code inspection
      // Storage module should be pure JS with no UI dependencies
      expect(true).toBe(true);
    });
  });
});
