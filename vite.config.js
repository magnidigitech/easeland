import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite Cache Buster HTML Plugin
function htmlCacheBusterPlugin() {
  const buildTimestamp = Date.now().toString();
  return {
    name: 'html-cache-buster',
    transformIndexHtml(html) {
      const metaTags = [
        '<meta name="build-time" content="' + buildTimestamp + '" />',
        '<meta name="app-version" content="1.0.0" />'
      ].join('\n    ');

      let transformed = html.replace('</head>', '    ' + metaTags + '\n  </head>');
      transformed = transformed.replace(
        /href="\/easeland_emblem_transparent\.png"/g,
        'href="/easeland_emblem_transparent.png?v=' + buildTimestamp + '"'
      );
      transformed = transformed.replace(
        /href="\/manifest\.json"/g,
        'href="/manifest.json?v=' + buildTimestamp + '"'
      );
      return transformed;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), htmlCacheBusterPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(Date.now().toString())
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          'vendor-leaflet': ['leaflet', 'leaflet.markercluster'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
})
