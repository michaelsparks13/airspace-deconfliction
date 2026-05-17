// Procedural low-poly aircraft meshes, no external asset files.
//
// All meshes are oriented nose-along +X (heading 90°) at unit scale = real
// meters. The render layer rotates them to true_track each frame.
//
// Reference sizes (rough, just enough to read at zoom 10-13):
//   Type 1 helo (S-64, K-MAX): ~25 m rotor span, modeled to ~16 m
//   Air tanker (BAe-146 / RJ85): ~30 m length
//   Recon FW (Twin Otter-ish): ~16 m length
//   ATGS air attack (King Air-ish): ~14 m length
//   UAS (sheriff Mavic/Phantom): ~0.5 m, scaled up to ~5 m here so it stays
//     findable at zoom 11. Dashed ground stem in visuals.ts is the primary
//     "this is a drone" cue.

import * as THREE from 'three';
import type { AircraftCategory } from '../data/types';

const BODY = new THREE.MeshStandardMaterial({
	color: 0xcfd4dc,
	metalness: 0.4,
	roughness: 0.55,
});
const ACCENT = new THREE.MeshStandardMaterial({
	color: 0x8a93a3,
	metalness: 0.5,
	roughness: 0.45,
});
const DISC = new THREE.MeshStandardMaterial({
	color: 0x9aa3b2,
	transparent: true,
	opacity: 0.25,
	side: THREE.DoubleSide,
});
const UAS_BODY = new THREE.MeshStandardMaterial({
	color: 0x4a5263,
	metalness: 0.3,
	roughness: 0.6,
});

function buildHelo(): THREE.Group {
	const g = new THREE.Group();

	const fuselage = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 3.5), BODY);
	fuselage.position.y = 1.75;
	g.add(fuselage);

	const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(7, 1.0, 1.0), ACCENT);
	tailBoom.position.set(-6.5, 2.0, 0);
	g.add(tailBoom);

	const tailFin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.3), ACCENT);
	tailFin.position.set(-9.5, 2.6, 0);
	g.add(tailFin);

	const rotor = new THREE.Mesh(new THREE.CircleGeometry(7, 32), DISC);
	rotor.rotation.x = -Math.PI / 2;
	rotor.position.y = 4.2;
	g.add(rotor);

	const tailRotor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), DISC);
	tailRotor.rotation.y = Math.PI / 2;
	tailRotor.position.set(-10.0, 2.6, 0.4);
	g.add(tailRotor);

	const skidGeom = new THREE.BoxGeometry(7, 0.15, 0.3);
	const skidL = new THREE.Mesh(skidGeom, ACCENT);
	skidL.position.set(0, 0, -1.6);
	const skidR = new THREE.Mesh(skidGeom, ACCENT);
	skidR.position.set(0, 0, 1.6);
	g.add(skidL, skidR);

	return g;
}

// Tanker: BAe-146 / RJ85 silhouette, high wing + four engines.
function buildTanker(): THREE.Group {
	const g = new THREE.Group();

	const fuselage = new THREE.Mesh(new THREE.BoxGeometry(28, 3.5, 3.5), BODY);
	fuselage.position.y = 4.5;
	g.add(fuselage);

	// Cockpit / nose cone
	const nose = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.5, 12), BODY);
	nose.rotation.z = -Math.PI / 2;
	nose.position.set(16, 4.5, 0);
	g.add(nose);

	// High wing
	const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 26), BODY);
	wing.position.set(2, 6.4, 0);
	g.add(wing);

	// Engines (4)
	const engineGeom = new THREE.CylinderGeometry(0.9, 0.9, 3, 12);
	for (const z of [-9, -4, 4, 9]) {
		const eng = new THREE.Mesh(engineGeom, ACCENT);
		eng.rotation.z = Math.PI / 2;
		eng.position.set(2.5, 5.0, z);
		g.add(eng);
	}

	// T-tail horizontal stabilizer
	const hstab = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 10), BODY);
	hstab.position.set(-12, 8.8, 0);
	g.add(hstab);

	// Vertical fin
	const vfin = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.5, 0.4), BODY);
	vfin.position.set(-12, 7.0, 0);
	g.add(vfin);

	return g;
}

// Small twin-engine high-wing, used for both recon and ATGS.
function buildSmallFixedWing(): THREE.Group {
	const g = new THREE.Group();

	const fuselage = new THREE.Mesh(new THREE.BoxGeometry(13, 2.2, 2.2), BODY);
	fuselage.position.y = 2.5;
	g.add(fuselage);

	const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.5, 10), BODY);
	nose.rotation.z = -Math.PI / 2;
	nose.position.set(7.7, 2.5, 0);
	g.add(nose);

	const wing = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 16), BODY);
	wing.position.set(0, 3.6, 0);
	g.add(wing);

	const engineGeom = new THREE.CylinderGeometry(0.6, 0.6, 2.2, 12);
	for (const z of [-3.5, 3.5]) {
		const eng = new THREE.Mesh(engineGeom, ACCENT);
		eng.rotation.z = Math.PI / 2;
		eng.position.set(0.6, 3.0, z);
		g.add(eng);
	}

	const hstab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 5), BODY);
	hstab.position.set(-6, 2.5, 0);
	g.add(hstab);

	const vfin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 0.3), BODY);
	vfin.position.set(-6, 3.5, 0);
	g.add(vfin);

	return g;
}

// UAS: small body + four cross-arm rotors.
function buildUas(): THREE.Group {
	const g = new THREE.Group();

	const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.5), UAS_BODY);
	body.position.y = 0.3;
	g.add(body);

	// Four arms in an X pattern.
	const armGeom = new THREE.BoxGeometry(3.5, 0.15, 0.2);
	for (let i = 0; i < 4; i++) {
		const arm = new THREE.Mesh(armGeom, UAS_BODY);
		arm.position.y = 0.35;
		arm.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
		g.add(arm);
	}

	// Four rotor discs at arm tips.
	const rotorGeom = new THREE.CircleGeometry(0.6, 16);
	for (let i = 0; i < 4; i++) {
		const rotor = new THREE.Mesh(rotorGeom, DISC);
		rotor.rotation.x = -Math.PI / 2;
		const angle = (i * Math.PI) / 2 + Math.PI / 4;
		rotor.position.set(Math.cos(angle) * 1.75, 0.5, Math.sin(angle) * 1.75);
		g.add(rotor);
	}

	return g;
}

export function buildAircraftMesh(category: AircraftCategory): THREE.Group {
	switch (category) {
		case 'helo-type1':
			return buildHelo();
		case 'air-tanker':
			return buildTanker();
		case 'recon-fw':
		case 'atgs-fw':
			return buildSmallFixedWing();
		case 'uas-sheriff':
			return buildUas();
	}
}
