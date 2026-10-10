import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import {
  Aperture, ArrowDownToLine, ArrowLeft, ArrowRight, Brush, Check, ChevronDown, ChevronRight,
  CircleHelp, Crop, Eye, EyeOff, FileImage, FlipHorizontal, FolderOpen, Frame, Grid2X2,
  Hand, ImagePlus, Layers3, Minus, MoreHorizontal, Move, Plus, Redo2, RotateCcw, RotateCw,
  Save, Search, Settings2, SlidersHorizontal, Sparkles, Square, Sun, Type, Undo2, ZoomIn, ZoomOut
} from 'lucide-react'

type Tool = 'move' | 'crop' | 'brush' | 'text'
type LayerItem = { id: string; name: string; type: 'image' | 'text' | 'shape'; visible: boolean; opacity: number; text?: string; x?: number; y?: number }
type Adjustments = { brightness: number; contrast: number; saturation: number; warmth: number; blur: number; grayscale: number; hue: number }

const defaults: Adjustments = { brightness: 100, contrast: 100, saturation: 100, warmth: 0, blur: 0, grayscale: 0, hue: 0 }
const sampleImage = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=90'
const filters = [
  { name: 'Oryginał', values: defaults },
  { name: 'Film', values: { ...defaults, contrast: 112, saturation: 84, warmth: 12 } },
  { name: 'Matowy', values: { ...defaults, contrast: 86, saturation: 76, brightness: 106 } },
  { name: 'Ciepły', values: { ...defaults, warmth: 28, saturation: 112, contrast: 105 } },
  { name: 'Mono', values: { ...defaults, grayscale: 100, contrast: 115 } },
]

function useImage(src: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) { setImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = src
    return () => { img.onload = null }
  }, [src])
  return image
}

function IconButton({ children, title, active, onClick, disabled }: { children: React.ReactNode; title: string; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return <button className={`icon-btn ${active ? 'active' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>{children}</button>
}

function Slider({ label, value, min, max, unit = '', onChange, reset }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void; reset?: () => void }) {
  return <div className="slider-row">
    <div className="slider-heading"><span>{label}</span><div><b>{value}{unit}</b>{reset && <button className="tiny-reset" title="Resetuj" onClick={reset}><RotateCcw size={12}/></button>}</div></div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} />
  </div>
}

export default function App() {
  const [src, setSrc] = useState<string | null>(sampleImage)
  const image = useImage(src)
  const [tool, setTool] = useState<Tool>('move')
  const [activeTab, setActiveTab] = useState<'adjust' | 'filters' | 'layers'>('adjust')
  const [adjust, setAdjust] = useState<Adjustments>(defaults)
  const [history, setHistory] = useState<Adjustments[]>([defaults])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [zoom, setZoom] = useState(72)
  const [showGrid, setShowGrid] = useState(false)
  const [showBefore, setShowBefore] = useState(false)
  const [selectedLayer, setSelectedLayer] = useState('photo')
  const [layers, setLayers] = useState<LayerItem[]>([{ id: 'photo', name: 'Zdjęcie główne', type: 'image', visible: true, opacity: 100 }])
  const [textValue, setTextValue] = useState('Twój tekst')
  const [docName, setDocName] = useState('Bez nazwy — 01')
  const [notice, setNotice] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [textPos, setTextPos] = useState({ x: 50, y: 50 })
  const textLayer = layers.find(l => l.id === selectedLayer && l.type === 'text')

  useEffect(() => {
    if (image) setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
  }, [image])

  const update = (key: keyof Adjustments, value: number) => setAdjust(prev => ({ ...prev, [key]: value }))
  const commitHistory = useCallback((next: Adjustments) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), next])
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = () => {
    if (historyIndex <= 0) return
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex); setAdjust(history[nextIndex])
  }
  const redo = () => {
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex); setAdjust(history[nextIndex])
  }
  const changeAdjustment = (key: keyof Adjustments, value: number) => {
    const next = { ...adjust, [key]: value }
    setAdjust(next)
  }
  const resetAdjustments = () => { setAdjust(defaults); commitHistory(defaults) }
  const applyFilter = (values: Adjustments) => { setAdjust(values); commitHistory(values) }

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setNotice('Wybierz plik obrazu.'); return }
    const nextUrl = URL.createObjectURL(file)
    setSrc(nextUrl); setDocName(file.name.replace(/\.[^.]+$/, ''))
    setAdjust(defaults); setHistory([defaults]); setHistoryIndex(0)
    setLayers([{ id: 'photo', name: file.name, type: 'image', visible: true, opacity: 100 }])
    setSelectedLayer('photo'); setNotice(`Wczytano: ${file.name}`)
    event.target.value = ''
  }

  const addText = () => {
    const id = `text-${Date.now()}`
    const layer = { id, name: 'Warstwa tekstowa', type: 'text' as const, visible: true, opacity: 100, text: textValue, x: 50, y: 50 }
    setLayers(prev => [...prev, layer]); setSelectedLayer(id); setTool('text')
  }
  const toggleVisibility = (id: string) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
  const updateLayerOpacity = (opacity: number) => setLayers(prev => prev.map(l => l.id === selectedLayer ? { ...l, opacity } : l))
  const moveLayer = (id: string, dir: -1 | 1) => setLayers(prev => {
    const arr = [...prev]; const i = arr.findIndex(l => l.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return prev
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return arr
  })

  const exportImage = () => {
    if (!image) { setNotice('Najpierw wczytaj zdjęcie.'); return }
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.filter = `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturation}%) grayscale(${showBefore ? 0 : adjust.grayscale}%) hue-rotate(${adjust.hue}deg) blur(${adjust.blur}px)`
    ctx.drawImage(image, 0, 0)
    if (adjust.warmth !== 0) {
      ctx.filter = 'none'; ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = adjust.warmth > 0 ? `rgba(255, ${Math.max(100, 180-adjust.warmth*2)}, 80, ${Math.abs(adjust.warmth)/100})` : `rgba(80, 150, 255, ${Math.abs(adjust.warmth)/100})`
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    layers.filter(l => l.visible && l.type === 'text').forEach(l => {
      ctx.globalAlpha = l.opacity / 100; ctx.filter = 'none'; ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.max(24, canvas.width * 0.045)}px sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8
      ctx.fillText(l.text || textValue, (l.x || 50) * canvas.width / 1000, (l.y || 50) * canvas.height / 700)
    })
    canvas.toBlob(blob => {
      if (!blob) { setNotice('Nie udało się wyeksportować obrazu.'); return }
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${docName || 'photoforge'}.png`; link.click()
      URL.revokeObjectURL(link.href); setNotice('Eksport PNG gotowy.')
    }, 'image/png')
  }

  const stageSize = useMemo(() => {
    if (!image) return { width: 800, height: 500 }
    const maxW = 900 * zoom / 100, maxH = 650 * zoom / 100
    const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1.3)
    return { width: Math.max(1, image.naturalWidth * scale), height: Math.max(1, image.naturalHeight * scale) }
  }, [image, zoom])

  const filterString = showBefore ? '' : `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturation}%) grayscale(${adjust.grayscale}%) hue-rotate(${adjust.hue}deg) blur(${adjust.blur}px)`
  const activeLayer = layers.find(l => l.id === selectedLayer)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Aperture size={20}/></div><span>photo<span className="brand-accent">forge</span></span><span className="beta">STUDIO</span></div>
      <div className="doc-title"><FileImage size={15}/><span>{docName}</span><span className="saved-dot" title="Zmiany lokalne"/></div>
      <div className="top-actions">
        <button className="text-action" onClick={() => fileRef.current?.click()}><FolderOpen size={16}/> Otwórz</button>
        <button className="text-action" onClick={undo} disabled={historyIndex <= 0} title="Cofnij"><Undo2 size={16}/></button>
        <button className="text-action" onClick={redo} disabled={historyIndex >= history.length - 1} title="Ponów"><Redo2 size={16}/></button>
        <button className="export-btn" onClick={exportImage}><ArrowDownToLine size={16}/> Eksportuj <ChevronDown size={14}/></button>
      </div>
    </header>
    <div className="menu-bar"><span>Plik</span><span>Edycja</span><span>Obraz</span><span>Warstwa</span><span>Kolory</span><span>Filtry</span><span>Widok</span><span>Pomoc</span><div className="menu-spacer"/><span className="cloud-status"><span/> Zapis lokalny</span></div>
    <main className="workspace">
      <aside className="tool-rail">
        <div className="rail-group">
          <IconButton title="Przesuwanie (V)" active={tool === 'move'} onClick={() => setTool('move')}><Move size={19}/></IconButton>
          <IconButton title="Kadrowanie (C)" active={tool === 'crop'} onClick={() => setTool('crop')}><Crop size={19}/></IconButton>
          <IconButton title="Pędzel (B)" active={tool === 'brush'} onClick={() => setTool('brush')}><Brush size={19}/></IconButton>
          <IconButton title="Tekst (T)" active={tool === 'text'} onClick={() => { setTool('text'); if (!layers.some(l => l.type === 'text')) addText() }}><Type size={19}/></IconButton>
          <IconButton title="Kształt" onClick={() => { const id = `shape-${Date.now()}`; setLayers(p => [...p, { id, name: 'Prostokąt', type: 'shape', visible: true, opacity: 100 }]); setSelectedLayer(id) }}><Square size={19}/></IconButton>
          <div className="rail-divider"/>
          <IconButton title="Dopasowanie" active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')}><SlidersHorizontal size={19}/></IconButton>
          <IconButton title="Warstwy" active={activeTab === 'layers'} onClick={() => setActiveTab('layers')}><Layers3 size={19}/></IconButton>
        </div>
        <div className="rail-bottom"><IconButton title="Pomoc"><CircleHelp size={18}/></IconButton><IconButton title="Ustawienia"><Settings2 size={18}/></IconButton></div>
      </aside>

      <section className="canvas-area">
        <div className="canvas-toolbar">
          <div className="tool-context"><span className="context-icon">{tool === 'move' ? <Move size={15}/> : tool === 'crop' ? <Crop size={15}/> : tool === 'brush' ? <Brush size={15}/> : <Type size={15}/>}</span><b>{tool === 'move' ? 'Przesuwanie' : tool === 'crop' ? 'Kadrowanie' : tool === 'brush' ? 'Pędzel' : 'Tekst'}</b><ChevronDown size={13}/><span className="context-separator"/><span className="muted">Tryb</span><span className="pill">Normalny <ChevronDown size={12}/></span></div>
          <div className="canvas-controls">
            <IconButton title="Pokaż oryginał" active={showBefore} onClick={() => setShowBefore(!showBefore)}><Eye size={16}/></IconButton>
            <IconButton title="Siatka" active={showGrid} onClick={() => setShowGrid(!showGrid)}><Grid2X2 size={16}/></IconButton>
            <span className="control-divider"/>
            <IconButton title="Pomniejsz" onClick={() => setZoom(v => Math.max(20, v - 10))}><ZoomOut size={16}/></IconButton><span className="zoom-label">{zoom}%</span><IconButton title="Powiększ" onClick={() => setZoom(v => Math.min(140, v + 10))}><ZoomIn size={16}/></IconButton>
          </div>
        </div>
        <div className={`canvas-viewport ${showGrid ? 'with-grid' : ''}`}>
          {!image ? <div className="empty-state"><div className="empty-icon"><ImagePlus size={28}/></div><h2>Twoje płótno czeka</h2><p>Wczytaj zdjęcie, aby rozpocząć edycję.</p><button className="primary-btn" onClick={() => fileRef.current?.click()}><ImagePlus size={16}/> Wczytaj zdjęcie</button></div> :
          <div className="stage-wrap" style={{ width: stageSize.width, height: stageSize.height, filter: filterString }}>
            <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}>
              <Layer>
                {layers.filter(l => l.type === 'image' && l.visible).map(l => <KonvaImage key={l.id} image={image} width={stageSize.width} height={stageSize.height} opacity={l.opacity / 100} filters={[]} listening={false}/>)}
                {layers.filter(l => l.type === 'shape' && l.visible).map(l => <Rect key={l.id} x={stageSize.width * .2} y={stageSize.height * .2} width={stageSize.width * .6} height={stageSize.height * .6} stroke="#a78bfa" strokeWidth={2} dash={[8, 5]} opacity={l.opacity / 100}/>)}
                {layers.filter(l => l.type === 'text' && l.visible).map(l => <KonvaText key={l.id} text={l.text || textValue} x={l.x ?? 50} y={l.y ?? 50} fontSize={Math.max(18, stageSize.width * .045)} fontFamily="DM Sans" fontStyle="bold" fill="white" shadowColor="black" shadowBlur={8} draggable onClick={() => setSelectedLayer(l.id)} onTap={() => setSelectedLayer(l.id)} onDragEnd={e => setLayers(prev => prev.map(item => item.id === l.id ? { ...item, x: e.target.x(), y: e.target.y() } : item))} opacity={l.opacity / 100}/>)}
              </Layer>
            </Stage>
            <div className="image-adjustment-overlay" style={{ pointerEvents: 'none' }}/>
            {tool === 'crop' && <div className="crop-overlay"><div className="crop-grid"><i/><i/><i/><i/></div><span>Kadrowanie — przeciągnij uchwyty (podgląd)</span></div>}
          </div>}
        </div>
        <footer className="statusbar"><div><span className="status-dot"/>{image ? `${imageSize.width} × ${imageSize.height} px` : 'Brak dokumentu'}<span className="status-divider"/>RGB / 8-bit</div><div><span>{tool === 'move' ? 'Przeciągnij warstwę, aby ją przesunąć' : tool === 'text' ? 'Kliknij tekst na płótnie, aby zaznaczyć' : tool === 'crop' ? 'Narzędzie kadrowania' : 'Narzędzie pędzla'}</span><span className="status-divider"/><span>{zoom}%</span></div></footer>
      </section>

      <aside className="right-panel">
        <div className="panel-tabs">
          <button className={activeTab === 'adjust' ? 'selected' : ''} onClick={() => setActiveTab('adjust')}><SlidersHorizontal size={15}/> Korekty</button>
          <button className={activeTab === 'filters' ? 'selected' : ''} onClick={() => setActiveTab('filters')}><Sparkles size={15}/> Filtry</button>
          <button className={activeTab === 'layers' ? 'selected' : ''} onClick={() => setActiveTab('layers')}><Layers3 size={15}/> Warstwy</button>
        </div>
        {activeTab === 'adjust' && <div className="panel-content">
          <div className="panel-heading"><div><h3>Podstawowe korekty</h3><p>Dopracuj światło i kolor</p></div><button className="round-icon" title="Resetuj wszystkie" onClick={resetAdjustments}><RotateCcw size={15}/></button></div>
          <div className="histogram"><div className="histogram-bars">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: `${10 + Math.abs(Math.sin(i * 12.32) * Math.cos(i * 3.17)) * 85}%` }}/>)}</div><div className="histogram-labels"><span>Cienie</span><span>Półtony</span><span>Światła</span></div></div>
          <div className="section-label"><Sun size={14}/> ŚWIATŁO</div>
          <Slider label="Jasność" value={adjust.brightness} min={0} max={200} unit="%" onChange={v => changeAdjustment('brightness', v)} reset={() => update('brightness', 100)}/>
          <Slider label="Kontrast" value={adjust.contrast} min={0} max={200} unit="%" onChange={v => changeAdjustment('contrast', v)} reset={() => update('contrast', 100)}/>
          <Slider label="Ekspozycja" value={Math.round((adjust.brightness - 100) / 2)} min={-50} max={50} onChange={v => changeAdjustment('brightness', 100 + v * 2)} reset={() => update('brightness', 100)}/>
          <div className="section-label"><Aperture size={14}/> KOLOR</div>
          <Slider label="Nasycenie" value={adjust.saturation} min={0} max={200} unit="%" onChange={v => changeAdjustment('saturation', v)} reset={() => update('saturation', 100)}/>
          <Slider label="Temperatura" value={adjust.warmth} min={-100} max={100} onChange={v => changeAdjustment('warmth', v)} reset={() => update('warmth', 0)}/>
          <Slider label="Odcień" value={adjust.hue} min={-180} max={180} unit="°" onChange={v => changeAdjustment('hue', v)} reset={() => update('hue', 0)}/>
          <div className="section-label"><Sparkles size={14}/> EFEKTY</div>
          <Slider label="Skala szarości" value={adjust.grayscale} min={0} max={100} unit="%" onChange={v => changeAdjustment('grayscale', v)} reset={() => update('grayscale', 0)}/>
          <Slider label="Rozmycie" value={adjust.blur} min={0} max={20} unit=" px" onChange={v => changeAdjustment('blur', v)} reset={() => update('blur', 0)}/>
          <button className="apply-btn" onClick={() => { commitHistory(adjust); setNotice('Korekty dodane do historii.') }}><Check size={15}/> Zastosuj korekty</button>
        </div>}
        {activeTab === 'filters' && <div className="panel-content">
          <div className="panel-heading"><div><h3>Presety kolorystyczne</h3><p>Jedno kliknięcie, nowy klimat</p></div><Sparkles size={18} className="muted-icon"/></div>
          <div className="filter-grid">{filters.map((f, i) => <button key={f.name} className={`filter-card ${JSON.stringify(adjust) === JSON.stringify(f.values) ? 'chosen' : ''}`} onClick={() => applyFilter(f.values)}><div className={`filter-preview filter-${i}`} style={{ filter: `saturate(${f.values.saturation}%) contrast(${f.values.contrast}%) sepia(${Math.max(0, f.values.warmth)/100}) grayscale(${f.values.grayscale}%)` }}><img src={src || sampleImage} alt="Podgląd filtra"/></div><span>{f.name}</span></button>)}</div>
          <div className="tip-card"><Sparkles size={16}/><div><b>Wskazówka</b><p>Połącz preset z ręcznymi korektami, aby uzyskać własny styl.</p></div></div>
          <button className="secondary-btn" onClick={resetAdjustments}><RotateCcw size={15}/> Przywróć oryginał</button>
        </div>}
        {activeTab === 'layers' && <div className="panel-content layer-panel">
          <div className="panel-heading"><div><h3>Warstwy</h3><p>{layers.length} elementy w dokumencie</p></div><button className="round-icon" title="Dodaj tekst" onClick={addText}><Plus size={16}/></button></div>
          <div className="layer-actions"><button onClick={addText}><Type size={14}/> Tekst</button><button onClick={() => { const id = `shape-${Date.now()}`; setLayers(p => [...p, { id, name: 'Prostokąt', type: 'shape', visible: true, opacity: 100 }]); setSelectedLayer(id) }}><Square size={14}/> Kształt</button></div>
          <div className="layers-list">{[...layers].reverse().map(layer => <div key={layer.id} className={`layer-item ${selectedLayer === layer.id ? 'layer-selected' : ''}`} onClick={() => setSelectedLayer(layer.id)}><button className="visibility" title="Widoczność" onClick={e => { e.stopPropagation(); toggleVisibility(layer.id) }}>{layer.visible ? <Eye size={14}/> : <EyeOff size={14}/>}</button><div className={`layer-thumb ${layer.type}`}>{layer.type === 'image' && image ? <img src={src || ''} alt=""/> : layer.type === 'text' ? <Type size={18}/> : <Square size={18}/>}</div><div className="layer-name"><b>{layer.name}</b><span>{layer.type === 'image' ? 'Obraz' : layer.type === 'text' ? 'Tekst' : 'Kształt'}</span></div><button className="more-btn" title="Przenieś na wierzch" onClick={e => { e.stopPropagation(); moveLayer(layer.id, 1) }}><MoreHorizontal size={16}/></button></div>)}</div>
          {activeLayer && <div className="layer-properties"><div className="section-label">WŁAŚCIWOŚCI</div><div className="slider-heading"><span>Krycie</span><b>{activeLayer.opacity}%</b></div><input type="range" min="0" max="100" value={activeLayer.opacity} onChange={e => updateLayerOpacity(Number(e.target.value))}/>{activeLayer.type === 'text' && <div className="text-editor"><label>Treść tekstu</label><input value={activeLayer.text || ''} onChange={e => setLayers(p => p.map(l => l.id === activeLayer.id ? { ...l, text: e.target.value } : l))}/></div>}</div>}
          <div className="tip-card"><Layers3 size={16}/><div><b>Praca na warstwach</b><p>Ukrywaj, wybieraj i zmieniaj krycie elementów niezależnie od siebie.</p></div></div>
        </div>}
      </aside>
    </main>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload}/>
    {notice && <button className="toast" onClick={() => setNotice('')}>{notice}<span>×</span></button>}
  </div>
}
