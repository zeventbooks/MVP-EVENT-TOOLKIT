#!/bin/bash

###############################################################################
# Deployment Configuration Verification Script
#
# This script verifies that all required configurations are in place
# before attempting a deployment. Run this before pushing to main!
#
# Usage:
#   ./scripts/verify-deployment-config.sh
#
# Or with service account credentials for full check:
#   SERVICE_ACCOUNT_JSON='...' ./scripts/verify-deployment-config.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Expected values
EXPECTED_SCRIPT_ID="1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l"
EXPECTED_DB_SPREADSHEET_ID="1SV1oZMq4GbZBaRc0YmTeV02Tl5KXWD8R6FZXC7TwVCQ"
EXPECTED_GCP_PROJECT="zeventbooks"
EXPECTED_SERVICE_ACCOUNT="apps-script-deployer@zeventbooks.iam.gserviceaccount.com"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_check() {
    local status=$1
    local message=$2

    if [ "$status" == "pass" ]; then
        echo -e "${GREEN}✅ $message${NC}"
        ((PASSED++))
    elif [ "$status" == "fail" ]; then
        echo -e "${RED}❌ $message${NC}"
        ((FAILED++))
    elif [ "$status" == "warn" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
        ((WARNINGS++))
    else
        echo -e "${CYAN}ℹ️  $message${NC}"
    fi
}

print_info() {
    echo -e "${CYAN}   ℹ️  $1${NC}"
}

print_action() {
    echo -e "${YELLOW}   → $1${NC}"
}

###############################################################################
# Check Functions
###############################################################################

check_node_modules() {
    print_header "CHECK 1: Dependencies"

    if [ -d "node_modules" ]; then
        print_check "pass" "node_modules exists"
    else
        print_check "fail" "node_modules not found"
        print_action "Run: npm install"
        return 1
    fi

    # Check for critical packages
    if [ -f "node_modules/googleapis/package.json" ]; then
        print_check "pass" "googleapis package installed"
    else
        print_check "fail" "googleapis package not found"
        print_action "Run: npm install"
        return 1
    fi
}

check_project_files() {
    print_header "CHECK 2: Project Files"

    # Check for Apps Script files
    if [ -f "Code.gs" ]; then
        print_check "pass" "Code.gs exists"
    else
        print_check "fail" "Code.gs not found"
        return 1
    fi

    if [ -f "appsscript.json" ]; then
        print_check "pass" "appsscript.json exists"
    else
        print_check "fail" "appsscript.json not found"
        return 1
    fi

    # Check for package.json
    if [ -f "package.json" ]; then
        print_check "pass" "package.json exists"

        # Check for deploy scripts
        if grep -q '"deploy":' package.json; then
            print_check "pass" "Deploy script configured in package.json"
        else
            print_check "fail" "Deploy script not found in package.json"
        fi

        if grep -q '"deploy:diagnose":' package.json; then
            print_check "pass" "Diagnostic script configured in package.json"
        else
            print_check "warn" "Diagnostic script not found in package.json"
        fi
    else
        print_check "fail" "package.json not found"
        return 1
    fi
}

check_configuration_ids() {
    print_header "CHECK 3: Configuration IDs"

    # Check if DEPLOYMENT_CONFIGURATION.md exists
    if [ -f "DEPLOYMENT_CONFIGURATION.md" ]; then
        print_check "pass" "DEPLOYMENT_CONFIGURATION.md exists"

        # Verify critical IDs are documented
        if grep -q "$EXPECTED_SCRIPT_ID" DEPLOYMENT_CONFIGURATION.md; then
            print_check "pass" "Script ID documented correctly"
        else
            print_check "warn" "Script ID may not be documented correctly"
        fi

        if grep -q "$EXPECTED_DB_SPREADSHEET_ID" DEPLOYMENT_CONFIGURATION.md; then
            print_check "pass" "Database Spreadsheet ID documented"
        else
            print_check "warn" "Database Spreadsheet ID may not be documented"
        fi

        if grep -q "$EXPECTED_GCP_PROJECT" DEPLOYMENT_CONFIGURATION.md; then
            print_check "pass" "GCP Project ID documented"
        else
            print_check "warn" "GCP Project ID may not be documented"
        fi

        if grep -q "$EXPECTED_SERVICE_ACCOUNT" DEPLOYMENT_CONFIGURATION.md; then
            print_check "pass" "Service Account email documented"
        else
            print_check "warn" "Service Account email may not be documented"
        fi
    else
        print_check "fail" "DEPLOYMENT_CONFIGURATION.md not found"
        print_action "This file should contain all configuration IDs"
        return 1
    fi
}

check_environment_variables() {
    print_header "CHECK 4: Environment Variables (Optional)"

    if [ -z "$SERVICE_ACCOUNT_JSON" ]; then
        print_check "info" "SERVICE_ACCOUNT_JSON not set (optional for local deployment)"
        print_info "Set this to test local deployment"
    else
        print_check "pass" "SERVICE_ACCOUNT_JSON is set"

        # Try to parse it
        if echo "$SERVICE_ACCOUNT_JSON" | jq . > /dev/null 2>&1; then
            print_check "pass" "SERVICE_ACCOUNT_JSON is valid JSON"

            # Check for required fields
            PROJECT_ID=$(echo "$SERVICE_ACCOUNT_JSON" | jq -r '.project_id // empty')
            CLIENT_EMAIL=$(echo "$SERVICE_ACCOUNT_JSON" | jq -r '.client_email // empty')

            if [ -n "$PROJECT_ID" ]; then
                print_info "Project ID: $PROJECT_ID"
                if [ "$PROJECT_ID" == "$EXPECTED_GCP_PROJECT" ]; then
                    print_check "pass" "Project ID matches expected: $EXPECTED_GCP_PROJECT"
                else
                    print_check "warn" "Project ID ($PROJECT_ID) doesn't match expected ($EXPECTED_GCP_PROJECT)"
                fi
            fi

            if [ -n "$CLIENT_EMAIL" ]; then
                print_info "Service Account: $CLIENT_EMAIL"
                if [ "$CLIENT_EMAIL" == "$EXPECTED_SERVICE_ACCOUNT" ]; then
                    print_check "pass" "Service Account matches expected"
                else
                    print_check "warn" "Service Account ($CLIENT_EMAIL) doesn't match expected ($EXPECTED_SERVICE_ACCOUNT)"
                fi
            fi
        else
            print_check "fail" "SERVICE_ACCOUNT_JSON is not valid JSON"
        fi
    fi

    if [ -z "$SCRIPT_ID" ]; then
        print_check "info" "SCRIPT_ID not set (will use default from config)"
        print_info "Default: $EXPECTED_SCRIPT_ID"
    else
        print_check "pass" "SCRIPT_ID is set: $SCRIPT_ID"
        if [ "$SCRIPT_ID" == "$EXPECTED_SCRIPT_ID" ]; then
            print_check "pass" "SCRIPT_ID matches expected"
        else
            print_check "warn" "SCRIPT_ID doesn't match expected: $EXPECTED_SCRIPT_ID"
        fi
    fi
}

check_github_workflow() {
    print_header "CHECK 5: GitHub Actions Configuration"

    if [ -f ".github/workflows/ci.yml" ]; then
        print_check "pass" "CI/CD workflow file exists"

        # Check if it references the correct secrets
        if grep -q "APPS_SCRIPT_SERVICE_ACCOUNT_JSON" .github/workflows/ci.yml; then
            print_check "pass" "Workflow uses APPS_SCRIPT_SERVICE_ACCOUNT_JSON secret"
        else
            print_check "warn" "Workflow may not be configured for service account deployment"
        fi

        if grep -q "SCRIPT_ID" .github/workflows/ci.yml; then
            print_check "pass" "Workflow uses SCRIPT_ID secret"
        else
            print_check "warn" "Workflow may not have SCRIPT_ID configured"
        fi
    else
        print_check "warn" "GitHub Actions workflow not found"
        print_info "CI/CD won't be available without this file"
    fi

    # Check if gh CLI is available and can list secrets
    if command -v gh &> /dev/null; then
        print_check "info" "GitHub CLI (gh) is installed"

        # Try to list secrets (may fail if not authenticated or no permissions)
        if gh secret list &> /dev/null; then
            print_check "pass" "Can access GitHub secrets"

            # Check specific secrets
            if gh secret list | grep -q "APPS_SCRIPT_SERVICE_ACCOUNT_JSON"; then
                print_check "pass" "APPS_SCRIPT_SERVICE_ACCOUNT_JSON secret exists in GitHub"
            else
                print_check "fail" "APPS_SCRIPT_SERVICE_ACCOUNT_JSON secret NOT found in GitHub"
                print_action "Add this secret at: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/settings/secrets/actions"
            fi

            if gh secret list | grep -q "SCRIPT_ID"; then
                print_check "pass" "SCRIPT_ID secret exists in GitHub"
            else
                print_check "fail" "SCRIPT_ID secret NOT found in GitHub"
                print_action "Add this secret at: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/settings/secrets/actions"
            fi
        else
            print_check "warn" "Cannot access GitHub secrets (may need authentication)"
            print_action "Run: gh auth login"
        fi
    else
        print_check "info" "GitHub CLI not installed (optional)"
        print_info "Install for secret verification: https://cli.github.com/"
    fi
}

check_documentation() {
    print_header "CHECK 6: Documentation"

    local docs=(
        "DEPLOYMENT_CONFIGURATION.md:Configuration reference"
        "docs/APPS_SCRIPT_API_SETUP.md:Setup guide"
        "GITHUB_ACTIONS_DEPLOYMENT.md:CI/CD guide"
        "DEPLOYMENT_QUICK_START.md:Quick start guide"
    )

    for doc in "${docs[@]}"; do
        IFS=':' read -r file desc <<< "$doc"
        if [ -f "$file" ]; then
            print_check "pass" "$desc ($file)"
        else
            print_check "warn" "$desc not found ($file)"
        fi
    done
}

check_tests() {
    print_header "CHECK 7: Test Suite"

    if [ -d "tests" ]; then
        print_check "pass" "tests directory exists"
    else
        print_check "warn" "tests directory not found"
    fi

    # Check if tests can run
    if npm run test --dry-run &> /dev/null 2>&1; then
        print_check "pass" "Test command configured"
    else
        print_check "warn" "Test command may not be configured"
    fi

    print_check "info" "Run 'npm test' before deploying"
}

run_diagnostic_if_possible() {
    print_header "CHECK 8: Service Account Diagnostic (Optional)"

    if [ -n "$SERVICE_ACCOUNT_JSON" ] && [ -n "$SCRIPT_ID" ]; then
        print_check "info" "Environment variables set - running diagnostic..."

        # Run the diagnostic script
        if npm run deploy:diagnose; then
            print_check "pass" "Diagnostic passed - ready to deploy!"
        else
            print_check "fail" "Diagnostic failed - check errors above"
            print_action "Review the diagnostic output for specific issues"
        fi
    else
        print_check "info" "Skipping diagnostic (environment variables not set)"
        print_info "To run full diagnostic:"
        print_action "export SCRIPT_ID='$EXPECTED_SCRIPT_ID'"
        print_action "export SERVICE_ACCOUNT_JSON='<your-json-here>'"
        print_action "./scripts/verify-deployment-config.sh"
    fi
}

###############################################################################
# Main Execution
###############################################################################

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║          Deployment Configuration Verification               ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Run all checks
check_node_modules
check_project_files
check_configuration_ids
check_environment_variables
check_github_workflow
check_documentation
check_tests
run_diagnostic_if_possible

# Summary
print_header "VERIFICATION SUMMARY"

echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                               ║${NC}"
        echo -e "${GREEN}║  ✅ ALL CHECKS PASSED - Ready to deploy!                     ║${NC}"
        echo -e "${GREEN}║                                                               ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Run tests: npm test"
        echo "  2. Push to main: git push origin main"
        echo "  3. Monitor: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║                                                               ║${NC}"
        echo -e "${YELLOW}║  ⚠️  CHECKS PASSED WITH WARNINGS                             ║${NC}"
        echo -e "${YELLOW}║                                                               ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Review warnings above. Deployment should work but may have issues."
        echo ""
        exit 0
    fi
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}║  ❌ VERIFICATION FAILED                                       ║${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please fix the failed checks above before deploying."
    echo ""
    echo "For help, see:"
    echo "  - DEPLOYMENT_CONFIGURATION.md (troubleshooting section)"
    echo "  - docs/APPS_SCRIPT_API_SETUP.md (setup guide)"
    echo ""
    exit 1
fi
