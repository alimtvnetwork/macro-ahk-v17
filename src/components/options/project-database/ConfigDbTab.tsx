/* eslint-disable @typescript-eslint/no-explicit-any, max-lines-per-function -- untyped extension message types */
/**
 * ConfigDbTab — ProjectConfig inline editor
 *
 * Reads all ProjectConfig rows from the project-scoped SQLite DB
 * and allows inline editing of values, grouped by Section.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sendMessage } from "@/lib/message-client";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, RefreshCw, Loader2,
  Settings2, Save, RotateCcw,
} from "lucide-react";

interface ConfigRow {
  Id: number;
  Section: string;
  Key: string;
  Value: string;
  ValueType: string;
  UpdatedAt: string;
}

interface ConfigDbTabProps {
  projectSlug: string;
}
export function ConfigDbTab({ projectSlug }: ConfigDbTabProps) {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await sendMessage<{ isOk: boolean; rows?: ConfigRow[]; errorMessage?: string }>({
        type: "PROJECT_CONFIG_READ" as any,
        project: projectSlug,
      } as any);
      if (resp.isOk && resp.rows) {
        setRows(resp.rows);
        setEdits({});
      } else {
        toast.error(resp.errorMessage || "Failed to read config");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const editKey = (section: string, key: string) => `${section}::${key}`;

  const handleSave = async (row: ConfigRow) => {
    const ek = editKey(row.Section, row.Key);
    const newValue = edits[ek];
    if (newValue === undefined || newValue === row.Value) return;

    setSaving(ek);
    try {
      const resp = await sendMessage<{ isOk: boolean; errorMessage?: string }>({
        type: "PROJECT_CONFIG_UPDATE" as any,
        project: projectSlug,
        section: row.Section,
        key: row.Key,
        value: newValue,
      } as any);
      if (resp.isOk) {
        toast.success(`Updated ${row.Section}.${row.Key}`);
        setEdits((prev) => {
          const next = { ...prev };
          delete next[ek];
          return next;
        });
        void load();
      } else {
        toast.error(resp.errorMessage || "Update failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  /** Save all pending edits in one batch */
  const handleBulkSave = async () => {
    const dirtyEntries = Object.entries(edits).filter(([ek, val]) => {
      const row = rows.find((r) => editKey(r.Section, r.Key) === ek);
      return row && val !== row.Value;
    });
    if (dirtyEntries.length === 0) return;

    setBulkSaving(true);
    let saved = 0;
    let failed = 0;
    for (const [ek, val] of dirtyEntries) {
      const [section, key] = ek.split("::");
      try {
        const resp = await sendMessage<{ isOk: boolean }>({
          type: "PROJECT_CONFIG_UPDATE" as any,
          project: projectSlug,
          section,
          key,
          value: val,
        } as any);
        if (resp.isOk) saved++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkSaving(false);
    if (failed > 0) {
      toast.warning(`Saved ${saved}, failed ${failed}`);
    } else {
      toast.success(`Saved ${saved} config value${saved !== 1 ? "s" : ""}`);
    }
    setEdits({});
    void load();
  };

  const handleReconstruct = async () => {
    setLoading(true);
    try {
      const resp = await sendMessage<{ isOk: boolean; errorMessage?: string }>({
        type: "PROJECT_CONFIG_RECONSTRUCT" as any,
        project: projectSlug,
      } as any);
      if (resp.isOk) {
        toast.success("Config reconstructed from source");
        void load();
      } else {
        toast.error(resp.errorMessage || "Reconstruct failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reconstruct failed");
    } finally {
      setLoading(false);
    }
  };

  // Group by section
  const sections = rows.reduce<Record<string, ConfigRow[]>>((acc, row) => {
    (acc[row.Section] ??= []).push(row);
    return acc;
  }, {});

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggleSection = (s: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
      return next;
    });
  };

  const pendingCount = Object.keys(edits).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Config (DB)</span>
          <Badge variant="outline" className="text-[10px]">
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {pendingCount} unsaved
            </Badge>
          )}
        </div>
        <div className="flex gap-1.5">
          {pendingCount > 0 && (
            <Button
              size="sm"
              onClick={() => void handleBulkSave()}
              disabled={bulkSaving}
              className="h-7 text-xs gap-1"
            >
              {bulkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save All ({pendingCount})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleReconstruct()}
            disabled={loading}
            className="h-7 text-xs gap-1"
            title="Re-seed config from source JSON (overwrites DB)"
          >
            <RotateCcw className="h-3 w-3" /> Re-seed
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-7 text-xs gap-1"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 && (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading config…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Settings2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p>No config rows found.</p>
          <p className="text-xs mt-1">Config is seeded automatically when a script with a config binding is injected.</p>
        </div>
      )}
      {Object.entries(sections).map(([section, sectionRows]) => (
        <Collapsible
          key={section}
          open={openSections.has(section)}
          onOpenChange={() => toggleSection(section)}
        >
          <div className="border rounded-md">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent/50 transition-colors text-left">
                {openSections.has(section) ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="text-xs font-mono font-semibold">{section}</span>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {sectionRows.length}
                </Badge>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t divide-y">
                {sectionRows.map((row) => {
                  const ek = editKey(row.Section, row.Key);
                  const currentValue = edits[ek] ?? row.Value;
                  const isDirty = edits[ek] !== undefined && edits[ek] !== row.Value;
                  const isSaving = saving === ek;

                  return (
                    <div key={ek} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[11px] font-mono text-muted-foreground w-36 shrink-0 truncate" title={row.Key}>
                        {row.Key}
                      </span>
                      <Input
                        value={currentValue}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [ek]: e.target.value }))}
                        className="h-6 text-[11px] font-mono flex-1"
                      />
                      <Badge variant="outline" className="text-[8px] shrink-0 w-12 justify-center">
                        {row.ValueType}
                      </Badge>
                      {isDirty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleSave(row)}
                          disabled={isSaving}
                          className="h-6 w-6 p-0"
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
