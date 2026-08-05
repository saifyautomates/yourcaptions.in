import { useEditorStore } from '../store/editorStore';

export function TransformHandles() {
  const { selectedClipIds } = useEditorStore();
  
  if (selectedClipIds.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute left-1/4 top-1/4 w-1/2 h-1/2 border-2 border-[#E60000] pointer-events-auto cursor-move">
        <div className="absolute -left-1 -top-1 w-3 h-3 bg-white border border-[#E60000] cursor-nwse-resize" />
        <div className="absolute -right-1 -top-1 w-3 h-3 bg-white border border-[#E60000] cursor-nesw-resize" />
        <div className="absolute -left-1 -bottom-1 w-3 h-3 bg-white border border-[#E60000] cursor-nesw-resize" />
        <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border border-[#E60000] cursor-nwse-resize" />
      </div>
    </div>
  );
}
