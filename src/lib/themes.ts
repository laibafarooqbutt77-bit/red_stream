import type { FinishPresetId } from '../three/proceduralModels';

export type BrandThemeId = 'crimson' | 'royal' | 'emerald' | 'fairy' | 'violet' | 'amber';

export interface BrandThemeOption {
  id: BrandThemeId;
  name: string;
  tagline: string;
  swatch: string;
  secondarySwatch: string;
  recommendedMode?: 'light' | 'dark';
  finish3D: FinishPresetId;
}

export const BRAND_THEMES: BrandThemeOption[] = [
  {
    id: 'crimson',
    name: 'YouTube Classic Red',
    tagline: 'Iconic red & crisp studio contrast',
    swatch: '#DC2626',
    secondarySwatch: '#171717',
    finish3D: 'crimson',
  },
  {
    id: 'royal',
    name: 'Disney Magic Royal',
    tagline: 'Fairytale sapphire blue & castle gold',
    swatch: '#2563EB',
    secondarySwatch: '#F5B942',
    finish3D: 'royal',
  },
  {
    id: 'emerald',
    name: 'Islamic Emerald',
    tagline: 'Serene emerald green & warm brass',
    swatch: '#059669',
    secondarySwatch: '#E5B95C',
    finish3D: 'emerald',
  },
  {
    id: 'fairy',
    name: 'Fairy Rose Studio',
    tagline: 'Enchanted rose pink & pearl glow',
    swatch: '#DB2777',
    secondarySwatch: '#F472B6',
    finish3D: 'fairy',
  },
  {
    id: 'violet',
    name: 'Midnight Violet',
    tagline: 'Modern creator purple & obsidian',
    swatch: '#7C3AED',
    secondarySwatch: '#A78BFA',
    finish3D: 'royal',
  },
  {
    id: 'amber',
    name: 'Golden Cinema',
    tagline: 'Warm broadcast gold & dark studio',
    swatch: '#D97706',
    secondarySwatch: '#FBBF24',
    finish3D: 'crimson',
  },
];

export function getBrandThemeMeta(id: BrandThemeId): BrandThemeOption {
  return BRAND_THEMES.find((t) => t.id === id) || BRAND_THEMES[0];
}
