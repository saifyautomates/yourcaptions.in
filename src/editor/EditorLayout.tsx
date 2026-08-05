import { TopToolbar } from './toolbar/TopToolbar';
import { LeftPanel } from './panels/LeftPanel';
import { RightPanel } from './panels/RightPanel';
import { PreviewCanvas } from './canvas/PreviewCanvas';
import { Timeline } from './timeline/Timeline';
import { useEditorStore } from './store/editorStore';

export function EditorLayout() {
  const { leftPanelWidth, rightPanelWidth, timelineHeight, isLeftPanelOpen, isRightPanelOpen } = useEditorStore();

  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden">
      <TopToolbar />
      
      <div className="flex flex-1 overflow-hidden min-h-0">
        {isLeftPanelOpen && (
          <div className="border-r border-zinc-800 flex-shrink-0" style={{ width: leftPanelWidth }}>
            <LeftPanel />
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-w-0 bg-black">
          <div className="flex-1 min-h-0 relative">
            <PreviewCanvas />
          </div>
          <div className="border-t border-zinc-800 flex-shrink-0 bg-[#0a0a0a]" style={{ height: timelineHeight }}>
            <Timeline />
          </div>
        </div>
        
        {isRightPanelOpen && (
          <div className="border-l border-zinc-800 flex-shrink-0 bg-[#0a0a0a]" style={{ width: rightPanelWidth }}>
            <RightPanel />
          </div>
        )}
      </div>
    </div>
  );
}
