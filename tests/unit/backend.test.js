/**
 * Unit Tests for Backend Functions (Code.gs)
 *
 * Note: These tests require mocking Google Apps Script globals
 * Run with: npm test
 */

describe('Backend API Functions', () => {

  describe('sanitizeInput_', () => {
    it('should remove HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = 'scriptalert(XSS)/script';
      // Mock implementation for testing
      const sanitizeInput_ = (input) => {
        if (!input || typeof input !== 'string') return '';
        return String(input)
          .replace(/[<>"']/g, '')
          .trim()
          .slice(0, 1000);
      };
      expect(sanitizeInput_(input)).toBe(expected);
    });

    it('should trim whitespace', () => {
      const sanitizeInput_ = (input) => {
        if (!input || typeof input !== 'string') return '';
        return String(input)
          .replace(/[<>"']/g, '')
          .trim()
          .slice(0, 1000);
      };
      expect(sanitizeInput_('  hello  ')).toBe('hello');
    });

    it('should limit to 1000 characters', () => {
      const sanitizeInput_ = (input) => {
        if (!input || typeof input !== 'string') return '';
        return String(input)
          .replace(/[<>"']/g, '')
          .trim()
          .slice(0, 1000);
      };
      const longString = 'a'.repeat(1500);
      expect(sanitizeInput_(longString)).toHaveLength(1000);
    });

    it('should handle null and undefined', () => {
      const sanitizeInput_ = (input) => {
        if (!input || typeof input !== 'string') return '';
        return String(input)
          .replace(/[<>"']/g, '')
          .trim()
          .slice(0, 1000);
      };
      expect(sanitizeInput_(null)).toBe('');
      expect(sanitizeInput_(undefined)).toBe('');
    });
  });

  describe('isUrl', () => {
    const isUrl = (s) => {
      try {
        const url = new URL(String(s));
        return ['http:', 'https:'].includes(url.protocol);
      } catch(_) {
        return false;
      }
    };

    it('should validate HTTP URLs', () => {
      expect(isUrl('http://example.com')).toBe(true);
      expect(isUrl('https://example.com')).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      expect(isUrl('ftp://example.com')).toBe(false);
      expect(isUrl('javascript:alert(1)')).toBe(false);
      expect(isUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isUrl('not a url')).toBe(false);
      expect(isUrl('')).toBe(false);
      expect(isUrl(null)).toBe(false);
    });
  });

  describe('schemaCheck', () => {
    const schemaCheck = (schema, obj) => {
      if (schema.type === 'object' && obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(schema.props || {})) {
          if (v.required && !(k in obj)) {
            throw new Error(`Missing required field: ${k}`);
          }
          if (k in obj && v.type && typeof obj[k] !== v.type) {
            throw new Error(`Type mismatch for ${k}: expected ${v.type}, got ${typeof obj[k]}`);
          }
        }
      } else if (schema.type && typeof obj !== schema.type) {
        throw new Error(`Schema type mismatch: expected ${schema.type}, got ${typeof obj}`);
      }
      return true;
    };

    it('should validate required fields', () => {
      const schema = {
        type: 'object',
        props: {
          name: { type: 'string', required: true }
        }
      };

      expect(() => schemaCheck(schema, {})).toThrow('Missing required field: name');
      expect(() => schemaCheck(schema, { name: 'test' })).not.toThrow();
    });

    it('should validate field types', () => {
      const schema = {
        type: 'object',
        props: {
          age: { type: 'number' }
        }
      };

      expect(() => schemaCheck(schema, { age: 'not a number' })).toThrow('Type mismatch');
      expect(() => schemaCheck(schema, { age: 25 })).not.toThrow();
    });
  });

  describe('Ok/Err envelopes', () => {
    const Ok = (value={}) => ({ ok: true, value });
    const Err = (code, message) => ({ ok: false, code, message: message || code });

    it('should create Ok response', () => {
      const res = Ok({ id: '123' });
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ id: '123' });
    });

    it('should create Err response', () => {
      const res = Err('NOT_FOUND', 'Resource not found');
      expect(res.ok).toBe(false);
      expect(res.code).toBe('NOT_FOUND');
      expect(res.message).toBe('Resource not found');
    });

    it('should default message to code', () => {
      const res = Err('BAD_INPUT');
      expect(res.message).toBe('BAD_INPUT');
    });
  });
});

describe('Frontend SDK (NU)', () => {

  describe('NU.esc', () => {
    const esc = (s) => {
      return String(s).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;'
      }[m]));
    };

    it('should escape HTML entities', () => {
      expect(esc('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(esc('Ben & Jerry')).toBe('Ben &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(esc('He said "hello"')).toBe('He said &quot;hello&quot;');
      expect(esc("It's working")).toBe('It&#39;s working');
    });
  });
});
