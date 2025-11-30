/**
 * Playwright Global Setup
 * Runs once before all tests
 *
 * Features:
 * - Prints environment configuration
 * - Optional deployment warmup (set WARMUP_BEFORE_TESTS=true)
 * - Validates deployment is responding before tests run
 */

const { printEnvironmentInfo, getBaseUrl } = require('./environments');
const https = require('https');
const http = require('http');

/**
 * Quick health check to verify deployment is responding
 * Returns true if status endpoint returns 200 with ok: true
 */
async function checkDeploymentHealth(baseUrl, maxAttempts = 3) {
  const statusUrl = `${baseUrl}/status`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fetchWithTimeout(statusUrl, 30000);

      if (result.statusCode === 200) {
        try {
          const json = JSON.parse(result.body);
          if (json.ok === true) {
            return { healthy: true, duration: result.duration, buildId: json.buildId };
          }
        } catch {
          // Invalid JSON
        }
      }

      // Wait before retry
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    } catch (err) {
      console.log(`  ⚠️ Health check attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }

  return { healthy: false };
}

/**
 * Make HTTP request with timeout
 */
function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, { timeout: timeoutMs }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchWithTimeout(response.headers.location, timeoutMs - (Date.now() - startTime))
          .then(resolve)
          .catch(reject);
      }

      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: data,
          duration: Date.now() - startTime
        });
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    });
  });
}

module.exports = async () => {
  // Print environment configuration
  printEnvironmentInfo();

  const baseUrl = getBaseUrl();

  // Optional: Run warmup before tests (set WARMUP_BEFORE_TESTS=true or CI=true)
  const shouldWarmup = process.env.WARMUP_BEFORE_TESTS === 'true' || process.env.CI === 'true';

  if (shouldWarmup) {
    console.log('🔥 Checking deployment health before tests...');
    console.log(`   URL: ${baseUrl}/status`);

    const health = await checkDeploymentHealth(baseUrl);

    if (health.healthy) {
      console.log(`   ✅ Deployment is healthy (${health.duration}ms, build: ${health.buildId || 'unknown'})`);
    } else {
      console.log('   ⚠️ Deployment may not be fully ready - tests might experience cold start delays');
      console.log('   💡 Run "npm run warmup" before tests to avoid cold starts');
    }

    console.log('');
  }
};
