/**
 * Analytics Service
 *
 * Centralizes all analytics-related operations:
 * - Event logging (impressions, clicks, dwell time)
 * - Data aggregation (by surface, sponsor, token)
 * - Report generation (raw metrics without formatting)
 * - Shared analytics (event managers & sponsors)
 * - Timeline and trend analysis
 *
 * Design principles:
 * - Separates data aggregation from presentation
 * - Returns raw metrics for flexible rendering
 * - Provides filtering and date range support
 * - Sanitizes all inputs to prevent injection
 *
 * @module AnalyticsService
 */

// === Event Logging ========================================================

/**
 * Log analytics events (impressions, clicks, dwell time)
 *
 * @param {array} items - Array of analytics events to log
 * @returns {object} Result envelope with count of logged events
 */
function AnalyticsService_logEvents(items) {
  if (!items || !items.length) return Ok({ count: 0 });

  const sh = _ensureAnalyticsSheet_();
  const now = Date.now();

  // Sanitize all values to prevent formula injection
  const rows = items.map(it => [
    new Date(it.ts || now),
    SecurityMiddleware_sanitizeSpreadsheetValue(it.eventId || ''),
    SecurityMiddleware_sanitizeSpreadsheetValue(it.surface || ''),
    SecurityMiddleware_sanitizeSpreadsheetValue(it.metric || ''),
    SecurityMiddleware_sanitizeSpreadsheetValue(it.sponsorId || ''),
    Number(it.value || 0),
    SecurityMiddleware_sanitizeSpreadsheetValue(it.token || ''),
    SecurityMiddleware_sanitizeSpreadsheetValue((it.ua || '').slice(0, 200))
  ]);

  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 8).setValues(rows);

  diag_('info', 'AnalyticsService_logEvents', 'logged', { count: rows.length });

  return Ok({ count: rows.length });
}

// === Report Operations ====================================================

/**
 * Get analytics report for an event
 * Returns raw metrics without formatting
 *
 * @param {object} params - Report parameters
 * @param {string} params.eventId - Event ID
 * @param {string} [params.brandId] - Tenant ID (for authorization)
 * @param {string} [params.dateFrom] - Start date (ISO)
 * @param {string} [params.dateTo] - End date (ISO)
 * @returns {object} Result envelope with aggregated metrics
 */
function AnalyticsService_getEventReport(params) {
  const { eventId, brandId, dateFrom, dateTo } = params || {};

  if (!eventId) return Err(ERR.BAD_INPUT, 'missing eventId');

  // Verify event exists and belongs to tenant (if brandId provided)
  if (brandId) {
    const verifyResult = AnalyticsService_verifyEventOwnership(eventId, brandId);
    if (!verifyResult.ok) return verifyResult;
  }

  const sh = _ensureAnalyticsSheet_();
  let data = sh.getDataRange().getValues().slice(1)
    .filter(r => r[1] === eventId);

  // Filter by date range if provided
  if (dateFrom || dateTo) {
    const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
    const toDate = dateTo ? new Date(dateTo) : new Date();

    data = data.filter(r => {
      const rowDate = new Date(r[0]);
      return rowDate >= fromDate && rowDate <= toDate;
    });
  }

  // Aggregate metrics
  const agg = AnalyticsService_aggregateEventData(data);

  return Ok(agg);
}

/**
 * Aggregate event analytics data
 *
 * @param {array} data - Raw analytics rows
 * @returns {object} Aggregated metrics
 */
function AnalyticsService_aggregateEventData(data) {
  const agg = {
    totals: { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 },
    bySurface: {},
    bySponsor: {},
    byToken: {},
    timeline: []
  };

  for (const r of data) {
    const timestamp = r[0];
    const surface = r[2];
    const metric = r[3];
    const sponsorId = (r[4] !== null && r[4] !== undefined && r[4] !== '') ? r[4] : '-';
    const value = Number((r[5] !== null && r[5] !== undefined) ? r[5] : 0);
    const token = (r[6] !== null && r[6] !== undefined && r[6] !== '') ? r[6] : '-';

    // Initialize aggregation objects
    if (!agg.bySurface[surface]) {
      agg.bySurface[surface] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
    }
    if (!agg.bySponsor[sponsorId]) {
      agg.bySponsor[sponsorId] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
    }
    if (!agg.byToken[token]) {
      agg.byToken[token] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
    }

    const surf = agg.bySurface[surface];
    const spons = agg.bySponsor[sponsorId];
    const tok = agg.byToken[token];

    // Aggregate metrics
    if (metric === 'impression') {
      agg.totals.impressions++;
      surf.impressions++;
      spons.impressions++;
      tok.impressions++;
    }
    if (metric === 'click') {
      agg.totals.clicks++;
      surf.clicks++;
      spons.clicks++;
      tok.clicks++;
    }
    if (metric === 'dwellSec') {
      agg.totals.dwellSec += value;
      surf.dwellSec += value;
      spons.dwellSec += value;
      tok.dwellSec += value;
    }

    // Track daily timeline
    const date = new Date(timestamp).toISOString().split('T')[0];
    let dayData = agg.timeline.find(d => d.date === date);
    if (!dayData) {
      dayData = { date, impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
      agg.timeline.push(dayData);
    }

    if (metric === 'impression') dayData.impressions++;
    if (metric === 'click') dayData.clicks++;
    if (metric === 'dwellSec') dayData.dwellSec += value;
  }

  // Calculate CTR for all aggregations
  agg.totals.ctr = agg.totals.impressions > 0
    ? +(agg.totals.clicks / agg.totals.impressions * 100).toFixed(2)
    : 0;

  for (const k in agg.bySurface) {
    const s = agg.bySurface[k];
    s.ctr = s.impressions > 0 ? +(s.clicks / s.impressions * 100).toFixed(2) : 0;
  }

  for (const k in agg.bySponsor) {
    const s = agg.bySponsor[k];
    s.ctr = s.impressions > 0 ? +(s.clicks / s.impressions * 100).toFixed(2) : 0;
  }

  for (const k in agg.byToken) {
    const t = agg.byToken[k];
    t.ctr = t.impressions > 0 ? +(t.clicks / t.impressions * 100).toFixed(2) : 0;
  }

  for (const day of agg.timeline) {
    day.ctr = day.impressions > 0 ? +(day.clicks / day.impressions * 100).toFixed(2) : 0;
  }

  // Sort timeline by date
  agg.timeline.sort((a, b) => a.date.localeCompare(b.date));

  return agg;
}

// === Shared Analytics =====================================================

/**
 * Get shared analytics (for both event managers and sponsors)
 *
 * @param {object} params - Query parameters
 * @param {string} params.brandId - Tenant ID
 * @param {string} [params.eventId] - Filter by event ID
 * @param {string} [params.sponsorId] - Filter by sponsor ID
 * @param {string} [params.dateFrom] - Start date (ISO)
 * @param {string} [params.dateTo] - End date (ISO)
 * @param {boolean} [params.isSponsorView=false] - True if sponsor is requesting
 * @returns {object} Result envelope with shared analytics
 */
function AnalyticsService_getSharedAnalytics(params) {
  const { brandId, eventId, sponsorId, dateFrom, dateTo, isSponsorView = false } = params || {};

  if (!brandId) return Err(ERR.BAD_INPUT, 'brandId required');

  // Get analytics sheet
  const sh = _ensureAnalyticsSheet_();
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];

  // Parse analytics data
  let analytics = rows.slice(1).map(row => ({
    timestamp: row[0],
    eventId: row[1],
    surface: row[2],
    metric: row[3],
    sponsorId: row[4],
    value: row[5],
    token: row[6],
    userAgent: row[7]
  }));

  // Filter by parameters
  analytics = analytics.filter(a => a.eventId); // Has event ID

  if (eventId) {
    analytics = analytics.filter(a => a.eventId === eventId);
  }

  if (sponsorId || isSponsorView) {
    // Sponsor view: only show their own data
    analytics = analytics.filter(a => a.sponsorId === (sponsorId || params.sponsorId));
  }

  if (dateFrom) {
    const start = new Date(dateFrom);
    analytics = analytics.filter(a => new Date(a.timestamp) >= start);
  }

  if (dateTo) {
    const end = new Date(dateTo);
    analytics = analytics.filter(a => new Date(a.timestamp) <= end);
  }

  // Calculate shared metrics
  const metrics = {
    // Overview metrics (shared by both)
    totalImpressions: analytics.filter(a => a.metric === 'impression').length,
    totalClicks: analytics.filter(a => a.metric === 'click').length,
    uniqueEvents: Math.min(
      new Set(analytics.slice(0, 10000).map(a => a.eventId)).size,
      analytics.length
    ),
    uniqueSponsors: Math.min(
      new Set(analytics.slice(0, 10000).filter(a => a.sponsorId).map(a => a.sponsorId)).size,
      analytics.length
    ),

    // Engagement rate (shared key metric)
    engagementRate: AnalyticsService_calculateEngagementRate(analytics),

    // By surface (shared - shows where engagement happens)
    bySurface: AnalyticsService_groupBySurface(analytics),

    // By event (for event managers)
    byEvent: !isSponsorView ? AnalyticsService_groupByEvent(analytics) : null,

    // By sponsor (for sponsors AND event managers)
    bySponsor: AnalyticsService_groupBySponsor(analytics),

    // Time-based trends (shared)
    dailyTrends: AnalyticsService_calculateDailyTrends(analytics)
  };

  return Ok(metrics);
}

// === Helper Functions =====================================================

/**
 * Verify event ownership (belongs to tenant)
 *
 * @param {string} eventId - Event ID
 * @param {string} brandId - Tenant ID
 * @returns {object} Result envelope (Ok/Err)
 */
function AnalyticsService_verifyEventOwnership(eventId, brandId) {
  const tenant = findTenant_(brandId);
  if (!tenant) return Err(ERR.NOT_FOUND, 'Unknown tenant');

  const eventSheet = SpreadsheetApp.openById(tenant.store.spreadsheetId)
    .getSheetByName('EVENTS');

  if (!eventSheet) {
    return Err(ERR.NOT_FOUND, 'Events sheet not found');
  }

  const eventRows = eventSheet.getDataRange().getValues().slice(1);
  const event = eventRows.find(r => r[0] === eventId && r[1] === brandId);

  if (!event) {
    diag_('warn', 'AnalyticsService_verifyEventOwnership', 'Unauthorized access attempt',
      { eventId, brandId });
    return Err(ERR.NOT_FOUND, 'Event not found or unauthorized');
  }

  return Ok();
}

/**
 * Calculate engagement rate from analytics data
 *
 * @param {array} analytics - Analytics data
 * @returns {number} Engagement rate (%)
 */
function AnalyticsService_calculateEngagementRate(analytics) {
  const impressions = analytics.filter(a => a.metric === 'impression').length;
  const clicks = analytics.filter(a => a.metric === 'click').length;

  return impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0;
}

/**
 * Group analytics by surface
 *
 * @param {array} analytics - Analytics data
 * @returns {object} Metrics grouped by surface
 */
function AnalyticsService_groupBySurface(analytics) {
  const grouped = {};

  for (const a of analytics) {
    if (!grouped[a.surface]) {
      grouped[a.surface] = { impressions: 0, clicks: 0, ctr: 0 };
    }

    if (a.metric === 'impression') grouped[a.surface].impressions++;
    if (a.metric === 'click') grouped[a.surface].clicks++;
  }

  // Calculate CTR
  for (const surface in grouped) {
    const s = grouped[surface];
    s.ctr = s.impressions > 0 ? +(s.clicks / s.impressions * 100).toFixed(2) : 0;
  }

  return grouped;
}

/**
 * Group analytics by event
 *
 * @param {array} analytics - Analytics data
 * @returns {object} Metrics grouped by event
 */
function AnalyticsService_groupByEvent(analytics) {
  const grouped = {};

  for (const a of analytics) {
    if (!grouped[a.eventId]) {
      grouped[a.eventId] = { impressions: 0, clicks: 0, ctr: 0 };
    }

    if (a.metric === 'impression') grouped[a.eventId].impressions++;
    if (a.metric === 'click') grouped[a.eventId].clicks++;
  }

  // Calculate CTR
  for (const eventId in grouped) {
    const e = grouped[eventId];
    e.ctr = e.impressions > 0 ? +(e.clicks / e.impressions * 100).toFixed(2) : 0;
  }

  return grouped;
}

/**
 * Group analytics by sponsor
 *
 * @param {array} analytics - Analytics data
 * @returns {object} Metrics grouped by sponsor
 */
function AnalyticsService_groupBySponsor(analytics) {
  const grouped = {};

  for (const a of analytics) {
    const sponsorId = a.sponsorId || '-';
    if (!grouped[sponsorId]) {
      grouped[sponsorId] = { impressions: 0, clicks: 0, ctr: 0 };
    }

    if (a.metric === 'impression') grouped[sponsorId].impressions++;
    if (a.metric === 'click') grouped[sponsorId].clicks++;
  }

  // Calculate CTR
  for (const sponsorId in grouped) {
    const s = grouped[sponsorId];
    s.ctr = s.impressions > 0 ? +(s.clicks / s.impressions * 100).toFixed(2) : 0;
  }

  return grouped;
}

/**
 * Calculate daily trends
 *
 * @param {array} analytics - Analytics data
 * @returns {array} Daily trend data
 */
function AnalyticsService_calculateDailyTrends(analytics) {
  const daily = {};

  for (const a of analytics) {
    const date = new Date(a.timestamp).toISOString().split('T')[0];

    if (!daily[date]) {
      daily[date] = { date, impressions: 0, clicks: 0, ctr: 0 };
    }

    if (a.metric === 'impression') daily[date].impressions++;
    if (a.metric === 'click') daily[date].clicks++;
  }

  // Calculate CTR and convert to array
  const trends = Object.values(daily).map(d => ({
    ...d,
    ctr: d.impressions > 0 ? +(d.clicks / d.impressions * 100).toFixed(2) : 0
  }));

  // Sort by date
  trends.sort((a, b) => a.date.localeCompare(b.date));

  return trends;
}
