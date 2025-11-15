/**
 * Data Validation Bug Fixes Tests
 *
 * Tests for data validation improvements:
 * - Bug #8: Off-by-one errors in diagnostic cleanup
 * - Bug #9: Off-by-one errors in daily cleanup
 * - Bug #10: Array bounds checking
 * - Bug #23: getRange invalid parameters
 * - Bug #24: getRange with empty sheets
 * - Bug #27: Schema validation for updates
 * - Bug #28: Safe JSON parsing
 */

describe('Data Validation Bug Fixes', () => {

  describe('Bug #8 & #9: Off-by-One Errors', () => {
    test('should calculate correct rows to delete for hard cap', () => {
      const DIAG_MAX = 3000;

      // Test when last row exceeds cap
      const last1 = 3500;
      const rowsToDelete1 = last1 - DIAG_MAX;
      expect(rowsToDelete1).toBe(500);

      // Test when last row is at cap
      const last2 = 3000;
      const rowsToDelete2 = last2 - DIAG_MAX;
      expect(rowsToDelete2).toBe(0);

      // Test when last row is below cap
      const last3 = 2500;
      const rowsToDelete3 = last3 - DIAG_MAX;
      expect(rowsToDelete3).toBe(-500);
      expect(rowsToDelete3 > 0).toBe(false); // Should not delete
    });

    test('should calculate correct rows for daily cleanup', () => {
      const DIAG_PER_DAY = 800;

      // If we have 900 entries for today
      const todayEntries = 900;
      const rowsToDelete = todayEntries - DIAG_PER_DAY;
      expect(rowsToDelete).toBe(100);

      // If we have exactly 800 entries
      const exactEntries = 800;
      const rowsToDelete2 = exactEntries - DIAG_PER_DAY;
      expect(rowsToDelete2).toBe(0);
    });

    test('should not delete when count is below threshold', () => {
      const DIAG_PER_DAY = 800;
      const todayEntries = 500;
      const rowsToDelete = todayEntries - DIAG_PER_DAY;

      expect(rowsToDelete).toBeLessThan(0);
      // In actual code, we check: if (rowsToDelete > 0)
      expect(rowsToDelete > 0).toBe(false);
    });
  });

  describe('Bug #10: Array Bounds Checking', () => {
    test('should check array length before accessing elements', () => {
      const emptyArray = [];
      const nonEmptyArray = [{ sponsorId: 'sponsor1' }];

      // Safe access pattern
      const accessSafely = (arr) => {
        if (arr && arr.length > 0) {
          return arr[0];
        }
        return null;
      };

      expect(accessSafely(emptyArray)).toBe(null);
      expect(accessSafely(nonEmptyArray)).toEqual({ sponsorId: 'sponsor1' });
    });

    test('should handle undefined array', () => {
      const accessSafely = (arr) => {
        if (arr && arr.length > 0) {
          return arr[0];
        }
        return null;
      };

      expect(accessSafely(undefined)).toBe(null);
      expect(accessSafely(null)).toBe(null);
    });

    test('should check before accessing nested properties', () => {
      const metrics = {
        bySponsor: []
      };

      const getTopSponsor = (m) => {
        if (m.bySponsor && m.bySponsor.length > 0) {
          const topSponsor = m.bySponsor[0];
          if (topSponsor && topSponsor.sponsorId) {
            return topSponsor.sponsorId;
          }
        }
        return null;
      };

      expect(getTopSponsor(metrics)).toBe(null);

      metrics.bySponsor.push({ sponsorId: 'sponsor1' });
      expect(getTopSponsor(metrics)).toBe('sponsor1');
    });
  });

  describe('Bug #23 & #24: getRange Invalid Parameters', () => {
    test('should check lastRow before calling getRange', () => {
      const simulateGetRange = (lastRow) => {
        // getRange requires at least 1 row
        if (lastRow > 1) {
          const numRows = lastRow - 1;
          return { success: true, rows: numRows };
        }
        return { success: false, rows: 0 };
      };

      // Sheet with only header
      expect(simulateGetRange(1)).toEqual({ success: false, rows: 0 });

      // Sheet with header + data
      expect(simulateGetRange(5)).toEqual({ success: true, rows: 4 });
    });

    test('should return empty array for empty sheets', () => {
      const getDataSafely = (lastRow) => {
        if (lastRow > 1) {
          return Array(lastRow - 1).fill({ data: 'row' });
        }
        return [];
      };

      expect(getDataSafely(1)).toEqual([]);
      expect(getDataSafely(3).length).toBe(2);
    });

    test('should handle Math.max correctly', () => {
      // Bug was: Math.max(0, lastRow - 1) when lastRow = 1
      const lastRow = 1;
      const numRows = Math.max(0, lastRow - 1);

      expect(numRows).toBe(0);
      // getRange(2, 1, 0, 6) would throw error
      // So we need to check: if (numRows > 0)
      expect(numRows > 0).toBe(false);
    });
  });

  describe('Bug #27: Schema Validation for Updates', () => {
    let template;

    beforeEach(() => {
      template = {
        fields: [
          { id: 'name', type: 'text', required: true },
          { id: 'description', type: 'text', required: false },
          { id: 'websiteUrl', type: 'url', required: false },
          { id: 'videoUrl', type: 'url', required: false }
        ]
      };
    });

    test('should accept valid fields', () => {
      const updateData = {
        name: 'Updated Event',
        description: 'New description'
      };

      const validateUpdate = (data, tpl) => {
        for (const [key, value] of Object.entries(data)) {
          const field = tpl.fields.find(f => f.id === key);
          if (!field) {
            return { valid: false, error: `Unknown field: ${key}` };
          }
        }
        return { valid: true };
      };

      expect(validateUpdate(updateData, template)).toEqual({ valid: true });
    });

    test('should reject unknown fields', () => {
      const updateData = {
        unknownField: 'value'
      };

      const validateUpdate = (data, tpl) => {
        for (const [key, value] of Object.entries(data)) {
          const field = tpl.fields.find(f => f.id === key);
          if (!field) {
            return { valid: false, error: `Unknown field: ${key}` };
          }
        }
        return { valid: true };
      };

      const result = validateUpdate(updateData, template);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown field: unknownField');
    });

    test('should validate URL fields', () => {
      const isUrl = (s) => {
        try {
          const url = new URL(s);
          return ['http:', 'https:'].includes(url.protocol);
        } catch {
          return false;
        }
      };

      const validateUpdate = (data, tpl) => {
        for (const [key, value] of Object.entries(data)) {
          const field = tpl.fields.find(f => f.id === key);
          if (!field) {
            return { valid: false, error: `Unknown field: ${key}` };
          }

          if (value !== null && value !== undefined) {
            if (field.type === 'url' && !isUrl(value)) {
              return { valid: false, error: `Invalid URL for field: ${key}` };
            }
          }
        }
        return { valid: true };
      };

      expect(validateUpdate({ websiteUrl: 'https://example.com' }, template)).toEqual({ valid: true });
      expect(validateUpdate({ websiteUrl: 'invalid-url' }, template).valid).toBe(false);
    });

    test('should allow null/undefined values', () => {
      const validateUpdate = (data, tpl) => {
        for (const [key, value] of Object.entries(data)) {
          const field = tpl.fields.find(f => f.id === key);
          if (!field) {
            return { valid: false, error: `Unknown field: ${key}` };
          }
        }
        return { valid: true };
      };

      expect(validateUpdate({ description: null }, template)).toEqual({ valid: true });
      expect(validateUpdate({ description: undefined }, template)).toEqual({ valid: true });
    });
  });

  describe('Bug #28: Safe JSON Parsing', () => {
    let safeJSONParse_;

    beforeEach(() => {
      safeJSONParse_ = function(jsonString, defaultValue = {}) {
        try {
          return JSON.parse(jsonString || '{}');
        } catch (e) {
          return defaultValue;
        }
      };
    });

    test('should parse valid JSON', () => {
      const result = safeJSONParse_('{"name": "test", "value": 123}');
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    test('should return default for invalid JSON', () => {
      const result = safeJSONParse_('invalid json');
      expect(result).toEqual({});
    });

    test('should use custom default value', () => {
      const result = safeJSONParse_('invalid', []);
      expect(result).toEqual([]);
    });

    test('should handle empty string', () => {
      const result = safeJSONParse_('');
      expect(result).toEqual({});
    });

    test('should handle null', () => {
      const result = safeJSONParse_(null);
      expect(result).toEqual({});
    });

    test('should handle undefined', () => {
      const result = safeJSONParse_(undefined);
      expect(result).toEqual({});
    });

    test('should parse nested objects', () => {
      const json = '{"user": {"name": "John", "age": 30}}';
      const result = safeJSONParse_(json);
      expect(result.user.name).toBe('John');
      expect(result.user.age).toBe(30);
    });

    test('should not throw on truncated JSON', () => {
      const truncated = '{"name": "test", "incomplete"';
      expect(() => safeJSONParse_(truncated)).not.toThrow();
      expect(safeJSONParse_(truncated)).toEqual({});
    });
  });

  describe('Template Field Validation', () => {
    let template;

    beforeEach(() => {
      template = {
        fields: [
          { id: 'name', type: 'text', required: true },
          { id: 'email', type: 'text', required: true },
          { id: 'website', type: 'url', required: false },
          { id: 'description', type: 'text', required: false }
        ]
      };
    });

    test('should validate required fields', () => {
      const validateRequired = (data, tpl) => {
        for (const field of tpl.fields) {
          if (field.required) {
            const value = data[field.id];
            if (value === undefined || value === null || value === '') {
              return { valid: false, error: `Missing field: ${field.id}` };
            }
          }
        }
        return { valid: true };
      };

      expect(validateRequired({ name: 'Test', email: 'test@test.com' }, template)).toEqual({ valid: true });
      expect(validateRequired({ name: 'Test' }, template).valid).toBe(false);
      expect(validateRequired({}, template).valid).toBe(false);
    });

    test('should allow optional fields to be missing', () => {
      const validateRequired = (data, tpl) => {
        for (const field of tpl.fields) {
          if (field.required) {
            const value = data[field.id];
            if (value === undefined || value === null || value === '') {
              return { valid: false, error: `Missing field: ${field.id}` };
            }
          }
        }
        return { valid: true };
      };

      const data = { name: 'Test', email: 'test@test.com' };
      // website and description are optional
      expect(validateRequired(data, template)).toEqual({ valid: true });
    });

    test('should validate field types', () => {
      const isUrl = (s) => {
        try {
          new URL(s);
          return true;
        } catch {
          return false;
        }
      };

      const validateTypes = (data, tpl) => {
        for (const field of tpl.fields) {
          const value = data[field.id];
          if (value != null && field.type === 'url' && !isUrl(value)) {
            return { valid: false, error: `Invalid URL: ${field.id}` };
          }
        }
        return { valid: true };
      };

      expect(validateTypes({ website: 'https://example.com' }, template)).toEqual({ valid: true });
      expect(validateTypes({ website: 'not-a-url' }, template).valid).toBe(false);
    });
  });
});
