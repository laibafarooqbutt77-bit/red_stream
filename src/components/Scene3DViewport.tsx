import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildProceduralModel,
  type BuiltModel,
  type FinishPresetId,
  type ModelPresetId,
} from '../three/proceduralModels';

export type CameraPresetId = 'studio' | 'front' | 'top';

interface Scene3DViewportProps {
  modelId: ModelPresetId;
  finishId: FinishPresetId;
  explodedAmount: number; // 0 to 1
  autoRotate: boolean;
  cameraPreset: CameraPresetId;
  theme: 'light' | 'dark';
  className?: string;
}

const CAMERA_PRESETS: Record<CameraPresetId, { pos: [number, number, number]; target: [number, number, number] }> = {
  studio: { pos: [3.2, 2.3, 4.0], target: [0, 1.25, 0] },
  front: { pos: [0, 1.45, 4.8], target: [0, 1.25, 0] },
  top: { pos: [0.05, 5.2, 1.2], target: [0, 1.1, 0] },
};

// Reusable module-scope scratch objects to prevent GC churn in tick loop
const _targetCamPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _explodeTarget = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const Scene3DViewport: React.FC<Scene3DViewportProps> = ({
  modelId,
  finishId,
  explodedAmount,
  autoRotate,
  cameraPreset,
  theme,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);

  // Live refs so React prop changes never tear down the WebGLRenderer
  const explodeRef = useRef(explodedAmount);
  explodeRef.current = explodedAmount;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const cameraTweenRef = useRef<{ active: boolean; preset: CameraPresetId }>({
    active: false,
    preset: cameraPreset,
  });

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    currentModel: BuiltModel | null;
    isSoftwareGl: boolean;
  } | null>(null);

  // Trigger smooth camera tween whenever cameraPreset changes
  useEffect(() => {
    cameraTweenRef.current = { active: true, preset: cameraPreset };
  }, [cameraPreset]);

  // Update theme-matched background & fog dynamically
  useEffect(() => {
    const ctx = sceneRefs.current;
    if (!ctx) return;
    const bgHex = theme === 'dark' ? 0x0d1221 : 0xf1f5f9;
    ctx.scene.background = new THREE.Color(bgHex);
    ctx.scene.fog = new THREE.FogExp2(bgHex, 0.042);
  }, [theme]);

  // Swap procedural 3D model / finish cleanly
  useEffect(() => {
    const ctx = sceneRefs.current;
    if (!ctx) return;
    if (ctx.currentModel) {
      ctx.scene.remove(ctx.currentModel.group);
      ctx.currentModel.dispose();
    }
    const built = buildProceduralModel(modelId, finishId, {
      isSoftwareGl: ctx.isSoftwareGl,
      maxAnisotropy: ctx.renderer.capabilities.getMaxAnisotropy(),
    });
    ctx.scene.add(built.group);
    ctx.currentModel = built;
  }, [modelId, finishId]);

  // Mount WebGLRenderer once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 240);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

    const scene = new THREE.Scene();
    const initialBg = theme === 'dark' ? 0x0d1221 : 0xf1f5f9;
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.FogExp2(initialBg, 0.042);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const presetInit = CAMERA_PRESETS[cameraPreset];
    camera.position.set(...presetInit.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...presetInit.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.1;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enablePan = false;

    // Cancel camera preset tween immediately if user touches OrbitControls
    const onControlStart = () => {
      cameraTweenRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Studio Lighting Rig (warm key + cool sky/ground hemi + rim)
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x262626, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(4.5, 6.5, 4.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -3.5;
    keyLight.shadow.camera.right = 3.5;
    keyLight.shadow.camera.top = 3.5;
    keyLight.shadow.camera.bottom = -3.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdcebff, 1.1);
    rimLight.position.set(-4.5, 3.8, -4.5);
    scene.add(rimLight);

    // Subtle ground receiver plane for cast shadows
    const floorGeo = new THREE.CircleGeometry(6, 48);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !isSoftwareGl;
    scene.add(floor);

    const initialModel = buildProceduralModel(modelId, finishId, {
      isSoftwareGl,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    });
    scene.add(initialModel.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneRefs.current = {
      scene,
      renderer,
      camera,
      controls,
      currentModel: initialModel,
      isSoftwareGl,
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 10 || rect.height < 10) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
    });
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;
    let currentExplode = explodeRef.current;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl?.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
      controls.autoRotateSpeed = 1.4;

      // Exponentially damp exploded-view separation
      currentExplode = THREE.MathUtils.damp(currentExplode, explodeRef.current, 6.5, delta);
      const activeModel = sceneRefs.current?.currentModel;
      if (activeModel) {
        activeModel.group.traverse((obj) => {
          const basePos = obj.userData.basePos as THREE.Vector3 | undefined;
          const explodeVec = obj.userData.explodeVec as THREE.Vector3 | undefined;
          if (basePos && explodeVec) {
            _explodeTarget.copy(basePos).addScaledVector(explodeVec, currentExplode);
            obj.position.lerp(_explodeTarget, 1 - Math.exp(-8 * delta));
          }
        });

        for (const anim of activeModel.animatedParts) {
          if (anim.kind === 'spin-slow') {
            anim.obj.rotation.y = elapsed * anim.speed;
          } else if (anim.kind === 'float') {
            const offset = Math.sin(elapsed * anim.speed) * 0.045;
            const base = anim.obj.userData.basePos as THREE.Vector3 | undefined;
            if (base) {
              anim.obj.position.y = base.y + (anim.obj.userData.explodeVec?.y || 0) * currentExplode + offset;
            }
          } else if (anim.kind === 'ring') {
            anim.obj.rotation.z = elapsed * anim.speed;
          }
        }
      }

      // Smoothly damp camera preset transitions
      if (cameraTweenRef.current.active) {
        const p = CAMERA_PRESETS[cameraTweenRef.current.preset];
        _targetCamPos.set(...p.pos);
        _targetLook.set(...p.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 6, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 6, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 6, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, 6, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, 6, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, 6, delta);
        if (camera.position.distanceTo(_targetCamPos) < 0.03) {
          cameraTweenRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);

      if (sceneRefs.current?.currentModel) {
        sceneRefs.current.currentModel.dispose();
      }
      floorGeo.dispose();
      floorMat.dispose();
      envTex.dispose();
      renderer.dispose();
      sceneRefs.current = null;
    };
  }, []);

  if (contextLost) {
    return (
      <div className={`flex items-center justify-center bg-neutral-900 text-neutral-300 text-xs ${className}`}>
        3D Viewport paused — restoring graphics context...
      </div>
    );
  }

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
};
