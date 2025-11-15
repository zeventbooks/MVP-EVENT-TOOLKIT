/**
 * Shared Reporting System for Event Managers & Sponsors
 *
 * Single Source of Truth for:
 * - Event Performance Metrics
 * - Sponsor Engagement Analytics
 * - Shared Dashboard Data
 *
 * Reports available to both Event Managers AND Sponsors (with appropriate filtering)
 */

/**
 * Get Shared Event-Sponsor Analytics
 *
 * Returns metrics useful for BOTH event managers and sponsors:
 * - Event impressions (views)
 * - Sponsor impressions per event
 * - Sponsor click-through rates
 * - Event engagement by surface (public, display, poster)
 * - Time-based trends
 *
 * @param {Object} params - Query parameters
 * @param {string} params.tenantId - Tenant ID
 * @param {string} [params.eventId] - Filter by specific event
 * @param {string} [params.sponsorId] - Filter by specific sponsor (for sponsor view)
 * @param {string} [params.startDate] - ISO date string
 * @param {string} [params.endDate] - ISO date string
 * @param {boolean} [params.isSponsorView=false] - True if sponsor is requesting (filters to their data only)
 * @returns {Object} Shared analytics
 */
function api_getSharedAnalytics(params) {
  try {
    const { tenantId, eventId, sponsorId, startDate, endDate, isSponsorView = false } = params;

    if (!tenantId) {
      return Err(ERR.BAD_INPUT, 'tenantId required');
    }

    // Get analytics sheet
    const analyticsSheet = _ensureAnalyticsSheet_();
    const rows = analyticsSheet.getDataRange().getValues();
    const headers = rows[0];

    // Parse analytics data
    const analytics = rows.slice(1).map(row => ({
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
    let filtered = analytics.filter(a => a.eventId); // Has event ID

    if (eventId) {
      filtered = filtered.filter(a => a.eventId === eventId);
    }

    if (sponsorId || isSponsorView) {
      // Sponsor view: only show their own data
      filtered = filtered.filter(a => a.sponsorId === (sponsorId || params.sponsorId));
    }

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(a => new Date(a.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter(a => new Date(a.timestamp) <= end);
    }

    // Calculate shared metrics
    const metrics = {
      // Overview metrics (shared by both)
      totalImpressions: filtered.filter(a => a.metric === 'impression').length,
      totalClicks: filtered.filter(a => a.metric === 'click').length,
      // Fixed: Bug #41 - Limit data size to prevent memory issues
      uniqueEvents: Math.min(new Set(filtered.slice(0, 10000).map(a => a.eventId)).size, filtered.length),
      uniqueSponsors: Math.min(new Set(filtered.slice(0, 10000).filter(a => a.sponsorId).map(a => a.sponsorId)).size, filtered.length),

      // Engagement rate (shared key metric)
      engagementRate: calculateEngagementRate_(filtered),

      // By surface (shared - shows where engagement happens)
      bySurface: groupBySurface_(filtered),

      // By event (for event managers)
      byEvent: !isSponsorView ? groupByEvent_(filtered) : null,

      // By sponsor (for sponsors AND event managers)
      bySponsor: groupBySponsor_(filtered),

      // Time-based trends (shared)
      dailyTrends: calculateDailyTrends_(filtered),

      // Top performing combinations
      topEventSponsorPairs: getTopEventSponsorPairs_(filtered, 10)
    };

    return Ok(metrics);

  } catch (e) {
    diag_('error', 'api_getSharedAnalytics', e.toString());
    return Err(ERR.INTERNAL, 'Failed to get analytics');
  }
}

/**
 * Calculate engagement rate (clicks / impressions)
 */
function calculateEngagementRate_(analytics) {
  const impressions = analytics.filter(a => a.metric === 'impression').length;
  const clicks = analytics.filter(a => a.metric === 'click').length;

  if (impressions === 0) return 0;

  return {
    rate: (clicks / impressions * 100).toFixed(2) + '%',
    clicks,
    impressions,
    rawRate: clicks / impressions
  };
}

/**
 * Group analytics by surface (public, display, poster)
 */
function groupBySurface_(analytics) {
  const surfaces = {};

  analytics.forEach(a => {
    const surface = a.surface || 'unknown';

    if (!surfaces[surface]) {
      surfaces[surface] = {
        impressions: 0,
        clicks: 0,
        uniqueEvents: new Set(),
        uniqueSponsors: new Set()
      };
    }

    if (a.metric === 'impression') surfaces[surface].impressions++;
    if (a.metric === 'click') surfaces[surface].clicks++;
    if (a.eventId) surfaces[surface].uniqueEvents.add(a.eventId);
    if (a.sponsorId) surfaces[surface].uniqueSponsors.add(a.sponsorId);
  });

  // Convert sets to counts
  Object.keys(surfaces).forEach(s => {
    surfaces[s].uniqueEvents = surfaces[s].uniqueEvents.size;
    surfaces[s].uniqueSponsors = surfaces[s].uniqueSponsors.size;
    surfaces[s].engagementRate = surfaces[s].impressions > 0
      ? (surfaces[s].clicks / surfaces[s].impressions * 100).toFixed(2) + '%'
      : '0%';
  });

  return surfaces;
}

/**
 * Group analytics by event
 */
function groupByEvent_(analytics) {
  const events = {};

  analytics.forEach(a => {
    const eventId = a.eventId;

    if (!events[eventId]) {
      events[eventId] = {
        eventId,
        impressions: 0,
        clicks: 0,
        uniqueSponsors: new Set(),
        surfaces: new Set()
      };
    }

    if (a.metric === 'impression') events[eventId].impressions++;
    if (a.metric === 'click') events[eventId].clicks++;
    if (a.sponsorId) events[eventId].uniqueSponsors.add(a.sponsorId);
    if (a.surface) events[eventId].surfaces.add(a.surface);
  });

  // Convert sets and calculate rates
  Object.keys(events).forEach(e => {
    events[e].uniqueSponsors = events[e].uniqueSponsors.size;
    events[e].surfaces = Array.from(events[e].surfaces);
    events[e].engagementRate = events[e].impressions > 0
      ? (events[e].clicks / events[e].impressions * 100).toFixed(2) + '%'
      : '0%';
  });

  // Sort by impressions descending
  return Object.values(events).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Group analytics by sponsor
 */
function groupBySponsor_(analytics) {
  const sponsors = {};

  analytics.forEach(a => {
    const sponsorId = a.sponsorId;
    if (!sponsorId) return; // Skip non-sponsor events

    if (!sponsors[sponsorId]) {
      sponsors[sponsorId] = {
        sponsorId,
        impressions: 0,
        clicks: 0,
        uniqueEvents: new Set(),
        surfaces: new Set()
      };
    }

    if (a.metric === 'impression') sponsors[sponsorId].impressions++;
    if (a.metric === 'click') sponsors[sponsorId].clicks++;
    if (a.eventId) sponsors[sponsorId].uniqueEvents.add(a.eventId);
    if (a.surface) sponsors[sponsorId].surfaces.add(a.surface);
  });

  // Convert sets and calculate rates
  Object.keys(sponsors).forEach(s => {
    sponsors[s].uniqueEvents = sponsors[s].uniqueEvents.size;
    sponsors[s].surfaces = Array.from(sponsors[s].surfaces);
    sponsors[s].engagementRate = sponsors[s].impressions > 0
      ? (sponsors[s].clicks / sponsors[s].impressions * 100).toFixed(2) + '%'
      : '0%';
  });

  // Sort by impressions descending
  return Object.values(sponsors).sort((a, b) => b.impressions - a.impressions);
}

/**
 * Calculate daily trends
 */
function calculateDailyTrends_(analytics) {
  const dailyData = {};

  analytics.forEach(a => {
    const date = new Date(a.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD

    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        impressions: 0,
        clicks: 0
      };
    }

    if (a.metric === 'impression') dailyData[date].impressions++;
    if (a.metric === 'click') dailyData[date].clicks++;
  });

  // Convert to array and sort by date
  const trends = Object.values(dailyData).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Add engagement rate
  trends.forEach(day => {
    day.engagementRate = day.impressions > 0
      ? (day.clicks / day.impressions * 100).toFixed(2) + '%'
      : '0%';
  });

  return trends;
}

/**
 * Get top event-sponsor pairs (most engaged combinations)
 */
function getTopEventSponsorPairs_(analytics, limit = 10) {
  const pairs = {};

  analytics.forEach(a => {
    if (!a.eventId || !a.sponsorId) return;

    const key = `${a.eventId}|${a.sponsorId}`;

    if (!pairs[key]) {
      pairs[key] = {
        eventId: a.eventId,
        sponsorId: a.sponsorId,
        impressions: 0,
        clicks: 0
      };
    }

    if (a.metric === 'impression') pairs[key].impressions++;
    if (a.metric === 'click') pairs[key].clicks++;
  });

  // Calculate engagement rate and sort
  const sorted = Object.values(pairs)
    .map(p => ({
      ...p,
      engagementRate: p.impressions > 0 ? p.clicks / p.impressions : 0,
      engagementRateFormatted: p.impressions > 0
        ? (p.clicks / p.impressions * 100).toFixed(2) + '%'
        : '0%'
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);

  return sorted;
}

/**
 * Generate Shared Report Template
 *
 * Creates a formatted report suitable for both Event Managers and Sponsors
 *
 * @param {string} tenantId - Tenant ID
 * @param {Object} [filters] - Report filters
 * @returns {Object} Report object with formatted data
 */
function api_generateSharedReport(tenantId, filters = {}) {
  try {
    // Get analytics data
    const analyticsResult = api_getSharedAnalytics({ tenantId, ...filters });

    if (!analyticsResult.ok) {
      return analyticsResult;
    }

    const metrics = analyticsResult.value;

    // Format report
    const report = {
      reportType: 'shared-event-sponsor',
      generatedAt: new Date().toISOString(),
      tenant: tenantId,
      filters,

      // Executive Summary (shared key metrics)
      summary: {
        totalImpressions: metrics.totalImpressions,
        totalClicks: metrics.totalClicks,
        engagementRate: metrics.engagementRate.rate,
        activeEvents: metrics.uniqueEvents,
        activeSponsors: metrics.uniqueSponsors
      },

      // Surface Performance (where engagement happens)
      surfacePerformance: metrics.bySurface,

      // Event Performance (for event managers)
      eventPerformance: metrics.byEvent,

      // Sponsor Performance (for both)
      sponsorPerformance: metrics.bySponsor,

      // Trends over time
      trends: metrics.dailyTrends,

      // Top combinations (insights for both)
      topPairings: metrics.topEventSponsorPairs,

      // Recommendations (AI-generated insights)
      recommendations: generateRecommendations_(metrics)
    };

    return Ok(report);

  } catch (e) {
    diag_('error', 'api_generateSharedReport', e.toString());
    return Err(ERR.INTERNAL, 'Failed to generate report');
  }
}

/**
 * Generate data-driven recommendations
 */
function generateRecommendations_(metrics) {
  const recommendations = [];

  // Engagement rate recommendations
  const overallRate = parseFloat(metrics.engagementRate.rate);
  if (overallRate < 2) {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      message: `Low engagement rate (${metrics.engagementRate.rate}). Consider testing different sponsor placements or creative.`
    });
  } else if (overallRate > 10) {
    recommendations.push({
      type: 'engagement',
      priority: 'success',
      message: `Excellent engagement rate (${metrics.engagementRate.rate})! Current strategy is working well.`
    });
  }

  // Surface-specific recommendations
  const surfaces = metrics.bySurface;
  Object.keys(surfaces).forEach(surface => {
    const rate = parseFloat(surfaces[surface].engagementRate);
    if (rate > overallRate * 1.5) {
      recommendations.push({
        type: 'surface',
        priority: 'medium',
        message: `"${surface}" surface is performing ${rate.toFixed(1)}% above average. Consider increasing sponsor presence here.`
      });
    }
  });

  // Sponsor-specific recommendations - Fixed: Bug #10
  if (metrics.bySponsor && metrics.bySponsor.length > 0) {
    const topSponsor = metrics.bySponsor[0];
    // Add null check to prevent crash
    if (topSponsor && topSponsor.sponsorId) {
      recommendations.push({
        type: 'sponsor',
        priority: 'info',
        message: `Top performing sponsor: ${topSponsor.sponsorId} with ${topSponsor.engagementRate} engagement across ${topSponsor.uniqueEvents} events.`
      });
    }
  }

  return recommendations;
}

/**
 * Export Shared Report to Google Sheets
 *
 * Creates a new sheet with formatted report data
 *
 * @param {string} tenantId - Tenant ID
 * @param {Object} [filters] - Report filters
 * @returns {Object} Result with sheet URL
 */
function api_exportSharedReport(tenantId, filters = {}) {
  try {
    // Generate report
    const reportResult = api_generateSharedReport(tenantId, filters);

    if (!reportResult.ok) {
      return reportResult;
    }

    const report = reportResult.value;

    // Get spreadsheet
    const tenant = findTenant_(tenantId);
    if (!tenant) {
      return Err(ERR.NOT_FOUND, 'Tenant not found');
    }

    const ss = SpreadsheetApp.openById(tenant.store.spreadsheetId);

    // Create new sheet with timestamp
    const sheetName = `Report_${new Date().toISOString().split('T')[0]}`;
    let sheet = ss.getSheetByName(sheetName);

    if (sheet) {
      ss.deleteSheet(sheet);
    }

    sheet = ss.insertSheet(sheetName);

    // Write summary
    sheet.appendRow(['SHARED EVENT-SPONSOR REPORT']);
    sheet.appendRow(['Generated:', report.generatedAt]);
    sheet.appendRow(['Tenant:', report.tenant]);
    sheet.appendRow([]);

    sheet.appendRow(['EXECUTIVE SUMMARY']);
    sheet.appendRow(['Total Impressions', report.summary.totalImpressions]);
    sheet.appendRow(['Total Clicks', report.summary.totalClicks]);
    sheet.appendRow(['Engagement Rate', report.summary.engagementRate]);
    sheet.appendRow(['Active Events', report.summary.activeEvents]);
    sheet.appendRow(['Active Sponsors', report.summary.activeSponsors]);
    sheet.appendRow([]);

    // Write surface performance
    sheet.appendRow(['SURFACE PERFORMANCE']);
    sheet.appendRow(['Surface', 'Impressions', 'Clicks', 'Engagement Rate', 'Unique Events', 'Unique Sponsors']);
    Object.keys(report.surfacePerformance).forEach(surface => {
      const data = report.surfacePerformance[surface];
      sheet.appendRow([
        surface,
        data.impressions,
        data.clicks,
        data.engagementRate,
        data.uniqueEvents,
        data.uniqueSponsors
      ]);
    });
    sheet.appendRow([]);

    // Write sponsor performance
    if (report.sponsorPerformance) {
      sheet.appendRow(['SPONSOR PERFORMANCE']);
      sheet.appendRow(['Sponsor ID', 'Impressions', 'Clicks', 'Engagement Rate', 'Events']);
      report.sponsorPerformance.forEach(sponsor => {
        sheet.appendRow([
          sponsor.sponsorId,
          sponsor.impressions,
          sponsor.clicks,
          sponsor.engagementRate,
          sponsor.uniqueEvents
        ]);
      });
      sheet.appendRow([]);
    }

    // Write recommendations
    sheet.appendRow(['RECOMMENDATIONS']);
    report.recommendations.forEach(rec => {
      sheet.appendRow([rec.priority.toUpperCase(), rec.message]);
    });

    // Format sheet
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, sheet.getLastColumn());

    return Ok({
      sheetName,
      url: ss.getUrl() + '#gid=' + sheet.getSheetId()
    });

  } catch (e) {
    diag_('error', 'api_exportSharedReport', e.toString());
    return Err(ERR.INTERNAL, 'Failed to export report');
  }
}
