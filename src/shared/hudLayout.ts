export type HudControlId =
  | 'joystick'
  | 'm1'
  | 'skill1'
  | 'skill2'
  | 'skill3'
  | 'awakened4'
  | 'secret5'
  | 'domain'
  | 'dash'
  | 'guard'
  | 'grab'
  | 'jump'
  | 'fly'
  | 'item';

export interface HudControlTransform {
  xPct: number;
  yPct: number;
  scale: number;
  opacity: number;
}

export interface CustomHudLayout {
  version: 1;
  customized: boolean;
  controls: Partial<Record<HudControlId, HudControlTransform>>;
}

export interface HudControlSpec {
  id: HudControlId;
  label: string;
  shortLabel: string;
  keyHint: string;
  baseSizePx: number;
  shape: 'circle' | 'pad' | 'pill';
  accentHex: string;
  contextualNote?: string;
}

export const HUD_CONTROL_IDS: HudControlId[] = [
  'joystick',
  'm1',
  'skill1',
  'skill2',
  'skill3',
  'awakened4',
  'secret5',
  'domain',
  'dash',
  'guard',
  'grab',
  'jump',
  'fly',
  'item',
];

export const HUD_CONTROL_SPECS: Record<HudControlId, HudControlSpec> = {
  joystick: {
    id: 'joystick',
    label: 'Move Stick',
    shortLabel: 'MOVE',
    keyHint: 'WASD',
    baseSizePx: 108,
    shape: 'pad',
    accentHex: '#38bdf8',
  },
  m1: {
    id: 'm1',
    label: 'Attack (M1)',
    shortLabel: 'ATK',
    keyHint: 'M1',
    baseSizePx: 66,
    shape: 'circle',
    accentHex: '#fbbf24',
  },
  skill1: {
    id: 'skill1',
    label: 'Skill 1',
    shortLabel: 'S1',
    keyHint: '1',
    baseSizePx: 50,
    shape: 'circle',
    accentHex: '#38bdf8',
  },
  skill2: {
    id: 'skill2',
    label: 'Skill 2',
    shortLabel: 'S2',
    keyHint: '2',
    baseSizePx: 50,
    shape: 'circle',
    accentHex: '#a78bfa',
  },
  skill3: {
    id: 'skill3',
    label: 'Skill 3 (Ult)',
    shortLabel: 'S3',
    keyHint: '3',
    baseSizePx: 54,
    shape: 'circle',
    accentHex: '#f43f5e',
  },
  awakened4: {
    id: 'awakened4',
    label: 'Awaken Finisher',
    shortLabel: 'S4',
    keyHint: '4',
    baseSizePx: 48,
    shape: 'circle',
    accentHex: '#f59e0b',
    contextualNote: 'Shown when Awakened',
  },
  secret5: {
    id: 'secret5',
    label: 'Ascended Secret',
    shortLabel: 'SEC',
    keyHint: '5',
    baseSizePx: 46,
    shape: 'circle',
    accentHex: '#fde047',
    contextualNote: 'Ascended Skins only',
  },
  domain: {
    id: 'domain',
    label: 'Domain Expansion',
    shortLabel: 'DOM',
    keyHint: 'V',
    baseSizePx: 48,
    shape: 'circle',
    accentHex: '#c084fc',
  },
  dash: {
    id: 'dash',
    label: 'Dash',
    shortLabel: 'DASH',
    keyHint: 'Q',
    baseSizePx: 46,
    shape: 'circle',
    accentHex: '#22d3ee',
  },
  guard: {
    id: 'guard',
    label: 'Guard / Parry',
    shortLabel: 'GRD',
    keyHint: 'F',
    baseSizePx: 50,
    shape: 'circle',
    accentHex: '#10b981',
  },
  grab: {
    id: 'grab',
    label: 'Grab',
    shortLabel: 'GRB',
    keyHint: 'G',
    baseSizePx: 46,
    shape: 'circle',
    accentHex: '#fb923c',
  },
  jump: {
    id: 'jump',
    label: 'Jump',
    shortLabel: 'JMP',
    keyHint: 'SPC',
    baseSizePx: 48,
    shape: 'circle',
    accentHex: '#e2e8f0',
  },
  fly: {
    id: 'fly',
    label: 'Flight Toggle',
    shortLabel: 'FLY',
    keyHint: '2xSPC',
    baseSizePx: 44,
    shape: 'pill',
    accentHex: '#38bdf8',
  },
  item: {
    id: 'item',
    label: 'Use Item',
    shortLabel: 'ITM',
    keyHint: 'E',
    baseSizePx: 46,
    shape: 'circle',
    accentHex: '#facc15',
    contextualNote: 'Shown when holding item',
  },
};

export const DEFAULT_HUD_CONTROLS: Record<HudControlId, HudControlTransform> = {
  joystick: { xPct: 14, yPct: 76, scale: 1.0, opacity: 0.92 },
  m1: { xPct: 88, yPct: 81, scale: 1.0, opacity: 0.96 },
  skill1: { xPct: 77, yPct: 87, scale: 1.0, opacity: 0.95 },
  skill2: { xPct: 79, yPct: 72, scale: 1.0, opacity: 0.95 },
  skill3: { xPct: 89, yPct: 63, scale: 1.0, opacity: 0.95 },
  awakened4: { xPct: 71, yPct: 58, scale: 1.0, opacity: 0.95 },
  secret5: { xPct: 63, yPct: 66, scale: 1.0, opacity: 0.95 },
  domain: { xPct: 89, yPct: 48, scale: 1.0, opacity: 0.96 },
  dash: { xPct: 69, yPct: 78, scale: 1.0, opacity: 0.92 },
  guard: { xPct: 68, yPct: 89, scale: 1.0, opacity: 0.94 },
  grab: { xPct: 58, yPct: 88, scale: 1.0, opacity: 0.92 },
  jump: { xPct: 92, yPct: 72, scale: 1.0, opacity: 0.94 },
  fly: { xPct: 92, yPct: 37, scale: 0.95, opacity: 0.92 },
  item: { xPct: 16, yPct: 56, scale: 1.0, opacity: 0.94 },
};

export const HUD_PRESETS: Record<'default' | 'compact' | 'spread', Record<HudControlId, HudControlTransform>> = {
  default: DEFAULT_HUD_CONTROLS,
  compact: {
    joystick: { xPct: 13, yPct: 79, scale: 0.88, opacity: 0.84 },
    m1: { xPct: 89, yPct: 83, scale: 0.9, opacity: 0.88 },
    skill1: { xPct: 79, yPct: 88, scale: 0.86, opacity: 0.86 },
    skill2: { xPct: 80, yPct: 74, scale: 0.86, opacity: 0.86 },
    skill3: { xPct: 90, yPct: 65, scale: 0.88, opacity: 0.88 },
    awakened4: { xPct: 73, yPct: 63, scale: 0.85, opacity: 0.86 },
    secret5: { xPct: 66, yPct: 71, scale: 0.85, opacity: 0.86 },
    domain: { xPct: 90, yPct: 51, scale: 0.86, opacity: 0.88 },
    dash: { xPct: 71, yPct: 80, scale: 0.85, opacity: 0.84 },
    guard: { xPct: 71, yPct: 90, scale: 0.88, opacity: 0.86 },
    grab: { xPct: 62, yPct: 89, scale: 0.84, opacity: 0.84 },
    jump: { xPct: 93, yPct: 74, scale: 0.88, opacity: 0.86 },
    fly: { xPct: 92, yPct: 40, scale: 0.85, opacity: 0.84 },
    item: { xPct: 14, yPct: 58, scale: 0.86, opacity: 0.86 },
  },
  spread: {
    joystick: { xPct: 15, yPct: 74, scale: 1.12, opacity: 0.95 },
    m1: { xPct: 87, yPct: 80, scale: 1.14, opacity: 0.98 },
    skill1: { xPct: 74, yPct: 87, scale: 1.08, opacity: 0.96 },
    skill2: { xPct: 76, yPct: 70, scale: 1.08, opacity: 0.96 },
    skill3: { xPct: 87, yPct: 59, scale: 1.1, opacity: 0.96 },
    awakened4: { xPct: 68, yPct: 55, scale: 1.06, opacity: 0.95 },
    secret5: { xPct: 60, yPct: 64, scale: 1.04, opacity: 0.95 },
    domain: { xPct: 88, yPct: 43, scale: 1.08, opacity: 0.98 },
    dash: { xPct: 64, yPct: 78, scale: 1.06, opacity: 0.94 },
    guard: { xPct: 64, yPct: 90, scale: 1.1, opacity: 0.95 },
    grab: { xPct: 53, yPct: 89, scale: 1.04, opacity: 0.94 },
    jump: { xPct: 93, yPct: 68, scale: 1.1, opacity: 0.96 },
    fly: { xPct: 92, yPct: 31, scale: 1.0, opacity: 0.92 },
    item: { xPct: 16, yPct: 52, scale: 1.06, opacity: 0.95 },
  },
};

export function clampHudValue(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

export function createDefaultHudLayout(): CustomHudLayout {
  const controls: Partial<Record<HudControlId, HudControlTransform>> = {};
  for (const id of HUD_CONTROL_IDS) {
    controls[id] = { ...DEFAULT_HUD_CONTROLS[id] };
  }
  return {
    version: 1,
    customized: false,
    controls,
  };
}

export function sanitizeHudLayout(raw: unknown): CustomHudLayout {
  const fallback = createDefaultHudLayout();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const obj = raw as Record<string, unknown>;
  const rawControls = obj.controls && typeof obj.controls === 'object' ? (obj.controls as Record<string, unknown>) : {};
  const sanitizedControls: Partial<Record<HudControlId, HudControlTransform>> = {};

  for (const id of HUD_CONTROL_IDS) {
    const def = DEFAULT_HUD_CONTROLS[id];
    const entry = rawControls[id];
    if (entry && typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      sanitizedControls[id] = {
        xPct: Math.round(clampHudValue(Number(rec.xPct ?? def.xPct), 4, 96) * 10) / 10,
        yPct: Math.round(clampHudValue(Number(rec.yPct ?? def.yPct), 6, 94) * 10) / 10,
        scale: Math.round(clampHudValue(Number(rec.scale ?? def.scale), 0.7, 1.5) * 100) / 100,
        opacity: Math.round(clampHudValue(Number(rec.opacity ?? def.opacity), 0.25, 1.0) * 100) / 100,
      };
    } else {
      sanitizedControls[id] = { ...def };
    }
  }

  return {
    version: 1,
    customized: Boolean(obj.customized),
    controls: sanitizedControls,
  };
}

export function resolveHudControlTransform(
  layout: CustomHudLayout | null | undefined,
  id: HudControlId
): HudControlTransform {
  const entry = layout?.controls?.[id];
  if (!entry) return { ...DEFAULT_HUD_CONTROLS[id] };
  return {
    xPct: clampHudValue(entry.xPct, 4, 96),
    yPct: clampHudValue(entry.yPct, 6, 94),
    scale: clampHudValue(entry.scale, 0.7, 1.5),
    opacity: clampHudValue(entry.opacity, 0.25, 1.0),
  };
}

export function applyHudPreset(preset: 'default' | 'compact' | 'spread'): CustomHudLayout {
  const source = HUD_PRESETS[preset] ?? DEFAULT_HUD_CONTROLS;
  const controls: Partial<Record<HudControlId, HudControlTransform>> = {};
  for (const id of HUD_CONTROL_IDS) {
    controls[id] = { ...source[id] };
  }
  return {
    version: 1,
    customized: preset !== 'default',
    controls,
  };
}
