/**
 * Poster Surface API Client
 *
 * Story 4.1 - Extract Frontend API Adapter Layer
 *
 * API client for the Poster surface (printable poster with QR codes).
 * Handles all API calls needed by Poster.html.
 *
 * @module frontend/apiClient/poster
 */

import {
  BaseApiClient,
  ApiClientConfig,
  ApiResponse,
  ApiErrorResponse,
  ErrorUIHandler,
} from './base';

// =============================================================================
// Types
// =============================================================================

/**
 * Lifecycle phase information
 */
export interface LifecyclePhase {
  phase: 'pre-event' | 'event-day' | 'post-event';
  label: string;
  isLive: boolean;
}

/**
 * Event CTA
 */
export interface EventCTA {
  label: string;
  url: string;
}

/**
 * Event CTAs
 */
export interface EventCTAs {
  primary?: EventCTA;
  secondary?: EventCTA;
}

/**
 * Event settings
 */
export interface EventSettings {
  showSponsors?: boolean;
  showSponsorBanner?: boolean;
}

/**
 * Sponsor data for poster
 */
export interface PosterSponsor {
  id: string;
  name: string;
  logoUrl?: string;
  linkUrl?: string;
  placement?: string;
  tier?: string;
}

/**
 * QR code data for poster
 */
export interface PosterQR {
  url: string;
  dataUrl?: string;
  publicUrl?: string;
}

/**
 * Event links
 */
export interface EventLinks {
  publicUrl?: string;
  displayUrl?: string;
  posterUrl?: string;
}

/**
 * Full event data for poster view
 */
export interface PosterEvent {
  id: string;
  name: string;
  startDateISO?: string;
  venue?: string;
  ctas?: EventCTAs;
  settings?: EventSettings;
  links?: EventLinks;
  sponsors?: PosterSponsor[];
  qr?: PosterQR;
}

/**
 * Brand configuration
 */
export interface BrandConfig {
  brandId: string;
  appTitle?: string;
  logoUrl?: string;
}

/**
 * Poster bundle response
 */
export interface PosterBundleValue {
  event: PosterEvent;
  config?: BrandConfig;
  lifecyclePhase?: LifecyclePhase;
}

/**
 * Analytics event payload
 */
export interface AnalyticsPayload {
  eventId: string;
  surface: 'poster';
  metric: string;
  value?: number;
  sessionId?: string;
  visibleSponsorIds?: string[];
}

// =============================================================================
// PosterApiClient Class
// =============================================================================

/**
 * API client for the Poster surface
 */
export class PosterApiClient extends BaseApiClient {
  private brandId: string;
  private scope: string;

  constructor(
    brandId: string,
    scope: string = 'event',
    config?: ApiClientConfig,
    onError?: ErrorUIHandler
  ) {
    super(config, onError);
    this.brandId = brandId;
    this.scope = scope;
  }

  /**
   * Get poster bundle for a specific event
   */
  async getPosterBundle(eventId: string): Promise<ApiResponse<PosterBundleValue>> {
    return this.post<PosterBundleValue>('api_getPosterBundle', {
      brandId: this.brandId,
      scope: this.scope,
      id: eventId,
    });
  }

  /**
   * Get poster bundle with etag for conditional requests
   */
  async getPosterBundleIfModified(
    eventId: string,
    etag: string
  ): Promise<ApiResponse<PosterBundleValue>> {
    return this.post<PosterBundleValue>('api_getPosterBundle', {
      brandId: this.brandId,
      scope: this.scope,
      id: eventId,
      ifNoneMatch: etag,
    });
  }

  /**
   * Log analytics event (fire-and-forget)
   *
   * Poster surfaces typically log:
   * - 'view' when displayed/rendered
   * - 'print' when print dialog is opened
   * - 'download' when poster is downloaded as image/PDF
   */
  logEvent(payload: AnalyticsPayload): void {
    // Fire and forget - don't await
    this.post('api_logEvents', { items: [payload] }, { retry: false }).catch(() => {
      // Silently ignore analytics failures
    });
  }

  /**
   * Log poster view (fire-and-forget)
   */
  logView(eventId: string, sessionId?: string): void {
    this.logEvent({
      eventId,
      surface: 'poster',
      metric: 'view',
      value: 1,
      sessionId,
    });
  }

  /**
   * Log poster print (fire-and-forget)
   */
  logPrint(eventId: string, sessionId?: string): void {
    this.logEvent({
      eventId,
      surface: 'poster',
      metric: 'print',
      value: 1,
      sessionId,
    });
  }

  /**
   * Log poster download (fire-and-forget)
   */
  logDownload(eventId: string, sessionId?: string): void {
    this.logEvent({
      eventId,
      surface: 'poster',
      metric: 'download',
      value: 1,
      sessionId,
    });
  }

  /**
   * Log sponsor impression (fire-and-forget)
   */
  logSponsorImpression(eventId: string, sponsorIds: string[], sessionId?: string): void {
    this.logEvent({
      eventId,
      surface: 'poster',
      metric: 'sponsor_impression',
      value: sponsorIds.length,
      sessionId,
      visibleSponsorIds: sponsorIds,
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Poster API client instance
 */
export function createPosterApiClient(
  brandId: string,
  scope?: string,
  config?: ApiClientConfig,
  onError?: ErrorUIHandler
): PosterApiClient {
  return new PosterApiClient(brandId, scope, config, onError);
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { isSuccess, isError } from './base';
export type { ApiResponse, ApiErrorResponse } from './base';

export default PosterApiClient;
