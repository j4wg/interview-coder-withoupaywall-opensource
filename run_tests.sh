#!/bin/bash
# Script to run Jest tests without Datadog tracing
export DD_INJECT_FORCE=false
export DD_TRACE_ENABLED=false
export NODE_OPTIONS="--no-warnings"

# Run Jest with a direct path to avoid any automatic tracing
./node_modules/.bin/jest --no-cache src/_pages/Debug.test.tsx