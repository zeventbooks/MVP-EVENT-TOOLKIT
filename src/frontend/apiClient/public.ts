/**
 * Public Surface API Client
 *
 * Story 4.1 - Extract Frontend API Adapter Layer
 *
 * API client for the Public surface (event listing and registration page).
 * Handles all API calls needed by Public.html.
 *
 * @module frontend/apiClient/public
 */

import {
  BaseApiClient,
  ApiClientConfig,
  ApiResponse,
  ApiErrorResponse,
  ErrorUIHandler,
  isSuccess,
} from './base';
import {
  getEnvConfig,
  buildWorkerV2BundlePath,
  buildWorkerV2EventsPath,
} from './env';

// =============================================================================
// Types
// =============================================================================

/**
 * Event summary for list view
 */
export interface EventSummary {
  id: string;
  name: string;
  startDateISO?: string;
  venue?: string;
}

/**
 * Event list response
 */
export interface EventListResponse {
  items: EventSummary[];
}

/**
 * Lifecycle phase information
 */
export interface LifecyclePhase {
  phase: 'pre-event' | 'event-day' | 'post-event';
  label: string;
  isLive: boolean;
}

/**
 * Event CTA (Call to Action)
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
  showSchedule?: boolean;
  showStandings?: boolean;
  showBracket?: boolean;
  showSponsors?: boolean;
  showVideo?: boolean;
  showMap?: boolean;
  showGallery?: boolean;
  showSponsorBanner?: boolean;
}

/**
 * Schedule item
 */
export interface ScheduleItem {
  time?: string;
  title?: string;
  description?: string;
}

/**
 * Standings item
 */
export interface StandingsItem {
  rank?: number;
  team?: string;
  wins?: number;
  losses?: number;
  points?: number;
}

/**
 * Bracket match
 */
export interface BracketMatch {
  team1?: string;
  team2?: string;
  score1?: number;
  score2?: number;
  winner?: string;
}

/**
 * Bracket round
 */
export interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

/**
 * Bracket data
 */
export interface Bracket {
  rounds: BracketRound[];
}

/**
 * Sponsor data
 */
export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  linkUrl?: string;
  placement?: string;
  tier?: string;
}

/**
 * Media data
 */
export interface EventMedia {
  videoUrl?: string;
  mapUrl?: string;
  gallery?: string[];
}

/**
 * External data URLs
 */
export interface ExternalData {
  scheduleUrl?: string;
  standingsUrl?: string;
  bracketUrl?: string;
}

/**
 * Payment information
 */
export interface PaymentInfo {
  enabled: boolean;
  provider?: string;
  checkoutUrl?: string;
  price?: number;
  currency?: string;
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
 * Full event data for detail view
 */
export interface PublicEvent {
  id: string;
  name: string;
  startDateISO?: string;
  venue?: string;
  ctas?: EventCTAs;
  settings?: EventSettings;
  links?: EventLinks;
  schedule?: ScheduleItem[];
  standings?: StandingsItem[];
  bracket?: Bracket;
  sponsors?: Sponsor[];
  media?: EventMedia;
  externalData?: ExternalData;
  payments?: PaymentInfo;
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
 * Public bundle response
 */
export interface PublicBundleValue {
  event: PublicEvent;
  config?: BrandConfig;
  lifecyclePhase?: LifecyclePhase;
}

/**
 * Analytics event payload
 */
export interface AnalyticsPayload {
  eventId: string;
  surface: string;
  metric: string;
  value?: number;
  sessionId?: string;
  visibleSponsorIds?: string[];
}

/**
 * External click payload
 */
export interface ExternalClickPayload {
  eventId: string;
  linkType: string;
  surface: string;
  sessionId?: string;
  visibleSponsorIds?: string[];
  ua?: string;
}

// =============================================================================
// PublicApiClient Class
// =============================================================================

/**
 * API client for the Public surface
 *
 * Story 4.2: Supports both GAS (production) and Worker v2 (staging) backends.
 * Uses environment detection to automatically route to the correct backend.
 */
export class PublicApiClient extends BaseApiClient {
  private brandId: string;
  private scope: string;
  private useWorkerV2: boolean;

  constructor(
    brandId: string,
    scope: string = 'event',
    config?: ApiClientConfig,
    onError?: ErrorUIHandler
  ) {
    super(config, onError);
    this.brandId = brandId;
    this.scope = scope;
    // Story 4.2: Auto-detect backend based on environment
    this.useWorkerV2 = getEnvConfig().useWorkerV2;
  }

  /**
   * Force use of Worker v2 endpoints (for testing)
   */
  setUseWorkerV2(useV2: boolean): void {
    this.useWorkerV2 = useV2;
  }

  /**
   * Get list of events
   *
   * Story 4.2: Uses Worker v2 in staging, GAS in production
   */
  async getEventList(): Promise<ApiResponse<EventListResponse>> {
    if (this.useWorkerV2) {
      return this.get<EventListResponse>(
        buildWorkerV2EventsPath(undefined, this.brandId)
      );
    }

    // GAS fallback
    return this.post<EventListResponse>('api_list', {
      brandId: this.brandId,
      scope: this.scope,
    });
  }

  /**
   * Get public bundle for a specific event
   *
   * Story 4.2: Uses Worker v2 in staging, GAS in production
   */
  async getPublicBundle(eventId: string): Promise<ApiResponse<PublicBundleValue>> {
    if (this.useWorkerV2) {
      return this.get<PublicBundleValue>(
        buildWorkerV2BundlePath(eventId, 'public', this.brandId)
      );
    }

    // GAS fallback
    return this.post<PublicBundleValue>('api_getPublicBundle', {
      brandId: this.brandId,
      scope: this.scope,
      id: eventId,
    });
  }

  /**
   * Get public bundle with etag for conditional requests
   *
   * Story 4.2: Uses Worker v2 in staging, GAS in production
   */
  async getPublicBundleIfModified(
    eventId: string,
    etag: string
  ): Promise<ApiResponse<PublicBundleValue>> {
    if (this.useWorkerV2) {
      return this.get<PublicBundleValue>(
        buildWorkerV2BundlePath(eventId, 'public', this.brandId),
        { ifNoneMatch: etag }
      );
    }

    // GAS fallback
    return this.post<PublicBundleValue>('api_getPublicBundle', {
      brandId: this.brandId,
      scope: this.scope,
      id: eventId,
      ifNoneMatch: etag,
    });
  }

  /**
   * Log analytics event (fire-and-forget)
   */
  logEvent(payload: AnalyticsPayload): void {
    // Fire and forget - don't await
    this.post('api_logEvents', { items: [payload] }, { retry: false }).catch(() => {
      // Silently ignore analytics failures
    });
  }

  /**
   * Log external click (fire-and-forget)
   */
  logExternalClick(payload: ExternalClickPayload): void {
    // Fire and forget - don't await
    this.post(
      'api_logExternalClick',
      {
        ...payload,
        ua: payload.ua || navigator.userAgent,
      },
      { retry: false }
    ).catch(() => {
      // Silently ignore analytics failures
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Public API client instance
 */
export function createPublicApiClient(
  brandId: string,
  scope?: string,
  config?: ApiClientConfig,
  onError?: ErrorUIHandler
): PublicApiClient {
  return new PublicApiClient(brandId, scope, config, onError);
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { isSuccess, isError } from './base';
export type { ApiResponse, ApiErrorResponse } from './base';

export default PublicApiClient;
