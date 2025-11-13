#!/usr/bin/env node

/**
 * Google Apps Script API Deployment Script
 *
 * Replaces Clasp with direct Apps Script API calls using service account authentication.
 * No OAuth, no token refresh, no credential expiration issues.
 *
 * Requirements:
 * - SERVICE_ACCOUNT_JSON environment variable (service account key)
 * - SCRIPT_ID environment variable (Apps Script project ID)
 *
 * Usage:
 *   SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' SCRIPT_ID='xxx' node scripts/deploy-apps-script.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const SCRIPT_ID = process.env.SCRIPT_ID;
const SERVICE_ACCOUNT_JSON = process.env.SERVICE_ACCOUNT_JSON;

// Apps Script file extensions and their types
const FILE_TYPE_MAP = {
  '.gs': 'SERVER_JS',
  '.js': 'SERVER_JS',
  '.html': 'HTML',
  '.json': 'JSON'
};

/**
 * Get all Apps Script project files from the local directory
 */
function getProjectFiles() {
  const files = [];
  const rootDir = process.cwd();

  // Files to include (Apps Script source files)
  const includePatterns = [
    'Code.gs',
    'appsscript.json',
    '*.gs',
    '*.html',
    'src/**/*.gs',
    'src/**/*.html',
    'lib/**/*.gs',
    'lib/**/*.html'
  ];

  // Files to exclude
  const excludePatterns = [
    'node_modules',
    '.git',
    'tests',
    'scripts',
    'docs',
    '.github',
    'playwright-report',
    'coverage',
    'newman-reports',
    'postman'
  ];

  /**
   * Recursively scan directory for Apps Script files
   */
  function scanDirectory(dir, baseDir = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(baseDir, entry.name);

      // Skip excluded directories
      if (entry.isDirectory()) {
        const shouldExclude = excludePatterns.some(pattern =>
          relativePath.includes(pattern) || entry.name === pattern
        );

        if (!shouldExclude) {
          scanDirectory(fullPath, relativePath);
        }
        continue;
      }

      // Check if file should be included
      const ext = path.extname(entry.name);
      const fileType = FILE_TYPE_MAP[ext];

      if (fileType) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Apps Script API expects files without extension in the name
        let name = relativePath;
        if (entry.name !== 'appsscript.json') {
          // Remove extension for .gs and .html files
          name = relativePath.replace(ext, '');
        }

        files.push({
          name: name,
          type: fileType,
          source: content
        });

        console.log(`  📄 ${relativePath} (${fileType})`);
      }
    }
  }

  console.log('📂 Scanning project files...');
  scanDirectory(rootDir);

  return files;
}

/**
 * Authenticate with Google Apps Script API using service account
 */
async function getAuthenticatedClient() {
  if (!SERVICE_ACCOUNT_JSON) {
    throw new Error('SERVICE_ACCOUNT_JSON environment variable is required');
  }

  if (!SCRIPT_ID) {
    throw new Error('SCRIPT_ID environment variable is required');
  }

  console.log('🔐 Authenticating with service account...');

  let credentials;
  try {
    credentials = JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch (error) {
    throw new Error(`Failed to parse SERVICE_ACCOUNT_JSON: ${error.message}`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.webapp.deploy'
    ]
  });

  const authClient = await auth.getClient();
  console.log('✅ Authentication successful');

  return google.script({ version: 'v1', auth: authClient });
}

/**
 * Upload project files to Apps Script
 */
async function uploadFiles(scriptClient, files) {
  console.log('\n📤 Uploading files to Apps Script...');

  try {
    const response = await scriptClient.projects.updateContent({
      scriptId: SCRIPT_ID,
      requestBody: {
        files: files,
        scriptId: SCRIPT_ID
      }
    });

    console.log(`✅ Uploaded ${files.length} files successfully`);
    return response.data;
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    if (error.response) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Create a new deployment
 */
async function createDeployment(scriptClient) {
  console.log('\n🚀 Creating deployment...');

  const timestamp = new Date().toISOString();
  const description = `CI/CD Deploy ${timestamp}`;

  try {
    const response = await scriptClient.projects.deployments.create({
      scriptId: SCRIPT_ID,
      requestBody: {
        versionNumber: undefined, // undefined = create from HEAD
        description: description
      }
    });

    const deployment = response.data;
    console.log('✅ Deployment created successfully');
    console.log(`   Deployment ID: ${deployment.deploymentId}`);

    // Get the web app URL
    const entryPoints = deployment.entryPoints || [];
    const webAppEntry = entryPoints.find(ep => ep.entryPointType === 'WEB_APP');

    if (webAppEntry && webAppEntry.webApp) {
      const url = webAppEntry.webApp.url;
      console.log(`   Web App URL: ${url}`);

      // Output for GitHub Actions
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(
          process.env.GITHUB_OUTPUT,
          `deployment_id=${deployment.deploymentId}\n`
        );
        fs.appendFileSync(
          process.env.GITHUB_OUTPUT,
          `url=${url}\n`
        );
      }

      return { deploymentId: deployment.deploymentId, url };
    } else {
      console.warn('⚠️  No web app entry point found in deployment');
      return { deploymentId: deployment.deploymentId, url: null };
    }
  } catch (error) {
    console.error('❌ Deployment creation failed:', error.message);
    if (error.response) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Main deployment function
 */
async function deploy() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Google Apps Script API Deployment');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Get authenticated client
    const scriptClient = await getAuthenticatedClient();

    // Get project files
    const files = getProjectFiles();

    if (files.length === 0) {
      throw new Error('No Apps Script files found to deploy');
    }

    console.log(`\n📊 Found ${files.length} files to deploy`);

    // Upload files
    await uploadFiles(scriptClient, files);

    // Create deployment
    const result = await createDeployment(scriptClient);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ Deployment Complete!');
    console.log('═══════════════════════════════════════════════════════');

    if (result.url) {
      console.log(`\n🌐 Your app is live at:\n   ${result.url}\n`);
    }

    return result;

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  ❌ Deployment Failed');
    console.error('═══════════════════════════════════════════════════════\n');
    console.error(error.message);

    if (error.code === 'ENOENT') {
      console.error('\n💡 Tip: Make sure you are running this from the project root directory');
    }

    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deploy();
}

module.exports = { deploy, getProjectFiles };
