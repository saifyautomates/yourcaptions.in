import { toast } from "sonner";
import { Search, Music, PlayCircle } from "lucide-react";

export function AudioTab() {
  const categories = [
    "Cinematic",
    "Vlog",
    "Ambient",
    "Upbeat",
    "Sound Effects",
  ];

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search audio library..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {categories.map((cat) => (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              {cat}
            </h3>
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-zinc-900 border border-zinc-800 rounded flex items-center justify-between p-2 cursor-pointer hover:border-zinc-700 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <Music className="w-4 h-4 text-zinc-500" />
                    <div>
                      <p className="text-zinc-300 text-[11px] font-medium leading-none">
                        {cat} Track {i}
                      </p>
                      <p className="text-zinc-600 text-[9px] mt-1">2:45</p>
                    </div>
                  </div>
                  <button className="text-zinc-500 hover:text-[#E60000] opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
