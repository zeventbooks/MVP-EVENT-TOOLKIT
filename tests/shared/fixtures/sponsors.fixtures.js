/**
 * Sponsor Fixtures for Testing
 *
 * Shared sponsor data for all test types across Triangle phases
 */

/**
 * Sponsor tier definitions
 */
const sponsorTiers = {
  platinum: {
    name: 'Platinum',
    color: '#FFD700',
    priority: 1
  },
  gold: {
    name: 'Gold',
    color: '#C0C0C0',
    priority: 2
  },
  silver: {
    name: 'Silver',
    color: '#CD7F32',
    priority: 3
  }
};

/**
 * Platinum sponsor fixture
 */
const platinumSponsor = {
  name: 'Platinum Corp',
  tier: 'platinum',
  logo: 'https://via.placeholder.com/300x100/FFD700/000000?text=Platinum+Corp',
  website: 'https://platinum-corp.example.com',
  description: 'Leading technology company',
  placements: {
    posterTop: true,
    tvTop: true,
    tvSide: true,
    mobileBanner: true
  }
};

/**
 * Gold sponsor fixture
 */
const goldSponsor = {
  name: 'Gold Industries',
  tier: 'gold',
  logo: 'https://via.placeholder.com/300x100/C0C0C0/000000?text=Gold+Industries',
  website: 'https://gold-industries.example.com',
  description: 'Manufacturing excellence',
  placements: {
    posterTop: true,
    tvTop: false,
    tvSide: true,
    mobileBanner: true
  }
};

/**
 * Silver sponsor fixture
 */
const silverSponsor = {
  name: 'Silver Solutions',
  tier: 'silver',
  logo: 'https://via.placeholder.com/300x100/CD7F32/000000?text=Silver+Solutions',
  website: 'https://silver-solutions.example.com',
  description: 'Innovative software solutions',
  placements: {
    posterTop: false,
    tvTop: false,
    tvSide: true,
    mobileBanner: false
  }
};

/**
 * Multi-tier sponsor configuration (typical event setup)
 */
const multiTierSponsors = [
  platinumSponsor,
  goldSponsor,
  silverSponsor
];

/**
 * Single sponsor configuration (small event)
 */
const singleSponsor = [platinumSponsor];

/**
 * Large sponsor list (major event)
 */
const largeSponsorList = [
  { ...platinumSponsor, name: 'Platinum Corp Alpha' },
  { ...platinumSponsor, name: 'Platinum Corp Beta' },
  { ...goldSponsor, name: 'Gold Industries One' },
  { ...goldSponsor, name: 'Gold Industries Two' },
  { ...goldSponsor, name: 'Gold Industries Three' },
  { ...silverSponsor, name: 'Silver Solutions A' },
  { ...silverSponsor, name: 'Silver Solutions B' },
  { ...silverSponsor, name: 'Silver Solutions C' },
  { ...silverSponsor, name: 'Silver Solutions D' },
  { ...silverSponsor, name: 'Silver Solutions E' }
];

/**
 * Sponsor with analytics data (After Event phase)
 */
const sponsorWithAnalytics = {
  ...platinumSponsor,
  analytics: {
    impressions: 1000,
    clicks: 50,
    ctr: 0.05,
    dwellSec: 5000,
    surfaces: {
      display: { impressions: 500, clicks: 25, dwellSec: 2500 },
      public: { impressions: 300, clicks: 15, dwellSec: 1500 },
      poster: { impressions: 200, clicks: 10, dwellSec: 1000 }
    }
  }
};

/**
 * Invalid sponsor fixtures (for validation testing)
 */
const invalidSponsors = {
  missingName: {
    tier: 'platinum',
    logo: 'https://via.placeholder.com/300x100'
  },
  missingTier: {
    name: 'No Tier Sponsor',
    logo: 'https://via.placeholder.com/300x100'
  },
  invalidTier: {
    name: 'Invalid Tier Sponsor',
    tier: 'diamond', // Not a valid tier
    logo: 'https://via.placeholder.com/300x100'
  },
  missingLogo: {
    name: 'No Logo Sponsor',
    tier: 'gold'
  },
  invalidLogoUrl: {
    name: 'Bad Logo Sponsor',
    tier: 'gold',
    logo: 'not-a-url'
  }
};

module.exports = {
  // Tier definitions
  sponsorTiers,

  // Individual sponsors
  platinumSponsor,
  goldSponsor,
  silverSponsor,

  // Sponsor configurations
  multiTierSponsors,
  singleSponsor,
  largeSponsorList,

  // With analytics
  sponsorWithAnalytics,

  // Invalid data
  invalidSponsors
};
