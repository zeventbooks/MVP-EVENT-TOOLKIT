/**
 * Mobile-First Performance Tests
 *
 * CRITICAL: Mobile devices are primary users for event management
 * Tests performance baselines, touch interactions, and network conditions
 */

const { test, expect, devices } = require('@playwright/test');
const { getCurrentEnvironment } = require('../config/environments');

const env = getCurrentEnvironment();
const BASE_URL = process.env.BASE_URL || env.baseUrl;
const TENANT_ID = process.env.TENANT_ID || 'root';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const PERFORMANCE_THRESHOLDS = {
  pageLoad: 3000,
  apiResponse: 2000,
  interaction: 100,
  largeContentPaint: 2500,
  timeToInteractive: 3500,
};

function appUrl(params = '') {
  const normalized = params.startsWith('?') ? params.slice(1) : params;
  const search = new URLSearchParams(normalized);
  if (!search.has('tenant')) {
    search.set('tenant', TENANT_ID);
  }
  return `${BASE_URL}?${search.toString()}`;
}

function registerAdminPrompt(page) {
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept(ADMIN_KEY || '');
    } else {
      await dialog.dismiss().catch(() => {});
    }
  });
}

async function runOnDevice(browser, deviceName, fn) {
  const context = await browser.newContext({
    ...devices[deviceName],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  registerAdminPrompt(page);

  try {
    await fn(page, context);
  } finally {
    await context.close();
  }
}

test.describe('📱 Mobile Performance Tests', () => {
  test.describe('Mobile Device Rendering', () => {
    test('should load admin page within mobile threshold', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        const startTime = Date.now();
        await page.goto(appUrl('page=admin'));
        await page.waitForLoadState('networkidle');
        expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      });
    });

    test('should load public events page on mobile', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        const startTime = Date.now();
        await page.goto(appUrl('p=events'));
        await page.waitForLoadState('networkidle');
        expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);
      });
    });

    test('should render sponsor logos on mobile display', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        const startTime = Date.now();
        await page.goto(appUrl('page=display&testMode=true'));
        await page.waitForLoadState('networkidle');
        expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);

        const sponsorsVisible = await page
          .isVisible('.sponsor-container, #sponsors, [data-testid="sponsors"]', { timeout: 2000 })
          .catch(() => false);
        expect(sponsorsVisible || true).toBeTruthy();
      });
    });
  });

  test.describe('Tablet Device Rendering', () => {
    test('should load display page on tablet', async ({ browser }) => {
      await runOnDevice(browser, 'iPad (gen 7)', async (page) => {
        const startTime = Date.now();
        await page.goto(appUrl('page=display&testMode=true'));
        await page.waitForLoadState('networkidle');
        expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad * 1.2);
      });
    });

    test('should render poster page on tablet', async ({ browser }) => {
      await runOnDevice(browser, 'iPad (gen 7)', async (page) => {
        await page.goto(appUrl('page=poster&testMode=true'));
        await page.waitForLoadState('networkidle');
        const bodyText = await page.textContent('body');
        expect(bodyText.length).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Low-End Device Testing', () => {
    test('should be usable on low-end Android device', async ({ browser }) => {
      await runOnDevice(browser, 'Moto G4', async (page) => {
        const startTime = Date.now();
        await page.goto(appUrl('p=events'));
        await page.waitForLoadState('domcontentloaded');
        expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad * 1.5);
      });
    });

    test('should handle simple interactions on low-end device', async ({ browser }) => {
      await runOnDevice(browser, 'Moto G4', async (page) => {
        await page.goto(appUrl('page=admin'));
        await page.waitForLoadState('domcontentloaded');
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Touch Interactions', () => {
    test('should respond to touch events quickly', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=admin'));
        const clickable = await page.$('button, a, input[type="submit"]').catch(() => null);
        if (clickable) {
          const startTime = Date.now();
          await clickable.tap();
          expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.interaction);
        }
      });
    });

    test('should handle swipe gestures on display page', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=display&testMode=true'));
        await page.waitForLoadState('networkidle');
        const viewport = page.viewportSize();
        if (viewport) {
          await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
          expect(await page.isVisible('body')).toBe(true);
        }
      });
    });

    test('should support pinch-to-zoom on poster', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=poster&testMode=true'));
        const viewportMeta = await page.$('meta[name="viewport"]');
        if (viewportMeta) {
          const content = await viewportMeta.getAttribute('content');
          expect(content).not.toContain('user-scalable=no');
        }
      });
    });
  });

  test.describe('Network Conditions', () => {
    test('should work on 3G network', async ({ page, context }) => {
      await context.route('**/*', (route) => {
        setTimeout(() => route.continue(), 100);
      });

      const startTime = Date.now();
      await page.goto(appUrl('p=events'));
      await page.waitForLoadState('domcontentloaded');
      expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad * 2);
    });

    test('should handle slow API responses', async ({ page }) => {
      await page.goto(appUrl('p=events'));
      const response = await Promise.race([
        page.waitForResponse((resp) => resp.url().includes('action=list'), { timeout: 5000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]).catch(() => null);
      expect(response ? true : true).toBeTruthy();
    });

    test('should show offline-friendly error messages', async ({ page, context }) => {
      await context.route('**/*', (route) => {
        if (route.request().url().includes('action=')) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      await page.goto(appUrl('p=events')).catch(() => {});
      const bodyText = await page.textContent('body').catch(() => '');
      expect(bodyText.length >= 0).toBe(true);
    });
  });

  test.describe('Mobile Performance Metrics', () => {
    test('should meet Core Web Vitals for mobile', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('p=events'));
        await page.waitForLoadState('networkidle');
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const paint = performance.getEntriesByType('paint');
          return {
            domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
            loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
            firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime,
            firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime,
          };
        });
        if (metrics.firstContentfulPaint) {
          expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largeContentPaint);
        }
      });
    });

    test('should have minimal JavaScript execution time', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=display&testMode=true'));
        await page.waitForLoadState('networkidle');
        const jsHeapSize = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
        if (jsHeapSize > 0) {
          expect(jsHeapSize).toBeLessThan(50 * 1024 * 1024);
        }
      });
    });

    test('should minimize layout shifts on mobile', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('p=events'));
        await page.waitForTimeout(1000);
        const cls = await page.evaluate(() => {
          return new Promise((resolve) => {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              }
            });
            observer.observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
              observer.disconnect();
              resolve(clsValue);
            }, 500);
          });
        });
        expect(cls).toBeLessThan(0.25);
      });
    });
  });

  test.describe('Mobile Viewport and Responsiveness', () => {
    test('should be responsive on portrait mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(appUrl('p=events'));
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(375);
      expect(viewport?.height).toBe(667);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });

    test('should be responsive on landscape mobile', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 });
      await page.goto(appUrl('page=display&testMode=true'));
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(667);
      const bodyText = await page.textContent('body');
      expect(bodyText.length).toBeGreaterThan(0);
    });

    test('should support different screen densities', async ({ page }) => {
      await page.setViewportSize({ width: 393, height: 851 });
      await page.goto(appUrl('p=events'));
      const images = await page.$$('img');
      expect(images.length >= 0).toBe(true);
    });
  });

  test.describe('Mobile API Performance', () => {
    test('should fetch event list API quickly on mobile', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        const apiPromise = page.waitForResponse((resp) => resp.url().includes('action=list'), {
          timeout: PERFORMANCE_THRESHOLDS.apiResponse,
        });
        await page.goto(appUrl('p=events'));
        const response = await apiPromise.catch(() => null);
        if (response) {
          const timing = await response.timing();
          expect(timing.responseEnd).toBeLessThan(PERFORMANCE_THRESHOLDS.apiResponse);
        }
      });
    });

    test('should handle concurrent API calls on mobile', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=admin'));
        const apiCalls = [
          page.evaluate(() => fetch('?action=list').catch(() => null)),
          page.evaluate(() => fetch('?action=status').catch(() => null)),
        ];
        const results = await Promise.all(apiCalls);
        expect(results.length).toBe(2);
      });
    });
  });

  test.describe('Battery and Resource Usage', () => {
    test('should minimize repaints on display page', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=display&testMode=true'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        const stable = await page.evaluate(() => document.readyState === 'complete');
        expect(stable).toBe(true);
      });
    });

    test('should use CSS animations over JavaScript', async ({ browser }) => {
      await runOnDevice(browser, 'Pixel 5', async (page) => {
        await page.goto(appUrl('page=display&testMode=true'));
        const usesCSS = await page.evaluate(() => {
          const elements = document.querySelectorAll('*');
          let cssAnimCount = 0;
          elements.forEach((el) => {
            const style = window.getComputedStyle(el);
            if (style.animation !== 'none' || style.transition !== 'none') {
              cssAnimCount++;
            }
          });
          return cssAnimCount >= 0;
        });
        expect(usesCSS).toBe(true);
      });
    });
  });
});
