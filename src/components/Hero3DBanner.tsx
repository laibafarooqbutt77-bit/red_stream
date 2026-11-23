import React, { useState } from 'react';
import { ArrowRight, Box, ChevronDown, ChevronUp, MoonStar, Sparkles } from 'lucide-react';
import { getBrandThemeMeta, type BrandThemeId } from '../lib/themes';
import type { ModelPresetId } from '../three/proceduralModels';
import { Scene3DViewport } from './Scene3DViewport';

interface Hero3DBannerProps {
  theme: 'light' | 'dark';
  brandTheme: BrandThemeId;
  onOpen3DGallery: (initialModel?: ModelPresetId) => void;
  onOpenCartoons: () => void;
  onOpenIslamicVideos: () => void;
}

const MODELS: { id: ModelPresetId; label: string }[] = [
  { id: 'fairytale-castle', label: 'Magic Castle' },
  { id: 'cartoon-sorcerer', label: 'Cartoon Ears & Hat' },
  { id: 'enchanted-carriage', label: 'Fairy Carriage' },
];

export const Hero3DBanner: React.FC<Hero3DBannerProps> = ({
  theme,
  brandTheme,
  onOpen3DGallery,
  onOpenCartoons,
  onOpenIslamicVideos,
}) => {
  const [selectedModel, setSelectedModel] = useState<ModelPresetId>('fairytale-castle');
  const [collapsed, setCollapsed] = useState(false);
  const activeBrandMeta = getBrandThemeMeta(brandTheme);

  if (collapsed) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161616] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          <Box className="w-4 h-4 text-red-600" />
          <span>Interactive Cartoon 3D Studio</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1"
        >
          <span>Show 3D Showcase</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Interactive cartoon 3D showcase"
      className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111626] overflow-hidden shadow-md"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Editorial Info & Actions */}
        <div
          className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between gap-6"
          style={{
            background:
              theme === 'dark'
                ? `radial-gradient(circle at top left, color-mix(in srgb, ${activeBrandMeta.swatch} 22%, transparent), transparent 62%), radial-gradient(circle at bottom right, color-mix(in srgb, ${activeBrandMeta.secondarySwatch} 12%, transparent), transparent 55%)`
                : `radial-gradient(circle at top left, color-mix(in srgb, ${activeBrandMeta.swatch} 14%, transparent), transparent 62%), radial-gradient(circle at bottom right, color-mix(in srgb, ${activeBrandMeta.secondarySwatch} 12%, transparent), transparent 55%)`,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-600 tracking-tight">
                Interactive 3D Studio · Cartoon &amp; Fairytale Worlds
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse 3D showcase"
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1"
              >
                <span className="hidden sm:inline">Minimize</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight [text-wrap:balance]">
              Watch Worldwide. Explore Animated 3D Worlds.
            </h1>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-md">
              Stream Islamic lectures, Quran recitations, and classic cartoons — or drag to inspect interactive fairytale castle, magic sorcerer hat, and enchanted carriage 3D models.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpen3DGallery(selectedModel)}
                className="h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Box className="w-4 h-4" />
                <span>Open 3D Gallery</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onOpenCartoons}
                className="h-10 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4 text-red-600" />
                <span>Cartoons</span>
              </button>

              <button
                type="button"
                onClick={onOpenIslamicVideos}
                className="h-10 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <MoonStar className="w-4 h-4 text-red-600" />
                <span>Islamic Videos</span>
              </button>
            </div>

            {/* Interactive Model Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedModel === m.id
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                      : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Interactive 3D Viewport */}
        <div className="lg:col-span-7 relative h-[280px] sm:h-[320px] lg:h-[360px] border-t lg:border-t-0 lg:border-l border-neutral-200 dark:border-neutral-800">
          <Scene3DViewport
            modelId={selectedModel}
            finishId={
              brandTheme !== 'crimson'
                ? activeBrandMeta.finish3D
                : selectedModel === 'enchanted-carriage'
                ? 'fairy'
                : selectedModel === 'cartoon-sorcerer'
                ? 'crimson'
                : 'royal'
            }
            explodedAmount={0}
            autoRotate={true}
            cameraPreset="studio"
            theme={theme}
          />
          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium pointer-events-none select-none">
            Drag to rotate · Scroll to zoom
          </div>
        </div>
      </div>
    </section>
  );
};
