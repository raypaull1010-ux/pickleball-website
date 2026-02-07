import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory is the project root
  root: '.',

  // Public directory for static assets
  publicDir: 'public',

  build: {
    // Output to dist folder
    outDir: 'dist',

    // Clear dist folder before build
    emptyOutDir: true,

    // Generate source maps for debugging
    sourcemap: false,

    // Rollup options for multi-page app
    rollupOptions: {
      input: {
        // Root pages
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        services: resolve(__dirname, 'services.html'),
        pricing: resolve(__dirname, 'pricing.html'),
        instructors: resolve(__dirname, 'instructors.html'),
        testimonials: resolve(__dirname, 'testimonials.html'),
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),

        // Admin pages
        adminPanel: resolve(__dirname, 'admin-panel.html'),
        adminNotify: resolve(__dirname, 'admin-notify.html'),

        // Dashboard pages
        coachDashboard: resolve(__dirname, 'coach-dashboard.html'),
        instructorDashboard: resolve(__dirname, 'instructor-dashboard.html'),
        instructorSignup: resolve(__dirname, 'instructor-signup.html'),

        // Feature pages
        gamesLibrary: resolve(__dirname, 'games-library.html'),
        levelUp: resolve(__dirname, 'level-up.html'),
        levelupHealthWaiver: resolve(__dirname, 'levelup-health-waiver.html'),
        rallyClipper: resolve(__dirname, 'rally-clipper.html'),
        gamificationDemo: resolve(__dirname, 'gamification-demo.html'),
        courtsideTracker: resolve(__dirname, 'courtside-tracker.html'),

        // Payment pages
        paymentSuccess: resolve(__dirname, 'payment-success.html'),
        paymentCancel: resolve(__dirname, 'payment-cancel.html'),

        // Membership & Community
        members: resolve(__dirname, 'membership-community/members.html'),
        community: resolve(__dirname, 'membership-community/community.html'),
        membership: resolve(__dirname, 'membership-community/membership.html'),

        // Coach Analysis
        videoAnalysis: resolve(__dirname, 'coach-analysis/video-analysis.html'),
        skillEvaluation: resolve(__dirname, 'coach-analysis/skill-evaluation.html'),
        skillEvaluationForm: resolve(__dirname, 'coach-analysis/skill-evaluation-form.html'),
        doublesAnalysis: resolve(__dirname, 'coach-analysis/doubles-analysis.html'),
        analysisTracker: resolve(__dirname, 'coach-analysis/analysis-tracker.html'),

        // AI Drill Coach
        drillsLibrary: resolve(__dirname, 'ai-drill-coach/drills-library.html'),
        drillPlaybook: resolve(__dirname, 'ai-drill-coach/drill-playbook.html'),
        drillUpload: resolve(__dirname, 'ai-drill-coach/drill-upload.html'),
        drillFeedback: resolve(__dirname, 'ai-drill-coach/drill-feedback.html'),
        drillResults: resolve(__dirname, 'ai-drill-coach/drill-results.html'),
        sessionTracker: resolve(__dirname, 'ai-drill-coach/session-tracker.html'),
        sessionUpload: resolve(__dirname, 'ai-drill-coach/session-upload.html'),
        sessionResults: resolve(__dirname, 'ai-drill-coach/session-results.html'),
      },
      output: {
        // Asset file naming
        assetFileNames: (assetInfo) => {
          // Keep CSS in css folder
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          // Keep images in images folder
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return 'images/[name]-[hash][extname]';
          }
          // Other assets
          return 'assets/[name]-[hash][extname]';
        },
        // Chunk file naming for JS
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },

    // Minification options
    minify: 'esbuild',

    // CSS options
    cssMinify: true,
  },

  // Development server options
  server: {
    port: 3000,
    open: true,
    // Proxy API calls to Netlify functions during development
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      },
    },
  },

  // Preview server (for testing production build)
  preview: {
    port: 4173,
  },

  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js'),
      '@css': resolve(__dirname, 'css'),
    },
  },
});
