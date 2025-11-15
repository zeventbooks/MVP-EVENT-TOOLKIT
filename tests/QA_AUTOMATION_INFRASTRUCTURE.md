# QA Automation Infrastructure

## Overview

Comprehensive, data-driven, results-based automation infrastructure for MVP Event Toolkit QA testing across multiple environments.

## 🎯 Key Features

- **Data-Driven Testing**: Centralized test data management with seeding, cleanup, and snapshots
- **Intelligent Test Selection**: AI-powered test prioritization based on historical data
- **Results Tracking**: Comprehensive metrics tracking with trend analysis and anomaly detection
- **Visual Dashboards**: Beautiful HTML dashboards with charts, trends, and recommendations
- **Multi-Environment Support**: QA (qa.zeventbooks.com), Production (zeventbooks.com), and Local
- **CI/CD Integration**: Full integration with Stage 1 and Stage 2 GitHub Actions workflows
- **Triangle Framework**: Event phase-specific testing (Before, During, After, All Phases)

## 📁 Architecture

```
tests/
├── automation-orchestrator.js          # Master orchestrator (complete workflow)
├── shared/
│   ├── test-data-manager.js           # Test data seeding & cleanup
│   ├── test-results-tracker.js        # Results aggregation & metrics
│   ├── intelligent-test-selector.js   # Smart test selection
│   └── generate-dashboard.js          # Dashboard generation
├── .test-data/                         # Test data storage
│   ├── snapshots/                      # Data snapshots
│   └── seeds/                          # Seed data
├── .test-results/                      # Results storage
│   ├── runs/                           # Test run results
│   ├── metrics/                        # Metrics data
│   └── trends/                         # Trend data
└── test-dashboard/                     # Generated dashboards
    └── index.html                      # Main dashboard
```

## 🚀 Quick Start

### Complete Automation Workflow

Run the complete end-to-end automation workflow:

```bash
npm run qa:run
```

This will:
1. Seed test data (standard strategy)
2. Select tests intelligently
3. Execute selected tests
4. Track and aggregate results
5. Generate visual dashboard
6. Cleanup test data
7. Show comprehensive summary

### Environment-Specific Testing

```bash
# QA environment (default)
npm run qa:run

# Production environment
npm run qa:run:production

# With load testing
npm run qa:run:load
```

## 📦 Test Data Management

### Seed Test Data

```bash
# Standard data (3 events + sponsors)
npm run qa:seed

# Comprehensive data (all scenarios)
npm run qa:seed:comprehensive

# Triangle phase-specific
npm run qa:seed:triangle:before    # Before Event phase
npm run qa:seed:triangle:during    # During Event phase
npm run qa:seed:triangle:after     # After Event phase
```

### Available Data Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `minimal` | 1 event | Quick smoke tests |
| `standard` | 3 events + sponsors | Default testing |
| `comprehensive` | All scenarios | Full validation |
| `triangleBefore` | Pre-event setup | Before phase testing |
| `triangleDuring` | Live event data | During phase testing |
| `triangleAfter` | Completed events | After phase testing |

### Data Management Commands

```bash
# View all snapshots
npm run qa:snapshots

# Cleanup test data
npm run qa:cleanup

# Manual seeding
node tests/shared/test-data-manager.js seed <strategy>
```

## 🎯 Intelligent Test Selection

### Smart Test Selection

```bash
# Smart selection (AI-powered)
npm run qa:select

# Critical tests only
npm run qa:select:critical

# Flaky tests only
npm run qa:select:flaky

# Recently failed tests
npm run qa:select:failed
```

### Test Selection Strategies

| Strategy | Description | Priority |
|----------|-------------|----------|
| `smart` | AI-powered selection | Based on history, failures, changes |
| `critical-only` | Critical path tests | Smoke, API, Security |
| `flaky-only` | Flaky tests | Intermittent failures |
| `failed-only` | Recently failed | Last 5 runs |
| `fast-only` | Fast tests | Under 5 seconds |
| `all` | All tests | Complete suite |

### Test Analysis

```bash
# Analyze test history
npm run qa:analyze

# Get optimization recommendations
npm run qa:recommendations
```

## 📊 Results Tracking & Metrics

### View Results

```bash
# Summary of latest run
npm run qa:results:summary

# Trends over time
npm run qa:results:trends

# Detect anomalies
npm run qa:results:anomalies

# View history
npm run qa:results:history

# Export to CSV
npm run qa:results:export
```

### Metrics Tracked

- **Success Rate**: Percentage of passing tests
- **Test Duration**: Total execution time
- **Coverage**: Code coverage percentages
- **Performance**: Response times (k6 load tests)
- **Flaky Tests**: Tests with intermittent failures
- **Trends**: Historical trends and patterns
- **Anomalies**: Statistical outliers

## 📈 Visual Dashboards

### Generate Dashboard

```bash
npm run qa:dashboard
```

This creates an interactive HTML dashboard at `test-dashboard/index.html` with:

- **Real-time Metrics**: Success rate, total tests, duration, coverage
- **Trend Charts**: Success rate and duration over time
- **Anomaly Alerts**: Detected issues requiring attention
- **Recommendations**: Actionable insights
- **Test History**: Recent test runs in table format
- **Framework Breakdown**: Jest, Playwright, k6 results

### Dashboard Features

- 📊 Interactive charts (Chart.js)
- 📈 Historical trends (30+ runs)
- 🚨 Anomaly detection
- 💡 Smart recommendations
- 📱 Responsive design
- 🎨 Beautiful gradients and colors

## 🔄 CI/CD Integration

### Stage 1: Build & Deploy

Located in `.github/workflows/stage1-deploy.yml`

**Triggers**: Push to `main`, PRs to `main`, manual

**Jobs**:
1. Lint (ESLint)
2. Unit Tests (Jest)
3. Contract Tests (Jest)
4. Deploy to Apps Script (main branch only)

**Outputs**: Deployment URL for Stage 2

### Stage 2: Testing & QA

Located in `.github/workflows/stage2-testing.yml`

**Triggers**: Auto after Stage 1, manual

**Progressive Testing Strategy**:

```
┌─────────────────────────────────────────┐
│ 1. Health Check (QA environment)       │
├─────────────────────────────────────────┤
│ 2. Critical Tests (API + Smoke)        │
│    - Fast feedback                      │
│    - 2 devices (iPhone 14 Pro + Chrome) │
├─────────────────────────────────────────┤
│ 3. Failure Gate                         │
│    - Calculate failure rate             │
│    - Decision: Run expensive tests?     │
├─────────────────────────────────────────┤
│ 4. Expensive Tests (Flows + Pages)     │
│    - Only if failure rate < 50%         │
│    - Cost optimization                  │
├─────────────────────────────────────────┤
│ 5. Quality Gate                         │
│    - Validate all results               │
│    - Approve/block QA deployment        │
├─────────────────────────────────────────┤
│ 6. Deploy to QA (if approved)          │
└─────────────────────────────────────────┘
```

**Cost Optimization**:
- Progressive testing (critical first)
- Failure gate (skip expensive if critical fails)
- Limited devices (2 instead of 11)
- QA environment only (not production)

## 🧪 Test Execution

### Full Test Suite

```bash
# All tests (Jest + Playwright)
npm run test:all

# Quick tests (Jest + API + Smoke)
npm run test:quick
```

### Framework-Specific

```bash
# Jest (Unit + Contract)
npm run test:jest

# Playwright (E2E)
npm run test:e2e

# k6 (Load tests)
npm run test:load:all
```

### Environment-Specific

```bash
# QA environment
BASE_URL=https://qa.zeventbooks.com npm run test:e2e

# Production environment (Hostinger)
npm run test:hostinger:all

# Google Apps Script (direct)
npm run test:google-script
```

### Triangle Framework

```bash
# All phases (sequential)
npm run test:triangle

# All phases (parallel)
npm run test:triangle:parallel

# Individual phases
npm run test:triangle:before   # 📋 Before Event
npm run test:triangle:during   # ▶️ During Event
npm run test:triangle:after    # 📊 After Event
npm run test:triangle:all      # ⚡ All Phases
```

## 🛠️ Manual Orchestration

### Using the Orchestrator CLI

```bash
# Run complete workflow
node tests/automation-orchestrator.js run

# Seed data only
node tests/automation-orchestrator.js seed comprehensive

# Select tests only
node tests/automation-orchestrator.js select smart

# Execute tests only
node tests/automation-orchestrator.js test

# Generate dashboard only
node tests/automation-orchestrator.js dashboard

# Cleanup only
node tests/automation-orchestrator.js cleanup

# Show summary
node tests/automation-orchestrator.js summary

# Help
node tests/automation-orchestrator.js help
```

### Custom Workflows

```bash
# Custom data strategy + test strategy
node tests/automation-orchestrator.js run \
  --data-strategy comprehensive \
  --test-strategy critical-only

# With load testing
node tests/automation-orchestrator.js run --load-test

# Verbose output
node tests/automation-orchestrator.js run --verbose

# Custom environment
TEST_ENV=production \
BASE_URL=https://zeventbooks.com \
node tests/automation-orchestrator.js run
```

## 📊 Data-Driven Decision Making

### Intelligent Features

1. **Historical Analysis**
   - Analyzes last 50 test runs
   - Identifies patterns and trends
   - Detects flaky tests
   - Finds slow tests

2. **Priority Scoring**
   - Recent failures: +10 points
   - Flaky tests: +8 points
   - Critical paths: +7 points
   - Changed code: +9 points
   - Performance issues: +6 points

3. **Anomaly Detection**
   - Statistical analysis (2σ)
   - Success rate anomalies
   - Duration anomalies
   - Failure spikes

4. **Recommendations**
   - Stability improvements
   - Performance optimizations
   - Coverage gaps
   - Trending issues

## 🔍 Troubleshooting

### Common Issues

**Tests failing with 403 errors**
- Check if `ADMIN_KEY` is set correctly
- Verify BASE_URL is accessible
- Check if API endpoints require authentication

**No test history available**
- Run tests first to build history
- Check `.test-results/runs/` directory
- Ensure results are being saved

**Dashboard shows no data**
- Run tests with results tracking
- Check `.test-results/` directory permissions
- Regenerate dashboard: `npm run qa:dashboard`

**Test data conflicts**
- Clean up old data: `npm run qa:cleanup`
- Use unique timestamps (automatic)
- Check test data snapshots: `npm run qa:snapshots`

### Debug Commands

```bash
# Verbose orchestrator
node tests/automation-orchestrator.js run --verbose

# Check environment
npm run test:env:print

# View test data stats
node tests/shared/test-data-manager.js stats

# Analyze test history
node tests/shared/intelligent-test-selector.js analyze
```

## 📝 Best Practices

### Test Data

1. **Use Factories**: Always use factory functions (`createBasicEvent()`) instead of constants
2. **Unique Names**: Use timestamp-based naming to avoid conflicts
3. **Cleanup**: Always cleanup after tests (automatic in orchestrator)
4. **Snapshots**: Save important test data states for debugging

### Test Selection

1. **Start Smart**: Use smart selection for CI/CD
2. **Critical First**: Always run critical tests before expensive ones
3. **Monitor Flaky**: Track and fix flaky tests immediately
4. **Review History**: Regularly review test history for patterns

### Results & Metrics

1. **Track Everything**: Enable results tracking in all environments
2. **Monitor Trends**: Check trends weekly
3. **Act on Anomalies**: Investigate anomalies immediately
4. **Export Data**: Export to CSV for external analysis

### CI/CD

1. **Use Failure Gate**: Let the failure gate save costs
2. **Review Dashboards**: Check dashboards after each run
3. **Fix Failures**: Don't skip failing tests
4. **Optimize Slow Tests**: Keep tests fast (< 5s unit, < 30s E2E)

## 🎓 Examples

### Example 1: Complete QA Run

```bash
# Run complete QA workflow on QA environment
npm run qa:run
```

Output:
```
╔════════════════════════════════════════════════════════════════╗
║     QA AUTOMATION INFRASTRUCTURE - COMPLETE WORKFLOW          ║
╚════════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────
📦 STEP 1: SEED TEST DATA
─────────────────────────────────────────────────────────────

🌱 Seeding test data using strategy: standard
📍 Environment: qa
🏢 Tenant: root

✓ Generated 3 events
✓ Generated 6 sponsors
✓ Test data ready for use

─────────────────────────────────────────────────────────────
🎯 STEP 2: INTELLIGENT TEST SELECTION
─────────────────────────────────────────────────────────────

✓ Selected 24 tests
✓ Strategy: smart
✓ Estimated duration: 45.2s

📋 Execution Stages:
   Critical: 6 tests
   High:     8 tests
   Medium:   7 tests
   Low:      3 tests

... (test execution continues)
```

### Example 2: Production Testing with Load Tests

```bash
# Test production with load tests
npm run qa:run:production --load-test
```

### Example 3: Analyze Flaky Tests

```bash
# Get flaky test recommendations
npm run qa:select:flaky
npm run qa:recommendations
```

### Example 4: Export Results for Analysis

```bash
# Export last 100 runs to CSV
npm run qa:results:export
```

## 🔗 Related Documentation

- [Triangle Test Organization](./docs/TRIANGLE_TEST_ORGANIZATION.md)
- [Stage 1 Deployment Workflow](../.github/workflows/stage1-deploy.yml)
- [Stage 2 Testing Workflow](../.github/workflows/stage2-testing.yml)
- [Playwright Configuration](../playwright.config.js)
- [Jest Configuration](../jest.config.js)

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review troubleshooting section
3. Check existing test runs in `.test-results/`
4. View dashboard for insights: `npm run qa:dashboard`
5. Run diagnostics: `npm run qa:analyze`

## 🎯 Summary

This QA automation infrastructure provides:

✅ **Data-Driven**: Intelligent test selection based on history
✅ **Results-Based**: Comprehensive metrics and trend analysis
✅ **Automated**: Full CI/CD integration with Stage 1 and Stage 2
✅ **Multi-Environment**: QA, Production, and Local support
✅ **Visual**: Beautiful dashboards with actionable insights
✅ **Cost-Optimized**: Progressive testing with failure gates
✅ **Triangle Framework**: Event phase-specific testing
✅ **Easy to Use**: Simple npm commands for all operations

---

**Built for**: MVP Event Toolkit (Zeventbooks)
**Environments**: qa.zeventbooks.com & zeventbooks.com
**Deployment**: Google Apps Script + Hostinger Proxy
**Version**: 1.3.0
