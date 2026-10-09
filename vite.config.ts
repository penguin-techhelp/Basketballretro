import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function versionManifestPlugin(buildTime: number): Plugin {
  return {
    name: 'version-manifest-plugin',
    buildStart() {
      const publicDir = path.resolve('public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const versionData = {
        version: '1.4.0',
        buildTime: buildTime,
        builtAt: new Date(buildTime).toISOString(),
        releaseNotes: 'Internet auto-update synchronization, court floor spacing, and offline PWA capability'
      };
      fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(versionData, null, 2));
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: '1.4.0',
          buildTime: buildTime,
          builtAt: new Date(buildTime).toISOString(),
          releaseNotes: 'Internet auto-update synchronization, court floor spacing, and offline PWA capability'
        }, null, 2)
      });
    }
  };
}

export default defineConfig(() => {
  const currentBuildTime = Date.now();

  return {
    base: './',
    define: {
      __APP_BUILD_TIME__: JSON.stringify(currentBuildTime),
      __APP_VERSION__: JSON.stringify('1.4.0'),
    },
    plugins: [
      react(),
      tailwindcss(),
      versionManifestPlugin(currentBuildTime),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'icon.svg',
          'version.json',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png'
        ],
        manifest: {
          id: '/',
          name: "Retro Hoops '95 - 16-Bit Court Dynasty",
          short_name: 'RetroHoops95',
          description: 'A fast-paced 16-bit arcade basketball simulator combining NBA Jam excitement with franchise dynasty depth.',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Navigation HTML: Always fetch NetworkFirst so when online, the browser always gets the newest version!
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'app-navigation-cache',
                networkTimeoutSeconds: 3,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // version.json is NetworkOnly so live update detection is never stale
              urlPattern: /version\.json$/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

