/** @type {import('tailwindcss').Config} */

// The web app extends the root canonical design system.
// Do NOT add new tokens here — add them to /tailwind.config.js (root).
// Only app-specific content paths go here.

const rootConfig = require('../../tailwind.config');

module.exports = {
  ...rootConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};
