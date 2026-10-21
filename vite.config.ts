import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => {
  if (command === 'build' && process.env.VITE_APP_MODE === 'api') {
    const configuredApiUrl = process.env.VITE_API_URL?.trim();
    if (!configuredApiUrl) {
      throw new Error('VITE_API_URL must be set to the HTTPS API origin for an API-mode production build.');
    }

    let apiUrl: URL;
    try {
      apiUrl = new URL(configuredApiUrl);
    } catch {
      throw new Error('VITE_API_URL must be a valid absolute HTTPS origin.');
    }
    const apiHostname = apiUrl.hostname.replace(/\.$/, '');
    if (
      apiUrl.protocol !== 'https:' ||
      apiUrl.username ||
      apiUrl.password ||
      apiUrl.pathname !== '/' ||
      apiUrl.search ||
      apiUrl.hash ||
      apiHostname === 'localhost' ||
      apiHostname.endsWith('.localhost') ||
      apiHostname === '127.0.0.1' ||
      apiHostname === '[::1]' ||
      apiHostname === 'invalid' ||
      apiHostname.endsWith('.invalid')
    ) {
      throw new Error('VITE_API_URL must be a routable HTTPS origin without credentials, path, query or fragment.');
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    envDir: false,
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
    },
  };
});
