/**
 * Vercel Web Analytics Integration
 * This script loads and initializes Vercel Web Analytics for static HTML pages
 */

import { inject } from './node_modules/@vercel/analytics/dist/index.mjs';

// Initialize Web Analytics
inject();
