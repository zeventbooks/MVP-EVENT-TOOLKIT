/**
 * Display Surface API Client
 *
 * Story 4.1 - Extract Frontend API Adapter Layer
 *
 * API client for the Display surface (TV/kiosk display).
 * Handles all API calls needed by Display.html.
 *
 * @module frontend/apiClient/display
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
  showSchedule?: boolean;
  showStandings?: boolean;
  showBracket?: boolean;
  showSponsors?: boolean;
  showVideo?: boolean;
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
 * Sponsor data for display
 */
export interface DisplaySponsor {
  id: string;
  name: string;
  logoUrl?: string;
  linkUrl?: string;
  placement?: string;
  tier?: string;
}

/**
 * QR code data
 */
export interface DisplayQR {
  url: string;
  dataUrl?: string;
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
 * Full event data for display view
 */
export interface DisplayEvent {
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
  sponsors?: DisplaySponsor[];
  qr?: DisplayQR;
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
 * Display bundle response
 */
export interface DisplayBundleValue {
  event: DisplayEvent;
  config?: BrandConfig;
  lifecyclePhase?: LifecyclePhase;
}

/**
 * Analytics event payload
 */
export interface AnalyticsPayload {
  eventId: string;
  surface: 'display';
  metric: string;
  value?: number;
  sessionId?: string;
  visibleSponsorIds?: string[];
}

// =============================================================================
// DisplayApiClient Class
// =============================================================================

/**
 * API client for the Display surface
 */
export class DisplayApiClient extends BaseApiClient {
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
   * Get display bundle for a specific event
   */
  async getDisplayBundle(eventId: string): Promise<ApiResponse<DisplayBundleValue>> {
    return this.post<DisplayBundleValue>('api_getDisplayBundle', {
      brandId: this.brandId,
      scope: this.scope,
      id: eventId,
    });
  }

  /**
   * Get display bundle with etag for conditional requests (SWR pattern)
   */
  async getDisplayBundleIfModified(
    eventId: string,
    etag: string
  ): Promise<ApiResponse<DisplayBundleValue>> {
    return this.post<DisplayBundleValue>('api_getDisplayBundle', {
      brandId: this.brandId,
      scope: this.scope,
      id: eventId,
      ifNoneMatch: etag,
    });
  }

  /**
   * Log analytics event (fire-and-forget)
   *
   * Display surfaces typically log:
   * - 'view' when displayed
   * - 'sponsor_impression' for visible sponsors
   */
  logEvent(payload: AnalyticsPayload): void {
    // Fire and forget - don't await
    this.post('api_logEvents', { items: [payload] }, { retry: false }).catch(() => {
      // Silently ignore analytics failures
    });
  }

  /**
   * Log sponsor impression (fire-and-forget)
   */
  logSponsorImpression(eventId: string, sponsorIds: string[], sessionId?: string): void {
    this.logEvent({
      eventId,
      surface: 'display',
      metric: 'sponsor_impression',
      value: sponsorIds.length,
      sessionId,
      visibleSponsorIds: sponsorIds,
    });
  }

  /**
   * Log display view (fire-and-forget)
   */
  logView(eventId: string, sessionId?: string): void {
    this.logEvent({
      eventId,
      surface: 'display',
      metric: 'view',
      value: 1,
      sessionId,
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Display API client instance
 */
export function createDisplayApiClient(
  brandId: string,
  scope?: string,
  config?: ApiClientConfig,
  onError?: ErrorUIHandler
): DisplayApiClient {
  return new DisplayApiClient(brandId, scope, config, onError);
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { isSuccess, isError } from './base';
export type { ApiResponse, ApiErrorResponse } from './base';

export default DisplayApiClient;
