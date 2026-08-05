import { X } from "lucide-react";

const SHORTCUTS: [string, string][] = [
  ["?", "Show this help"],
  ["Space", "Play / pause"],
  ["J", "Previous caption"],
  ["K", "Next caption"],
  ["⌘ / Ctrl + K", "Search captions"],
  ["⌘ / Ctrl + S", "Save changes"],
  ["Esc", "Close dialogs"],
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-border/60">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-mono">{k}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
