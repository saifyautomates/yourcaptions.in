import { Clip } from '../types/editor.types';
import { useTimelineStore } from '../store/timelineStore';

interface Props {
  clip: Clip;
}

export function VideoInspector({ clip }: Props) {
  const { updateClip } = useTimelineStore();

  const handleTransformChange = (key: string, value: number) => {
    updateClip(clip.id, {
      transform: { ...clip.transform, [key]: value }
    });
  };

  return (
    <div className="flex flex-col space-y-px bg-zinc-900">
      <div className="bg-[#0a0a0a] p-4 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-white mb-4">Transform</h3>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Scale X</label>
              <input 
                type="number" 
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white" 
                value={clip.transform.scaleX}
                onChange={e => handleTransformChange('scaleX', parseFloat(e.target.value))}
                step={0.1}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Scale Y</label>
              <input 
                type="number" 
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white" 
                value={clip.transform.scaleY}
                onChange={e => handleTransformChange('scaleY', parseFloat(e.target.value))}
                step={0.1}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Position X</label>
              <input 
                type="number" 
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white" 
                value={clip.transform.x}
                onChange={e => handleTransformChange('x', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Position Y</label>
              <input 
                type="number" 
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white" 
                value={clip.transform.y}
                onChange={e => handleTransformChange('y', parseFloat(e.target.value))}
              />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Rotation</label>
            <div className="flex items-center space-x-2">
              <input 
                type="range" 
                className="flex-1 accent-[#E60000]" 
                min="-180" max="180" 
                value={clip.transform.rotation}
                onChange={e => handleTransformChange('rotation', parseFloat(e.target.value))}
              />
              <span className="text-xs text-zinc-400 w-8 text-right">{clip.transform.rotation}°</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] p-4 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-white mb-4">Compositing</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Opacity</label>
            <div className="flex items-center space-x-2">
              <input 
                type="range" 
                className="flex-1 accent-[#E60000]" 
                min="0" max="1" step="0.01"
                value={clip.opacity}
                onChange={e => updateClip(clip.id, { opacity: parseFloat(e.target.value) })}
              />
              <span className="text-xs text-zinc-400 w-8 text-right">{Math.round(clip.opacity * 100)}%</span>
            </div>
          </div>
          
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Blend Mode</label>
            <select 
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
              value={clip.blendMode}
              onChange={e => updateClip(clip.id, { blendMode: e.target.value as any })}
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
