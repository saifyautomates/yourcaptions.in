import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Film, Wand2, Type, Music, Sparkles } from 'lucide-react';
import { MediaTab } from './tabs/MediaTab';
import { EffectsTab } from './tabs/EffectsTab';
import { AITab } from './tabs/AITab';
import { TextTab } from './tabs/TextTab';
import { AudioTab } from './tabs/AudioTab';

export function LeftPanel() {
  const { leftPanelTab, setLeftPanelTab } = useEditorStore();
  
  const tabs = [
    { id: 'media', icon: Film, label: 'Media' },
    { id: 'effects', icon: Wand2, label: 'Effects' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'ai', icon: Sparkles, label: 'AI' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setLeftPanelTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 border-b-2 transition-colors ${leftPanelTab === tab.id ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            <tab.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] uppercase font-bold tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {leftPanelTab === 'media' && <MediaTab />}
        {leftPanelTab === 'effects' && <EffectsTab />}
        {leftPanelTab === 'text' && <TextTab />}
        {leftPanelTab === 'audio' && <AudioTab />}
        {leftPanelTab === 'ai' && <AITab />}
      </div>
    </div>
  );
}
