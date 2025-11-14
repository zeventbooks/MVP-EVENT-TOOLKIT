#!/bin/bash
# Quick test script to check if a URL has 302 redirect issues
# Usage: ./scripts/test-url.sh <URL>

if [ -z "$1" ]; then
    echo "Usage: $0 <WEB_APP_URL>"
    echo ""
    echo "Example:"
    echo "  $0 https://script.google.com/macros/s/YOUR_ID/exec"
    exit 1
fi

WEB_APP_URL="$1"

echo "🧪 Testing URL for 302 redirects"
echo "========================================================"
echo "URL: $WEB_APP_URL"
echo ""

# Test status endpoint
echo "📋 Test 1: Status Endpoint"
echo "   GET $WEB_APP_URL?page=status"
echo ""

STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$WEB_APP_URL?page=status")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

echo "HTTP Code: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ SUCCESS! HTTP 200 - No redirect!"

    # Check if response is valid JSON
    if echo "$RESPONSE_BODY" | jq empty 2>/dev/null; then
        echo "✅ Valid JSON response"
        echo ""
        echo "Response preview:"
        echo "$RESPONSE_BODY" | jq -C '.' | head -20
    else
        echo "⚠️ Response is not JSON"
        echo "$RESPONSE_BODY" | head -10
    fi
elif [ "$HTTP_CODE" = "302" ]; then
    echo "❌ FAILED! HTTP 302 - Redirecting to login"
    echo ""
    echo "Response:"
    echo "$RESPONSE_BODY"
    echo ""
    echo "This means the deployment has: \"executeAs\": \"USER_ACCESSING\""
    echo "It needs to be changed to: \"executeAs\": \"USER_DEPLOYING\""
    exit 1
else
    echo "⚠️ Unexpected HTTP $HTTP_CODE"
    echo ""
    echo "Response:"
    echo "$RESPONSE_BODY"
    exit 1
fi

echo ""
echo "========================================================"
