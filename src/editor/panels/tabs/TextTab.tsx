import { toast } from "sonner";
import { Search, Type } from "lucide-react";

export function TextTab() {
  const templates = [
    "Default Text",
    "Lower Third",
    "Subtitle",
    "Title",
    "Credits",
  ];

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search text templates..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {templates.map((t) => (
          <div
            key={t}
            className="bg-zinc-900 border border-zinc-800 rounded-md p-3 flex items-center cursor-pointer hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
          >
            <Type className="w-4 h-4 text-zinc-400 mr-3" />
            <span className="text-zinc-300 text-xs font-medium">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
