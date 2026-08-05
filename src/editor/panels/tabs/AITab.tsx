import { toast } from "sonner";
import { Sparkles, Languages, Wand2 } from "lucide-react";

export function AITab() {
  return (
    <div className="h-full flex flex-col text-sm">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-white font-semibold flex items-center">
          <Sparkles className="w-4 h-4 mr-2 text-[#E60000]" />
          AI Tools
        </h2>
        <p className="text-zinc-500 text-xs mt-1">
          Powered by Advanced AI
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 cursor-pointer transition-colors group" onClick={() => toast.info("Feature under development")}>
          <div className="flex items-start space-x-3">
            <div className="bg-zinc-800 p-2 rounded-md group-hover:bg-zinc-700">
              <Languages className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-zinc-200 font-medium text-sm">
                Auto Transcribe
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Generate accurate captions from audio using global and regional
                AI.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 cursor-pointer transition-colors group" onClick={() => toast.info("Feature under development")}>
          <div className="flex items-start space-x-3">
            <div className="bg-zinc-800 p-2 rounded-md group-hover:bg-zinc-700">
              <Wand2 className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-zinc-200 font-medium text-sm">
                Remove Silence
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Automatically detect and cut out silent pauses from your clips.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
