import React, { useState, useEffect, useMemo } from "react";
import {
  ALL_RAW_PRESETS,
  getDeletedTemplateNames,
  deleteTemplatePermanently,
  restoreTemplate,
  isTemplateDeleted,
  normalizeCapStyle,
  captionSpanStyle,
  DEFAULT_CAP_STYLE,
  type CapPresetEntry,
} from "@/lib/captionStyle";
import { toast } from "sonner";
import { Search, Trash2, RotateCcw, Sparkles, Filter, CheckCircle2, EyeOff, Layers } from "lucide-react";

export function TemplatesManager() {
  const [search, setSearch] = useState("");
  const [packFilter, setPackFilter] = useState<"All" | "Kalakar" | "Captik" | "Studio">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Deleted">("All");
  const [deletedSet, setDeletedSet] = useState<Set<string>>(new Set(getDeletedTemplateNames()));

  // Sync deleted templates state on update
  useEffect(() => {
    const handleUpdate = () => {
      setDeletedSet(new Set(getDeletedTemplateNames()));
    };
    window.addEventListener("templates:updated", handleUpdate);
    return () => window.removeEventListener("templates:updated");
  }, []);

  const handleDelete = (name: string) => {
    if (confirm(`Are you sure you want to delete / hide the template "${name}" from users?`)) {
      deleteTemplatePermanently(name);
      setDeletedSet(new Set(getDeletedTemplateNames()));
      toast.success(`Template "${name}" has been deleted / hidden.`);
    }
  };

  const handleRestore = (name: string) => {
    restoreTemplate(name);
    setDeletedSet(new Set(getDeletedTemplateNames()));
    toast.success(`Template "${name}" has been restored and is now visible to users.`);
  };

  const handleRestoreAll = () => {
    if (confirm("Restore all deleted / hidden templates?")) {
      const deleted = getDeletedTemplateNames();
      deleted.forEach((name) => restoreTemplate(name));
      setDeletedSet(new Set());
      toast.success("All templates restored successfully.");
    }
  };

  const filtered = useMemo(() => {
    return ALL_RAW_PRESETS.filter((p) => {
      const isDel = deletedSet.has(p.name);

      // Status filter
      if (statusFilter === "Active" && isDel) return false;
      if (statusFilter === "Deleted" && !isDel) return false;

      // Pack filter
      const isKalakar = p.name.startsWith("Kalakar ·");
      const isCaptik = p.name.startsWith("Captik ·");
      const isStudio = !isKalakar && !isCaptik;

      if (packFilter === "Kalakar" && !isKalakar) return false;
      if (packFilter === "Captik" && !isCaptik) return false;
      if (packFilter === "Studio" && !isStudio) return false;

      // Search filter
      const q = search.trim().toLowerCase();
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCat = p.category?.toLowerCase().includes(q);
        const matchesFeature = p.feature?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesFeature) return false;
      }

      return true;
    });
  }, [search, packFilter, statusFilter, deletedSet]);

  const totalCount = ALL_RAW_PRESETS.length;
  const deletedCount = deletedSet.size;
  const activeCount = totalCount - deletedCount;

  return (
    <div className="space-y-6 text-[#BBB]">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111] border border-[#222]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Total Templates</p>
          <p className="text-2xl font-black text-white mt-1">{totalCount}</p>
          <p className="text-xs text-[#888] mt-1">50 Studio + 72 Captik + 43 Kalakar</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111] border border-[#222]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Active Templates</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</p>
          <p className="text-xs text-[#888] mt-1">Available in editor &amp; gallery</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111] border border-[#222]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Deleted / Hidden</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{deletedCount}</p>
          <p className="text-xs text-[#888] mt-1">Excluded from user app</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111] border border-[#222] flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Batch Actions</p>
            <p className="text-xs text-[#888] mt-1">Quick admin maintenance</p>
          </div>
          {deletedCount > 0 && (
            <button
              onClick={handleRestoreAll}
              className="mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore All ({deletedCount})
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#111] border border-[#222]">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            placeholder="Search by name, pack, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#333] focus:border-[#E60000] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#666] outline-none transition"
          />
        </div>

        {/* Pack Selector */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(["All", "Kalakar", "Captik", "Studio"] as const).map((pack) => (
            <button
              key={pack}
              onClick={() => setPackFilter(pack)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                packFilter === pack
                  ? "bg-[#E60000] text-white"
                  : "bg-[#1A1A1A] text-[#888] hover:text-white border border-[#2A2A2A]"
              }`}
            >
              {pack === "All" ? `All (${totalCount})` :
               pack === "Kalakar" ? `Kalakar (43)` :
               pack === "Captik" ? `Captik (72)` :
               `Studio (50)`}
            </button>
          ))}
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-1.5">
          {(["All", "Active", "Deleted"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === status
                  ? "bg-white text-black"
                  : "bg-[#1A1A1A] text-[#888] hover:text-white border border-[#2A2A2A]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Table / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((template, idx) => {
          const isDel = deletedSet.has(template.name);
          const style = normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...template.patch });
          const isKalakar = template.name.startsWith("Kalakar ·");
          const isCaptik = template.name.startsWith("Captik ·");
          const packLabel = isKalakar ? "Kalakar" : isCaptik ? "Captik" : "Studio Pack";

          return (
            <div
              key={template.name}
              className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                isDel
                  ? "bg-[#120808] border-rose-950/60 opacity-70"
                  : "bg-[#111] border-[#222] hover:border-[#333]"
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#222] text-[#AAA] border border-[#333]">
                      {packLabel}
                    </span>
                    <h4 className="text-white font-bold text-sm mt-1.5 truncate" title={template.name}>
                      {template.name}
                    </h4>
                    {template.category && (
                      <p className="text-xs text-[#777] mt-0.5">{template.category}</p>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                      isDel
                        ? "bg-rose-950/80 text-rose-400 border border-rose-800/50"
                        : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                    }`}
                  >
                    {isDel ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Deleted
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </>
                    )}
                  </span>
                </div>

                {/* Visual Preview Box */}
                <div
                  className="mt-3 h-20 rounded-lg bg-[#08080C] border border-[#1A1A22] flex items-center justify-center p-2 overflow-hidden text-center"
                >
                  <span
                    style={{
                      fontFamily: style.fontFamily,
                      fontWeight: style.fontWeight,
                      fontSize: "18px",
                      color: style.activeWordOn ? style.activeWordColor : style.color,
                      textTransform: style.textCase === "upper" ? "uppercase" : "none",
                      textShadow: style.glowOn ? `0 0 10px ${style.glowColor}` : "0 2px 4px rgba(0,0,0,0.8)",
                      background: style.activeWordBgOn ? style.activeWordBgColor : "transparent",
                      padding: style.activeWordBgOn ? "2px 6px" : "0",
                      borderRadius: style.activeWordBgOn ? "4px" : "0",
                    }}
                  >
                    {template.cleanName || "VIRAL CAPTION"}
                  </span>
                </div>

                {/* Features & Details */}
                <div className="mt-3 text-[11px] text-[#777] space-y-1">
                  <div className="flex justify-between">
                    <span>Font:</span>
                    <span className="text-[#AAA] font-medium">{style.fontFamily.split(",")[0].replace(/'/g, "")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Animation:</span>
                    <span className="text-[#AAA] font-medium">{style.transition} ({style.transitionSpeed}ms)</span>
                  </div>
                  {template.feature && (
                    <p className="text-[11px] text-[#666] italic mt-1 truncate" title={template.feature}>
                      {template.feature}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between">
                <span className="text-[11px] text-[#555]">
                  #{idx + 1}
                </span>

                {isDel ? (
                  <button
                    onClick={() => handleRestore(template.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 text-xs font-bold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(template.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/80 border border-rose-800/40 text-rose-400 hover:text-white text-xs font-bold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center rounded-xl bg-[#111] border border-[#222]">
          <p className="text-white font-bold text-base">No templates found</p>
          <p className="text-xs text-[#777] mt-1">Try adjusting your search query or filter settings.</p>
        </div>
      )}
    </div>
  );
}
