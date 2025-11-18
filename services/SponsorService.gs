/**
 * Sponsor Service
 *
 * Centralizes all sponsor-related operations:
 * - Sponsor analytics (impressions, clicks, CTR)
 * - Performance metrics and insights
 * - ROI calculations
 * - Portfolio reports (cross-tenant)
 * - Engagement scoring
 *
 * Design principles:
 * - Encapsulates sponsor business logic
 * - Provides data aggregation and analysis
 * - Separates data retrieval from presentation
 * - Supports multi-tenant portfolio views
 *
 * @module SponsorService
 */

// === Analytics Operations =================================================

/**
 * Get sponsor-specific analytics data
 *
 * @param {object} params - Analytics parameters
 * @param {string} params.sponsorId - Sponsor ID
 * @param {string} [params.eventId] - Filter by event ID
 * @param {string} [params.dateFrom] - Start date (ISO)
 * @param {string} [params.dateTo] - End date (ISO)
 * @param {string} [params.tenantId] - Tenant ID (for admin access)
 * @returns {object} Result envelope with analytics data
 */
function SponsorService_getAnalytics(params) {
  if (!params || typeof params !== 'object') {
    return Err(ERR.BAD_INPUT, 'Missing payload');
  }

  const { sponsorId, eventId, dateFrom, dateTo } = params;

  if (!sponsorId) return Err(ERR.BAD_INPUT, 'Missing sponsorId');

  // Get analytics data
  const sh = _ensureAnalyticsSheet_();
  let data = sh.getDataRange().getValues().slice(1);

  // Filter by sponsor ID
  data = data.filter(r => r[4] === sponsorId);

  // Filter by event ID if provided
  if (eventId) {
    data = data.filter(r => r[1] === eventId);
  }

  // Filter by date range if provided
  if (dateFrom || dateTo) {
    const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
    const toDate = dateTo ? new Date(dateTo) : new Date();

    data = data.filter(r => {
      const rowDate = new Date(r[0]); // timestamp column
      return rowDate >= fromDate && rowDate <= toDate;
    });
  }

  // Aggregate metrics
  const agg = SponsorService_aggregateMetrics(data, sponsorId);

  diag_('info', 'SponsorService_getAnalytics', 'Analytics retrieved', {
    sponsorId,
    eventId: eventId || 'all',
    totalImpressions: agg.totals.impressions
  });

  return Ok(agg);
}

/**
 * Aggregate sponsor metrics from raw analytics data
 *
 * @param {array} data - Raw analytics rows
 * @param {string} sponsorId - Sponsor ID
 * @returns {object} Aggregated metrics
 */
function SponsorService_aggregateMetrics(data, sponsorId) {
  const agg = {
    sponsorId: sponsorId,
    totals: { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 },
    bySurface: {}, // poster, display, public, etc.
    byEvent: {},
    timeline: [] // Daily breakdown
  };

  // Process each analytics row
  for (const r of data) {
    const timestamp = r[0];
    const evtId = r[1];
    const surface = r[2];
    const metric = r[3];
    const value = Number((r[5] !== null && r[5] !== undefined) ? r[5] : 0);

    // Initialize surface if not exists
    if (!agg.bySurface[surface]) {
      agg.bySurface[surface] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
    }

    // Initialize event if not exists
    if (!agg.byEvent[evtId]) {
      agg.byEvent[evtId] = { impressions: 0, clicks: 0, dwellSec: 0, ctr: 0 };
    }

    const surf = agg.bySurface[surface];
    const evt = agg.byEvent[evtId];

    // Aggregate metrics
    if (metric === 'impression') {
      agg.totals.impressions++;
      surf.impressions++;
      evt.impressions++;
    }
    if (metric === 'click') {
      agg.totals.clicks++;
      surf.clicks++;
      evt.clicks++;
    }
    if (metric === 'dwellSec') {
      agg.totals.dwellSec += value;
      surf.dwellSec += value;
      evt.dwellSec += value;
    }

    // Track daily timeline
    const date = new Date(timestamp).toISOString().split('T')[0];
    let dayData = agg.timeline.find(d => d.date === date);
    if (!dayData) {
      dayData = { date, impressions: 0, clicks: 0, dwellSec: 0 };
      agg.timeline.push(dayData);
    }

    if (metric === 'impression') dayData.impressions++;
    if (metric === 'click') dayData.clicks++;
    if (metric === 'dwellSec') dayData.dwellSec += value;
  }

  // Calculate CTR (Click-Through Rate) for all aggregations
  agg.totals.ctr = agg.totals.impressions > 0
    ? +(agg.totals.clicks / agg.totals.impressions * 100).toFixed(2)
    : 0;

  for (const surface in agg.bySurface) {
    const s = agg.bySurface[surface];
    s.ctr = s.impressions > 0 ? +(s.clicks / s.impressions * 100).toFixed(2) : 0;
  }

  for (const evtId in agg.byEvent) {
    const e = agg.byEvent[evtId];
    e.ctr = e.impressions > 0 ? +(e.clicks / e.impressions * 100).toFixed(2) : 0;
  }

  for (const day of agg.timeline) {
    day.ctr = day.impressions > 0 ? +(day.clicks / day.impressions * 100).toFixed(2) : 0;
  }

  // Sort timeline by date
  agg.timeline.sort((a, b) => a.date.localeCompare(b.date));

  // Add engagement score
  agg.totals.engagementScore = SponsorService_calculateEngagementScore(
    agg.totals.ctr,
    agg.totals.dwellSec,
    agg.totals.impressions
  );

  // Add performance insights
  agg.insights = SponsorService_generateInsights(agg);

  return agg;
}

// === ROI Calculations =====================================================

/**
 * Calculate ROI metrics for a sponsor
 *
 * @param {object} params - ROI parameters
 * @param {string} params.sponsorId - Sponsor ID
 * @param {number} [params.sponsorshipCost=0] - Total sponsorship investment
 * @param {number} [params.costPerClick=0] - Expected cost per click
 * @param {number} [params.conversionRate=0] - Conversion rate (%)
 * @param {number} [params.avgTransactionValue=0] - Average transaction value
 * @param {string} [params.dateFrom] - Start date
 * @param {string} [params.dateTo] - End date
 * @returns {object} Result envelope with ROI metrics
 */
function SponsorService_calculateROI(params) {
  const {
    sponsorId,
    sponsorshipCost = 0,
    costPerClick = 0,
    conversionRate = 0,
    avgTransactionValue = 0,
    dateFrom,
    dateTo
  } = params || {};

  if (!sponsorId) return Err(ERR.BAD_INPUT, 'Missing sponsorId');

  // Get analytics for the sponsor
  const analyticsResult = SponsorService_getAnalytics({
    sponsorId,
    dateFrom,
    dateTo
  });

  if (!analyticsResult.ok) return analyticsResult;

  const analytics = analyticsResult.value;

  // Calculate ROI metrics
  const totalClicks = analytics.totals.clicks;
  const totalImpressions = analytics.totals.impressions;
  const ctr = analytics.totals.ctr;

  // Estimated value from clicks
  const estimatedConversions = totalClicks * (conversionRate / 100);
  const estimatedRevenue = estimatedConversions * avgTransactionValue;

  // Cost metrics
  const actualCostPerClick = sponsorshipCost > 0 && totalClicks > 0
    ? sponsorshipCost / totalClicks
    : costPerClick;

  const totalCost = sponsorshipCost || (totalClicks * costPerClick);

  // ROI calculation: (Revenue - Cost) / Cost * 100
  const roi = totalCost > 0
    ? ((estimatedRevenue - totalCost) / totalCost * 100).toFixed(2)
    : 0;

  // Cost per impression (CPM - Cost Per Mille)
  const cpm = totalImpressions > 0
    ? (totalCost / totalImpressions * 1000).toFixed(2)
    : 0;

  return Ok({
    sponsorId,
    period: { from: dateFrom, to: dateTo },
    metrics: {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: ctr,
      engagementScore: analytics.totals.engagementScore
    },
    financials: {
      totalCost: parseFloat(totalCost.toFixed(2)),
      costPerClick: parseFloat(actualCostPerClick.toFixed(2)),
      cpm: parseFloat(cpm),
      estimatedConversions: parseFloat(estimatedConversions.toFixed(2)),
      estimatedRevenue: parseFloat(estimatedRevenue.toFixed(2)),
      roi: parseFloat(roi)
    },
    insights: SponsorService_generateROIInsights({
      roi: parseFloat(roi),
      ctr,
      cpm: parseFloat(cpm),
      engagementScore: analytics.totals.engagementScore
    })
  });
}

// === Engagement & Insights ================================================

/**
 * Calculate engagement score from CTR and dwell time
 *
 * @param {number} ctr - Click-through rate (percentage)
 * @param {number} dwellSec - Total dwell time in seconds
 * @param {number} impressions - Total impressions
 * @returns {number} Engagement score (0-100)
 */
function SponsorService_calculateEngagementScore(ctr, dwellSec, impressions) {
  if (impressions === 0) return 0;

  // Normalize dwell time (assuming 5 seconds is good engagement per impression)
  const avgDwellPerImpression = dwellSec / impressions;
  const normalizedDwell = Math.min(avgDwellPerImpression / 5 * 100, 100);

  // Weight: 60% CTR, 40% dwell time
  const score = (ctr * 0.6) + (normalizedDwell * 0.4);

  return +score.toFixed(2);
}

/**
 * Generate performance insights for sponsors
 *
 * @param {object} agg - Aggregated analytics data
 * @returns {array} Array of insight objects
 */
function SponsorService_generateInsights(agg) {
  const insights = [];

  // Insight 1: Best performing surface
  let bestSurface = null;
  let bestCTR = 0;

  for (const [surface, data] of Object.entries(agg.bySurface)) {
    if (data.ctr > bestCTR && data.impressions >= 10) {
      bestCTR = data.ctr;
      bestSurface = surface;
    }
  }

  if (bestSurface) {
    insights.push({
      type: 'best_surface',
      message: `Best performing surface: ${bestSurface} (${bestCTR}% CTR)`,
      surface: bestSurface,
      ctr: bestCTR
    });
  }

  // Insight 2: Engagement trend
  if (agg.timeline.length >= 7) {
    const recentDays = agg.timeline.slice(-7);
    const recentAvgCTR = recentDays.reduce((sum, d) => sum + d.ctr, 0) / 7;
    const previousDays = agg.timeline.slice(-14, -7);
    const previousAvgCTR = previousDays.length > 0
      ? previousDays.reduce((sum, d) => sum + d.ctr, 0) / previousDays.length
      : 0;

    if (recentAvgCTR > previousAvgCTR * 1.1) {
      insights.push({
        type: 'trending_up',
        message: `Engagement trending up: ${recentAvgCTR.toFixed(2)}% CTR (last 7 days)`,
        trend: 'up',
        currentCTR: recentAvgCTR.toFixed(2)
      });
    } else if (recentAvgCTR < previousAvgCTR * 0.9) {
      insights.push({
        type: 'trending_down',
        message: `Engagement trending down: ${recentAvgCTR.toFixed(2)}% CTR (last 7 days)`,
        trend: 'down',
        currentCTR: recentAvgCTR.toFixed(2)
      });
    }
  }

  // Insight 3: Engagement score rating
  const score = agg.totals.engagementScore;
  if (score >= 70) {
    insights.push({
      type: 'high_engagement',
      message: `Excellent engagement score: ${score}/100`,
      score: score,
      rating: 'excellent'
    });
  } else if (score < 40) {
    insights.push({
      type: 'low_engagement',
      message: `Low engagement score: ${score}/100. Consider optimizing creative or placement.`,
      score: score,
      rating: 'needs_improvement'
    });
  }

  return insights;
}

/**
 * Generate ROI-specific insights
 *
 * @param {object} metrics - ROI metrics
 * @returns {array} Array of ROI insights
 */
function SponsorService_generateROIInsights(metrics) {
  const insights = [];
  const { roi, ctr, cpm, engagementScore } = metrics;

  // ROI insights
  if (roi > 100) {
    insights.push({
      type: 'positive_roi',
      message: `Strong positive ROI of ${roi}%`,
      severity: 'success'
    });
  } else if (roi > 0) {
    insights.push({
      type: 'moderate_roi',
      message: `Moderate positive ROI of ${roi}%`,
      severity: 'info'
    });
  } else {
    insights.push({
      type: 'negative_roi',
      message: `Negative ROI of ${roi}%. Review campaign effectiveness.`,
      severity: 'warning'
    });
  }

  // CPM insights (industry benchmark: $5-$15 for digital display)
  if (cpm < 5) {
    insights.push({
      type: 'low_cpm',
      message: `Very cost-effective CPM of $${cpm}`,
      severity: 'success'
    });
  } else if (cpm > 15) {
    insights.push({
      type: 'high_cpm',
      message: `High CPM of $${cpm}. Consider negotiating better rates.`,
      severity: 'warning'
    });
  }

  // CTR insights (industry benchmark: 0.5%-2% for display)
  if (ctr > 2) {
    insights.push({
      type: 'excellent_ctr',
      message: `Exceptional CTR of ${ctr}% (above industry average)`,
      severity: 'success'
    });
  } else if (ctr < 0.5) {
    insights.push({
      type: 'low_ctr',
      message: `Low CTR of ${ctr}%. Consider improving creative or targeting.`,
      severity: 'warning'
    });
  }

  return insights;
}

// === Portfolio Operations =================================================

/**
 * Get portfolio sponsor list (all sponsors across child tenants)
 *
 * @param {string} parentTenantId - Parent tenant ID
 * @returns {object} Result envelope with sponsor list
 */
function SponsorService_getPortfolioSponsors(parentTenantId) {
  const parentTenant = findTenant_(parentTenantId);
  if (!parentTenant) {
    return Err(ERR.NOT_FOUND, 'Unknown parent tenant');
  }

  const childTenantIds = parentTenant.childTenants || [];

  // Collect all unique sponsors across all child tenants
  const sponsorsMap = new Map();

  for (const childTenantId of childTenantIds) {
    const childTenant = findTenant_(childTenantId);
    if (!childTenant) continue;

    const sponsors = childTenant.sponsors || [];
    for (const sponsor of sponsors) {
      if (!sponsorsMap.has(sponsor.id)) {
        sponsorsMap.set(sponsor.id, {
          id: sponsor.id,
          name: sponsor.name,
          logo: sponsor.logo,
          tenants: [childTenantId]
        });
      } else {
        const existing = sponsorsMap.get(sponsor.id);
        if (!existing.tenants.includes(childTenantId)) {
          existing.tenants.push(childTenantId);
        }
      }
    }
  }

  const sponsors = Array.from(sponsorsMap.values());

  return Ok({
    parentTenantId,
    totalSponsors: sponsors.length,
    sponsors
  });
}
