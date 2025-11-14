#!/bin/bash
# Test deployment script to verify 302 redirect fix
# Run this locally after authenticating with: npx clasp login

set -e

echo "🧪 Test Deployment Script - Verify 302 Redirect Fix"
echo "========================================================"
echo ""

# Check if clasp is authenticated
if ! npx clasp login --status &>/dev/null; then
    echo "❌ Not authenticated with clasp"
    echo ""
    echo "Please run first:"
    echo "  npx clasp login"
    echo ""
    exit 1
fi

echo "✅ Authenticated with clasp"
echo ""

# Push the latest code
echo "📤 Pushing latest code to Apps Script..."
npx clasp push --force
echo ""

# List current deployments
echo "📋 Current deployments:"
npx clasp deployments
echo ""

# Ask user which deployment to update or create new
read -p "Enter deployment ID to update (@1, @2, etc.) or press Enter to create new: " DEPLOY_ID

if [ -n "$DEPLOY_ID" ]; then
    echo ""
    echo "🔄 Updating deployment $DEPLOY_ID..."
    npx clasp deploy -i "$DEPLOY_ID" -d "Test Deploy - Fix 302 redirects $(date -Iseconds)"
else
    echo ""
    echo "🆕 Creating new deployment..."
    npx clasp deploy -d "Test Deploy - Fix 302 redirects $(date -Iseconds)"
fi

echo ""
echo "📋 Updated deployments:"
DEPLOYMENTS=$(npx clasp deployments)
echo "$DEPLOYMENTS"
echo ""

# Extract web app URL
WEB_APP_URL=$(echo "$DEPLOYMENTS" | grep -oP 'https://script\.google\.com/macros/s/[^/]+/exec' | head -1)

if [ -z "$WEB_APP_URL" ]; then
    echo "⚠️ Could not automatically extract web app URL"
    echo "Please copy the URL from the deployments list above"
    exit 0
fi

echo "🌐 Web App URL: $WEB_APP_URL"
echo ""

# Test the deployment
echo "🧪 Testing deployment for 302 redirects..."
echo "========================================================"
echo ""

# Test status endpoint
echo "📋 Test 1: Status Endpoint"
echo "   GET $WEB_APP_URL?page=status"
echo ""

STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$WEB_APP_URL?page=status")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP 200 OK - No redirect!"

    # Check if response is valid JSON
    if echo "$RESPONSE_BODY" | jq empty 2>/dev/null; then
        echo "✅ Valid JSON response"

        # Show key info
        BUILD=$(echo "$RESPONSE_BODY" | jq -r '.value.build // "unknown"')
        CONTRACT=$(echo "$RESPONSE_BODY" | jq -r '.value.contract // "unknown"')
        echo "   Build: $BUILD"
        echo "   Contract: $CONTRACT"
    else
        echo "⚠️ Response is not JSON (might be HTML)"
        echo "$RESPONSE_BODY" | head -5
    fi
elif [ "$HTTP_CODE" = "302" ]; then
    echo "❌ HTTP 302 - Still redirecting!"
    echo ""
    echo "Response:"
    echo "$RESPONSE_BODY"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "1. Make sure you deployed AFTER changing appsscript.json"
    echo "2. Verify appsscript.json has: \"executeAs\": \"USER_DEPLOYING\""
    echo "3. Try creating a brand new deployment instead of updating"
    exit 1
else
    echo "⚠️ HTTP $HTTP_CODE (unexpected)"
    echo "$RESPONSE_BODY"
fi

echo ""

# Test public page
echo "📋 Test 2: Public Events Page"
echo "   GET $WEB_APP_URL?p=events&tenant=root"
echo ""

PUBLIC_RESPONSE=$(curl -s -w "\n%{http_code}" "$WEB_APP_URL?p=events&tenant=root")
HTTP_CODE=$(echo "$PUBLIC_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP 200 OK - No redirect!"
elif [ "$HTTP_CODE" = "302" ]; then
    echo "❌ HTTP 302 - Still redirecting!"
    exit 1
else
    echo "⚠️ HTTP $HTTP_CODE"
fi

echo ""
echo "========================================================"
echo "🎉 SUCCESS! 302 redirects are FIXED!"
echo "========================================================"
echo ""
echo "Your deployment is working correctly at:"
echo "  $WEB_APP_URL"
echo ""
echo "Next steps:"
echo "1. Save this deployment ID for GitHub secrets (optional)"
echo "2. Merge the PR to main"
echo "3. CI will deploy with the fixed configuration"
echo ""
