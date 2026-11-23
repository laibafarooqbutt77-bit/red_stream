import * as THREE from 'three';

export type ModelPresetId = 'fairytale-castle' | 'cartoon-sorcerer' | 'enchanted-carriage';
export type FinishPresetId = 'royal' | 'fairy' | 'crimson' | 'emerald';

export interface FinishPalette {
  id: FinishPresetId;
  label: string;
  swatch: string;
  primary: number;
  secondary: number;
  metal: number;
  accent: number;
  glow: number;
}

export const FINISH_PALETTES: Record<FinishPresetId, FinishPalette> = {
  royal: {
    id: 'royal',
    label: 'Royal Blue & Gold',
    swatch: '#2563EB',
    primary: 0xf2eee6,
    secondary: 0x60a5fa,
    metal: 0xf5b942,
    accent: 0x1d4ed8,
    glow: 0xffe066,
  },
  fairy: {
    id: 'fairy',
    label: 'Fairy Rose & Pearl',
    swatch: '#EC4899',
    primary: 0xfaf5f2,
    secondary: 0xf472b6,
    metal: 0xe6b18a,
    accent: 0xdb2777,
    glow: 0xfef08a,
  },
  crimson: {
    id: 'crimson',
    label: 'Classic Cartoon Red',
    swatch: '#DC2626',
    primary: 0x22232b,
    secondary: 0xfef3c7,
    metal: 0xf5b942,
    accent: 0xdc2626,
    glow: 0xfbbf24,
  },
  emerald: {
    id: 'emerald',
    label: 'Enchanted Emerald',
    swatch: '#059669',
    primary: 0xe8f3ee,
    secondary: 0x34d399,
    metal: 0xe5b95c,
    accent: 0x059669,
    glow: 0xa7f3d0,
  },
};

export interface BuiltModel {
  group: THREE.Group;
  animatedParts: {
    obj: THREE.Object3D;
    kind: 'spin-slow' | 'float' | 'ring';
    speed: number;
    baseY: number;
  }[];
  dispose: () => void;
}

function registerExplodable(obj: THREE.Object3D, explodeVec: THREE.Vector3) {
  obj.userData.basePos = obj.position.clone();
  obj.userData.explodeVec = explodeVec;
}

function createStarGeometry(outerR = 0.14, innerR = 0.06, depth = 0.04): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function createCrescentGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.22, -Math.PI * 0.65, Math.PI * 0.65, false);
  shape.absarc(0.09, 0, 0.16, Math.PI * 0.58, -Math.PI * 0.58, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.center();
  return geo;
}

function createBowtieGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.04);
  shape.lineTo(0.32, 0.18);
  shape.quadraticCurveTo(0.38, 0, 0.32, -0.18);
  shape.lineTo(0, -0.04);
  shape.lineTo(-0.32, -0.18);
  shape.quadraticCurveTo(-0.38, 0, -0.32, 0.18);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
  geo.center();
  return geo;
}

function createFlagGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.24, -0.05);
  shape.lineTo(0, -0.12);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: false,
  });
  return geo;
}

export function buildProceduralModel(
  modelId: ModelPresetId,
  finishId: FinishPresetId,
  options: { isSoftwareGl: boolean; maxAnisotropy: number }
): BuiltModel {
  const palette = FINISH_PALETTES[finishId];
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const animatedParts: BuiltModel['animatedParts'] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Calibrated PBR materials with distinct roughness tiers
  const stonePrimaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.primary,
      roughness: 0.72,
      metalness: 0.08,
    })
  );
  const satinSecondaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.secondary,
      roughness: 0.45,
      metalness: 0.22,
    })
  );
  const brushedGoldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: palette.metal,
      roughness: 0.18,
      metalness: 0.92,
      anisotropy: 0.75,
      clearcoat: 0.35,
    })
  );
  const spireGlossMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: palette.accent,
      roughness: 0.2,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    })
  );
  const cartoonInkMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1c22,
      roughness: 0.28,
      metalness: 0.15,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
    })
  );
  const cartoonCreamMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfde8d7,
      roughness: 0.58,
      metalness: 0.02,
    })
  );
  const cartoonRedMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      roughness: 0.22,
      metalness: 0.2,
      clearcoat: 0.9,
    })
  );
  const magicGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.glow,
      emissive: palette.glow,
      emissiveIntensity: 1.45,
      roughness: 0.25,
      metalness: 0.1,
    })
  );
  const moatWaterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.88,
    })
  );
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.06,
      metalness: 0.0,
      transmission: options.isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: options.isSoftwareGl ? 0.42 : 1.0,
      ior: 1.5,
      thickness: 0.6,
      clearcoat: 1.0,
    })
  );

  const enableShadows = (mesh: THREE.Object3D) => {
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = !options.isSoftwareGl;
        child.receiveShadow = !options.isSoftwareGl;
      }
    });
  };

  if (modelId === 'fairytale-castle') {
    // 1. Royal Island Base & Shimmering Moat Ring
    const islandGeo = trackGeo(new THREE.CylinderGeometry(1.75, 1.9, 0.22, 32));
    const island = new THREE.Mesh(islandGeo, stonePrimaryMat);
    island.position.set(0, 0.11, 0);
    registerExplodable(island, new THREE.Vector3(0, -0.35, 0));
    root.add(island);

    const moatGeo = trackGeo(new THREE.CylinderGeometry(1.96, 2.02, 0.08, 36));
    const moat = new THREE.Mesh(moatGeo, moatWaterMat);
    moat.position.set(0, 0.04, 0);
    registerExplodable(moat, new THREE.Vector3(0, -0.5, 0));
    root.add(moat);

    // 2. Fortress Curtain Wall & Battlements
    const curtainGeo = trackGeo(new THREE.CylinderGeometry(1.18, 1.24, 0.56, 8));
    const curtain = new THREE.Mesh(curtainGeo, stonePrimaryMat);
    curtain.position.set(0, 0.5, 0);
    curtain.rotation.y = Math.PI / 8;
    registerExplodable(curtain, new THREE.Vector3(0, -0.05, 0));
    root.add(curtain);

    // 3. Front Arched Gatehouse & Drawbridge
    const gateGroup = new THREE.Group();
    const gateBodyGeo = trackGeo(new THREE.BoxGeometry(0.58, 0.68, 0.42));
    const gateBody = new THREE.Mesh(gateBodyGeo, stonePrimaryMat);
    gateBody.position.y = 0.34;
    const archGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.44, 16));
    const arch = new THREE.Mesh(archGeo, cartoonInkMat);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 0.26, 0.02);
    const doorBaseGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.26, 0.44));
    const doorBase = new THREE.Mesh(doorBaseGeo, cartoonInkMat);
    doorBase.position.set(0, 0.13, 0.02);
    const bridgeGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.05, 0.62));
    const bridge = new THREE.Mesh(bridgeGeo, brushedGoldMat);
    bridge.position.set(0, 0.03, 0.45);
    bridge.rotation.x = 0.12;
    gateGroup.add(gateBody, arch, doorBase, bridge);
    gateGroup.position.set(0, 0.22, 0.96);
    registerExplodable(gateGroup, new THREE.Vector3(0, 0, 0.65));
    root.add(gateGroup);

    // 4. Four Corner Turrets with Conical Spires
    const turretShaftGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.21, 0.95, 16));
    const turretRoofGeo = trackGeo(new THREE.ConeGeometry(0.25, 0.62, 16));
    const turretRimGeo = trackGeo(new THREE.TorusGeometry(0.21, 0.03, 10, 24));
    const flagGeo = trackGeo(createFlagGeometry());
    const cornerPositions: [number, number][] = [
      [-0.95, 0.72],
      [0.95, 0.72],
      [-0.95, -0.72],
      [0.95, -0.72],
    ];
    cornerPositions.forEach(([tx, tz]) => {
      const turret = new THREE.Group();
      const shaft = new THREE.Mesh(turretShaftGeo, stonePrimaryMat);
      shaft.position.y = 0.48;
      const rim = new THREE.Mesh(turretRimGeo, brushedGoldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.96;
      const roof = new THREE.Mesh(turretRoofGeo, spireGlossMat);
      roof.position.y = 1.27;
      const flag = new THREE.Mesh(flagGeo, cartoonRedMat);
      flag.position.set(0, 1.56, 0);
      turret.add(shaft, rim, roof, flag);
      turret.position.set(tx, 0.22, tz);
      registerExplodable(turret, new THREE.Vector3(tx * 0.48, 0.2, tz * 0.48));
      root.add(turret);
    });

    // 5. Two Mid-Level Side Towers
    const midShaftGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 1.38, 20));
    const midRoofGeo = trackGeo(new THREE.ConeGeometry(0.32, 0.78, 20));
    [-0.56, 0.56].forEach((mx) => {
      const tower = new THREE.Group();
      const shaft = new THREE.Mesh(midShaftGeo, stonePrimaryMat);
      shaft.position.y = 0.69;
      const roof = new THREE.Mesh(midRoofGeo, spireGlossMat);
      roof.position.y = 1.76;
      const tipGeo = trackGeo(new THREE.SphereGeometry(0.055, 12, 12));
      const tip = new THREE.Mesh(tipGeo, brushedGoldMat);
      tip.position.y = 2.16;
      tower.add(shaft, roof, tip);
      tower.position.set(mx, 0.22, -0.15);
      registerExplodable(tower, new THREE.Vector3(mx * 0.5, 0.4, -0.15));
      root.add(tower);
    });

    // 6. Central Grand Royal Keep & Tall Spire
    const keepBodyGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.54, 1.55, 24));
    const keepBody = new THREE.Mesh(keepBodyGeo, stonePrimaryMat);
    keepBody.position.set(0, 1.0, -0.06);
    registerExplodable(keepBody, new THREE.Vector3(0, 0.45, 0));
    root.add(keepBody);

    // Balcony Crown Ring + Rose Window
    const balconyGeo = trackGeo(new THREE.TorusGeometry(0.5, 0.045, 12, 32));
    const balcony = new THREE.Mesh(balconyGeo, brushedGoldMat);
    balcony.rotation.x = Math.PI / 2;
    balcony.position.set(0, 1.78, -0.06);
    registerExplodable(balcony, new THREE.Vector3(0, 0.65, 0));
    root.add(balcony);

    const roseFrameGeo = trackGeo(new THREE.TorusGeometry(0.16, 0.025, 10, 24));
    const roseFrame = new THREE.Mesh(roseFrameGeo, brushedGoldMat);
    roseFrame.position.set(0, 1.35, 0.45);
    const roseGlowGeo = trackGeo(new THREE.CircleGeometry(0.14, 24));
    const roseGlow = new THREE.Mesh(roseGlowGeo, magicGlowMat);
    roseGlow.position.set(0, 1.35, 0.455);
    registerExplodable(roseFrame, new THREE.Vector3(0, 0.45, 0.35));
    registerExplodable(roseGlow, new THREE.Vector3(0, 0.45, 0.35));
    root.add(roseFrame, roseGlow);

    const centralSpireGeo = trackGeo(new THREE.ConeGeometry(0.48, 1.25, 28));
    const centralSpire = new THREE.Mesh(centralSpireGeo, spireGlossMat);
    centralSpire.position.set(0, 2.4, -0.06);
    registerExplodable(centralSpire, new THREE.Vector3(0, 0.95, 0));
    root.add(centralSpire);

    const spireFinialGeo = trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    const spireFinial = new THREE.Mesh(spireFinialGeo, brushedGoldMat);
    spireFinial.position.set(0, 3.08, -0.06);
    registerExplodable(spireFinial, new THREE.Vector3(0, 1.3, 0));
    root.add(spireFinial);

    // 7. Orbiting Pixie Magic Star Ring
    const magicOrbit = new THREE.Group();
    const orbitRingGeo = trackGeo(new THREE.TorusGeometry(0.88, 0.016, 10, 56));
    const orbitRing = new THREE.Mesh(orbitRingGeo, brushedGoldMat);
    orbitRing.rotation.x = Math.PI / 2 - 0.18;
    magicOrbit.add(orbitRing);

    const starGeo = trackGeo(createStarGeometry(0.11, 0.048, 0.03));
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const star = new THREE.Mesh(starGeo, magicGlowMat);
      star.position.set(Math.cos(angle) * 0.88, Math.sin(angle) * 0.16, Math.sin(angle) * 0.88);
      star.rotation.y = -angle;
      magicOrbit.add(star);
    }
    magicOrbit.position.set(0, 2.28, -0.06);
    registerExplodable(magicOrbit, new THREE.Vector3(0, 1.05, 0));
    root.add(magicOrbit);
    animatedParts.push({ obj: magicOrbit, kind: 'spin-slow', speed: 0.55, baseY: 2.28 });
  } else if (modelId === 'cartoon-sorcerer') {
    // 1. Theater Stage Pedestal
    const stageBaseGeo = trackGeo(new THREE.CylinderGeometry(1.25, 1.42, 0.2, 36));
    const stageBase = new THREE.Mesh(stageBaseGeo, spireGlossMat);
    stageBase.position.set(0, 0.1, 0);
    registerExplodable(stageBase, new THREE.Vector3(0, -0.4, 0));
    root.add(stageBase);

    const stageTrimGeo = trackGeo(new THREE.TorusGeometry(1.26, 0.035, 12, 48));
    const stageTrim = new THREE.Mesh(stageTrimGeo, brushedGoldMat);
    stageTrim.rotation.x = Math.PI / 2;
    stageTrim.position.set(0, 0.2, 0);
    registerExplodable(stageTrim, new THREE.Vector3(0, -0.25, 0));
    root.add(stageTrim);

    // 2. Classic Cartoon Bowtie Collar
    const bowtieGeo = trackGeo(createBowtieGeometry());
    const bowtie = new THREE.Mesh(bowtieGeo, cartoonRedMat);
    bowtie.position.set(0, 0.42, 0.45);
    registerExplodable(bowtie, new THREE.Vector3(0, -0.1, 0.5));
    root.add(bowtie);

    // 3. Stylized Cartoon Character Head & Iconic Big Round Ears
    const headGeo = trackGeo(new THREE.SphereGeometry(0.62, 32, 24));
    const head = new THREE.Mesh(headGeo, cartoonInkMat);
    head.position.set(0, 1.08, 0);
    registerExplodable(head, new THREE.Vector3(0, 0, 0));
    root.add(head);

    // Friendly Cartoon Face Mask / Cheeks + Nose
    const cheekGeo = trackGeo(new THREE.SphereGeometry(0.36, 24, 18));
    const cheeks = new THREE.Mesh(cheekGeo, cartoonCreamMat);
    cheeks.scale.set(1.18, 0.82, 0.72);
    cheeks.position.set(0, 0.98, 0.36);
    registerExplodable(cheeks, new THREE.Vector3(0, 0, 0.4));
    root.add(cheeks);

    const noseGeo = trackGeo(new THREE.SphereGeometry(0.11, 16, 16));
    const nose = new THREE.Mesh(noseGeo, cartoonInkMat);
    nose.scale.set(1.2, 0.9, 1.1);
    nose.position.set(0, 1.02, 0.68);
    registerExplodable(nose, new THREE.Vector3(0, 0, 0.65));
    root.add(nose);

    // Classic Big Round Ears
    const earGeo = trackGeo(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 32));
    const leftEar = new THREE.Mesh(earGeo, cartoonInkMat);
    leftEar.rotation.x = Math.PI / 2;
    leftEar.rotation.z = 0.25;
    leftEar.position.set(-0.62, 1.68, -0.04);
    registerExplodable(leftEar, new THREE.Vector3(-0.55, 0.35, 0));
    root.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, cartoonInkMat);
    rightEar.rotation.x = Math.PI / 2;
    rightEar.rotation.z = -0.25;
    rightEar.position.set(0.62, 1.68, -0.04);
    registerExplodable(rightEar, new THREE.Vector3(0.55, 0.35, 0));
    root.add(rightEar);

    // 4. Sorcerer's Pointed Magic Hat + Orbiting Crescent & Stars
    const hatGroup = new THREE.Group();
    const hatBrimGeo = trackGeo(new THREE.TorusGeometry(0.54, 0.065, 14, 36));
    const hatBrim = new THREE.Mesh(hatBrimGeo, spireGlossMat);
    hatBrim.rotation.x = Math.PI / 2;
    const hatConeGeo = trackGeo(new THREE.ConeGeometry(0.5, 1.05, 32));
    const hatCone = new THREE.Mesh(hatConeGeo, spireGlossMat);
    hatCone.position.y = 0.52;
    hatCone.rotation.z = -0.12;
    const hatBandGeo = trackGeo(new THREE.TorusGeometry(0.47, 0.03, 10, 32));
    const hatBand = new THREE.Mesh(hatBandGeo, brushedGoldMat);
    hatBand.rotation.x = Math.PI / 2;
    hatBand.position.y = 0.08;
    const hatCrescentGeo = trackGeo(createCrescentGeometry());
    const hatCrescent = new THREE.Mesh(hatCrescentGeo, magicGlowMat);
    hatCrescent.position.set(0, 0.45, 0.36);
    hatCrescent.scale.setScalar(0.65);
    hatGroup.add(hatBrim, hatCone, hatBand, hatCrescent);
    hatGroup.position.set(0, 1.62, 0);
    hatGroup.rotation.x = -0.08;
    registerExplodable(hatGroup, new THREE.Vector3(0, 0.85, 0));
    root.add(hatGroup);

    // Orbiting Magic Stars around Hat
    const hatStars = new THREE.Group();
    const smStarGeo = trackGeo(createStarGeometry(0.1, 0.045, 0.03));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const st = new THREE.Mesh(smStarGeo, magicGlowMat);
      st.position.set(Math.cos(angle) * 0.72, (i % 2) * 0.14, Math.sin(angle) * 0.72);
      st.rotation.y = -angle;
      hatStars.add(st);
    }
    hatStars.position.set(0, 2.05, 0);
    registerExplodable(hatStars, new THREE.Vector3(0, 1.15, 0));
    root.add(hatStars);
    animatedParts.push({ obj: hatStars, kind: 'spin-slow', speed: 0.75, baseY: 2.05 });

    // 5. Floating Star Magic Wand
    const wandGroup = new THREE.Group();
    const wandShaftGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.035, 0.95, 14));
    const wandShaft = new THREE.Mesh(wandShaftGeo, brushedGoldMat);
    const wandStarGeo = trackGeo(createStarGeometry(0.18, 0.08, 0.05));
    const wandStar = new THREE.Mesh(wandStarGeo, magicGlowMat);
    wandStar.position.y = 0.54;
    wandGroup.add(wandShaft, wandStar);
    wandGroup.position.set(1.08, 1.25, 0.25);
    wandGroup.rotation.z = -0.32;
    registerExplodable(wandGroup, new THREE.Vector3(0.65, 0.35, 0.35));
    root.add(wandGroup);
    animatedParts.push({ obj: wandGroup, kind: 'float', speed: 1.8, baseY: 1.25 });
  } else {
    // 'enchanted-carriage': Ribbed Pumpkin Coach + 4 Spoked Gold Wheels + Crown Finial
    const roadGeo = trackGeo(new THREE.CylinderGeometry(1.65, 1.75, 0.14, 36));
    const road = new THREE.Mesh(roadGeo, stonePrimaryMat);
    road.position.set(0, 0.07, 0);
    registerExplodable(road, new THREE.Vector3(0, -0.4, 0));
    root.add(road);

    // 1. Curved Gold Undercarriage Chassis & Axles
    const chassisGeo = trackGeo(new THREE.BoxGeometry(1.7, 0.08, 0.9));
    const chassis = new THREE.Mesh(chassisGeo, brushedGoldMat);
    chassis.position.set(0, 0.48, 0);
    registerExplodable(chassis, new THREE.Vector3(0, -0.15, 0));
    root.add(chassis);

    const axleGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.48, 12));
    const frontAxle = new THREE.Mesh(axleGeo, brushedGoldMat);
    frontAxle.rotation.x = Math.PI / 2;
    frontAxle.position.set(0.66, 0.44, 0);
    const rearAxle = new THREE.Mesh(axleGeo, brushedGoldMat);
    rearAxle.rotation.x = Math.PI / 2;
    rearAxle.position.set(-0.66, 0.5, 0);
    registerExplodable(frontAxle, new THREE.Vector3(0.3, -0.15, 0));
    registerExplodable(rearAxle, new THREE.Vector3(-0.3, -0.15, 0));
    root.add(frontAxle, rearAxle);

    // 2. Four Spoked Golden Carriage Wheels
    const createWheel = (radius: number) => {
      const wg = new THREE.Group();
      const rimGeo = trackGeo(new THREE.TorusGeometry(radius, 0.04, 12, 32));
      const rim = new THREE.Mesh(rimGeo, brushedGoldMat);
      wg.add(rim);

      const spokeGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.018, radius * 1.9, 8));
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(spokeGeo, brushedGoldMat);
        spoke.rotation.z = (i / 4) * Math.PI;
        wg.add(spoke);
      }
      const hubGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16));
      const hub = new THREE.Mesh(hubGeo, spireGlossMat);
      hub.rotation.x = Math.PI / 2;
      wg.add(hub);
      return wg;
    };

    const wheelSpecs: { x: number; y: number; z: number; r: number }[] = [
      { x: 0.66, y: 0.48, z: 0.72, r: 0.34 },
      { x: 0.66, y: 0.48, z: -0.72, r: 0.34 },
      { x: -0.66, y: 0.56, z: 0.76, r: 0.42 },
      { x: -0.66, y: 0.56, z: -0.76, r: 0.42 },
    ];
    wheelSpecs.forEach((w) => {
      const wheel = createWheel(w.r);
      wheel.position.set(w.x, w.y, w.z);
      registerExplodable(wheel, new THREE.Vector3(w.x * 0.35, -0.1, Math.sign(w.z) * 0.55));
      root.add(wheel);
    });

    // 3. Sculpted Pumpkin Coach Cabin (LatheGeometry)
    const cabinPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const y = t * 1.25;
      const r = Math.sin(t * Math.PI) * 0.88;
      cabinPts.push(new THREE.Vector2(Math.max(0.02, r), y));
    }
    const cabinGeo = trackGeo(new THREE.LatheGeometry(cabinPts, 32));
    const cabin = new THREE.Mesh(cabinGeo, stonePrimaryMat);
    cabin.position.set(0, 0.56, 0);
    registerExplodable(cabin, new THREE.Vector3(0, 0.35, 0));
    root.add(cabin);

    // 4. Eight Ornate Golden Meridian Coach Ribs
    const ribGeo = trackGeo(new THREE.TorusGeometry(0.76, 0.026, 10, 32, Math.PI));
    for (let i = 0; i < 8; i++) {
      const rib = new THREE.Mesh(ribGeo, brushedGoldMat);
      rib.position.set(0, 1.18, 0);
      rib.rotation.y = (i / 8) * Math.PI * 2;
      rib.scale.set(1.16, 0.84, 1);
      registerExplodable(rib, new THREE.Vector3(0, 0.45, 0));
      root.add(rib);
    }

    // 5. Glowing Arched Carriage Windows (Front & Back Sides)
    const winFrameGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.03, 10, 24));
    const winGlassGeo = trackGeo(new THREE.CircleGeometry(0.22, 24));
    [-0.86, 0.86].forEach((wz) => {
      const frame = new THREE.Mesh(winFrameGeo, brushedGoldMat);
      frame.position.set(0, 1.22, wz);
      const win = new THREE.Mesh(winGlassGeo, magicGlowMat);
      win.position.set(0, 1.22, wz + Math.sign(wz) * 0.01);
      if (wz < 0) win.rotation.y = Math.PI;
      registerExplodable(frame, new THREE.Vector3(0, 0.35, Math.sign(wz) * 0.55));
      registerExplodable(win, new THREE.Vector3(0, 0.35, Math.sign(wz) * 0.55));
      root.add(frame, win);
    });

    // 6. Royal Crown Finial on Roof
    const crownGroup = new THREE.Group();
    const crownBaseGeo = trackGeo(new THREE.TorusGeometry(0.26, 0.035, 12, 28));
    const crownBase = new THREE.Mesh(crownBaseGeo, brushedGoldMat);
    crownBase.rotation.x = Math.PI / 2;
    const crownDomeGeo = trackGeo(new THREE.SphereGeometry(0.24, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55));
    const crownDome = new THREE.Mesh(crownDomeGeo, spireGlossMat);
    const jewelGeo = trackGeo(new THREE.OctahedronGeometry(0.09, 0));
    const jewel = new THREE.Mesh(jewelGeo, magicGlowMat);
    jewel.position.y = 0.28;
    crownGroup.add(crownBase, crownDome, jewel);
    crownGroup.position.set(0, 1.84, 0);
    registerExplodable(crownGroup, new THREE.Vector3(0, 0.95, 0));
    root.add(crownGroup);

    // 7. Front Hanging Fairy Lantern (Floats smoothly)
    const lanternGroup = new THREE.Group();
    const lGlassGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.06, 0.16, 8));
    const lGlass = new THREE.Mesh(lGlassGeo, glassMat);
    const lCoreGeo = trackGeo(new THREE.SphereGeometry(0.05, 10, 10));
    const lCore = new THREE.Mesh(lCoreGeo, magicGlowMat);
    const lCapGeo = trackGeo(new THREE.ConeGeometry(0.1, 0.08, 8));
    const lCap = new THREE.Mesh(lCapGeo, brushedGoldMat);
    lCap.position.y = 0.11;
    lanternGroup.add(lGlass, lCore, lCap);
    lanternGroup.position.set(1.06, 1.32, 0);
    registerExplodable(lanternGroup, new THREE.Vector3(0.65, 0.35, 0));
    root.add(lanternGroup);
    animatedParts.push({ obj: lanternGroup, kind: 'float', speed: 1.7, baseY: 1.32 });
  }

  // Ground Contact Shadow Disc
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 15, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.48)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  textures.push(shadowTex);

  const contactShadowGeo = trackGeo(new THREE.PlaneGeometry(4.5, 4.5));
  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    })
  );
  const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.005;
  root.add(contactShadow);

  enableShadows(root);

  return {
    group: root,
    animatedParts,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
