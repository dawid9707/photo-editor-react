import { useEffect, useMemo, useRef, useState } from 'react';

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 920;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const initialAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  blur: 0,
  invert: 0,
};

const initialLayers = [
  {
    id: 'text-main',
    name: 'Main Title',
    type: 'text',
    visible: true,
    opacity: 100,
    x: 220,
    y: 220,
    fontSize: 72,
    color: '#f8fafc',
    text: 'Photo Editor Pro',
  },
  {
    id: 'brush-glow',
    name: 'Glow Brush',
    type: 'brush',
    visible: true,
    opacity: 100,
    strokes: [
      {
        color: '#f97316',
        size: 20,
        points: [
          { x: 290, y: 610 },
          { x: 360, y: 560 },
          { x: 440, y: 520 },
          { x: 520, y: 540 },
          { x: 610, y: 610 },
        ],
      },
    ],
  },
];

function App() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const layersRef = useRef(initialLayers);
  const adjustmentsRef = useRef(initialAdjustments);

  const [baseImage, setBaseImage] = useState(null);
  const [tool, setTool] = useState('move');
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [activeLayerId, setActiveLayerId] = useState('text-main');
  const [layers, setLayers] = useState(initialLayers);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [textInput, setTextInput] = useState('Photo Editor Pro');
  const [brushColor, setBrushColor] = useState('#f97316');
  const [brushSize, setBrushSize] = useState(18);
  const [cropRect, setCropRect] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({
    mode: null,
    layerId: null,
    start: null,
    origin: null,
    cropStart: null,
  });

  const [history, setHistory] = useState([
    { layers: deepClone(initialLayers), adjustments: { ...initialAdjustments } },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    adjustmentsRef.current = adjustments;
  }, [adjustments]);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) || null,
    [layers, activeLayerId],
  );

  const filterString = useMemo(() => {
    const { brightness, contrast, saturation, grayscale, sepia, hue, blur, invert } = adjustments;
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) sepia(${sepia}%) hue-rotate(${hue}deg) blur(${blur}px) invert(${invert}%)`;
  }, [adjustments]);

  const commitHistory = (nextLayers = layersRef.current, nextAdjustments = adjustmentsRef.current) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const snapshot = {
        layers: deepClone(nextLayers),
        adjustments: { ...nextAdjustments },
      };

      const next = [...trimmed, snapshot];
      if (next.length > 30) next.shift();
      return next;
    });

    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid) drawGrid(ctx, canvas.width, canvas.height);

    const image = imageRef.current;
    if (image) {
      const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
      const drawW = image.width * ratio;
      const drawH = image.height * ratio;
      const x = (canvas.width - drawW) / 2;
      const y = (canvas.height - drawH) / 2;

      ctx.save();
      ctx.filter = filterString;
      ctx.drawImage(image, x, y, drawW, drawH);
      ctx.restore();
    }

    layers.forEach((layer) => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      if (layer.type === 'text') {
        ctx.font = `${layer.fontSize}px Inter, 'Segoe UI', sans-serif`;
        ctx.fillStyle = layer.color;
        ctx.textBaseline = 'top';
        ctx.fillText(layer.text, layer.x, layer.y);
      }

      if (layer.type === 'brush' && Array.isArray(layer.strokes)) {
        layer.strokes.forEach((stroke) => {
          if (!stroke || stroke.points.length === 0) return;

          if (stroke.color === 'rgba(0,0,0,0)') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            stroke.points.forEach((point, index) => {
              if (index === 0) ctx.moveTo(point.x, point.y);
              else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.restore();
            return;
          }

          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        });
      }

      ctx.restore();
    });

    if (cropRect) {
      const { x, y, width, height } = cropRect;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }
  }, [baseImage, layers, filterString, showGrid, cropRect, zoom]);

  useEffect(() => {
    if (!baseImage) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
    };
    img.src = baseImage;
  }, [baseImage]);

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const updateLayer = (layerId, updater) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
    );
  };

  const ensureBrushLayer = () => {
    const selectedBrush = layers.find((layer) => layer.type === 'brush' && layer.id === activeLayerId);
    if (selectedBrush) return selectedBrush.id;

    const fallback = layers.find((layer) => layer.type === 'brush');
    if (fallback) {
      setActiveLayerId(fallback.id);
      return fallback.id;
    }

    const newLayer = {
      id: makeId(),
      name: 'Brush Layer',
      type: 'brush',
      visible: true,
      opacity: 100,
      strokes: [],
    };

    const next = [...layersRef.current, newLayer];
    setLayers(next);
    setActiveLayerId(newLayer.id);
    return newLayer.id;
  };

  const pushAdjustment = (key, value) => {
    const nextAdjustments = { ...adjustmentsRef.current, [key]: value };
    setAdjustments(nextAdjustments);
    commitHistory(layersRef.current, nextAdjustments);
  };

  const handlePointerDown = (event) => {
    const pos = getCanvasCoordinates(event);

    if (tool === 'brush' || tool === 'eraser') {
      const layerId = ensureBrushLayer();
      const stroke = {
        color: tool === 'eraser' ? 'rgba(0,0,0,0)' : brushColor,
        size: brushSize,
        points: [{ x: pos.x, y: pos.y }],
      };

      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === layerId
            ? { ...layer, strokes: [...(layer.strokes || []), stroke] }
            : layer,
        ),
      );

      dragRef.current = {
        mode: 'brush',
        layerId,
        start: pos,
        origin: null,
        cropStart: null,
      };
      setIsDragging(true);
      return;
    }

    if (tool === 'move' && activeLayer && activeLayer.type === 'text') {
      dragRef.current = {
        mode: 'move-layer',
        layerId: activeLayer.id,
        start: pos,
        origin: { x: activeLayer.x, y: activeLayer.y },
        cropStart: null,
      };
      setIsDragging(true);
      return;
    }

    if (tool === 'crop') {
      dragRef.current = {
        mode: 'crop',
        layerId: null,
        start: pos,
        origin: null,
        cropStart: pos,
      };
      setCropRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setIsDragging(true);
      return;
    }
  };

  const handlePointerMove = (event) => {
    const pos = getCanvasCoordinates(event);

    if (!isDragging || !dragRef.current.mode) return;

    if (dragRef.current.mode === 'brush') {
      const { layerId } = dragRef.current;
      setLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== layerId || !Array.isArray(layer.strokes)) return layer;
          const nextStrokes = [...layer.strokes];
          const lastStroke = nextStrokes[nextStrokes.length - 1];
          if (!lastStroke) return layer;
          lastStroke.points = [...lastStroke.points, { x: pos.x, y: pos.y }];
          return { ...layer, strokes: nextStrokes };
        }),
      );
      return;
    }

    if (dragRef.current.mode === 'move-layer') {
      const { start, origin, layerId } = dragRef.current;
      const dx = pos.x - start.x;
      const dy = pos.y - start.y;
      updateLayer(layerId, (layer) => ({
        ...layer,
        x: origin.x + dx,
        y: origin.y + dy,
      }));
      return;
    }

    if (dragRef.current.mode === 'crop') {
      const { cropStart } = dragRef.current;
      const x = Math.min(cropStart.x, pos.x);
      const y = Math.min(cropStart.y, pos.y);
      const width = Math.abs(pos.x - cropStart.x);
      const height = Math.abs(pos.y - cropStart.y);
      setCropRect({ x, y, width, height });
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;

    if (dragRef.current.mode === 'crop' && cropRect) {
      const nextRect = { ...cropRect };
      if (nextRect.width > 6 && nextRect.height > 6) {
        const clipped = applyCrop(nextRect);
        if (clipped) {
          setBaseImage(clipped);
        }
      }
    }

    setCropRect(null);
    dragRef.current = { mode: null, layerId: null, start: null, origin: null, cropStart: null };
    setIsDragging(false);
    commitHistory(layersRef.current, adjustmentsRef.current);
  };

  const applyCrop = (rect) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width;
    offscreen.height = rect.height;
    const ctx = offscreen.getContext('2d');

    const source = imageRef.current;
    const imageRatio = source.width / canvas.width;
    const cropX = rect.x * imageRatio;
    const cropY = rect.y * imageRatio;
    const cropW = rect.width * imageRatio;
    const cropH = rect.height * imageRatio;

    ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, offscreen.width, offscreen.height);
    return offscreen.toDataURL('image/png');
  };

  const addTextLayer = () => {
    const newLayer = {
      id: makeId(),
      name: 'Text Layer',
      type: 'text',
      visible: true,
      opacity: 100,
      x: 220,
      y: 180,
      fontSize: 62,
      color: '#ffffff',
      text: textInput || 'New Text',
    };

    const next = [...layersRef.current, newLayer];
    setLayers(next);
    setActiveLayerId(newLayer.id);
    setTool('move');
    commitHistory(next, adjustmentsRef.current);
  };

  const addBrushLayer = () => {
    const newLayer = {
      id: makeId(),
      name: 'Brush Layer',
      type: 'brush',
      visible: true,
      opacity: 100,
      strokes: [],
    };

    const next = [...layersRef.current, newLayer];
    setLayers(next);
    setActiveLayerId(newLayer.id);
    setTool('brush');
    commitHistory(next, adjustmentsRef.current);
  };

  const duplicateLayer = (layerId) => {
    const source = layersRef.current.find((layer) => layer.id === layerId);
    if (!source) return;

    const duplicate = {
      ...deepClone(source),
      id: makeId(),
      name: `${source.name} Copy`,
      x: (source.x || 0) + 18,
      y: (source.y || 0) + 18,
    };

    const next = [...layersRef.current, duplicate];
    setLayers(next);
    setActiveLayerId(duplicate.id);
    commitHistory(next, adjustmentsRef.current);
  };

  const removeLayer = (layerId) => {
    const next = layersRef.current.filter((layer) => layer.id !== layerId);
    setLayers(next);
    if (activeLayerId === layerId) {
      setActiveLayerId(next[0]?.id || null);
    }
    commitHistory(next, adjustmentsRef.current);
  };

  const resetAll = () => {
    setBaseImage(null);
    imageRef.current = null;
    setLayers(initialLayers);
    setAdjustments(initialAdjustments);
    setActiveLayerId('text-main');
    setHistory([{ layers: deepClone(initialLayers), adjustments: { ...initialAdjustments } }]);
    setHistoryIndex(0);
  };

  const undo = () => {
    setHistoryIndex((prev) => {
      const nextIndex = clamp(prev - 1, 0, history.length - 1);
      const snapshot = history[nextIndex];
      if (snapshot) {
        setLayers(deepClone(snapshot.layers));
        setAdjustments({ ...snapshot.adjustments });
      }
      return nextIndex;
    });
  };

  const redo = () => {
    setHistoryIndex((prev) => {
      const nextIndex = clamp(prev + 1, 0, history.length - 1);
      const snapshot = history[nextIndex];
      if (snapshot) {
        setLayers(deepClone(snapshot.layers));
        setAdjustments({ ...snapshot.adjustments });
      }
      return nextIndex;
    });
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'photo-editor-pro.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const onImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBaseImage(reader.result);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="app-header">
          <div>
            <p className="eyebrow">Creative Suite</p>
            <h1>Photo Editor Pro</h1>
          </div>
          <button className="secondary" onClick={resetAll}>Reset</button>
        </div>

        <div className="panel-block">
          <label className="section-title">File</label>
          <input type="file" accept="image/*" onChange={onImageUpload} />
        </div>

        <div className="panel-block">
          <label className="section-title">Tools</label>
          <div className="segmented-control">
            <button className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}>Move</button>
            <button className={tool === 'crop' ? 'active' : ''} onClick={() => setTool('crop')}>Crop</button>
            <button className={tool === 'brush' ? 'active' : ''} onClick={() => { setTool('brush'); ensureBrushLayer(); }}>Brush</button>
            <button className={tool === 'eraser' ? 'active' : ''} onClick={() => { setTool('eraser'); ensureBrushLayer(); }}>Eraser</button>
          </div>
        </div>

        <div className="panel-block">
          <label className="section-title">Text</label>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text"
          />
          <button className="primary" onClick={addTextLayer}>Add Text Layer</button>
        </div>

        <div className="panel-block">
          <label className="section-title">Brush</label>
          <div className="color-row">
            <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
            <span>{brushSize}px</span>
          </div>
          <input type="range" min={2} max={60} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
        </div>

        <div className="panel-block">
          <label className="section-title">Adjustments</label>
          <RangeControl label="Brightness" value={adjustments.brightness} min={0} max={200} onChange={(value) => pushAdjustment('brightness', value)} />
          <RangeControl label="Contrast" value={adjustments.contrast} min={0} max={200} onChange={(value) => pushAdjustment('contrast', value)} />
          <RangeControl label="Saturation" value={adjustments.saturation} min={0} max={200} onChange={(value) => pushAdjustment('saturation', value)} />
          <RangeControl label="Grayscale" value={adjustments.grayscale} min={0} max={100} onChange={(value) => pushAdjustment('grayscale', value)} />
          <RangeControl label="Sepia" value={adjustments.sepia} min={0} max={100} onChange={(value) => pushAdjustment('sepia', value)} />
          <RangeControl label="Hue" value={adjustments.hue} min={0} max={360} onChange={(value) => pushAdjustment('hue', value)} />
          <RangeControl label="Blur" value={adjustments.blur} min={0} max={20} onChange={(value) => pushAdjustment('blur', value)} />
          <RangeControl label="Invert" value={adjustments.invert} min={0} max={100} onChange={(value) => pushAdjustment('invert', value)} />
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="window-actions">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>

          <div className="toolbar-group">
            <button onClick={undo} disabled={historyIndex <= 0}>Undo</button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1}>Redo</button>
            <button onClick={() => setShowGrid((prev) => !prev)}>{showGrid ? 'Hide Grid' : 'Show Grid'}</button>
            <button className="primary" onClick={exportPNG}>Export PNG</button>
          </div>

          <div className="zoom-controls">
            <button onClick={() => setZoom((prev) => clamp(prev - 0.1, 0.4, 2))}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((prev) => clamp(prev + 0.1, 0.4, 2))}>+</button>
          </div>
        </header>

        <section className="canvas-area">
          <div className="canvas-wrapper" style={{ transform: `scale(${zoom})` }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerUp}
              onPointerUp={handlePointerUp}
            />
          </div>
        </section>

        <aside className="layers-panel">
          <div className="panel-header">
            <h2>Layers</h2>
            <button className="small" onClick={addBrushLayer}>+ Layer</button>
          </div>

          <div className="layers-list">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`layer-item ${layer.id === activeLayerId ? 'selected' : ''}`}
                onClick={() => setActiveLayerId(layer.id)}
              >
                <div className="layer-meta">
                  <span className={`layer-badge ${layer.type}`} />
                  <span>{layer.name}</span>
                </div>

                <div className="layer-actions">
                  <button className="small" onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, (item) => ({ ...item, visible: !item.visible })); }}>
                    {layer.visible ? 'Hide' : 'Show'}
                  </button>
                  <button className="small" onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }}>Copy</button>
                  <button className="small danger" onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}>Delete</button>
                </div>

                {layer.type === 'text' && (
                  <div className="property-row">
                    <input
                      value={layer.text}
                      onChange={(e) => updateLayer(layer.id, (item) => ({ ...item, text: e.target.value }))}
                    />
                    <input
                      type="color"
                      value={layer.color}
                      onChange={(e) => updateLayer(layer.id, (item) => ({ ...item, color: e.target.value }))}
                    />
                    <input
                      type="range"
                      min={24}
                      max={180}
                      value={layer.fontSize}
                      onChange={(e) => updateLayer(layer.id, (item) => ({ ...item, fontSize: Number(e.target.value) }))}
                    />
                  </div>
                )}

                <div className="property-row opacity-row">
                  <label>Opacity</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={layer.opacity}
                    onChange={(e) => updateLayer(layer.id, (item) => ({ ...item, opacity: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

function RangeControl({ label, value, min, max, onChange }) {
  return (
    <label className="range-control">
      <div className="range-header">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

export default App;
