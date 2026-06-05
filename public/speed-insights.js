/**
 * Vercel Speed Insights Integration
 * This script loads and initializes Vercel Speed Insights for static HTML pages
 */

import { injectSpeedInsights } from './node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights
injectSpeedInsights({
  debug: true // Enable debug mode in development
});
