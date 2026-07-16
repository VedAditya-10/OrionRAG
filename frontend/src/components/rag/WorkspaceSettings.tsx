import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Settings2,
  X,
  Save,
  RotateCcw,
  Plus,
  Globe,
  Tags,
  Cpu,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { KnowledgeBase, UpdateWorkspace } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS = [
  { value: "", label: "Default (from server)" },
  { value: "English", label: "English" },
  { value: "Vietnamese", label: "Vietnamese" },
  { value: "Chinese", label: "Chinese" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Spanish", label: "Spanish" },
];

const DEFAULT_ENTITY_TYPES = [
  "Organization", "Person", "Product", "Location", "Event",
  "Financial_Metric", "Technology", "Date", "Regulation",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkspaceSettingsProps {
  workspace: KnowledgeBase;
  onSave: (data: UpdateWorkspace) => Promise<void>;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Tag Input (for entity types)
// ---------------------------------------------------------------------------

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const trimmed = value.trim().replace(/\s+/g, "_");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 min-h-[40px] rounded-md border border-input bg-background cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/20"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            className="hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? placeholder : "Add type..."}
        className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkspaceSettings({
  workspace,
  onSave,
  open,
  onClose,
}: WorkspaceSettingsProps) {
  const [activeTab, setActiveTab] = useState<"kg" | "mcp">("kg");
  const [language, setLanguage] = useState(workspace.kg_language ?? "");
  const [entityTypes, setEntityTypes] = useState<string[]>(
    workspace.kg_entity_types ?? []
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync when workspace changes
  useEffect(() => {
    setLanguage(workspace.kg_language ?? "");
    setEntityTypes(workspace.kg_entity_types ?? []);
  }, [workspace.kg_language, workspace.kg_entity_types]);

  const hasChanges =
    language !== (workspace.kg_language ?? "") ||
    JSON.stringify(entityTypes) !== JSON.stringify(workspace.kg_entity_types ?? []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        kg_language: language || null,
        kg_entity_types: entityTypes.length > 0 ? entityTypes : null,
      });
      toast.success("Workspace settings saved");
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [language, entityTypes, onSave, onClose]);

  const handleReset = () => {
    setLanguage("");
    setEntityTypes([]);
  };

  const handleLoadDefaults = () => {
    setEntityTypes(DEFAULT_ENTITY_TYPES);
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Workspace Settings</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-3 text-xs bg-muted/20 flex-shrink-0">
        <button
          type="button"
          className={cn(
            "py-2 px-3 border-b-2 font-medium transition-colors cursor-pointer",
            activeTab === "kg"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("kg")}
        >
          Knowledge Graph Settings
        </button>
        <button
          type="button"
          className={cn(
            "py-2 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
            activeTab === "mcp"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("mcp")}
        >
          <Cpu className="w-3.5 h-3.5" />
          AI IDE Integration (MCP)
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {activeTab === "kg" ? (
          <>
            {/* KG Language */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Globe className="w-3.5 h-3.5" />
                KG Language
              </label>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-8 text-xs bg-background"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Language used for KG entity extraction. Empty = server default.
              </p>
            </div>

            {/* KG Entity Types */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tags className="w-3.5 h-3.5" />
                  KG Entity Types
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadDefaults}
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                >
                  <Plus className="w-3 h-3 mr-0.5" />
                  Load defaults
                </Button>
              </div>
              <TagInput
                tags={entityTypes}
                onChange={setEntityTypes}
                placeholder="Organization, Person, Product..."
              />
              <p className="text-[10px] text-muted-foreground">
                Entity types for Knowledge Graph extraction. Press Enter or comma to add. Empty = server default.
              </p>
            </div>

            {/* Info box */}
            <div className="rounded-md border border-blue-400/20 bg-blue-400/5 p-2.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                These settings affect how documents are processed in this workspace.
                Changes apply to newly analyzed documents — existing documents keep
                their current KG data. Re-analyze documents to apply new settings.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* Status Section */}
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-semibold text-emerald-400">MCP Server Online</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Server running locally at <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">http://localhost:8001/mcp</code>
              </p>
            </div>

            {/* Setup Guides */}
            <div className="space-y-3">
              {/* Cursor Setup */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-foreground">1. Integrate with Cursor IDE</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Connect your RAG workspace directly to Cursor's Composer and Chat interface.
                </p>
                <ol className="text-[11px] text-muted-foreground list-decimal list-inside space-y-0.5 pl-1">
                  <li>Open Cursor settings, go to <span className="text-foreground font-medium">Models &gt; MCP</span>.</li>
                  <li>Click <span className="text-foreground font-medium">+ Add New MCP Server</span>.</li>
                  <li>Set Name to <code className="font-mono text-foreground bg-muted px-0.5">Orion</code>, Type to <code className="font-mono text-foreground bg-muted px-0.5">sse</code>, and URL to:</li>
                </ol>
                <div className="bg-card border p-2 rounded-md font-mono text-[10px] flex items-center justify-between mt-1">
                  <span>http://localhost:8001/mcp</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText("http://localhost:8001/mcp");
                      toast.success("URL copied to clipboard");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Claude Desktop Setup */}
              <div className="space-y-1 pt-1.5">
                <h4 className="text-xs font-semibold text-foreground">2. Integrate with Claude Desktop</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Add this block to your local <code className="font-mono bg-muted px-0.5 text-foreground">claude_desktop_config.json</code> file:
                </p>
                
                <div className="relative mt-1 group">
                  <pre className="bg-card border p-2.5 rounded-md font-mono text-[10px] text-foreground overflow-x-auto">
{`{
  "mcpServers": {
    "orion-rag": {
      "url": "http://localhost:8001/mcp"
    }
  }
}`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 bg-background/50 backdrop-blur-sm opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => {
                      const jsonStr = JSON.stringify({
                        mcpServers: {
                          "orion-rag": {
                            url: "http://localhost:8001/mcp"
                          }
                        }
                      }, null, 2);
                      navigator.clipboard.writeText(jsonStr);
                      setCopied(true);
                      toast.success("Claude Desktop config copied to clipboard");
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t flex-shrink-0">
        {activeTab === "kg" ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 text-xs gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to defaults
            </Button>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs cursor-pointer">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="h-7 text-xs gap-1 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex w-full justify-end">
            <Button size="sm" onClick={onClose} className="h-7 text-xs cursor-pointer">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
