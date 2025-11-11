#!/bin/bash
# Deploy to Apps Script and output test URLs for all tenants

set -e

echo "🚀 Deploying to Google Apps Script..."
echo ""

# Push latest code
echo "📤 Pushing code to Apps Script..."
npx @google/clasp push --force

echo ""
echo "✅ Code pushed successfully!"
echo ""

# Create new deployment
echo "📦 Creating new deployment..."
DEPLOY_OUTPUT=$(npx @google/clasp deploy --description "Deployment $(date '+%Y-%m-%d %H:%M:%S')" 2>&1)
echo "$DEPLOY_OUTPUT"

echo ""
echo "🔍 Getting deployment information..."

# Extract deployment ID from the deploy output
DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'AKfycb[a-zA-Z0-9_-]+' | head -1)

if [ -z "$DEPLOYMENT_ID" ]; then
    echo "⚠️  Could not extract deployment ID from output"
    echo "Trying to get it from deployments list..."
    DEPLOYMENTS=$(npx @google/clasp deployments 2>&1)
    DEPLOYMENT_ID=$(echo "$DEPLOYMENTS" | grep -oP 'AKfycb[a-zA-Z0-9_-]+' | head -1)
fi

# Construct the Web App URL
if [ -n "$DEPLOYMENT_ID" ]; then
    WEBAPP_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"
    echo "✅ Found deployment ID: ${DEPLOYMENT_ID}"
else
    echo "❌ Could not find deployment ID!"
    echo "Please run 'npx @google/clasp deployments' to see your deployments"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 BASE URL:"
echo "$WEBAPP_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏢 ROOT TENANT (Zeventbook)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Admin Page:"
echo "${WEBAPP_URL}?page=admin&tenant=root"
echo ""
echo "📊 Shared Analytics (NEW!):"
echo "${WEBAPP_URL}?page=report&tenant=root"
echo ""
echo "Public Page:"
echo "${WEBAPP_URL}?page=public&tenant=root"
echo ""
echo "Display Page (TV):"
echo "${WEBAPP_URL}?page=display&tenant=root"
echo ""
echo "Poster Page (Print):"
echo "${WEBAPP_URL}?page=poster&tenant=root"
echo ""
echo "Test Dashboard:"
echo "${WEBAPP_URL}?page=test&tenant=root"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 ABC TENANT (American Bocce Co.)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Admin Page:"
echo "${WEBAPP_URL}?page=admin&tenant=abc"
echo ""
echo "📊 Shared Analytics (NEW!):"
echo "${WEBAPP_URL}?page=report&tenant=abc"
echo ""
echo "Public Page:"
echo "${WEBAPP_URL}?page=public&tenant=abc"
echo ""
echo "Display Page (TV):"
echo "${WEBAPP_URL}?page=display&tenant=abc"
echo ""
echo "Poster Page (Print):"
echo "${WEBAPP_URL}?page=poster&tenant=abc"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏆 CBC TENANT (Chicago Bocce Club)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Admin Page:"
echo "${WEBAPP_URL}?page=admin&tenant=cbc"
echo ""
echo "📊 Shared Analytics (NEW!):"
echo "${WEBAPP_URL}?page=report&tenant=cbc"
echo ""
echo "Public Page:"
echo "${WEBAPP_URL}?page=public&tenant=cbc"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚽ CBL TENANT (Chicago Bocce League)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Admin Page:"
echo "${WEBAPP_URL}?page=admin&tenant=cbl"
echo ""
echo "📊 Shared Analytics (NEW!):"
echo "${WEBAPP_URL}?page=report&tenant=cbl"
echo ""
echo "Public Page:"
echo "${WEBAPP_URL}?page=public&tenant=cbl"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 API & DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "API Documentation:"
echo "${WEBAPP_URL}?page=api"
echo ""
echo "System Status:"
echo "${WEBAPP_URL}?page=status"
echo ""
echo "Diagnostics:"
echo "${WEBAPP_URL}?page=diagnostics&tenant=root"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 TESTING TIPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Start with Admin page to create test events"
echo "2. Check the Shared Analytics page (NEW feature!)"
echo "3. Test mobile responsiveness (F12 → Toggle device)"
echo "4. Verify all TRIANGLE pages (Admin → Poster → Display → Public)"
echo ""
echo "📝 Save these URLs for easy testing!"
echo ""
