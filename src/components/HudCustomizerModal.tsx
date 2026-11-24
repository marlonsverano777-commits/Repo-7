import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Move,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CustomHudLayout,
  DEFAULT_HUD_CONTROLS,
  HUD_CONTROL_IDS,
  HUD_CONTROL_SPECS,
  HudControlId,
  applyHudPreset,
  clampHudValue,
  createDefaultHudLayout,
  resolveHudControlTransform,
  sanitizeHudLayout,
} from '../shared/hudLayout.ts';
import { soundEngine } from '../game/soundEngine.ts';

interface HudCustomizerModalProps {
  open: boolean;
  initialLayout: CustomHudLayout | null | undefined;
  isCloudSynced: boolean;
  onSave: (layout: CustomHudLayout) => void;
  onClose: () => void;
}

export const HudCustomizerModal: React.FC<HudCustomizerModalProps> = ({
  open,
  initialLayout,
  isCloudSynced,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<CustomHudLayout>(() => sanitizeHudLayout(initialLayout));
  const [selectedId, setSelectedId] = useState<HudControlId>('m1');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    id: HudControlId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(sanitizeHudLayout(initialLayout));
    setSelectedId('m1');
    dragStateRef.current = null;
  }, [open, initialLayout]);

  if (!open) return null;

  const selectedSpec = HUD_CONTROL_SPECS[selectedId];
  const selectedTransform = resolveHudControlTransform(draft, selectedId);

  const updateControl = (
    id: HudControlId,
    patch: Partial<{ xPct: number; yPct: number; scale: number; opacity: number }>
  ) => {
    setDraft((prev) => {
      const cur = resolveHudControlTransform(prev, id);
      const nextTransform = {
        xPct: Math.round(clampHudValue(patch.xPct ?? cur.xPct, 4, 96) * 10) / 10,
        yPct: Math.round(clampHudValue(patch.yPct ?? cur.yPct, 6, 94) * 10) / 10,
        scale: Math.round(clampHudValue(patch.scale ?? cur.scale, 0.7, 1.5) * 100) / 100,
        opacity: Math.round(clampHudValue(patch.opacity ?? cur.opacity, 0.25, 1.0) * 100) / 100,
      };
      return {
        version: 1,
        customized: true,
        controls: {
          ...prev.controls,
          [id]: nextTransform,
        },
      };
    });
  };

  const handleControlPointerDown = (
    id: HudControlId,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    soundEngine.unlock();
    setSelectedId(id);
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const cur = resolveHudControlTransform(draft, id);
    const centerPxX = stageRect.left + (cur.xPct / 100) * stageRect.width;
    const centerPxY = stageRect.top + (cur.yPct / 100) * stageRect.height;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointers
    }
    dragStateRef.current = {
      id,
      pointerId: e.pointerId,
      offsetX: e.clientX - centerPxX,
      offsetY: e.clientY - centerPxY,
    };
  };

  const handleControlPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return;
    const nextX = ((e.clientX - drag.offsetX - rect.left) / rect.width) * 100;
    const nextY = ((e.clientY - drag.offsetY - rect.top) / rect.height) * 100;
    updateControl(drag.id, { xPct: nextX, yPct: nextY });
  };

  const handleControlPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }
  };

  return (
    <div
      data-testid="hud-customizer-modal"
      className="fixed inset-0 z-[80] bg-slate-950 text-white flex flex-col overflow-hidden safe-area-pad animate-fade-in select-none"
    >
      {/* Top Toolbar */}
      <div className="px-2.5 sm:px-4 py-2 bg-slate-900 border-b border-slate-700/90 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-display font-bold text-xs sm:text-sm uppercase tracking-wider text-white truncate">
                HUD Layout Editor
              </h2>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                  isCloudSynced
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                    : 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                }`}
              >
                {isCloudSynced ? 'Google Sync' : 'Local Save'}
              </span>
            </div>
            <p className="hidden sm:block text-[10px] text-slate-400 truncate">
              Drag any combat button to reposition, resize, or adjust transparency.
            </p>
          </div>
        </div>

        {/* Presets & Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
          {(['default', 'compact', 'spread'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`hud-preset-${preset}`}
              onClick={() => {
                soundEngine.unlock();
                soundEngine.play('uiClick');
                setDraft(applyHudPreset(preset));
              }}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-display font-bold uppercase text-slate-200 cursor-pointer"
            >
              {preset}
            </button>
          ))}

          <button
            type="button"
            data-testid="hud-reset-selected-btn"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiClick');
              const def = DEFAULT_HUD_CONTROLS[selectedId];
              updateControl(selectedId, def);
            }}
            title="Reset selected button"
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Reset Item</span>
          </button>

          <button
            type="button"
            data-testid="hud-reset-all-btn"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiClick');
              setDraft(createDefaultHudLayout());
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/70 border border-slate-600 hover:border-rose-400 text-[10px] font-semibold text-rose-300 cursor-pointer"
          >
            Reset All
          </button>

          <button
            type="button"
            data-testid="hud-save-btn"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiSelect');
              onSave(sanitizeHudLayout(draft));
              onClose();
            }}
            className="px-2.5 sm:px-3.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-[11px] sm:text-xs flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          <button
            type="button"
            data-testid="hud-cancel-btn"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.play('uiClick');
              onClose();
            }}
            aria-label="Close HUD Customizer"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Draggable Arena HUD Stage */}
      <div
        ref={stageRef}
        data-testid="hud-customizer-stage"
        className="relative flex-1 min-h-0 overflow-hidden bg-slate-900"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 45%, rgba(56,189,248,0.12), rgba(15,23,42,0.96) 72%), linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 36px 36px, 36px 36px',
        }}
      >
        {/* Reference Safe Guides for Minimap + Top Bar */}
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 opacity-45">
          <div className="w-16 h-16 rounded-xl border border-dashed border-slate-400 flex items-center justify-center text-[8px] font-mono-num text-slate-300">
            MINIMAP
          </div>
          <div className="w-28 h-12 rounded-lg border border-dashed border-slate-400 flex items-center justify-center text-[8px] font-mono-num text-slate-300">
            HP / CHI BAR
          </div>
        </div>
        <div className="pointer-events-none absolute top-2 right-2 w-24 h-8 rounded-lg border border-dashed border-slate-400 opacity-45 flex items-center justify-center text-[8px] font-mono-num text-slate-300">
          MENU / EXIT
        </div>

        {HUD_CONTROL_IDS.map((id) => {
          const spec = HUD_CONTROL_SPECS[id];
          const t = resolveHudControlTransform(draft, id);
          const isSelected = selectedId === id;
          const basePx = spec.baseSizePx;

          return (
            <button
              key={id}
              type="button"
              data-testid={`hud-node-${id}`}
              onPointerDown={(e) => handleControlPointerDown(id, e)}
              onPointerMove={handleControlPointerMove}
              onPointerUp={handleControlPointerUp}
              onPointerCancel={handleControlPointerUp}
              style={{
                left: `${t.xPct}%`,
                top: `${t.yPct}%`,
                width: basePx,
                height: spec.shape === 'pill' ? Math.round(basePx * 0.72) : basePx,
                opacity: t.opacity,
                transform: `translate(-50%, -50%) scale(${t.scale})`,
                borderColor: isSelected ? '#ffffff' : spec.accentHex,
                backgroundColor:
                  id === 'joystick'
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(15,23,42,0.88)',
              }}
              className={`touch-none-select absolute flex flex-col items-center justify-center border-2 shadow-lg cursor-grab active:cursor-grabbing ${
                spec.shape === 'pill' ? 'rounded-2xl' : 'rounded-full'
              } ${isSelected ? 'ring-2 ring-amber-400 z-30' : 'z-10'}`}
            >
              {id === 'joystick' && (
                <div
                  className="w-8 h-8 rounded-full border-2 border-slate-900 pointer-events-none"
                  style={{ backgroundColor: spec.accentHex }}
                />
              )}
              <span
                className="font-display font-bold text-[10px] leading-none pointer-events-none"
                style={{ color: spec.accentHex }}
              >
                {spec.shortLabel}
              </span>
              <span className="font-mono-num text-[8px] text-slate-300 leading-none mt-0.5 pointer-events-none">
                {spec.keyHint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Selected Control Inspector + Sliders */}
      <div className="px-2.5 sm:px-4 py-2 bg-slate-900 border-t border-slate-700/90 flex flex-col gap-1.5 shrink-0">
        {/* Scrollable Quick Selector Strip */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {HUD_CONTROL_IDS.map((id) => {
            const spec = HUD_CONTROL_SPECS[id];
            const active = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('uiClick');
                  setSelectedId(id);
                }}
                className={`px-2 py-0.5 rounded-md border text-[10px] font-display font-bold uppercase whitespace-nowrap cursor-pointer shrink-0 ${
                  active
                    ? 'bg-amber-400 border-amber-300 text-slate-950'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {spec.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Selected Control Name + Size & Opacity Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
          <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Move className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-display font-bold text-xs text-white truncate">
                {selectedSpec.label}
              </span>
              <span className="text-[10px] font-mono-num text-slate-400 shrink-0">
                ({Math.round(selectedTransform.xPct)}%, {Math.round(selectedTransform.yPct)}%)
              </span>
            </div>
            {selectedSpec.contextualNote && (
              <span className="text-[9px] text-amber-300 truncate shrink-0">
                {selectedSpec.contextualNote}
              </span>
            )}
          </div>

          <div className="sm:col-span-4 flex items-center gap-2 min-w-0">
            <label
              htmlFor="hud-scale-slider"
              className="text-[10px] font-display font-bold uppercase text-slate-300 w-10 shrink-0"
            >
              Size
            </label>
            <input
              id="hud-scale-slider"
              data-testid="hud-scale-slider"
              type="range"
              min={0.7}
              max={1.5}
              step={0.05}
              value={selectedTransform.scale}
              onChange={(e) =>
                updateControl(selectedId, { scale: Number(e.target.value) })
              }
              className="flex-1 min-w-0 accent-amber-400 cursor-pointer"
            />
            <span
              data-testid="hud-scale-value"
              className="w-10 text-right font-mono-num text-[11px] font-bold text-amber-300 shrink-0"
            >
              {Math.round(selectedTransform.scale * 100)}%
            </span>
          </div>

          <div className="sm:col-span-4 flex items-center gap-2 min-w-0">
            <label
              htmlFor="hud-opacity-slider"
              className="text-[10px] font-display font-bold uppercase text-slate-300 w-12 shrink-0"
            >
              Opacity
            </label>
            <input
              id="hud-opacity-slider"
              data-testid="hud-opacity-slider"
              type="range"
              min={0.25}
              max={1.0}
              step={0.05}
              value={selectedTransform.opacity}
              onChange={(e) =>
                updateControl(selectedId, { opacity: Number(e.target.value) })
              }
              className="flex-1 min-w-0 accent-sky-400 cursor-pointer"
            />
            <span
              data-testid="hud-opacity-value"
              className="w-10 text-right font-mono-num text-[11px] font-bold text-sky-300 shrink-0"
            >
              {Math.round(selectedTransform.opacity * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
