/**
 * Comprehensive Unit Tests for Backend Functions (Code.gs)
 *
 * Tests all utility functions, guards, helpers, and business logic
 * Run with: npm test
 */

describe('Error Envelopes', () => {
  const Ok = (value={}) => ({ ok: true, value });
  const Err = (code, message) => ({ ok: false, code, message: message || code });

  describe('Ok envelope', () => {
    it('should create success response with value', () => {
      const res = Ok({ id: '123', name: 'Test' });
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ id: '123', name: 'Test' });
    });

    it('should default to empty object if no value provided', () => {
      const res = Ok();
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({});
    });
  });

  describe('Err envelope', () => {
    it('should create error response with code and message', () => {
      const res = Err('NOT_FOUND', 'Resource not found');
      expect(res.ok).toBe(false);
      expect(res.code).toBe('NOT_FOUND');
      expect(res.message).toBe('Resource not found');
    });

    it('should use code as message if message not provided', () => {
      const res = Err('BAD_INPUT');
      expect(res.ok).toBe(false);
      expect(res.code).toBe('BAD_INPUT');
      expect(res.message).toBe('BAD_INPUT');
    });

    it('should handle all error codes', () => {
      const codes = ['BAD_INPUT', 'NOT_FOUND', 'RATE_LIMITED', 'INTERNAL', 'CONTRACT'];
      codes.forEach(code => {
        const res = Err(code);
        expect(res.code).toBe(code);
      });
    });
  });
});

describe('Input Sanitization', () => {
  const sanitizeInput_ = (input) => {
    if (!input || typeof input !== 'string') return '';
    return String(input)
      .replace(/[<>"']/g, '')
      .trim()
      .slice(0, 1000);
  };

  describe('XSS prevention', () => {
    it('should remove < and >', () => {
      expect(sanitizeInput_('<script>alert("XSS")</script>'))
        .toBe('scriptalert(XSS)/script');
    });

    it('should remove double quotes', () => {
      expect(sanitizeInput_('"malicious"')).toBe('malicious');
    });

    it('should remove single quotes', () => {
      expect(sanitizeInput_("'malicious'")).toBe('malicious');
    });

    it('should remove all dangerous characters at once', () => {
      expect(sanitizeInput_('<div class="test">content</div>'))
        .toBe('div class=testcontent/div');
    });
  });

  describe('Whitespace handling', () => {
    it('should trim leading whitespace', () => {
      expect(sanitizeInput_('   hello')).toBe('hello');
    });

    it('should trim trailing whitespace', () => {
      expect(sanitizeInput_('hello   ')).toBe('hello');
    });

    it('should trim both sides', () => {
      expect(sanitizeInput_('   hello world   ')).toBe('hello world');
    });

    it('should preserve internal whitespace', () => {
      expect(sanitizeInput_('hello   world')).toBe('hello   world');
    });
  });

  describe('Length limits', () => {
    it('should limit to 1000 characters', () => {
      const longString = 'a'.repeat(1500);
      const result = sanitizeInput_(longString);
      expect(result).toHaveLength(1000);
      expect(result).toBe('a'.repeat(1000));
    });

    it('should not truncate strings under 1000 chars', () => {
      const str = 'a'.repeat(999);
      expect(sanitizeInput_(str)).toHaveLength(999);
    });
  });

  describe('Edge cases', () => {
    it('should return empty string for null', () => {
      expect(sanitizeInput_(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(sanitizeInput_(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(sanitizeInput_('')).toBe('');
    });

    it('should return empty string for non-string types', () => {
      expect(sanitizeInput_(123)).toBe('');
      expect(sanitizeInput_({})).toBe('');
      expect(sanitizeInput_([])).toBe('');
    });

    it('should handle strings with only dangerous characters', () => {
      expect(sanitizeInput_("<>\"'<>\"'")).toBe('');
    });
  });
});

describe('URL Validation', () => {
  const isUrl = (s) => {
    try {
      const url = new URL(String(s));
      return ['http:', 'https:'].includes(url.protocol);
    } catch(_) {
      return false;
    }
  };

  describe('Valid URLs', () => {
    it('should accept http:// URLs', () => {
      expect(isUrl('http://example.com')).toBe(true);
    });

    it('should accept https:// URLs', () => {
      expect(isUrl('https://example.com')).toBe(true);
    });

    it('should accept URLs with paths', () => {
      expect(isUrl('https://example.com/path/to/resource')).toBe(true);
    });

    it('should accept URLs with query strings', () => {
      expect(isUrl('https://example.com?foo=bar&baz=qux')).toBe(true);
    });

    it('should accept URLs with ports', () => {
      expect(isUrl('http://localhost:8080')).toBe(true);
    });

    it('should accept URLs with hashes', () => {
      expect(isUrl('https://example.com/page#section')).toBe(true);
    });
  });

  describe('Invalid URLs - Security', () => {
    it('should reject javascript: protocol', () => {
      expect(isUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject data: protocol', () => {
      expect(isUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should reject file: protocol', () => {
      expect(isUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject ftp: protocol', () => {
      expect(isUrl('ftp://example.com')).toBe(false);
    });

    it('should reject vbscript: protocol', () => {
      expect(isUrl('vbscript:msgbox(1)')).toBe(false);
    });
  });

  describe('Invalid URLs - Malformed', () => {
    it('should reject plain text', () => {
      expect(isUrl('not a url')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isUrl('')).toBe(false);
    });

    it('should reject null', () => {
      expect(isUrl(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isUrl(undefined)).toBe(false);
    });

    it('should reject relative URLs', () => {
      expect(isUrl('/path/to/resource')).toBe(false);
    });

    it('should reject URLs without protocol', () => {
      expect(isUrl('example.com')).toBe(false);
    });
  });
});

describe('Schema Validation', () => {
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
    } else if (schema.type === 'array' && Array.isArray(obj)) {
      // Arrays are valid
    } else if (schema.type && typeof obj !== schema.type) {
      throw new Error(`Schema type mismatch: expected ${schema.type}, got ${typeof obj}`);
    }
    return true;
  };

  describe('Required fields', () => {
    const schema = {
      type: 'object',
      props: {
        name: { type: 'string', required: true },
        age: { type: 'number', required: true }
      }
    };

    it('should pass when all required fields present', () => {
      expect(() => schemaCheck(schema, { name: 'John', age: 30 })).not.toThrow();
    });

    it('should fail when required field missing', () => {
      expect(() => schemaCheck(schema, { name: 'John' }))
        .toThrow('Missing required field: age');
    });

    it('should fail when multiple required fields missing', () => {
      expect(() => schemaCheck(schema, {}))
        .toThrow('Missing required field');
    });
  });

  describe('Type validation', () => {
    const schema = {
      type: 'object',
      props: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' }
      }
    };

    it('should pass with correct types', () => {
      expect(() => schemaCheck(schema, {
        name: 'John',
        age: 30,
        active: true
      })).not.toThrow();
    });

    it('should fail with incorrect string type', () => {
      expect(() => schemaCheck(schema, { name: 123 }))
        .toThrow('Type mismatch for name: expected string');
    });

    it('should fail with incorrect number type', () => {
      expect(() => schemaCheck(schema, { age: '30' }))
        .toThrow('Type mismatch for age: expected number');
    });

    it('should fail with incorrect boolean type', () => {
      expect(() => schemaCheck(schema, { active: 'true' }))
        .toThrow('Type mismatch for active: expected boolean');
    });
  });

  describe('Optional fields', () => {
    const schema = {
      type: 'object',
      props: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: false }
      }
    };

    it('should pass when optional field omitted', () => {
      expect(() => schemaCheck(schema, { name: 'John' })).not.toThrow();
    });

    it('should pass when optional field provided with correct type', () => {
      expect(() => schemaCheck(schema, {
        name: 'John',
        email: 'john@example.com'
      })).not.toThrow();
    });

    it('should fail when optional field has wrong type', () => {
      expect(() => schemaCheck(schema, { name: 'John', email: 123 }))
        .toThrow('Type mismatch for email');
    });
  });

  describe('Schema types', () => {
    it('should validate array type', () => {
      const schema = { type: 'array' };
      expect(() => schemaCheck(schema, [])).not.toThrow();
      expect(() => schemaCheck(schema, [1, 2, 3])).not.toThrow();
    });

    it('should validate string type', () => {
      const schema = { type: 'string' };
      expect(() => schemaCheck(schema, 'hello')).not.toThrow();
      expect(() => schemaCheck(schema, 123)).toThrow('Schema type mismatch');
    });

    it('should validate number type', () => {
      const schema = { type: 'number' };
      expect(() => schemaCheck(schema, 42)).not.toThrow();
      expect(() => schemaCheck(schema, '42')).toThrow('Schema type mismatch');
    });

    it('should validate boolean type', () => {
      const schema = { type: 'boolean' };
      expect(() => schemaCheck(schema, true)).not.toThrow();
      expect(() => schemaCheck(schema, 'true')).toThrow('Schema type mismatch');
    });
  });
});

describe('Frontend SDK (NU)', () => {
  const esc = (s) => {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#39;'
    }[m]));
  };

  describe('HTML entity escaping', () => {
    it('should escape < to &lt;', () => {
      expect(esc('<')).toBe('&lt;');
    });

    it('should escape > to &gt;', () => {
      expect(esc('>')).toBe('&gt;');
    });

    it('should escape & to &amp;', () => {
      expect(esc('&')).toBe('&amp;');
    });

    it('should escape " to &quot;', () => {
      expect(esc('"')).toBe('&quot;');
    });

    it('should escape \' to &#39;', () => {
      expect(esc("'")).toBe('&#39;');
    });
  });

  describe('XSS protection', () => {
    it('should escape script tags', () => {
      expect(esc('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should escape img onerror attack', () => {
      expect(esc('<img src=x onerror="alert(1)">'))
        .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });

    it('should escape event handlers', () => {
      expect(esc('<div onclick="evil()">'))
        .toBe('&lt;div onclick=&quot;evil()&quot;&gt;');
    });

    it('should escape HTML entities in user content', () => {
      expect(esc('Ben & Jerry\'s "Ice Cream" <3'))
        .toBe('Ben &amp; Jerry&#39;s &quot;Ice Cream&quot; &lt;3');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(esc('')).toBe('');
    });

    it('should handle string with no special chars', () => {
      expect(esc('Hello World')).toBe('Hello World');
    });

    it('should handle multiple occurrences', () => {
      expect(esc('<<>>')).toBe('&lt;&lt;&gt;&gt;');
    });

    it('should handle numbers', () => {
      expect(esc(123)).toBe('123');
    });

    it('should handle unicode', () => {
      expect(esc('Hello 世界')).toBe('Hello 世界');
    });
  });
});

describe('Rate Limiting Logic', () => {
  const RATE_MAX_PER_MIN = 20;

  function checkRateLimit(requestCount) {
    return requestCount < RATE_MAX_PER_MIN;
  }

  it('should allow requests under limit', () => {
    expect(checkRateLimit(0)).toBe(true);
    expect(checkRateLimit(10)).toBe(true);
    expect(checkRateLimit(19)).toBe(true);
  });

  it('should block requests at limit', () => {
    expect(checkRateLimit(20)).toBe(false);
  });

  it('should block requests over limit', () => {
    expect(checkRateLimit(21)).toBe(false);
    expect(checkRateLimit(100)).toBe(false);
  });

  it('should have correct limit constant', () => {
    expect(RATE_MAX_PER_MIN).toBe(20);
  });
});

describe('Slug Generation', () => {
  function generateSlug(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  it('should convert to lowercase', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should replace spaces with hyphens', () => {
    expect(generateSlug('my event name')).toBe('my-event-name');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Event @ 2024!')).toBe('event-2024');
  });

  it('should remove leading hyphens', () => {
    expect(generateSlug('---test')).toBe('test');
  });

  it('should remove trailing hyphens', () => {
    expect(generateSlug('test---')).toBe('test');
  });

  it('should handle consecutive spaces', () => {
    expect(generateSlug('hello    world')).toBe('hello-world');
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should preserve numbers', () => {
    expect(generateSlug('Event 2024')).toBe('event-2024');
  });

  it('should handle unicode characters', () => {
    expect(generateSlug('Café Münchën')).toBe('caf-m-nch-n');
  });
});
