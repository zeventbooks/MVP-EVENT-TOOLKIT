/**
 * Environment Detection Module
 *
 * Story 4.2 - Cut Over Public/Display/Poster to Worker in Staging
 *
 * Detects whether the frontend is running in staging or production environment
 * to route API calls to the appropriate backend (Worker v2 or GAS).
 *
 * @module frontend/apiClient/env
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Environment type
 */
export type Environment = 'staging' | 'production' | 'local' | 'unknown';

/**
 * API backend type
 */
export type ApiBackend = 'worker' | 'gas';

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  env: Environment;
  backend: ApiBackend;
  baseApiUrl: string;
  useWorkerV2: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Staging hostname patterns
 */
const STAGING_HOSTNAMES = [
  'stg.eventangle.com',
  'api-stg.eventangle.com',
  'staging.eventangle.com',
];

/**
 * Production hostname patterns
 */
const PRODUCTION_HOSTNAMES = [
  'eventangle.com',
  'www.eventangle.com',
  'api.eventangle.com',
];

/**
 * Local development patterns
 */
const LOCAL_PATTERNS = ['localhost', '127.0.0.1', '0.0.0.0'];

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detect current environment from hostname
 *
 * @param hostname - Current hostname (defaults to window.location.hostname)
 * @returns Environment type
 */
export function detectEnvironment(hostname?: string): Environment {
  const host = hostname || (typeof window !== 'undefined' ? window.location.hostname : '');

  if (!host) return 'unknown';

  // Check staging
  if (STAGING_HOSTNAMES.some(h => host === h || host.endsWith('.' + h))) {
    return 'staging';
  }

  // Check production
  if (PRODUCTION_HOSTNAMES.some(h => host === h)) {
    return 'production';
  }

  // Check local
  if (LOCAL_PATTERNS.some(p => host.includes(p))) {
    return 'local';
  }

  // Check Google Apps Script direct access (production by default)
  if (host === 'script.google.com') {
    return 'production';
  }

  return 'unknown';
}

/**
 * Determine which API backend to use
 *
 * Story 4.2: Staging uses Worker v2 endpoints, Production uses GAS
 *
 * @param env - Environment type
 * @returns API backend to use
 */
export function getApiBackend(env: Environment): ApiBackend {
  switch (env) {
    case 'staging':
      // Story 4.2: Staging fully on Worker
      return 'worker';
    case 'production':
      // Production still on GAS (until Stage-2 passes)
      return 'gas';
    case 'local':
      // Local development defaults to Worker for testing
      return 'worker';
    default:
      // Unknown environments use GAS (safe fallback)
      return 'gas';
  }
}

/**
 * Check if Worker v2 API should be used
 *
 * @param env - Environment type
 * @returns True if Worker v2 endpoints should be used
 */
export function shouldUseWorkerV2(env: Environment): boolean {
  return getApiBackend(env) === 'worker';
}

/**
 * Get the base API URL for the current environment
 *
 * @param env - Environment type
 * @returns Base URL for API requests
 */
export function getBaseApiUrl(env: Environment): string {
  switch (env) {
    case 'staging':
      return 'https://stg.eventangle.com';
    case 'production':
      return 'https://www.eventangle.com';
    case 'local':
      return 'http://localhost:3000';
    default:
      // Use relative URL for unknown environments
      return '';
  }
}

/**
 * Get full environment configuration
 *
 * @returns Complete environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = detectEnvironment();
  const backend = getApiBackend(env);

  return {
    env,
    backend,
    baseApiUrl: getBaseApiUrl(env),
    useWorkerV2: shouldUseWorkerV2(env),
  };
}

// =============================================================================
// API Path Builders
// =============================================================================

/**
 * Build Worker v2 bundle endpoint path
 *
 * @param eventId - Event ID
 * @param bundleType - Bundle type (public, display, poster, admin)
 * @param brandId - Brand ID
 * @returns API endpoint path
 */
export function buildWorkerV2BundlePath(
  eventId: string,
  bundleType: 'public' | 'display' | 'poster' | 'admin',
  brandId: string = 'root'
): string {
  return `/api/v2/events/${encodeURIComponent(eventId)}/bundle/${bundleType}?brand=${encodeURIComponent(brandId)}`;
}

/**
 * Build Worker v2 events endpoint path
 *
 * @param eventId - Optional event ID (omit for list)
 * @param brandId - Brand ID
 * @returns API endpoint path
 */
export function buildWorkerV2EventsPath(eventId?: string, brandId: string = 'root'): string {
  const base = `/api/v2/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;
  return `${base}?brand=${encodeURIComponent(brandId)}`;
}

// =============================================================================
// Export singleton config for convenience
// =============================================================================

/**
 * Current environment configuration (lazily initialized)
 */
let _envConfig: EnvironmentConfig | null = null;

/**
 * Get the current environment configuration (cached)
 */
export function getEnvConfig(): EnvironmentConfig {
  if (!_envConfig) {
    _envConfig = getEnvironmentConfig();
  }
  return _envConfig;
}

/**
 * Check if currently running in staging
 */
export function isStaging(): boolean {
  return getEnvConfig().env === 'staging';
}

/**
 * Check if currently running in production
 */
export function isProduction(): boolean {
  return getEnvConfig().env === 'production';
}

export default {
  detectEnvironment,
  getApiBackend,
  shouldUseWorkerV2,
  getBaseApiUrl,
  getEnvironmentConfig,
  getEnvConfig,
  isStaging,
  isProduction,
  buildWorkerV2BundlePath,
  buildWorkerV2EventsPath,
};
