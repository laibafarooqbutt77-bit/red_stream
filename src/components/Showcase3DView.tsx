import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCw } from 'lucide-react';
import {
  FINISH_PALETTES,
  type FinishPresetId,
  type ModelPresetId,
} from '../three/proceduralModels';
import { Scene3DViewport, type CameraPresetId } from './Scene3DViewport';

interface Showcase3DViewProps {
  theme: 'light' | 'dark';
  initialModel?: ModelPresetId;
}

const MODEL_OPTIONS: { id: ModelPresetId; label: string; subtitle: string }[] = [
  {
    id: 'fairytale-castle',
    label: 'Magic Fairytale Castle',
    subtitle: 'Arched drawbridge gatehouse, 6 conical turret spires, rose window & orbiting star ring',
  },
  {
    id: 'cartoon-sorcerer',
    label: 'Cartoon Ears & Magic Hat',
    subtitle: 'Classic cartoon silhouette with big round ears, sorcerer wizard hat, stars & magic wand',
  },
  {
    id: 'enchanted-carriage',
    label: 'Enchanted Fairy Carriage',
    subtitle: 'Sculpted ribbed pumpkin coach, 4 spoked golden wheels, royal crown finial & floating lantern',
  },
];

export const Showcase3DView: React.FC<Showcase3DViewProps> = ({
  theme,
  initialModel = 'fairytale-castle',
}) => {
  const [modelId, setModelId] = useState<ModelPresetId>(initialModel);
  const [finishId, setFinishId] = useState<FinishPresetId>(
    initialModel === 'enchanted-carriage' ? 'fairy' : 'royal'
  );
  const [explodedAmount, setExplodedAmount] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('studio');
  const [dockCollapsed, setDockCollapsed] = useState(false);

  useEffect(() => {
    setModelId(initialModel);
    if (initialModel === 'enchanted-carriage') setFinishId('fairy');
    else setFinishId('royal');
  }, [initialModel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeMeta = MODEL_OPTIONS.find((m) => m.id === modelId) || MODEL_OPTIONS[0];

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* 100% Unobstructed Central 3D Viewport */}
      <Scene3DViewport
        modelId={modelId}
        finishId={finishId}
        explodedAmount={explodedAmount}
        autoRotate={autoRotate}
        cameraPreset={cameraPreset}
        theme={theme}
      />

      {/* Minimal Top-Left Spec Label (no backdrop-filter over WebGL) */}
      <div
        className={`absolute top-4 left-4 z-10 px-4 py-2.5 rounded-xl border pointer-events-none select-none max-w-sm ${
          theme === 'dark'
            ? 'bg-[#141519]/92 border-neutral-800 text-neutral-100'
            : 'bg-white/95 border-neutral-200 text-neutral-900'
        }`}
      >
        <div className="text-xs font-semibold text-red-600">Cartoon 3D Showcase</div>
        <h1 className="text-base font-bold leading-snug mt-0.5">{activeMeta.label}</h1>
        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{activeMeta.subtitle}</p>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-20 transition-transform duration-300 w-[min(940px,94vw)]"
        style={{
          bottom: '20px',
          transform: dockCollapsed
            ? 'translate(-50%, calc(100% - 32px))'
            : 'translate(-50%, 0)',
        }}
      >
        {/* Collapse / Expand Handle */}
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((p) => !p)}
            className={`px-3.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 shadow-md ${
              theme === 'dark'
                ? 'bg-[#18191E] border-neutral-700 text-neutral-200 hover:bg-neutral-800'
                : 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-100'
            }`}
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}</span>
          </button>
        </div>

        {/* Unified Solid/RGBA Dock (no backdrop-filter over WebGL) */}
        <div
          className={`rounded-2xl border p-3.5 md:p-4 shadow-2xl space-y-3 ${
            theme === 'dark'
              ? 'bg-[#16171C]/95 border-neutral-800 text-neutral-100'
              : 'bg-white/95 border-neutral-200 text-neutral-900'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Model Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    modelId === m.id
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Camera Presets + Auto-Rotate */}
            <div className="flex items-center gap-1.5">
              {(['studio', 'front', 'top'] as CameraPresetId[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCameraPreset(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    cameraPreset === preset
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAutoRotate((p) => !p)}
                aria-label="Toggle auto-rotate"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  autoRotate
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Spin</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            {/* Material Finish Swatches */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-neutral-500">Theme:</span>
              <div className="flex items-center gap-2">
                {Object.values(FINISH_PALETTES).map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => setFinishId(pal.id)}
                    title={pal.label}
                    aria-label={pal.label}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      finishId === pal.id
                        ? 'border-red-600 scale-110'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                    style={{ backgroundColor: pal.swatch }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hidden md:inline">
                {FINISH_PALETTES[finishId].label}
              </span>
            </div>

            {/* Exploded View Slider */}
            <div className="flex items-center gap-3 flex-1 max-w-xs">
              <label
                htmlFor="exploded-slider"
                className="text-xs font-medium text-neutral-500 whitespace-nowrap"
              >
                Explode View
              </label>
              <input
                id="exploded-slider"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={explodedAmount}
                onChange={(e) => setExplodedAmount(Number(e.target.value))}
                className="flex-1 accent-red-600 cursor-pointer"
              />
              <span className="text-xs font-mono tabular-nums w-9 text-right">
                {Math.round(explodedAmount * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
