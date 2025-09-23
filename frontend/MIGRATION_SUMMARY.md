# Frontend API Migration Summary

## Overview

The Face-LogBook frontend has been updated to use a single environment variable for the backend base URL, eliminating hardcoded URLs throughout the codebase. This improves maintainability and makes it easier to deploy to different environments.

## Changes Made

1. Added environment configuration files:
   - `.env.development` - Development environment configuration
   - `.env.production` - Production environment configuration
   - `.env` - Default environment configuration

2. Created a centralized API service module in `src/services/api.ts` that:
   - Reads the `VITE_API_BASE` environment variable
   - Provides standardized request helpers (GET, POST, PUT, DELETE)
   - Handles error processing and authentication consistently

3. Updated API clients to use the centralized service:
   - `src/api/attendance.ts`
   - `src/api/auth.ts`
   - `src/api/groups.ts`
   - `src/api/students.ts`

4. Updated the Vite configuration to use the environment variable for API proxy

5. Added documentation in `API_CONFIG.md`

## Example Changes

Before:
```typescript
// Previously hardcoded in apiClient.ts
const API_ROOT = "/api/v1";

// Authentication endpoint using hardcoded URL pattern
export const login = async (username, password) => {
  const response = await axios.post(`${API_URL}/auth/login`, { username, password });
  // ...
};
```

After:
```typescript
// Now using environment variable in services/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const API_VERSION = '/api/v1';
const API_URL = `${API_BASE}${API_VERSION}`;

// Authentication endpoint using central API service
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  // ...
};
```

## Testing

To verify the changes:
1. Configure `.env.development` with the appropriate backend URL
2. Start the development server: `npm run dev`
3. Open your browser's developer tools and check the Network tab
4. Confirm that API requests are going to the URL specified in the environment variable
5. Test login and other API functionality to ensure everything works as expected

## Next Steps

1. Update deployment pipelines to set the environment variable appropriately for each environment
2. Consider adding additional environment-specific configuration if needed