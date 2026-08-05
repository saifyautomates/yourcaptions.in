import { Upload, FolderPlus, ListFilter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MediaTab() {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <span className="font-semibold text-zinc-300">Project Media</span>
        <div className="flex space-x-1">
          <button
            onClick={() => toast.info("Not implemented yet")}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => toast.info("Not implemented yet")}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded"
          >
            <ListFilter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <div
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors ${dragActive ? "border-[#E60000] bg-red-900/10" : "border-zinc-800 hover:border-zinc-700"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            toast.success("Media imported successfully!");
          }}
        >
          <Upload className="w-8 h-8 text-zinc-500 mb-2" />
          <p className="text-zinc-300 font-medium mb-1">Drag and drop media</p>
          <p className="text-zinc-500 text-xs mb-3">Video, Audio, Images</p>
          <button
            onClick={() => toast.success("Opening file browser...")}
            className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors"
          >
            Browse Files
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-center text-zinc-600 text-xs mt-10">
          No media imported yet
        </div>
      </div>
    </div>
  );
}
