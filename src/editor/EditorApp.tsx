import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EditorLayout } from './EditorLayout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function EditorApp() {
  const { projectId } = useParams();
  
  useKeyboardShortcuts();

  useEffect(() => {
    // In a real app, load project data here using projectId
  }, [projectId]);

  return (
    <div className="w-full h-screen bg-[#050505] text-white overflow-hidden flex flex-col font-sans">
      <EditorLayout />
    </div>
  );
}
