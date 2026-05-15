/**
 * Per-aircraft visual annotations: AGL halo ring (sits at the aircraft's
 * altitude, colored by AGL band) and ground stem (a thin vertical line from
 * the aircraft down to the ground; solid for manned, dashed for UAS).
 *
 * Building the geometries here keeps AircraftLayer focused on placement and
 * matrix math.
 */

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

const HALO_RADIUS_METERS = 60;
const HALO_TUBE_METERS = 7;

/** A flat torus that hovers around the aircraft at its altitude. */
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
		opacity: 0.75,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(geom, mat);
	// RingGeometry lies in the XY plane; rotate so it lies flat (XZ in our
	// scene-local frame where Y is up).
	ring.rotation.x = -Math.PI / 2;
	return ring;
}

export function setHaloColor(ring: THREE.Mesh, band: AglBand): void {
	const mat = ring.material as THREE.MeshBasicMaterial;
	mat.color.setHex(AGL_COLORS[band]);
}

/**
 * Ground stem: a vertical line from (x, 0, z) to (x, altitude, z).
 * Built as a Line for manned, as a series of dashes for UAS.
 *
 * We update the stem's length each frame (since AGL changes), so we expose
 * a single object whose endpoint we mutate by setting `geometry.attributes`.
 */
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
