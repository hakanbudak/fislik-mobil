#!/usr/bin/env bash
set -euo pipefail
API_URL="${EXPO_PUBLIC_API_URL:-https://fislik-api.selamet.dev}"
npx openapi-typescript "${API_URL}/openapi.json" -o src/api/generated/schema.d.ts
