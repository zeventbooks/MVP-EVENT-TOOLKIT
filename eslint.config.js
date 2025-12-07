/**
 * ESLint Flat Config (ESLint v9+)
 *
 * Migrated from .eslintrc.json for compatibility with ESLint v9.
 * Includes Google Apps Script globals and test environment support.
 */

const js = require('@eslint/js');
const globals = require('globals');

// Google Apps Script globals
const gasGlobals = {
  SpreadsheetApp: 'readonly',
  ScriptApp: 'readonly',
  ContentService: 'readonly',
  HtmlService: 'readonly',
  CacheService: 'readonly',
  Utilities: 'readonly',
  FormApp: 'readonly',
  google: 'readonly',
  Logger: 'readonly',
  Session: 'readonly',
  UrlFetchApp: 'readonly',
  LockService: 'readonly',
  PropertiesService: 'readonly',
};

// App-specific globals (from Code.gs, Config.gs, etc.)
const appGlobals = {
  ERR: 'readonly',
  Ok: 'readonly',
  Err: 'readonly',
  UserFriendlyErr_: 'readonly',
  diag_: 'readonly',
  getDb_: 'readonly',
  getStoreSheet_: 'readonly',
  _ensureAnalyticsSheet_: 'readonly',
  findBrand_: 'readonly',
  findBrandByHost_: 'readonly',
  findTemplate_: 'readonly',
  findFormTemplate_: 'readonly',
  listFormTemplates_: 'readonly',
  getAdminSecret_: 'readonly',
  setupAdminSecrets_: 'readonly',
  resolveUrlAlias_: 'readonly',
  listUrlAliases_: 'readonly',
  loadBrands_: 'readonly',
  isValidAdminKey_: 'readonly',
  safeJSONParse_: 'readonly',
  isUrl: 'readonly',
  schemaCheck: 'readonly',
  brand: 'readonly',
  TEMPLATES: 'readonly',
  BRANDS: 'readonly',
  FORM_TEMPLATES: 'readonly',
  ZEB: 'readonly',
};

// Security middleware globals
const securityGlobals = {
  SecurityMiddleware_sanitizeInput: 'readonly',
  SecurityMiddleware_sanitizeId: 'readonly',
  SecurityMiddleware_sanitizeSpreadsheetValue: 'readonly',
  SecurityMiddleware_sanitizeMetaForLogging: 'readonly',
  SecurityMiddleware_assertScopeAllowed: 'readonly',
  SecurityMiddleware_authenticateRequest: 'readonly',
  SecurityMiddleware_validateOrigin: 'readonly',
  SecurityMiddleware_generateCSRFToken: 'readonly',
  SecurityMiddleware_validateCSRFToken: 'readonly',
  SecurityMiddleware_generateJWT: 'readonly',
  SecurityMiddleware_gate: 'readonly',
  SecurityMiddleware_timingSafeCompare: 'readonly',
};

// Service globals
const serviceGlobals = {
  FormService_listTemplates: 'readonly',
  FormService_createFromTemplate: 'readonly',
  FormService_generateShortlink: 'readonly',
  FormService_getResponseAnalytics: 'readonly',
  FormService_linkToEvent: 'readonly',
  SponsorService_calculateROI: 'readonly',
  SponsorService_validatePlacements: 'readonly',
  SponsorService_getSettings: 'readonly',
  SponsorService_getPortfolioSponsors: 'readonly',
  WebhookService_register: 'readonly',
  WebhookService_unregister: 'readonly',
  WebhookService_list: 'readonly',
  WebhookService_deliver: 'readonly',
  WebhookService_test: 'readonly',
  WebhookService_getDeliveries: 'readonly',
  WebhookService_verifySignature: 'readonly',
  AnalyticsService_logEvents: 'readonly',
  AnalyticsService_getEventReport: 'readonly',
  AnalyticsService_getSharedAnalytics: 'readonly',
  ApiSchemas_validateRequest: 'readonly',
  ApiSchemas_validateResponse: 'readonly',
  ApiSchemas_getSchema: 'readonly',
  ApiSchemas_getAllSchemas: 'readonly',
  TemplateService_migrateData: 'readonly',
  TemplateService_renderForm: 'readonly',
  TemplateService_composeTemplate: 'readonly',
};

// API globals
const apiGlobals = {
  api_translate: 'readonly',
  api_getTemplate: 'readonly',
  api_listTemplates: 'readonly',
  api_validateTemplateData: 'readonly',
  api_healthCheck: 'readonly',
  api_runDiagnostics: 'readonly',
  api_createShortlink: 'readonly',
  api_exportSharedReport: 'readonly',
  i18n_detectLocale: 'readonly',
  i18n_formatDate: 'readonly',
  i18n_formatCurrency: 'readonly',
  i18n_setUserLocale: 'readonly',
  i18n_getSupportedLocales: 'readonly',
  doGet: 'readonly',
  doPost: 'readonly',
  include: 'readonly',
};

// Combined app globals
const allAppGlobals = {
  ...gasGlobals,
  ...appGlobals,
  ...securityGlobals,
  ...serviceGlobals,
  ...apiGlobals,
};

module.exports = [
  // Base recommended config
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'playwright-report/**',
      'playwright-report-*/**',
      'test-results/**',
      '.test-results/**',
      'tests/load/**',
    ],
  },

  // Default config for all JS files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...allAppGlobals,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'warn',
      'semi': ['warn', 'always'],
      'quotes': 'off',
      'no-var': 'warn',
    },
  },

  // Google Apps Script files (.gs)
  // These files DEFINE the globals, so we only include GAS platform globals
  {
    files: ['**/*.gs'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...gasGlobals,
        // Browser globals needed in GAS context
        console: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'warn',
      'semi': ['warn', 'always'],
      'quotes': 'off',
      'no-var': 'warn',
      // Disable no-redeclare for .gs files since they define app globals
      'no-redeclare': 'off',
    },
  },

  // Test files (Jest)
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...allAppGlobals,
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Tests often mock/redefine globals
      'no-redeclare': 'off',
    },
  },

  // E2E test files (Playwright - ESM)
  {
    files: ['tests/e2e/**/*.js', 'tests/e2e/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      // Tests often mock/redefine globals
      'no-redeclare': 'off',
    },
  },

  // Smoke test files
  {
    files: ['tests/smoke/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
    },
  },

  // Scripts (Node.js CommonJS)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Scripts may define variables that shadow browser globals
      'no-redeclare': 'off',
    },
  },

  // Scripts (Node.js ESM - .mjs files)
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Scripts may define variables that shadow browser globals
      'no-redeclare': 'off',
    },
  },

  // Cloudflare Worker files (ESM)
  {
    files: ['cloudflare-proxy/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Cloudflare Worker globals
        addEventListener: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        crypto: 'readonly',
        caches: 'readonly',
        console: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
  },
];
