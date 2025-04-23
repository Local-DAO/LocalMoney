#!/bin/bash

# run-tests.sh - Script to run LocalMoney integration tests
# Usage: ./run-tests.sh [options]
# Options:
#  --no-build: Skip building and deploying the programs
#  --force-build: Force build even if source code hasn't changed
#  --suite=<test-suite>: Specify which test suite to run
#     Available suites: full-lifecycle, integration, unit, hub, all, anchor (default: full-lifecycle)
#  --anchor-client: Use anchor client approach instead of manual serialization (used with anchor suite)
#  --verify-deploy: Verify program deployment before running tests (Now runs by default after deploy)

# Exit on error
set -e

# Always stop existing validator first to ensure reset if needed
echo "🛑 Attempting to stop any running local validator..."
pkill -f solana-test-validator || true
sleep 2 # Give time for the process to terminate

# Parse command line arguments
SKIP_BUILD=false
FORCE_BUILD=false
TEST_SUITE="full-lifecycle"
USE_ANCHOR_CLIENT=false
# VERIFY_DEPLOY flag removed, verification happens automatically after deploy

for arg in "$@"
do
    if [ "$arg" == "--no-build" ]; then
        SKIP_BUILD=true
    elif [ "$arg" == "--force-build" ]; then
        FORCE_BUILD=true
    elif [[ "$arg" == "--suite="* ]]; then
        TEST_SUITE="${arg#*=}"
    elif [ "$arg" == "--anchor-client" ]; then
        USE_ANCHOR_CLIENT=true
    # elif [ "$arg" == "--verify-deploy" ]; then # Removed
    #     VERIFY_DEPLOY=true
    fi
done

echo "🚀 Starting LocalMoney test process for suite: $TEST_SUITE..."
if [ "$USE_ANCHOR_CLIENT" = true ]; then
    echo "Using Anchor client approach where possible"
fi
# if [ "$VERIFY_DEPLOY" = true ]; then # Removed
#     echo "Verifying program deployment before running tests"
# fi

# Check if solana is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Error: Solana CLI is not installed. Please install it first."
    exit 1
fi

# Check if anchor is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Error: Anchor CLI is not installed. Please install it first."
    exit 1
fi

echo "📋 Checking Solana version..."
solana --version

echo "📋 Checking Anchor version..."
anchor --version

# Flag to track if we started the validator ourselves
STARTED_VALIDATOR=false

# Function to check if a validator is already running
check_validator_running() {
    if curl --silent --head http://localhost:8899/health >/dev/null 2>&1; then
        return 0 # Running
    else
        return 1 # Not running
    fi
}

# Start validator if not running
if check_validator_running; then
    echo "⚠️ Validator already running at http://localhost:8899 - Tests might use existing state."
    echo "   Consider stopping it manually if a clean state is required."
else
    echo "🧹 Cleaning up previous validator instances (redundant check)..."
    mkdir -p test-ledger
    echo "🔄 Starting Solana local validator in the background..."
    solana-test-validator --reset > test-ledger/validator.log 2>&1 &
    VALIDATOR_PID=$!
    echo $VALIDATOR_PID > test-ledger/validator.pid
    STARTED_VALIDATOR=true # Set the flag indicating we started it

    # Wait for validator to start
    echo "⏳ Waiting for validator to start..."
    MAX_WAIT=30
    CURRENT_WAIT=0
    while ! check_validator_running; do
        if [ $CURRENT_WAIT -ge $MAX_WAIT ]; then
            echo "❌ Error: Timed out waiting for validator to start."
            kill $VALIDATOR_PID 2>/dev/null || true
            exit 1
        fi
        sleep 1
        CURRENT_WAIT=$((CURRENT_WAIT + 1))
    done
    echo "✅ Validator started."

    # Check if validator is responsive
    echo "🔍 Verifying validator is responsive..."
    if ! solana cluster-version; then
        echo "❌ Error: Failed to communicate with local validator after starting."
        kill $VALIDATOR_PID 2>/dev/null || true
        exit 1
    fi

    echo "✅ Local validator running with PID $VALIDATOR_PID"
fi

# Set Solana config to use localhost
echo "⚙️ Configuring Solana to use localhost..."
solana config set --url localhost

# Export environment variables
export ANCHOR_PROVIDER_URL=http://localhost:8899
export ANCHOR_WALLET=/root/.config/solana/id.json 
echo "⚓ Anchor environment variables set:"
echo "ANCHOR_PROVIDER_URL: $ANCHOR_PROVIDER_URL"
echo "ANCHOR_WALLET: $ANCHOR_WALLET"

# Cache file for source code hash
HASH_CACHE_FILE=".program_hash_cache"

# Function to check if build is needed (original logic)
check_build_needed() {
    if [ "$SKIP_BUILD" = true ]; then return 1; fi
    if [ "$FORCE_BUILD" = true ]; then return 0; fi
    local PROGRAMS_DIR="programs"
    local TARGET_DIR="target/deploy"
    local CARGO_TOML="Cargo.toml"
    local ANCHOR_TOML="Anchor.toml"
    if [ ! -f "$TARGET_DIR/hub.so" ] || [ ! -f "$TARGET_DIR/offer.so" ] || \
       [ ! -f "$TARGET_DIR/trade.so" ] || [ ! -f "$TARGET_DIR/price.so" ] || \
       [ ! -f "$TARGET_DIR/profile.so" ]; then return 0; fi
    local CURRENT_HASH=$(find $PROGRAMS_DIR -type f -name "*.rs" -o -name "*.toml" | sort | xargs cat | sha256sum | cut -d ' ' -f 1)
    local CURRENT_CONFIG_HASH=$(cat $CARGO_TOML $ANCHOR_TOML 2>/dev/null | sha256sum | cut -d ' ' -f 1)
    local COMBINED_HASH="${CURRENT_HASH}_${CURRENT_CONFIG_HASH}"
    if [ -f "$HASH_CACHE_FILE" ]; then
        local CACHED_HASH=$(cat "$HASH_CACHE_FILE")
        if [ "$COMBINED_HASH" != "$CACHED_HASH" ]; then
            echo "$COMBINED_HASH" > "$HASH_CACHE_FILE"
            return 0
        else
            return 1
        fi
    else
        echo "$COMBINED_HASH" > "$HASH_CACHE_FILE"
        return 0
    fi
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying program deployment on validator..."
    local all_verified=true
    HUB_PROGRAM_ID=$(grep "^hub =" Anchor.toml | awk -F'"' '{print $2}')
    OFFER_PROGRAM_ID=$(grep "^offer =" Anchor.toml | awk -F'"' '{print $2}')
    TRADE_PROGRAM_ID=$(grep "^trade =" Anchor.toml | awk -F'"' '{print $2}')
    PRICE_PROGRAM_ID=$(grep "^price =" Anchor.toml | awk -F'"' '{print $2}')
    PROFILE_PROGRAM_ID=$(grep "^profile =" Anchor.toml | awk -F'"' '{print $2}')
    PROGRAMS=("hub:$HUB_PROGRAM_ID" "offer:$OFFER_PROGRAM_ID" "trade:$TRADE_PROGRAM_ID" "price:$PRICE_PROGRAM_ID" "profile:$PROFILE_PROGRAM_ID")
    for entry in "${PROGRAMS[@]}"; do
        local name="${entry%%:*}"; local id="${entry##*:}"
        echo -n "Checking ${name} program (${id})... " # Use -n to print result on same line
        if ! solana program show "${id}" > /dev/null 2>&1; then
            echo "❌ NOT FOUND"
            all_verified=false
        else
            echo "✓ Found"
        fi
    done
    if [ "$all_verified" = false ]; then
        echo "❌ Deployment verification failed."
        return 1
    else
        echo "✅ All programs verified as deployed!"
        return 0
    fi
}

# Determine if we need to build/deploy
DO_BUILD_DEPLOY=false
if [ "$STARTED_VALIDATOR" = true ]; then
    echo "Validator was just started by this script. Forcing build and deploy." 
    DO_BUILD_DEPLOY=true
elif check_build_needed; then
    echo "Build needed based on source changes or flags."
    DO_BUILD_DEPLOY=true
else
    echo "Build not needed based on source changes or flags."
fi

# Build and deploy programs if determined necessary
if [ "$DO_BUILD_DEPLOY" = true ]; then
    if [ "$SKIP_BUILD" = true ]; then
         echo "⚠️ --no-build flag is set, but build/deploy is forced because validator was just started. Ignoring --no-build."
    fi
    echo "🔨 Building programs..."
    anchor build
    if [ $? -ne 0 ]; then echo "❌ Build failed."; exit 1; fi
    
    echo "📦 Deploying programs to local validator..."
    anchor deploy --provider.cluster localnet 
    if [ $? -ne 0 ]; then echo "❌ Deployment failed."; exit 1; fi
    
    echo "✅ Programs built and deployed successfully!"

    # Always verify deployment immediately after build/deploy
    if ! verify_deployment; then exit 1; fi

else
    echo "⏩ Skipping build and deploy cycle..."
    # Even if skipping, verify programs exist on validator
    if ! verify_deployment; then
         echo "   Programs missing on validator despite skipping build. Build might be required."
         exit 1
    fi
fi

# Run the specified test suite
# ... (rest of test execution and cleanup logic - unchanged) ...

echo "🛠️ Setting up test environment and running tests: $TEST_SUITE"

# Clear previous test logs if they exist
TEST_LOG_FILE="test-ledger/test-output.log"
mkdir -p test-ledger
rm -f "$TEST_LOG_FILE"
echo "Cleared previous test log file: $TEST_LOG_FILE"

echo "⚙️ Running tests (output to $TEST_LOG_FILE)..."
case $TEST_SUITE in
    "full-lifecycle")
        # Explicitly pass env vars to npm script
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:direct:full-lifecycle >> "$TEST_LOG_FILE" 2>&1
        TEST_EXIT_CODE=$?
        ;;
    "integration")
        # Explicitly pass env vars to npm script
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:direct:integration >> "$TEST_LOG_FILE" 2>&1
        TEST_EXIT_CODE=$?
        ;;
    "unit")
         # Explicitly pass env vars to npm script
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:direct:unit >> "$TEST_LOG_FILE" 2>&1
        TEST_EXIT_CODE=$?
        ;;
    "hub")
         # Explicitly pass env vars to npm script
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:direct:hub >> "$TEST_LOG_FILE" 2>&1
        TEST_EXIT_CODE=$?
        ;;
    "anchor")
        if [ "$USE_ANCHOR_CLIENT" = true ]; then
             # Explicitly pass env vars to npm script
            ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
            ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:anchor >> "$TEST_LOG_FILE" 2>&1
            TEST_EXIT_CODE=$?
        else
            echo "❌ Anchor suite requires --anchor-client flag" >> "$TEST_LOG_FILE" 2>&1
            TEST_EXIT_CODE=1 # Indicate error
        fi
        ;;
    "all")
         # Explicitly pass env vars to npm script
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:direct:all >> "$TEST_LOG_FILE" 2>&1
        TEST_EXIT_CODE=$?
        ;;
    *)
        echo "❌ Unknown test suite: $TEST_SUITE. Using default (full-lifecycle)." >> "$TEST_LOG_FILE" 2>&1
         # Explicitly pass env vars to npm script
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run setup-test-env:no-build && \
        ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL ANCHOR_WALLET=$ANCHOR_WALLET npm run test:direct:full-lifecycle >> "$TEST_LOG_FILE" 2>&1
        TEST_EXIT_CODE=$?
        ;;
esac

# Analyze test results from the log file
echo "📊 Analyzing test results from $TEST_LOG_FILE..."
cat "$TEST_LOG_FILE"

# Check test exit code
if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "❌ Tests failed! See output above or in $TEST_LOG_FILE."
    # Don't exit immediately, allow cleanup
else
    echo "✅ Tests passed for suite: $TEST_SUITE"
fi

# Cleanup - stop the validator only if we started it
if [ "$STARTED_VALIDATOR" = true ]; then
    echo "🧹 Stopping local validator (PID $VALIDATOR_PID)..."
    if [ -f test-ledger/validator.pid ]; then
        # Use kill -TERM first for graceful shutdown
        kill -TERM $VALIDATOR_PID 2>/dev/null || true
        sleep 3 # Give it time to shut down
        # Force kill if still running
        if kill -0 $VALIDATOR_PID 2>/dev/null; then
            echo "   Validator didn't stop gracefully, forcing kill..."
            kill -9 $VALIDATOR_PID 2>/dev/null || true
            sleep 1
        fi
        # Extra cleanup check just in case
        pkill -f solana-test-validator 2>/dev/null || true
    else 
        echo "   Validator PID file not found, attempting generic pkill..."
        pkill -f solana-test-validator 2>/dev/null || true
    fi
    echo "✅ Cleaned up validator process"
else
    echo "✅ Leaving existing validator running"
fi

# Exit with the test suite's exit code
echo "🏁 Test run finished for suite: $TEST_SUITE"
exit $TEST_EXIT_CODE