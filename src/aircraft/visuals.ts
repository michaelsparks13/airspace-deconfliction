// AGL halo ring (sits at aircraft altitude, colored by AGL band) and ground
// stem (vertical line down to terrain; solid for manned, dashed for UAS).
// Keeping the geometry here so AircraftLayer can focus on placement.

import * as THREE from 'three';
import { AGL_BANDS } from '../config';
import type { CrewType } from '../data/types';

/** AGL color bands, exported so the legend/UI can mirror them. */
export const AGL_COLORS = {
	red: 0xff4d4d,
	amber: 0xffb938,
	green: 0x4ade80,
	unknown: 0x7a8493,
} as const;

export type AglBand = keyof typeof AGL_COLORS;

export function aglBandFor(aglMeters: number | null): AglBand {
	if (aglMeters === null || Number.isNaN(aglMeters)) return 'unknown';
	if (aglMeters < AGL_BANDS.redMaxMeters) return 'red';
	if (aglMeters < AGL_BANDS.amberMaxMeters) return 'amber';
	return 'green';
}

const HALO_RADIUS_METERS = 220;
const HALO_TUBE_METERS = 40;
const OUTLINE_RADIUS_METERS = 70;

// Soft additive glow. Larger radius + additive blending pops the silhouette
// against the dark basemap; low opacity keeps it from washing out close-in.
export function buildHaloRing(): THREE.Mesh {
	const geom = new THREE.RingGeometry(
		HALO_RADIUS_METERS - HALO_TUBE_METERS,
		HALO_RADIUS_METERS,
		48,
		1,
	);
	const mat = new THREE.MeshBasicMaterial({
		color: AGL_COLORS.unknown,
		transparent: true,
		opacity: 0.4,
		side: THREE.DoubleSide,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(geom, mat);
	// RingGeometry lies in XY; rotate it to XZ so it's flat in scene-local.
	ring.rotation.x = -Math.PI / 2;
	return ring;
}

export function setHaloColor(ring: THREE.Mesh, band: AglBand): void {
	const mat = ring.material as THREE.MeshBasicMaterial;
	mat.color.setHex(AGL_COLORS[band]);
}

// Crisp white outline inside the glow, keeps the silhouette readable when
// the halo bleeds into bright terrain or the fire fill.
export function buildOutlineRing(): THREE.LineLoop {
	const points: THREE.Vector3[] = [];
	const segments = 48;
	for (let i = 0; i < segments; i++) {
		const a = (i / segments) * Math.PI * 2;
		points.push(new THREE.Vector3(Math.cos(a) * OUTLINE_RADIUS_METERS, 0, Math.sin(a) * OUTLINE_RADIUS_METERS));
	}
	const geom = new THREE.BufferGeometry().setFromPoints(points);
	const mat = new THREE.LineBasicMaterial({
		color: 0xffffff,
		transparent: true,
		opacity: 0.9,
		depthTest: false,
		depthWrite: false,
	});
	const ring = new THREE.LineLoop(geom, mat);
	ring.renderOrder = 999;
	return ring;
}

// Vertical line from (x, 0, z) to (x, altitude, z): solid for manned,
// dashed for UAS. Length is updated each frame as AGL changes by mutating
// the second vertex of the geometry directly.
export interface GroundStem {
	object: THREE.Object3D;
	setHeight(meters: number): void;
	setColor(hex: number): void;
}

export function buildGroundStem(crew: CrewType): GroundStem {
	const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)];
	const geometry = new THREE.BufferGeometry().setFromPoints(points);

	if (crew === 'uas') {
		const material = new THREE.LineDashedMaterial({
			color: AGL_COLORS.unknown,
			dashSize: 8,
			gapSize: 6,
			transparent: true,
			opacity: 0.85,
			depthWrite: false,
		});
		const line = new THREE.Line(geometry, material);
		line.computeLineDistances();
		return {
			object: line,
			setHeight(meters) {
				const pos = line.geometry.attributes.position as THREE.BufferAttribute;
				pos.setY(1, meters);
				pos.needsUpdate = true;
				line.computeLineDistances();
			},
			setColor(hex) {
				(line.material as THREE.LineDashedMaterial).color.setHex(hex);
			},
		};
	}

	const material = new THREE.LineBasicMaterial({
		color: AGL_COLORS.unknown,
		transparent: true,
		opacity: 0.85,
		depthWrite: false,
	});
	const line = new THREE.Line(geometry, material);
	return {
		object: line,
		setHeight(meters) {
			const pos = line.geometry.attributes.position as THREE.BufferAttribute;
			pos.setY(1, meters);
			pos.needsUpdate = true;
		},
		setColor(hex) {
			(line.material as THREE.LineBasicMaterial).color.setHex(hex);
		},
	};
}
