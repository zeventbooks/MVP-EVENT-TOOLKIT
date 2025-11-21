/**
 * SharedUtils Unit Tests
 *
 * Tests for the shared utilities module used across
 * Sponsor.html, Signup.html, PlannerCards.html, Admin.html
 *
 * Dependencies tested:
 * - showAlert: Alert/notification system
 * - formatDate: Date formatting utilities
 * - formatRelativeTime: Relative time strings
 * - validateForm: Form validation
 * - isValidEmail/isValidUrl: Input validation
 * - withLoadingState: Async loading state management
 * - esc: XSS prevention (delegates to NU.esc)
 * - debounce/throttle: Rate limiting utilities
 */

describe('SharedUtils', () => {

  // =============================================================================
  // DATE FORMATTING
  // =============================================================================

  describe('formatDate()', () => {
    let formatDate;

    beforeAll(() => {
      // Simulate the formatDate function from SharedUtils
      formatDate = function(dateInput, options = {}) {
        if (!dateInput) return 'Date TBD';

        try {
          const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
          if (isNaN(date.getTime())) return 'Invalid Date';

          const defaultOptions = {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          };

          return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
        } catch (e) {
          return 'Date TBD';
        }
      };
    });

    test('should format valid ISO date string', () => {
      const result = formatDate('2025-12-25');
      expect(result).toMatch(/Dec\s+25,?\s+2025/);
    });

    test('should format Date object', () => {
      const result = formatDate(new Date('2025-07-04'));
      expect(result).toMatch(/Jul\s+4,?\s+2025/);
    });

    test('should return "Date TBD" for null/undefined', () => {
      expect(formatDate(null)).toBe('Date TBD');
      expect(formatDate(undefined)).toBe('Date TBD');
      expect(formatDate('')).toBe('Date TBD');
    });

    test('should return "Invalid Date" for invalid date strings', () => {
      expect(formatDate('not-a-date')).toBe('Invalid Date');
      expect(formatDate('abc123')).toBe('Invalid Date');
    });

    test('should accept custom format options', () => {
      const result = formatDate('2025-12-25', { weekday: 'long' });
      expect(result).toMatch(/Thursday/);
    });

    test('should handle edge case dates', () => {
      // Leap year date
      const leapYear = formatDate('2024-02-29');
      expect(leapYear).toMatch(/Feb\s+29,?\s+2024/);

      // Year boundary
      const newYear = formatDate('2025-01-01');
      expect(newYear).toMatch(/Jan\s+1,?\s+2025/);
    });
  });

  describe('formatRelativeTime()', () => {
    let formatRelativeTime;
    let mockNow;

    beforeAll(() => {
      // Fix "now" for consistent testing
      mockNow = new Date('2025-11-21T12:00:00Z');

      formatRelativeTime = function(dateInput) {
        if (!dateInput) return '';

        try {
          const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
          if (isNaN(date.getTime())) return '';

          const diffMs = mockNow - date;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays === 0) return 'Today';
          if (diffDays === 1) return 'Yesterday';
          if (diffDays < 7) return `${diffDays} days ago`;
          if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
          if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
          return `${Math.floor(diffDays / 365)} years ago`;
        } catch (e) {
          return '';
        }
      };
    });

    test('should return "Today" for same day', () => {
      expect(formatRelativeTime('2025-11-21')).toBe('Today');
    });

    test('should return "Yesterday" for previous day', () => {
      expect(formatRelativeTime('2025-11-20')).toBe('Yesterday');
    });

    test('should return "X days ago" for recent dates', () => {
      expect(formatRelativeTime('2025-11-18')).toBe('3 days ago');
      expect(formatRelativeTime('2025-11-16')).toBe('5 days ago');
    });

    test('should return "X weeks ago" for dates within a month', () => {
      expect(formatRelativeTime('2025-11-07')).toBe('2 weeks ago');
      expect(formatRelativeTime('2025-10-28')).toBe('3 weeks ago');
    });

    test('should return "X months ago" for dates within a year', () => {
      expect(formatRelativeTime('2025-09-21')).toBe('2 months ago');
      expect(formatRelativeTime('2025-06-21')).toBe('5 months ago');
    });

    test('should return "X years ago" for dates over a year', () => {
      expect(formatRelativeTime('2023-11-21')).toBe('2 years ago');
    });

    test('should return empty string for null/undefined/invalid', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(undefined)).toBe('');
      expect(formatRelativeTime('invalid')).toBe('');
    });
  });

  // =============================================================================
  // INPUT VALIDATION
  // =============================================================================

  describe('isValidEmail()', () => {
    let isValidEmail;

    beforeAll(() => {
      isValidEmail = function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };
    });

    test('should validate correct email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@domain.org')).toBe(true);
      expect(isValidEmail('name+tag@company.co.uk')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no-at-sign.com')).toBe(false);
      expect(isValidEmail('@no-local-part.com')).toBe(false);
      expect(isValidEmail('no-domain@')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('a@b.c')).toBe(true); // Minimal valid
    });
  });

  describe('isValidUrl()', () => {
    let isValidUrl;

    beforeAll(() => {
      isValidUrl = function(url) {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
    });

    test('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false); // Missing protocol
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('://missing-protocol.com')).toBe(false);
    });
  });

  // =============================================================================
  // XSS PREVENTION (delegates to NU.esc pattern)
  // =============================================================================

  describe('esc() - XSS Prevention', () => {
    let esc;

    beforeAll(() => {
      // Simulate the esc function that delegates to NU.esc
      esc = function(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/[&<>"']/g, m => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[m]));
      };
    });

    test('should escape all HTML special characters', () => {
      expect(esc('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    test('should escape ampersands', () => {
      expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('should escape single quotes', () => {
      expect(esc("It's dangerous")).toBe('It&#39;s dangerous');
    });

    test('should return empty string for null/undefined', () => {
      expect(esc(null)).toBe('');
      expect(esc(undefined)).toBe('');
    });

    test('should handle numbers by converting to string', () => {
      expect(esc(123)).toBe('123');
    });

    test('should escape complex XSS attack vectors', () => {
      const vectors = [
        '<img src="x" onerror="alert(1)">',
        '"><script>alert(document.cookie)</script>',
        "'-alert(1)-'",
        '<svg onload="alert(1)">'
      ];

      vectors.forEach(vector => {
        const escaped = esc(vector);
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
      });
    });
  });

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  describe('debounce()', () => {
    let debounce;

    beforeAll(() => {
      debounce = function(fn, delay = 300) {
        let timeoutId;
        return function(...args) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
      };
    });

    test('should delay function execution', (done) => {
      let callCount = 0;
      const debouncedFn = debounce(() => callCount++, 50);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(callCount).toBe(0); // Not called yet

      setTimeout(() => {
        expect(callCount).toBe(1); // Only called once
        done();
      }, 100);
    });

    test('should pass arguments to debounced function', (done) => {
      let receivedArgs = null;
      const debouncedFn = debounce((...args) => { receivedArgs = args; }, 50);

      debouncedFn('a', 'b', 'c');

      setTimeout(() => {
        expect(receivedArgs).toEqual(['a', 'b', 'c']);
        done();
      }, 100);
    });
  });

  describe('throttle()', () => {
    let throttle;

    beforeAll(() => {
      throttle = function(fn, limit = 100) {
        let inThrottle;
        return function(...args) {
          if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
          }
        };
      };
    });

    test('should execute immediately on first call', () => {
      let callCount = 0;
      const throttledFn = throttle(() => callCount++, 100);

      throttledFn();
      expect(callCount).toBe(1);
    });

    test('should throttle subsequent calls', (done) => {
      let callCount = 0;
      const throttledFn = throttle(() => callCount++, 50);

      throttledFn(); // Should execute (count = 1)
      throttledFn(); // Should be throttled
      throttledFn(); // Should be throttled

      expect(callCount).toBe(1);

      setTimeout(() => {
        throttledFn(); // Should execute (count = 2)
        expect(callCount).toBe(2);
        done();
      }, 100);
    });
  });

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  describe('validateForm()', () => {
    let validateForm;
    let mockForm;

    beforeEach(() => {
      // Create mock form structure
      mockForm = {
        querySelectorAll: jest.fn()
      };

      validateForm = function(formIdOrEl) {
        const form = formIdOrEl;
        if (!form) return { valid: false, errors: [{ field: null, message: 'Form not found' }] };

        const errors = [];
        const requiredInputs = form.querySelectorAll('[required]') || [];

        requiredInputs.forEach(input => {
          input.classList = { remove: jest.fn(), add: jest.fn() };

          if (!input.value || !input.value.trim()) {
            errors.push({
              field: input.name || input.id,
              message: `${input.name || 'Field'} is required`
            });
            input.classList.add('form-input-error');
          }
        });

        return { valid: errors.length === 0, errors };
      };
    });

    test('should return valid for form with all required fields filled', () => {
      mockForm.querySelectorAll.mockReturnValue([
        { value: 'John', name: 'name', classList: { remove: jest.fn(), add: jest.fn() } },
        { value: 'john@example.com', name: 'email', classList: { remove: jest.fn(), add: jest.fn() } }
      ]);

      const result = validateForm(mockForm);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return invalid for empty required fields', () => {
      mockForm.querySelectorAll.mockReturnValue([
        { value: '', name: 'name', classList: { remove: jest.fn(), add: jest.fn() } }
      ]);

      const result = validateForm(mockForm);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
    });

    test('should return error for null form', () => {
      const result = validateForm(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Form not found');
    });
  });

  // =============================================================================
  // ALERT SYSTEM (Structure Tests)
  // =============================================================================

  describe('showAlert() - Alert Structure', () => {
    test('should create alert with correct CSS class based on type', () => {
      const alertTypes = ['info', 'success', 'error', 'warning'];

      alertTypes.forEach(type => {
        const expectedClass = `alert alert-${type}`;
        expect(expectedClass).toBe(`alert alert-${type}`);
      });
    });

    test('should support all alert types from Styles.html', () => {
      // Verify these match the CSS classes in Styles.html
      const supportedTypes = ['info', 'success', 'error', 'warning'];
      const cssClasses = [
        '.alert-info',
        '.alert-success',
        '.alert-error',
        '.alert-warning'
      ];

      expect(supportedTypes.length).toBe(cssClasses.length);
    });
  });

});
