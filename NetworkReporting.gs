/**
 * Network Reporting - Parent-Level Analytics
 *
 * Provides aggregated reporting across parent and child tenants
 * for multi-brand sponsorship analytics.
 *
 * Use Case: ABC (parent) views consolidated sponsor metrics
 *           across ABC, CBC, and CBL (children)
 */

/**
 * Get consolidated sponsor report across parent and child tenants
 *
 * @param {string} parentTenantId - Parent organization (e.g., 'abc')
 * @param {string} sponsorId - Sponsor ID to report on
 * @param {object} options - Optional filters (dateRange, etc.)
 * @returns {object} - Aggregated sponsor metrics
 */
function getNetworkSponsorReport_(parentTenantId, sponsorId, options = {}) {
  const parentTenant = findTenant_(parentTenantId);

  if (!parentTenant || parentTenant.type !== 'parent') {
    return {
      ok: false,
      error: 'Invalid parent tenant or not a parent organization'
    };
  }

  const report = {
    parentOrg: {
      id: parentTenantId,
      name: parentTenant.name
    },
    sponsor: {
      id: sponsorId,
      name: null  // Will be populated from data
    },
    networkSummary: {
      totalImpressions: 0,
      totalClicks: 0,
      totalEvents: 0,
      networkCTR: 0,
      dateRange: options.dateRange || { start: null, end: null }
    },
    byBrand: {},
    topPerformingEvents: [],
    generatedAt: new Date().toISOString()
  };

  // Get sponsor data from parent tenant
  const parentData = getSponsorDataForTenant_(parentTenantId, sponsorId, options);
  if (parentData) {
    report.networkSummary.totalImpressions += parentData.impressions || 0;
    report.networkSummary.totalClicks += parentData.clicks || 0;
    report.networkSummary.totalEvents += parentData.events || 0;
    report.byBrand[parentTenantId] = {
      name: parentTenant.name,
      ...parentData
    };

    // Set sponsor name if found
    if (parentData.sponsorName) {
      report.sponsor.name = parentData.sponsorName;
    }
  }

  // Get sponsor data from child tenants
  const childTenantIds = parentTenant.childTenants || [];
  childTenantIds.forEach(childId => {
    const childTenant = findTenant_(childId);
    if (!childTenant) return;

    // Skip child tenants not included in network reports
    if (childTenant.includeInNetworkReports === false) return;

    const childData = getSponsorDataForTenant_(childId, sponsorId, options);
    if (childData) {
      report.networkSummary.totalImpressions += childData.impressions || 0;
      report.networkSummary.totalClicks += childData.clicks || 0;
      report.networkSummary.totalEvents += childData.events || 0;
      report.byBrand[childId] = {
        name: childTenant.name,
        ...childData
      };

      // Set sponsor name if not yet set
      if (!report.sponsor.name && childData.sponsorName) {
        report.sponsor.name = childData.sponsorName;
      }
    }
  });

  // Calculate network CTR
  if (report.networkSummary.totalImpressions > 0) {
    report.networkSummary.networkCTR = (
      (report.networkSummary.totalClicks / report.networkSummary.totalImpressions) * 100
    ).toFixed(2);
  }

  // Aggregate top performing events across all brands
  report.topPerformingEvents = getTopPerformingEventsAcrossNetwork_(
    parentTenantId,
    sponsorId,
    childTenantIds,
    5  // Top 5 events
  );

  return {
    ok: true,
    value: report
  };
}

/**
 * Get sponsor data for a specific tenant
 *
 * @param {string} tenantId - Tenant ID
 * @param {string} sponsorId - Sponsor ID
 * @param {object} options - Optional filters
 * @returns {object|null} - Sponsor data or null
 */
function getSponsorDataForTenant_(tenantId, sponsorId, options = {}) {
  try {
    // Get all events for this tenant
    const tenant = findTenant_(tenantId);
    if (!tenant) return null;

    const db = getDb_(tenant);
    const events = db.list('events') || [];

    // Get sponsors to find sponsor name
    const sponsors = db.list('sponsors') || [];
    const sponsor = sponsors.find(s => s.id === sponsorId);
    const sponsorName = sponsor ? sponsor.name : null;

    // Filter events that have this sponsor
    const sponsoredEvents = events.filter(event => {
      const eventSponsorIds = (event.sponsorIds || '').split(',').map(id => id.trim());
      return eventSponsorIds.includes(sponsorId);
    });

    if (sponsoredEvents.length === 0) {
      return {
        sponsorName: sponsorName,
        impressions: 0,
        clicks: 0,
        events: 0,
        ctr: 0,
        eventsList: []
      };
    }

    // Aggregate metrics
    let totalImpressions = 0;
    let totalClicks = 0;
    const eventsList = [];

    sponsoredEvents.forEach(event => {
      // Get analytics for this event (if available)
      // NOTE: This assumes analytics are tracked per event
      // Adjust based on your actual analytics storage
      const eventImpressions = event.analytics?.impressions || 0;
      const eventClicks = event.analytics?.clicks || 0;

      totalImpressions += eventImpressions;
      totalClicks += eventClicks;

      eventsList.push({
        id: event.id,
        name: event.name,
        date: event.dateISO,
        impressions: eventImpressions,
        clicks: eventClicks,
        ctr: eventImpressions > 0 ? ((eventClicks / eventImpressions) * 100).toFixed(2) : 0
      });
    });

    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

    return {
      sponsorName: sponsorName,
      impressions: totalImpressions,
      clicks: totalClicks,
      events: sponsoredEvents.length,
      ctr: ctr,
      eventsList: eventsList
    };

  } catch (error) {
    console.error(`Error getting sponsor data for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Get top performing events across network
 *
 * @param {string} parentTenantId - Parent tenant ID
 * @param {string} sponsorId - Sponsor ID
 * @param {array} childTenantIds - Child tenant IDs
 * @param {number} limit - Number of top events to return
 * @returns {array} - Top performing events
 */
function getTopPerformingEventsAcrossNetwork_(parentTenantId, sponsorId, childTenantIds, limit = 5) {
  const allEvents = [];

  // Collect events from parent
  const parentData = getSponsorDataForTenant_(parentTenantId, sponsorId);
  if (parentData && parentData.eventsList) {
    parentData.eventsList.forEach(event => {
      allEvents.push({
        ...event,
        tenantId: parentTenantId,
        tenantName: findTenant_(parentTenantId)?.name || parentTenantId
      });
    });
  }

  // Collect events from children
  childTenantIds.forEach(childId => {
    const childTenant = findTenant_(childId);
    // Skip child tenants not included in network reports
    if (!childTenant || childTenant.includeInNetworkReports === false) return;

    const childData = getSponsorDataForTenant_(childId, sponsorId);
    if (childData && childData.eventsList) {
      childData.eventsList.forEach(event => {
        allEvents.push({
          ...event,
          tenantId: childId,
          tenantName: childTenant.name || childId
        });
      });
    }
  });

  // Sort by impressions (descending) and return top N
  return allEvents
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

/**
 * Get network summary for parent organization
 * Shows overall network health and activity
 *
 * @param {string} parentTenantId - Parent tenant ID
 * @returns {object} - Network summary
 */
function getNetworkSummary_(parentTenantId) {
  const parentTenant = findTenant_(parentTenantId);

  if (!parentTenant || parentTenant.type !== 'parent') {
    return {
      ok: false,
      error: 'Invalid parent tenant or not a parent organization'
    };
  }

  const summary = {
    network: {
      parent: {
        id: parentTenantId,
        name: parentTenant.name
      },
      children: []
    },
    metrics: {
      totalEvents: 0,
      totalSponsors: 0,
      totalImpressions: 0,
      activeSponsors: new Set()
    },
    byBrand: {}
  };

  // Get parent metrics
  const parentDb = getDb_(parentTenant);
  const parentEvents = parentDb.list('events') || [];
  const parentSponsors = parentDb.list('sponsors') || [];

  summary.metrics.totalEvents += parentEvents.length;
  summary.metrics.totalSponsors += parentSponsors.length;

  // Track active sponsors (sponsors with events)
  parentEvents.forEach(event => {
    const sponsorIds = (event.sponsorIds || '').split(',').map(id => id.trim()).filter(id => id);
    sponsorIds.forEach(sid => summary.metrics.activeSponsors.add(sid));

    const eventImpressions = event.analytics?.impressions || 0;
    summary.metrics.totalImpressions += eventImpressions;
  });

  summary.byBrand[parentTenantId] = {
    name: parentTenant.name,
    events: parentEvents.length,
    sponsors: parentSponsors.length
  };

  // Get child metrics
  const childTenantIds = parentTenant.childTenants || [];
  childTenantIds.forEach(childId => {
    const childTenant = findTenant_(childId);
    if (!childTenant) return;

    // Skip child tenants not included in network reports
    if (childTenant.includeInNetworkReports === false) return;

    summary.network.children.push({
      id: childId,
      name: childTenant.name
    });

    const childDb = getDb_(childTenant);
    const childEvents = childDb.list('events') || [];
    const childSponsors = childDb.list('sponsors') || [];

    summary.metrics.totalEvents += childEvents.length;
    summary.metrics.totalSponsors += childSponsors.length;

    // Track active sponsors
    childEvents.forEach(event => {
      const sponsorIds = (event.sponsorIds || '').split(',').map(id => id.trim()).filter(id => id);
      sponsorIds.forEach(sid => summary.metrics.activeSponsors.add(sid));

      const eventImpressions = event.analytics?.impressions || 0;
      summary.metrics.totalImpressions += eventImpressions;
    });

    summary.byBrand[childId] = {
      name: childTenant.name,
      events: childEvents.length,
      sponsors: childSponsors.length
    };
  });

  // Convert Set to count
  summary.metrics.activeSponsors = summary.metrics.activeSponsors.size;

  return {
    ok: true,
    value: summary
  };
}

/**
 * Get list of all sponsors across network
 * Useful for parent organizations to see all sponsors
 *
 * @param {string} parentTenantId - Parent tenant ID
 * @returns {object} - List of sponsors with brand breakdown
 */
function getNetworkSponsors_(parentTenantId) {
  const parentTenant = findTenant_(parentTenantId);

  if (!parentTenant || parentTenant.type !== 'parent') {
    return {
      ok: false,
      error: 'Invalid parent tenant or not a parent organization'
    };
  }

  const sponsorsMap = new Map();

  // Helper to add sponsor to map
  const addSponsor = (sponsor, tenantId, tenantName) => {
    const key = sponsor.id;
    if (!sponsorsMap.has(key)) {
      sponsorsMap.set(key, {
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        website: sponsor.website,
        tier: sponsor.tier,
        brands: []
      });
    }
    sponsorsMap.get(key).brands.push({
      tenantId: tenantId,
      tenantName: tenantName
    });
  };

  // Get sponsors from parent
  const parentDb = getDb_(parentTenant);
  const parentSponsors = parentDb.list('sponsors') || [];
  parentSponsors.forEach(sponsor => {
    addSponsor(sponsor, parentTenantId, parentTenant.name);
  });

  // Get sponsors from children
  const childTenantIds = parentTenant.childTenants || [];
  childTenantIds.forEach(childId => {
    const childTenant = findTenant_(childId);
    if (!childTenant) return;

    // Skip child tenants not included in network reports
    if (childTenant.includeInNetworkReports === false) return;

    const childDb = getDb_(childTenant);
    const childSponsors = childDb.list('sponsors') || [];
    childSponsors.forEach(sponsor => {
      addSponsor(sponsor, childId, childTenant.name);
    });
  });

  return {
    ok: true,
    value: {
      sponsors: Array.from(sponsorsMap.values()),
      totalCount: sponsorsMap.size
    }
  };
}
