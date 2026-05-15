import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Serve a 1x1 transparent PNG for any /tiles/... request that doesn't resolve to
 * a file on disk.
 *
 * Why: Vite's dev server returns the SPA fallback (HTML 200) for unknown paths,
 * which makes MapLibre try to decode HTML as PNG and spam "could not decode"
 * warnings whenever the camera reaches just outside the bundled tile pack. A
 * transparent PNG keeps the scene clean and the console quiet, and matches what
 * would happen behind a real tile CDN for a missing-but-valid request.
 */
function tilesFallbackPlugin(): Plugin {
	// 1x1 transparent PNG (95 bytes, base64 from a known-good source).
	const TRANSPARENT_PNG = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
		'base64',
	);
	return {
		name: 'tiles-fallback',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith('/tiles/')) return next();
				const onDisk = resolve(server.config.publicDir, req.url.replace(/^\//, ''));
				if (existsSync(onDisk)) return next();
				res.setHeader('Content-Type', 'image/png');
				res.setHeader('Cache-Control', 'public, max-age=3600');
				res.end(TRANSPARENT_PNG);
			});
		},
	};
}

export default defineConfig({
	plugins: [vue(), tilesFallbackPlugin()],
});
