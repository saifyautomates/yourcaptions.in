import { Play, Pause, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { CanvasOverlay } from './CanvasOverlay';
import { TransformHandles } from './TransformHandles';

export function PreviewCanvas() {
  const { isPlaying, setIsPlaying, currentTime, duration, canvasZoom, setCanvasZoom } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const frames = Math.floor((time % 1) * 30);
    return `\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}:\${frames.toString().padStart(2, '0')}`;
  };

  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    
    const availableWidth = clientWidth - 32; // p-4 = 16px * 2
    const availableHeight = clientHeight - 32;
    
    const widthAtZoom1 = availableHeight * (16 / 9);
    const fitZoom = availableWidth < widthAtZoom1 
      ? availableWidth / widthAtZoom1 
      : 1;
      
    setCanvasZoom(Number(fitZoom.toFixed(2)));
  };

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]">
      {/* Scrollable Canvas Area */}
      <div 
        ref={containerRef}
        className="absolute inset-0 overflow-auto flex items-center justify-center p-4"
      >
        <div 
          className="relative aspect-video bg-black border border-zinc-800 shadow-2xl flex items-center justify-center flex-shrink-0"
          style={{ height: `\${canvasZoom * 100}%`, minHeight: '300px' }}
        >
          <span className="text-zinc-700 font-mono text-2xl tracking-widest uppercase select-none">Video Render Output</span>
          
          <CanvasOverlay />
          <TransformHandles />
        </div>
      </div>

      {/* Playback Controls Overlay (Fixed to viewport) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 z-50">
        <button className="text-zinc-300 hover:text-white transition-colors" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>
        <div className="font-mono text-sm text-zinc-300">
          {formatTime(currentTime)} <span className="text-zinc-600">/</span> {formatTime(duration)}
        </div>
      </div>

      {/* Zoom Controls Overlay (Fixed to viewport) */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-50">
        <button 
          className="text-zinc-300 hover:text-white transition-colors p-1" 
          onClick={() => setCanvasZoom(Math.max(0.1, canvasZoom - 0.1))}
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-zinc-300 text-xs font-mono w-12 text-center select-none">
          {Math.round(canvasZoom * 100)}%
        </span>
        <button 
          className="text-zinc-300 hover:text-white transition-colors p-1" 
          onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.1))}
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-white/20 mx-1" />
        <button 
          className="text-zinc-300 hover:text-white transition-colors p-1" 
          onClick={handleFitToScreen}
          title="Fit to Screen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
