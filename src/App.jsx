import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Upload,
  Download,
  Save,
  ImagePlus,
  Trash2,
  Copy,
  Grip,
  RotateCw,
  Lock,
  Unlock,
  Layers,
  SendToBack,
  Grid3X3,
  Check,
  X,
  FileUp,
} from 'lucide-react';

const SIDEBAR_WIDTH = 220;
const GRID_SIZE = 20;
const MIN_SIZE = 40;
const DEFAULT_FRAME_BORDER_CM = 5;
const MIN_FRAME_BORDER_CM = 1;
const MAX_FRAME_BORDER_CM = 12;
const PX_PER_CM = 4;
const DEFAULT_FRAME_WIDTH_CM = 50;
const DEFAULT_FRAME_HEIGHT_CM = 70;
const DEFAULT_PASSEPARTOUT_CM = 5;
const DEFAULT_PASSEPARTOUT_COLOR = '#FBFAF7';
const MIN_FRAME_CM = 10;
const MAX_FRAME_CM = 250;
const MAX_PASSEPARTOUT_CM = 20;

const materials = {
  oak: {
    label: 'Oak',
    style:
      'linear-gradient(115deg, rgba(255,255,255,.18), transparent 24%), repeating-linear-gradient(35deg, #C9965E 0 6px, #B98248 6px 9px, #D6AA73 9px 15px)',
  },
  darkOak: {
    label: 'Dark Oak',
    style:
      'linear-gradient(115deg, rgba(255,255,255,.08), transparent 26%), repeating-linear-gradient(35deg, #3B2417 0 7px, #4C2F1D 7px 13px, #2A1A12 13px 18px)',
  },
  black: { label: 'Black', style: '#171717' },
  white: { label: 'White', style: '#F8F7F4' },
  custom: { label: 'Custom', style: '#A87E68' },
};

const wallOptions = {
  warm: { label: 'Warm white', color: '#F5F0EB', accent: '#E8DDD4', className: 'wall-warm' },
  grey: { label: 'Light grey', color: '#E5E4E0', accent: '#CFCFCA', className: 'wall-grey' },
  charcoal: { label: 'Deep charcoal', color: '#292A2A', accent: '#4C4D4D', className: 'wall-charcoal' },
  linen: { label: 'Natural linen', color: '#EDE5D7', accent: '#D7C9B4', className: 'wall-linen' },
};

const presets = [
  {
    id: 'sym3',
    name: 'Symmetric 3',
    boxes: [
      [28, 35, 18, 30],
      [48, 24, 22, 42],
      [72, 35, 18, 30],
    ],
  },
  {
    id: 'grid',
    name: 'Grid 2×2',
    boxes: [
      [36, 27, 20, 28],
      [60, 27, 20, 28],
      [36, 60, 20, 28],
      [60, 60, 20, 28],
    ],
  },
  {
    id: 'stair',
    name: 'Staircase',
    boxes: [
      [28, 60, 20, 28],
      [45, 48, 20, 28],
      [62, 36, 20, 28],
      [78, 24, 16, 24],
    ],
  },
  {
    id: 'cluster',
    name: 'Cluster',
    boxes: [
      [45, 33, 22, 34],
      [64, 30, 16, 23],
      [31, 42, 17, 25],
      [58, 65, 18, 25],
      [76, 55, 16, 28],
    ],
  },
  {
    id: 'salon',
    name: 'Salon mix',
    boxes: [
      [34, 30, 17, 24],
      [53, 25, 24, 34],
      [75, 32, 15, 21],
      [29, 62, 21, 27],
      [55, 65, 16, 24],
      [72, 63, 19, 26],
    ],
  },
];

function uid() {
  return `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function snap(value, enabled) {
  return enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;
}

function cmToPx(value) {
  return value * PX_PER_CM;
}

function pxToCm(value) {
  return Math.round((value / PX_PER_CM) * 10) / 10;
}

function getMaxMatWidthCm(frame) {
  const widthCm = Number(frame.widthCm) || pxToCm(frame.w || cmToPx(DEFAULT_FRAME_WIDTH_CM));
  const heightCm = Number(frame.heightCm) || pxToCm(frame.h || cmToPx(DEFAULT_FRAME_HEIGHT_CM));
  const maxByFrame = Math.max(0, Math.min(widthCm, heightCm) / 2 - 1);
  return Math.round(Math.min(MAX_PASSEPARTOUT_CM, maxByFrame) * 2) / 2;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  const existing = document.querySelector('script[data-html2canvas]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.html2canvas));
      existing.addEventListener('error', () => reject(new Error('html2canvas failed to load')));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    script.dataset.html2canvas = 'true';
    script.onload = () => (window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas unavailable')));
    script.onerror = () => reject(new Error('html2canvas failed to load'));
    document.head.appendChild(script);
  });
}

function App() {
  const [frames, setFrames] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showCmGrid, setShowCmGrid] = useState(false);
  const [wall, setWall] = useState('warm');
  const [activePreset, setActivePreset] = useState('cluster');
  const [message, setMessage] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [measurementDraft, setMeasurementDraft] = useState({ widthCm: '', heightCm: '' });
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadInputRef = useRef(null);
  const dragState = useRef(null);
  const framesRef = useRef([]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    const selected = frames.find((frame) => frame.id === selectedId);
    if (selected) {
      setMeasurementDraft({
        widthCm: String(Math.round(selected.widthCm ?? pxToCm(selected.w))),
        heightCm: String(Math.round(selected.heightCm ?? pxToCm(selected.h))),
      });
    }
  }, [frames, selectedId]);

  useEffect(() => {
    return () => {
      framesRef.current.forEach((frame) => {
        if (frame.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(frame.objectUrl);
      });
    };
  }, []);

  const showMessage = useCallback((text) => {
    setMessage(text);
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => setMessage(''), 3600);
  }, []);

  const getCanvasRect = useCallback(() => canvasRef.current?.getBoundingClientRect(), []);

  const applyPreset = useCallback((incoming = frames, presetId = activePreset) => {
    const rect = getCanvasRect();
    const preset = presets.find((p) => p.id === presetId) || presets[0];
    if (!rect) return incoming;
    return incoming.map((frame, index) => {
      const box = preset.boxes[index % preset.boxes.length];
      const cycle = Math.floor(index / preset.boxes.length);
      const w = Math.max(MIN_SIZE, (box[2] / 100) * rect.width);
      const h = Math.max(MIN_SIZE, (box[3] / 100) * rect.height);
      const jitter = cycle * 26;
      const x = clamp((box[0] / 100) * rect.width - w / 2 + jitter, 0, rect.width - w);
      const y = clamp((box[1] / 100) * rect.height - h / 2 + jitter, 0, rect.height - h);
      return { ...frame, x, y, w, h, widthCm: pxToCm(w), heightCm: pxToCm(h) };
    });
  }, [activePreset, frames, getCanvasRect]);

  const addFiles = useCallback(async (files) => {
    const accepted = [...files].filter((file) => file.type.startsWith('image/'));
    if (!accepted.length) {
      showMessage('No image files found. Try JPG, PNG, HEIC, or WebP.');
      return;
    }
    const rect = getCanvasRect();
    const defaultW = cmToPx(DEFAULT_FRAME_WIDTH_CM);
    const defaultH = cmToPx(DEFAULT_FRAME_HEIGHT_CM);
    const baseX = rect ? rect.width / 2 - defaultW / 2 : 280;
    const baseY = rect ? rect.height / 2 - defaultH / 2 : 220;
    const startIndex = frames.length;
    const newFrames = await Promise.all(
      accepted.map(async (file, i) => ({
        id: uid(),
        objectUrl: URL.createObjectURL(file),
        dataUrl: await fileToDataUrl(file),
        name: file.name,
        x: clamp(baseX + i * 24, 0, Math.max(0, (rect?.width || 800) - defaultW)),
        y: clamp(baseY + i * 22, 0, Math.max(0, (rect?.height || 600) - defaultH)),
        w: defaultW,
        h: defaultH,
        widthCm: DEFAULT_FRAME_WIDTH_CM,
        heightCm: DEFAULT_FRAME_HEIGHT_CM,
        rotation: 0,
        material: 'oak',
        customColor: '#A87E68',
        borderWidthCm: DEFAULT_FRAME_BORDER_CM,
        mat: true,
        matWidthCm: DEFAULT_PASSEPARTOUT_CM,
        matColor: DEFAULT_PASSEPARTOUT_COLOR,
        aspectLocked: false,
        z: startIndex + i + 1,
      }))
    );
    setFrames((current) => [...current, ...newFrames]);
    setSelectedId(newFrames[newFrames.length - 1].id);
    showMessage(`${newFrames.length} photo${newFrames.length === 1 ? '' : 's'} added.`);
  }, [frames.length, getCanvasRect, showMessage]);

  const updateFrame = useCallback((id, patch) => {
    setFrames((current) => current.map((frame) => (frame.id === id ? { ...frame, ...patch } : frame)));
  }, []);

  const updateFrameMeasurement = useCallback((id, key, rawValue) => {
    const normalized = String(rawValue).replace(',', '.');
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return;
    const valueCm = clamp(numeric, MIN_FRAME_CM, MAX_FRAME_CM);
    const pixels = cmToPx(valueCm);
    setFrames((current) => current.map((frame) => {
      if (frame.id !== id) return frame;
      if (key === 'widthCm') return { ...frame, w: pixels, widthCm: valueCm };
      return { ...frame, h: pixels, heightCm: valueCm };
    }));
    setMeasurementDraft((current) => ({ ...current, [key]: String(valueCm) }));
  }, []);

  const onMeasurementDraftChange = useCallback((key, value) => {
    if (/^\d{0,3}([,.]\d{0,1})?$/.test(value)) {
      setMeasurementDraft((current) => ({ ...current, [key]: value }));
    }
  }, []);

  const commitMeasurementDraft = useCallback((id, key) => {
    const value = measurementDraft[key];
    if (value === '') {
      const frame = frames.find((item) => item.id === id);
      if (frame) setMeasurementDraft((current) => ({ ...current, [key]: String(Math.round(frame[key] ?? pxToCm(key === 'widthCm' ? frame.w : frame.h))) }));
      return;
    }
    updateFrameMeasurement(id, key, value);
  }, [frames, measurementDraft, updateFrameMeasurement]);

  const onMeasurementKeyDown = useCallback((event, id, key) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      commitMeasurementDraft(id, key);
    }
  }, [commitMeasurementDraft]);

  const selectFrame = useCallback((event, id) => {
    event.stopPropagation();
    setSelectedId(id);
  }, []);

  const onPointerDownFrame = useCallback((event, frame) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    selectFrame(event, frame.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      mode: 'move',
      id: frame.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      frame: { ...frame },
    };
    setDraggingId(frame.id);
  }, [selectFrame]);

  const onPointerDownResize = useCallback((event, frame) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(frame.id);
    dragState.current = {
      mode: 'resize',
      id: frame.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      frame: { ...frame },
      ratio: frame.w / frame.h,
    };
    setDraggingId(frame.id);
  }, []);

  const onPointerDownRotate = useCallback((event, frame) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const center = { x: rect.left + frame.x + frame.w / 2, y: rect.top + frame.y + frame.h / 2 };
    const startAngle = Math.atan2(event.clientY - center.y, event.clientX - center.x) * (180 / Math.PI);
    setSelectedId(frame.id);
    dragState.current = { mode: 'rotate', id: frame.id, pointerId: event.pointerId, frame: { ...frame }, center, startAngle };
    setDraggingId(frame.id);
  }, []);

  const onPointerMove = useCallback((event) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const rect = getCanvasRect();
    if (!rect) return;
    event.preventDefault();
    if (state.mode === 'move') {
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      const x = snap(clamp(state.frame.x + dx, 0, rect.width - state.frame.w), snapToGrid);
      const y = snap(clamp(state.frame.y + dy, 0, rect.height - state.frame.h), snapToGrid);
      updateFrame(state.id, { x, y });
    }
    if (state.mode === 'resize') {
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      let w = Math.max(MIN_SIZE, state.frame.w + dx);
      let h = state.frame.aspectLocked ? w / state.ratio : Math.max(MIN_SIZE, state.frame.h + dy);
      if (state.frame.aspectLocked && state.frame.h + dy > h) {
        h = Math.max(MIN_SIZE, state.frame.h + dy);
        w = h * state.ratio;
      }
      w = snap(Math.min(w, rect.width - state.frame.x), snapToGrid);
      h = snap(Math.min(h, rect.height - state.frame.y), snapToGrid);
      const nextW = Math.max(MIN_SIZE, w);
      const nextH = Math.max(MIN_SIZE, h);
      updateFrame(state.id, { w: nextW, h: nextH, widthCm: pxToCm(nextW), heightCm: pxToCm(nextH) });
    }
    if (state.mode === 'rotate') {
      const angle = Math.atan2(event.clientY - state.center.y, event.clientX - state.center.x) * (180 / Math.PI);
      updateFrame(state.id, { rotation: state.frame.rotation + angle - state.startAngle });
    }
  }, [getCanvasRect, snapToGrid, updateFrame]);

  const endPointer = useCallback((event) => {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null;
      setDraggingId(null);
    }
  }, []);

  const deleteFrame = useCallback((id) => {
    setFrames((current) => {
      const target = current.find((frame) => frame.id === id);
      if (target?.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(target.objectUrl);
      return current.filter((frame) => frame.id !== id);
    });
    setSelectedId(null);
  }, []);

  const duplicateFrame = useCallback((frame) => {
    const copy = { ...frame, id: uid(), x: frame.x + 28, y: frame.y + 28, rotation: frame.rotation, z: Math.max(0, ...frames.map((f) => f.z)) + 1 };
    setFrames((current) => [...current, copy]);
    setSelectedId(copy.id);
  }, [frames]);

  const bringToFront = useCallback((id) => updateFrame(id, { z: Math.max(0, ...frames.map((f) => f.z)) + 1 }), [frames, updateFrame]);
  const sendToBack = useCallback((id) => updateFrame(id, { z: Math.min(0, ...frames.map((f) => f.z)) - 1 }), [frames, updateFrame]);

  const choosePreset = useCallback((presetId) => {
    setActivePreset(presetId);
    setFrames((current) => applyPreset(current, presetId));
    showMessage('Layout preset applied.');
  }, [applyPreset, showMessage]);

  const exportPng = useCallback(async () => {
    if (!canvasRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const previous = selectedId;
      setSelectedId(null);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: null,
        useCORS: true,
        scale: Math.min(2, window.devicePixelRatio || 1),
      });
      setSelectedId(previous);
      const link = document.createElement('a');
      link.download = 'art-wall.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showMessage('PNG exported.');
    } catch (error) {
      showMessage(`Export failed: ${error.message || 'html2canvas could not render the wall.'}`);
    } finally {
      setCapturing(false);
    }
  }, [selectedId, showMessage]);

  const saveLayout = useCallback(() => {
    const layout = {
      version: 1,
      wall,
      snapToGrid,
      showCmGrid,
      frames: frames.map(({ id, objectUrl, ...frame }) => ({ ...frame, id })),
    };
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'art-wall-layout.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    showMessage('Layout JSON downloaded.');
  }, [frames, snapToGrid, showCmGrid, wall, showMessage]);

  const loadLayout = useCallback(async (file) => {
    try {
      const text = await file.text();
      const layout = JSON.parse(text);
      if (!layout || !Array.isArray(layout.frames)) throw new Error('Missing frames array');
      setFrames((current) => {
        current.forEach((frame) => {
          if (frame.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(frame.objectUrl);
        });
        return layout.frames.map((frame, index) => ({
          id: frame.id || uid(),
          objectUrl: frame.dataUrl,
          dataUrl: frame.dataUrl,
          name: frame.name || `Loaded artwork ${index + 1}`,
          x: Number(frame.x) || 80,
          y: Number(frame.y) || 80,
          w: Math.max(MIN_SIZE, Number(frame.w) || cmToPx(Number(frame.widthCm) || DEFAULT_FRAME_WIDTH_CM)),
          h: Math.max(MIN_SIZE, Number(frame.h) || cmToPx(Number(frame.heightCm) || DEFAULT_FRAME_HEIGHT_CM)),
          widthCm: Number(frame.widthCm) || pxToCm(Math.max(MIN_SIZE, Number(frame.w) || cmToPx(DEFAULT_FRAME_WIDTH_CM))),
          heightCm: Number(frame.heightCm) || pxToCm(Math.max(MIN_SIZE, Number(frame.h) || cmToPx(DEFAULT_FRAME_HEIGHT_CM))),
          rotation: Number(frame.rotation) || 0,
          material: materials[frame.material] ? frame.material : 'oak',
          customColor: frame.customColor || '#A87E68',
          borderWidthCm: clamp(Number(frame.borderWidthCm) || pxToCm(Number(frame.borderWidth) || cmToPx(DEFAULT_FRAME_BORDER_CM)), MIN_FRAME_BORDER_CM, MAX_FRAME_BORDER_CM),
          mat: frame.mat !== false,
          matWidthCm: clamp(Number(frame.matWidthCm) || DEFAULT_PASSEPARTOUT_CM, 0, MAX_PASSEPARTOUT_CM),
          matColor: frame.matColor || DEFAULT_PASSEPARTOUT_COLOR,
          aspectLocked: Boolean(frame.aspectLocked),
          z: Number(frame.z) || index + 1,
        }));
      });
      setWall(wallOptions[layout.wall] ? layout.wall : 'warm');
      setSnapToGrid(Boolean(layout.snapToGrid));
      setShowCmGrid(Boolean(layout.showCmGrid));
      setSelectedId(null);
      showMessage('Layout loaded.');
    } catch (error) {
      showMessage('Could not load that layout. Please choose a valid art-wall-layout.json file.');
    }
  }, [showMessage]);

  const selected = frames.find((frame) => frame.id === selectedId);
  const selectedMaxMatWidthCm = selected ? getMaxMatWidthCm(selected) : MAX_PASSEPARTOUT_CM;
  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const panelStyle = selected && canvasRect ? {
    left: clamp(selected.x + selected.w + 18, 14, canvasRect.width - 270),
    top: clamp(selected.y + 12, 14, canvasRect.height - 472),
  } : {};

  return (
    <div className="app-shell">
      <style>{styles}</style>
      <aside className="sidebar">
        <div className="brand">
          <span>Art Wall</span>
          <small>Gallery planner</small>
        </div>

        <button className="primary button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={17} /> Upload photos
        </button>
        <input ref={fileInputRef} className="hidden" type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />

        <button className="button ghost" onClick={() => loadInputRef.current?.click()}>
          <FileUp size={16} /> Load layout
        </button>
        <input ref={loadInputRef} className="hidden" type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && loadLayout(e.target.files[0])} />

        <div className="divider" />
        <section>
          <h3>Wall</h3>
          <div className="swatches">
            {Object.entries(wallOptions).map(([key, option]) => (
              <button key={key} title={option.label} className={`swatch ${wall === key ? 'active' : ''}`} onClick={() => setWall(key)} style={{ background: option.color, '--accent': option.accent }}>
                {wall === key && <Check size={13} />}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Layouts</h3>
          <div className="preset-list">
            {presets.map((preset) => (
              <button key={preset.id} className={`preset ${activePreset === preset.id ? 'active' : ''}`} onClick={() => choosePreset(preset.id)}>
                <span className="preset-thumb">
                  {preset.boxes.map((box, i) => <i key={i} style={{ left: `${box[0] - box[2] / 2}%`, top: `${box[1] - box[3] / 2}%`, width: `${box[2]}%`, height: `${box[3]}%` }} />)}
                </span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="divider" />
        <button className={`button ghost ${snapToGrid ? 'on' : ''}`} onClick={() => setSnapToGrid((value) => !value)}>
          <Grid3X3 size={16} /> Snap to grid
        </button>
        <button className={`button ghost ${showCmGrid ? 'on' : ''}`} onClick={() => setShowCmGrid((value) => !value)}>
          <Grid3X3 size={16} /> Show cm grid
        </button>

        <div className="divider" />
        <button className="button ghost" onClick={exportPng} disabled={capturing}>
          <Download size={16} /> {capturing ? 'Capturing…' : 'Export PNG'}
        </button>
        <button className="button ghost" onClick={saveLayout}>
          <Save size={16} /> Save layout
        </button>
      </aside>

      <main className="workspace">
        <div className="top-note">Drag, resize, rotate, and frame your personal gallery wall.</div>
        <section
          ref={canvasRef}
          className={`wall-canvas ${wallOptions[wall].className} ${snapToGrid ? 'grid-on' : ''} ${showCmGrid ? 'cm-grid-on' : ''}`}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onClick={() => setSelectedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          {showCmGrid && canvasRect && (
            <div className="cm-grid-overlay" aria-hidden="true">
              {Array.from({ length: Math.floor(canvasRect.width / cmToPx(50)) + 1 }, (_, i) => (
                <span key={`x-${i}`} className="cm-label x-label" style={{ left: cmToPx(i * 50) }}>{i * 50} cm</span>
              ))}
              {Array.from({ length: Math.floor(canvasRect.height / cmToPx(50)) + 1 }, (_, i) => (
                <span key={`y-${i}`} className="cm-label y-label" style={{ top: cmToPx(i * 50) }}>{i * 50} cm</span>
              ))}
            </div>
          )}
          {!frames.length && (
            <div className="empty-state">
              <ImagePlus size={42} />
              <p>Drop photos here or upload from the sidebar.</p>
              <small>They’ll appear as framed works on a warm Scandinavian wall.</small>
            </div>
          )}

          {frames.map((frame) => {
            const selectedFrame = selectedId === frame.id;
            const materialBackground = frame.material === 'custom' ? frame.customColor : materials[frame.material]?.style;
            const matWidthCm = Math.min(frame.matWidthCm ?? DEFAULT_PASSEPARTOUT_CM, getMaxMatWidthCm(frame));
            return (
              <article
                key={frame.id}
                className={`frame ${selectedFrame ? 'selected' : ''} ${draggingId === frame.id ? 'dragging' : ''}`}
                onClick={(event) => selectFrame(event, frame.id)}
                onPointerDown={(event) => onPointerDownFrame(event, frame)}
                style={{
                  left: frame.x,
                  top: frame.y,
                  width: frame.w,
                  height: frame.h,
                  zIndex: frame.z,
                  transform: `rotate(${frame.rotation}deg) ${draggingId === frame.id ? 'scale(1.02)' : 'scale(1)'}`,
                  borderWidth: cmToPx(frame.borderWidthCm ?? DEFAULT_FRAME_BORDER_CM),
                  borderImage: frame.material === 'black' || frame.material === 'white' || frame.material === 'custom' ? undefined : `${materialBackground} 30`,
                  borderColor: frame.material === 'black' || frame.material === 'white' || frame.material === 'custom' ? materialBackground : undefined,
                  background: materialBackground,
                }}
              >
                <span className="hook" />
                <div
                  className={`photo-wrap ${frame.mat ? 'with-mat' : ''}`}
                  style={{
                    padding: frame.mat ? cmToPx(matWidthCm) : 0,
                    background: frame.mat ? (frame.matColor || DEFAULT_PASSEPARTOUT_COLOR) : '#fff',
                  }}
                >
                  <img src={frame.objectUrl || frame.dataUrl} alt={frame.name} draggable="false" />
                </div>
                {selectedFrame && (
                  <>
                    <button className="rotate-handle" onPointerDown={(event) => onPointerDownRotate(event, frame)} aria-label="Rotate frame"><RotateCw size={14} /></button>
                    <button className="resize-handle" onPointerDown={(event) => onPointerDownResize(event, frame)} aria-label="Resize frame"><Grip size={15} /></button>
                  </>
                )}
              </article>
            );
          })}

          {selected && (
            <div className="floating-panel" style={panelStyle} onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <strong>Frame</strong>
                <button onClick={() => setSelectedId(null)}><X size={14} /></button>
              </div>
              <div className="material-row">
                {Object.entries(materials).map(([key, item]) => (
                  <button key={key} className={selected.material === key ? 'active' : ''} onClick={() => updateFrame(selected.id, { material: key })}>
                    <span style={{ background: key === 'custom' ? selected.customColor : item.style }} />{item.label}
                  </button>
                ))}
              </div>
              {selected.material === 'custom' && (
                <label className="color-row">Custom color <input type="color" value={selected.customColor} onChange={(e) => updateFrame(selected.id, { customColor: e.target.value })} /></label>
              )}
              <div className="measurement-grid">
                <label>
                  Width
                  <span><input type="text" inputMode="decimal" value={measurementDraft.widthCm} onChange={(e) => onMeasurementDraftChange('widthCm', e.target.value)} onBlur={() => commitMeasurementDraft(selected.id, 'widthCm')} onKeyDown={(e) => onMeasurementKeyDown(e, selected.id, 'widthCm')} /> cm</span>
                </label>
                <label>
                  Height
                  <span><input type="text" inputMode="decimal" value={measurementDraft.heightCm} onChange={(e) => onMeasurementDraftChange('heightCm', e.target.value)} onBlur={() => commitMeasurementDraft(selected.id, 'heightCm')} onKeyDown={(e) => onMeasurementKeyDown(e, selected.id, 'heightCm')} /> cm</span>
                </label>
              </div>
              <p className="measurement-note">Outer frame size. All frames use the same scale, so 60 cm is exactly twice 30 cm on the wall.</p>
              <label className="range-row">
                <span>Frame width</span>
                <output>{selected.borderWidthCm ?? DEFAULT_FRAME_BORDER_CM} cm</output>
                <input
                  type="range"
                  min={MIN_FRAME_BORDER_CM}
                  max={MAX_FRAME_BORDER_CM}
                  step="0.5"
                  value={selected.borderWidthCm ?? DEFAULT_FRAME_BORDER_CM}
                  onChange={(e) => updateFrame(selected.id, { borderWidthCm: Number(e.target.value) })}
                />
              </label>
              <label className="range-row">
                <span>Passepartout</span>
                <output>{selected.mat ? `${Math.min(selected.matWidthCm ?? DEFAULT_PASSEPARTOUT_CM, selectedMaxMatWidthCm)} cm` : 'off'}</output>
                <input
                  type="range"
                  min="0"
                  max={selectedMaxMatWidthCm}
                  step="0.5"
                  value={Math.min(selected.matWidthCm ?? DEFAULT_PASSEPARTOUT_CM, selectedMaxMatWidthCm)}
                  disabled={!selected.mat}
                  onChange={(e) => updateFrame(selected.id, { matWidthCm: Math.min(Number(e.target.value), selectedMaxMatWidthCm) })}
                />
              </label>
              <p className="measurement-note">Passepartout is limited by the selected frame size so the opening stays proportional.</p>
              <label className="color-row">Passepartout color <input type="color" value={selected.matColor || DEFAULT_PASSEPARTOUT_COLOR} disabled={!selected.mat} onChange={(e) => updateFrame(selected.id, { matColor: e.target.value })} /></label>
              <div className="toggle-row">
                <button className={selected.mat ? 'active' : ''} onClick={() => updateFrame(selected.id, { mat: !selected.mat })}>Passepartout {selected.mat ? 'on' : 'off'}</button>
                <button className={selected.aspectLocked ? 'active' : ''} onClick={() => updateFrame(selected.id, { aspectLocked: !selected.aspectLocked })}>{selected.aspectLocked ? <Lock size={14} /> : <Unlock size={14} />} Ratio</button>
              </div>
              <div className="action-row">
                <button onClick={() => bringToFront(selected.id)}><Layers size={14} /> Front</button>
                <button onClick={() => sendToBack(selected.id)}><SendToBack size={14} /> Back</button>
              </div>
              <div className="action-row">
                <button onClick={() => duplicateFrame(selected)}><Copy size={14} /> Duplicate</button>
                <button className="danger" onClick={() => deleteFrame(selected.id)}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          )}
        </section>
        {message && <div className="toast">{message}</div>}
      </main>
    </div>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap');
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1F211F; background: #EFEAE3; }
button { font: inherit; cursor: pointer; border: 0; }
.hidden { display: none; }
.app-shell { min-height: 100%; }
.sidebar { position: fixed; inset: 0 auto 0 0; width: ${SIDEBAR_WIDTH}px; padding: 22px 16px; background: rgba(255,255,255,.82); backdrop-filter: blur(18px); border-right: 1px solid rgba(60,54,47,.12); z-index: 50; overflow-y: auto; }
.brand { margin-bottom: 24px; }
.brand span { display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 32px; line-height: 1; letter-spacing: -.04em; }
.brand small { color: #77706A; font-size: 12px; text-transform: uppercase; letter-spacing: .16em; }
.button { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; border-radius: 14px; margin-bottom: 9px; transition: .18s ease; }
.button:disabled { opacity: .62; cursor: wait; }
.primary { background: #20211F; color: white; box-shadow: 0 10px 28px rgba(0,0,0,.16); }
.primary:hover { transform: translateY(-1px); }
.ghost { background: #F7F4EF; color: #2A2B28; border: 1px solid rgba(57,51,44,.1); }
.ghost:hover, .ghost.on { background: #ECE5DB; }
.divider { height: 1px; background: rgba(57,51,44,.12); margin: 18px 0; }
h3 { margin: 0 0 10px; font-size: 12px; color: #77706A; letter-spacing: .12em; text-transform: uppercase; }
.swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.swatch { position: relative; height: 34px; border-radius: 999px; border: 1px solid rgba(0,0,0,.14); box-shadow: inset 0 0 0 7px var(--accent); display: grid; place-items: center; color: #111; }
.swatch.active { outline: 2px solid #4A90D9; outline-offset: 2px; }
.preset-list { display: grid; gap: 8px; }
.preset { display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 10px; text-align: left; background: #F8F5F0; border: 1px solid rgba(57,51,44,.1); border-radius: 13px; padding: 7px; color: #3C3935; }
.preset.active { border-color: rgba(74,144,217,.7); box-shadow: 0 0 0 2px rgba(74,144,217,.14); }
.preset-thumb { position: relative; display: block; height: 40px; border-radius: 8px; background: linear-gradient(180deg, #EFE7DC, #E3D7C9); overflow: hidden; }
.preset-thumb i { position: absolute; border: 2px solid #74695F; background: rgba(255,255,255,.55); border-radius: 2px; }
.workspace { margin-left: ${SIDEBAR_WIDTH}px; min-height: 100vh; padding: 28px; display: flex; flex-direction: column; gap: 16px; }
.top-note { align-self: flex-end; font-size: 13px; color: #7B756E; background: rgba(255,255,255,.56); padding: 8px 13px; border-radius: 999px; }
.wall-canvas { position: relative; flex: 1; min-height: calc(100vh - 88px); overflow: hidden; border-radius: 28px; box-shadow: inset 0 0 80px rgba(60,45,35,.11), 0 18px 50px rgba(53,47,40,.14); isolation: isolate; touch-action: none; }
.wall-canvas::before { content: ''; position: absolute; inset: 0; z-index: -2; background: var(--wall-bg, #F5F0EB); }
.wall-canvas::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: -1; opacity: .18; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"), radial-gradient(ellipse at center, transparent 48%, rgba(25,20,15,.16)); mix-blend-mode: multiply; }
.wall-warm { --wall-bg: #F5F0EB; }
.wall-grey { --wall-bg: #E5E4E0; }
.wall-charcoal { --wall-bg: #292A2A; }
.wall-charcoal::after { opacity: .24; mix-blend-mode: soft-light; }
.wall-linen { --wall-bg: #EDE5D7; }
.wall-linen::after { opacity: .28; background-image: repeating-linear-gradient(90deg, rgba(122,97,63,.08) 0 1px, transparent 1px 9px), repeating-linear-gradient(0deg, rgba(122,97,63,.06) 0 1px, transparent 1px 7px), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.6' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E"); }
.grid-on { background-image: linear-gradient(rgba(90,90,90,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(90,90,90,.10) 1px, transparent 1px); background-size: ${GRID_SIZE}px ${GRID_SIZE}px; }
.cm-grid-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 0; background-image: linear-gradient(rgba(74,144,217,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(74,144,217,.18) 1px, transparent 1px); background-size: ${cmToPx(10)}px ${cmToPx(10)}px; }
.cm-grid-overlay::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(74,144,217,.34) 1px, transparent 1px), linear-gradient(90deg, rgba(74,144,217,.34) 1px, transparent 1px); background-size: ${cmToPx(50)}px ${cmToPx(50)}px; }
.cm-label { position: absolute; z-index: 1; color: rgba(43,92,138,.82); background: rgba(255,255,255,.72); border: 1px solid rgba(74,144,217,.22); border-radius: 999px; padding: 2px 5px; font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.x-label { top: 6px; transform: translateX(4px); }
.y-label { left: 6px; transform: translateY(4px); }
.empty-state { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; color: #81776D; gap: 8px; pointer-events: none; }
.empty-state svg { margin: auto; opacity: .55; }
.empty-state p { margin: 0; font-size: 18px; color: #55504B; }
.empty-state small { font-size: 13px; }
.frame { position: absolute; border-style: solid; border-color: #C9965E; box-shadow: inset 0 0 0 1px rgba(255,255,255,.23), inset 0 0 18px rgba(0,0,0,.24), 0 4px 18px rgba(0,0,0,.25); user-select: none; transform-origin: center; transition: box-shadow .14s ease, transform .14s ease; touch-action: none; }
.frame.selected { box-shadow: 0 0 0 2px #4A90D9, inset 0 0 0 1px rgba(255,255,255,.23), inset 0 0 18px rgba(0,0,0,.24), 0 4px 18px rgba(0,0,0,.25); }
.frame.dragging { box-shadow: 0 0 0 2px rgba(74,144,217,.72), inset 0 0 0 1px rgba(255,255,255,.23), inset 0 0 18px rgba(0,0,0,.20), 0 16px 38px rgba(0,0,0,.32); }
.hook { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); width: 28px; height: 13px; border-top: 1px solid rgba(70,63,55,.38); border-radius: 50% 50% 0 0; pointer-events: none; }
.hook::after { content: ''; position: absolute; top: -3px; left: 50%; width: 5px; height: 5px; transform: translateX(-50%); border-radius: 50%; background: rgba(70,63,55,.45); }
.photo-wrap { width: 100%; height: 100%; background: #fff; overflow: hidden; box-shadow: inset 0 0 18px rgba(0,0,0,.18); }
.photo-wrap.with-mat { background: #FBFAF7; }
.photo-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; background: transparent; }
.rotate-handle, .resize-handle { position: absolute; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; background: white; color: #2C2D2A; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
.rotate-handle { right: -16px; top: -48px; }
.resize-handle { right: -15px; bottom: -15px; cursor: nwse-resize; }
.floating-panel { position: absolute; z-index: 999; width: 256px; background: rgba(255,255,255,.94); border: 1px solid rgba(55,48,40,.1); border-radius: 18px; padding: 12px; box-shadow: 0 18px 44px rgba(39,34,27,.18); backdrop-filter: blur(16px); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.panel-head button { background: #F1EEE9; border-radius: 999px; width: 24px; height: 24px; display: grid; place-items: center; }
.material-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.material-row button, .toggle-row button, .action-row button { min-height: 31px; border-radius: 10px; background: #F6F3EE; color: #34332F; display: flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid rgba(57,51,44,.08); }
.material-row button.active, .toggle-row button.active { box-shadow: 0 0 0 2px rgba(74,144,217,.28); background: #EDF5FF; }
.material-row span { width: 13px; height: 13px; border-radius: 50%; border: 1px solid rgba(0,0,0,.13); }
.color-row { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #69625B; }
.color-row input { width: 42px; height: 28px; border: 0; background: transparent; }
.measurement-grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.measurement-grid label { display: grid; gap: 5px; font-size: 12px; color: #69625B; }
.measurement-grid span { display: flex; align-items: center; gap: 4px; border: 1px solid rgba(57,51,44,.12); background: #F8F5F0; border-radius: 10px; padding: 4px 7px; color: #77706A; }
.measurement-grid input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #34332F; font: inherit; font-variant-numeric: tabular-nums; }
.measurement-note { margin: 6px 0 0; color: #81776D; font-size: 11px; line-height: 1.35; }
.range-row { margin-top: 10px; display: grid; grid-template-columns: 1fr auto; gap: 6px 10px; align-items: center; font-size: 13px; color: #69625B; }
.range-row output { color: #34332F; font-variant-numeric: tabular-nums; }
.range-row input { grid-column: 1 / -1; width: 100%; accent-color: #4A90D9; }
.toggle-row, .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 8px; }
.action-row .danger { color: #9C2F2F; background: #FFF1F1; }
.toast { position: fixed; left: calc(${SIDEBAR_WIDTH}px + 36px); bottom: 28px; z-index: 2000; background: #20211F; color: white; padding: 11px 14px; border-radius: 999px; box-shadow: 0 12px 34px rgba(0,0,0,.22); font-size: 13px; }
@media (max-width: 760px) {
  .app-shell { display: block; padding-bottom: 230px; }
  .sidebar { inset: auto 10px 10px 10px; width: auto; height: 212px; border: 1px solid rgba(60,54,47,.12); border-radius: 24px; padding: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; overflow-y: auto; }
  .brand { grid-column: 1 / -1; margin: 0; display: flex; align-items: end; justify-content: space-between; }
  .brand span { font-size: 24px; }
  .button { margin: 0; min-height: 38px; }
  .divider { display: none; }
  .sidebar section { min-width: 0; }
  .preset-list { grid-template-columns: 1fr 1fr; }
  .preset { grid-template-columns: 38px 1fr; font-size: 12px; padding: 5px; }
  .preset-thumb { height: 28px; }
  .workspace { margin-left: 0; padding: 12px; min-height: calc(100vh - 220px); }
  .top-note { display: none; }
  .wall-canvas { min-height: calc(100vh - 245px); border-radius: 18px; }
  .toast { left: 20px; right: 20px; bottom: 236px; border-radius: 16px; }
  .floating-panel { width: 230px; }
}
`;

createRoot(document.getElementById('root')).render(<App />);
