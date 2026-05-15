/**
 * One-shot tile downloader.
 *
 * Downloads terrarium DEM tiles (AWS Public Datasets) and CARTO Dark Matter
 * basemap raster tiles for the demo bbox, into public/tiles/{source}/{z}/{x}/{y}.png.
 *
 * Idempotent: skips files that already exist. Concurrency-limited (8 in flight)
 * to stay polite to CARTO's public CDN. Retries 5xx + network errors once.
 *
 * Run via:  npm run fetch-tiles
 *
 * The downloaded tiles are NOT committed to git (see .gitignore) — the script
 * is the source of truth, the tiles are derived artifacts. First-time setup
 * for a new clone is one `npm run fetch-tiles` invocation.
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_DIR = resolve(ROOT, 'public', 'tiles');

// Mirror src/config.ts. Kept in sync manually since this script runs in Node
// outside the Vite import graph.
const DEMO_BBOX = {
	lonMin: -108.10,
	latMin: 37.60,
	lonMax: -107.50,
	latMax: 38.10,
} as const;

// Pitched + rotated camera reaches outside the operational bbox; download a buffer
// in each direction so the visible-tile set always lives on disk. 0.15° is a few
// km of slack at this latitude — covers ~all reasonable pan/orbit before the user
// would pan into wholly different terrain.
const TILE_PACK_BUFFER_DEG = 0.15;

const FETCH_BBOX = {
	lonMin: DEMO_BBOX.lonMin - TILE_PACK_BUFFER_DEG,
	latMin: DEMO_BBOX.latMin - TILE_PACK_BUFFER_DEG,
	lonMax: DEMO_BBOX.lonMax + TILE_PACK_BUFFER_DEG,
	latMax: DEMO_BBOX.latMax + TILE_PACK_BUFFER_DEG,
} as const;

const ZOOM_RANGE = { min: 8, max: 13 } as const;

const SOURCES = [
	{
		name: 'terrarium',
		urlTemplate: 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
	},
	{
		name: 'basemap',
		urlTemplate: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
	},
] as const;

const USER_AGENT = 'airspace-deconfliction-portfolio/0.1 (https://github.com/) one-shot-tile-fetch';
const CONCURRENCY = 8;

// ---- Web Mercator tile math ---------------------------------------------------

function lonToTileX(lon: number, z: number): number {
	return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
	const rad = (lat * Math.PI) / 180;
	return Math.floor(
		((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
	);
}

interface TileCoord {
	z: number;
	x: number;
	y: number;
}

function tilesForBbox(z: number): TileCoord[] {
	const xMin = lonToTileX(FETCH_BBOX.lonMin, z);
	const xMax = lonToTileX(FETCH_BBOX.lonMax, z);
	// Note: tile y axis is flipped — north has lower y. Use the max-lat corner
	// for the min y, and vice versa.
	const yMin = latToTileY(FETCH_BBOX.latMax, z);
	const yMax = latToTileY(FETCH_BBOX.latMin, z);

	const tiles: TileCoord[] = [];
	for (let x = xMin; x <= xMax; x++) {
		for (let y = yMin; y <= yMax; y++) {
			tiles.push({ z, x, y });
		}
	}
	return tiles;
}

// ---- Fetching -----------------------------------------------------------------

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

interface FetchResult {
	bytes: number;
	skipped: boolean;
	error?: string;
}

async function fetchOne(
	url: string,
	outPath: string,
	attempt = 1,
): Promise<FetchResult> {
	if (await fileExists(outPath)) {
		return { bytes: 0, skipped: true };
	}
	try {
		const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
		if (!res.ok) {
			if (res.status >= 500 && attempt === 1) {
				await delay(500);
				return fetchOne(url, outPath, 2);
			}
			return { bytes: 0, skipped: false, error: `HTTP ${res.status}` };
		}
		const buf = Buffer.from(await res.arrayBuffer());
		await mkdir(dirname(outPath), { recursive: true });
		await writeFile(outPath, buf);
		return { bytes: buf.byteLength, skipped: false };
	} catch (err) {
		if (attempt === 1) {
			await delay(500);
			return fetchOne(url, outPath, 2);
		}
		return { bytes: 0, skipped: false, error: (err as Error).message };
	}
}

async function fetchPool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
	const queue = items.slice();
	const runners = Array.from({ length: CONCURRENCY }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			if (item === undefined) return;
			await worker(item);
		}
	});
	await Promise.all(runners);
}

function format(template: string, t: TileCoord): string {
	return template
		.replace('{z}', String(t.z))
		.replace('{x}', String(t.x))
		.replace('{y}', String(t.y));
}

function fmtBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ---- Main ---------------------------------------------------------------------

async function main(): Promise<void> {
	const overallStart = Date.now();
	const allTiles: TileCoord[] = [];
	for (let z = ZOOM_RANGE.min; z <= ZOOM_RANGE.max; z++) {
		allTiles.push(...tilesForBbox(z));
	}

	const perSource = SOURCES.length;
	console.log(`Operational bbox: ${JSON.stringify(DEMO_BBOX)}`);
	console.log(`Fetched bbox (with ${TILE_PACK_BUFFER_DEG}° buffer): ${JSON.stringify(FETCH_BBOX)}`);
	console.log(`Zoom range: ${ZOOM_RANGE.min}..${ZOOM_RANGE.max}`);
	console.log(`Tiles per source: ${allTiles.length}`);
	console.log(`Total fetches: ${allTiles.length * perSource}`);
	console.log('');

	for (const source of SOURCES) {
		const start = Date.now();
		let downloaded = 0;
		let skipped = 0;
		let bytes = 0;
		const errors: string[] = [];

		await fetchPool(allTiles, async (t) => {
			const url = format(source.urlTemplate, t);
			const outPath = resolve(OUTPUT_DIR, source.name, String(t.z), String(t.x), `${t.y}.png`);
			const r = await fetchOne(url, outPath);
			if (r.skipped) {
				skipped++;
			} else if (r.error) {
				errors.push(`${t.z}/${t.x}/${t.y}: ${r.error}`);
			} else {
				downloaded++;
				bytes += r.bytes;
			}
		});

		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		console.log(
			`[${source.name}] downloaded=${downloaded} skipped=${skipped} bytes=${fmtBytes(bytes)} errors=${errors.length} (${elapsed}s)`,
		);
		if (errors.length > 0) {
			for (const e of errors.slice(0, 5)) console.log(`  - ${e}`);
			if (errors.length > 5) console.log(`  ...and ${errors.length - 5} more`);
		}
	}

	const overall = ((Date.now() - overallStart) / 1000).toFixed(1);
	console.log('');
	console.log(`Done in ${overall}s. Output: ${OUTPUT_DIR}`);
}

await main();
