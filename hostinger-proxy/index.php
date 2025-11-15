<?php
/**
 * Hostinger Multi-Environment Proxy to Google Apps Script
 *
 * Automatically routes requests to QA or Production Google Apps Script deployments
 * based on the domain (qa.zeventbooks.com vs zeventbooks.com)
 *
 * Setup Instructions:
 * 1. Create two Apps Script deployments (QA and Production)
 * 2. Update the deployment IDs below
 * 3. Upload this SAME file to both sites:
 *    - zeventbooks.com → public_html/index.php
 *    - qa.zeventbooks.com → qa.zeventbooks.com/index.php
 * 4. Upload the accompanying .htaccess file to both locations
 * 5. Test both environments:
 *    - QA: https://qa.zeventbooks.com?p=status&tenant=root
 *    - Prod: https://zeventbooks.com?p=status&tenant=root
 */

// ============================================================================
// ENVIRONMENT DETECTION & CONFIGURATION
// ============================================================================

// Detect environment from the HTTP_HOST header
$currentHost = $_SERVER['HTTP_HOST'] ?? '';
$isQA = (strpos($currentHost, 'qa.zeventbooks.com') !== false);
$isLocal = (strpos($currentHost, 'localhost') !== false || strpos($currentHost, '127.0.0.1') !== false);

// Environment-specific Apps Script deployment IDs
if ($isLocal) {
    // Local Development - Uses QA deployment for testing
    define('GOOGLE_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG/exec');
    define('ENVIRONMENT', 'LOCAL');

} elseif ($isQA) {
    // QA Environment - Auto-updates with main branch (@HEAD deployment)
    define('GOOGLE_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG/exec');
    define('ENVIRONMENT', 'QA');

} else {
    // Production Environment - Manually promoted versioned deployment
    // TODO: Replace with your production deployment ID after creating it
    // Run: npx clasp deploy -d "Production v1.0"
    define('GOOGLE_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG/exec');
    define('ENVIRONMENT', 'PRODUCTION');
}

// ✅ Current Deployment Configuration:
//
// QA Deployment (Auto-updates):
//   Deployment ID: AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG
//   Update method: Automatic on push to main branch
//   Used by: qa.zeventbooks.com
//
// Production Deployment (Stable):
//   Deployment ID: AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG (TEMPORARY - REPLACE THIS)
//   Update method: Manual promotion
//   Used by: zeventbooks.com
//
// To create a separate production deployment:
//   1. Run: npx clasp deploy -d "Production v1.0"
//   2. Copy the new deployment ID
//   3. Replace the PRODUCTION deployment ID above
//   4. Re-upload this file to Hostinger
//
// To view all deployments:
//   npx clasp deployments

// ============================================================================
// PROXY LOGIC - NO NEED TO MODIFY BELOW THIS LINE
// ============================================================================

// Get the current query string (everything after ?)
$queryString = $_SERVER['QUERY_STRING'] ?? '';

// Build the full target URL
$targetUrl = GOOGLE_SCRIPT_URL;
if ($queryString) {
    $targetUrl .= '?' . $queryString;
}

// Initialize cURL for making the proxy request
$ch = curl_init();

// Configure cURL options
curl_setopt_array($ch, [
    CURLOPT_URL => $targetUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
        'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'Zeventbooks-Proxy'),
        'Accept: ' . ($_SERVER['HTTP_ACCEPT'] ?? 'text/html,application/json'),
    ],
]);

// For POST requests, forward the request body
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $postData = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);

    // Forward Content-Type header for JSON requests
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers = curl_getopt($ch, CURLOPT_HTTPHEADER);
        $headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
}

// Execute the proxied request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

// Handle cURL errors
if (curl_errno($ch)) {
    http_response_code(502); // Bad Gateway
    header('Content-Type: application/json');
    echo json_encode([
        'ok' => false,
        'code' => 'PROXY_ERROR',
        'message' => 'Unable to connect to backend service',
        'error' => curl_error($ch)
    ]);
    curl_close($ch);
    exit;
}

curl_close($ch);

// Forward the response to the client
http_response_code($httpCode);

// Set content type from backend
if ($contentType) {
    header('Content-Type: ' . $contentType);
}

// Add CORS headers to allow cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Add environment tracking header (useful for debugging)
header('X-Zeventbooks-Environment: ' . ENVIRONMENT);
header('X-Zeventbooks-Host: ' . $currentHost);

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); // No Content
    exit;
}

// Output the proxied response
echo $response;

// ============================================================================
// DEBUG MODE (uncomment to enable logging)
// ============================================================================

// Uncomment these lines to enable debug logging:
/*
$logFile = __DIR__ . '/proxy-debug.log';
$logEntry = sprintf(
    "[%s] ENV:%s HOST:%s %s %s → %s (Status: %d)\n",
    date('Y-m-d H:i:s'),
    ENVIRONMENT,
    $currentHost,
    $_SERVER['REQUEST_METHOD'],
    $_SERVER['REQUEST_URI'],
    $targetUrl,
    $httpCode
);
file_put_contents($logFile, $logEntry, FILE_APPEND);
*/
?>
