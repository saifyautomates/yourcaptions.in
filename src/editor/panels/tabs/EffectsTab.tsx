import { toast } from "sonner";
import { Search } from "lucide-react";

export function EffectsTab() {
  const categories = ["Blur", "Color", "Stylize", "Distort", "Light"];

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search effects..."
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
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-video bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center cursor-pointer hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-zinc-600 text-xs">
                    {cat} {i}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
