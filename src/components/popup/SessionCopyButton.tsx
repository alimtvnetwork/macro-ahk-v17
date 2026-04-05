import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ClipboardCopy, Check, Loader2 } from "lucide-react";
import { sendMessage } from "@/lib/message-client";
import { toast } from "sonner";

/** Unified log entry supporting both camelCase (normalized) and PascalCase (raw SQLite) field names. */
interface SessionLog {
  id: number;
  session_id: string;
  timestamp?: string;  Timestamp?: string;
  level?: string;      Level?: string;
  source?: string;     Source?: string;
  category?: string;   Category?: string;
  action?: string;     Action?: string;
  detail?: string;     Detail?: string;
  error_code?: string; ErrorCode?: string;
  message?: string;    Message?: string;
  stack_trace?: string; StackTrace?: string;
  context?: string;    Context?: string;
  script_id?: string;  ScriptId?: string;
  project_id?: string;
  config_id?: string;
  script_file?: string; ScriptFile?: string;
  ext_version?: string;
}

interface SessionLogsResponse {
  sessionId: string;
  logs: SessionLog[];
  errors: SessionLog[];
}

function formatLogEntry(entry: SessionLog): string {
  const ts = entry.timestamp ?? entry.Timestamp ?? "";
  const level = ((entry.level ?? entry.Level ?? "info") as string).toUpperCase().padEnd(5);
  const source = entry.source ?? entry.Source ?? "—";
  const action = entry.action ?? entry.Action ?? "";
  const detail = entry.detail ?? entry.Detail ?? "";
  const msg = entry.message ?? entry.Message ?? "";
  const text = action ? `[${entry.category ?? entry.Category ?? ""}] ${action}: ${detail}` : msg;

  return `${ts}  ${level}  ${source}  ${text}`;
}

function formatErrorEntry(entry: SessionLog): string {
  const ts = entry.timestamp ?? entry.Timestamp ?? "";
  const level = ((entry.level ?? entry.Level ?? "error") as string).toUpperCase().padEnd(5);
  const code = entry.error_code ?? entry.ErrorCode ?? "UNKNOWN";
  const msg = entry.message ?? entry.Message ?? "";
  const scriptFile = entry.script_file ?? entry.ScriptFile;
  const file = scriptFile ? ` [${scriptFile}]` : "";
  const stackVal = entry.stack_trace ?? entry.StackTrace;
  const stack = stackVal ? `\n    Stack: ${stackVal}` : "";
  const ctxVal = entry.context ?? entry.Context;
  const ctx = ctxVal ? `\n    Context: ${ctxVal}` : "";

  return `${ts}  ${level}  ${code}${file}  ${msg}${stack}${ctx}`;
}

function getExtensionVersion(): string {
  try {
    const g = globalThis as { chrome?: { runtime?: { getManifest?: () => { version?: string } } } };
    return g.chrome?.runtime?.getManifest?.().version ?? "?";
  } catch { return "?"; }
}

function buildReport(data: SessionLogsResponse): string {
  const version = getExtensionVersion();
  const header = [
    "═══════════════════════════════════════════",
    `  Marco Session Report`,
    `  Session: ${data.sessionId}`,
    `  Generated: ${new Date().toISOString()}`,
    `  Version: ${version}`,
    `  Logs: ${data.logs.length}  |  Errors: ${data.errors.length}`,
    "═══════════════════════════════════════════",
  ].join("\n");

  const logsSection = data.logs.length > 0
    ? "\n\n── LOGS ──────────────────────────────────\n" +
      data.logs.map(formatLogEntry).join("\n")
    : "\n\n── LOGS ──────────────────────────────────\n(no logs)";

  const errorsSection = data.errors.length > 0
    ? "\n\n── ERRORS ────────────────────────────────\n" +
      data.errors.map(formatErrorEntry).join("\n\n")
    : "\n\n── ERRORS ────────────────────────────────\n(no errors)";

  return header + logsSection + errorsSection + "\n";
}

// eslint-disable-next-line max-lines-per-function -- button with loading/copied states + report fetch
export function SessionCopyButton() {
  const [state, setState] = useState<"idle" | "loading" | "copied">("idle");

  const handleCopy = useCallback(async () => {
    setState("loading");

    try {
      // Try the new file-based session report first
      let report: string;
      try {
        const fileReport = await sendMessage<{ report: string; sessionId: string }>({
          type: "GET_SESSION_REPORT",
        });
        report = fileReport.report;
      } catch {
        // Fallback to legacy SQLite-only report
        const data = await sendMessage<SessionLogsResponse>({
          type: "GET_SESSION_LOGS",
        });
        report = buildReport(data);
      }

      await navigator.clipboard.writeText(report);

      setState("copied");
      toast.success("Session report copied to clipboard");

      setTimeout(() => setState("idle"), 2000);
    } catch (copyError) {
      setState("idle");
      const msg = copyError instanceof Error ? copyError.message : "Copy failed";
      toast.error(msg);
    }
  }, []);

  const isLoading = state === "loading";
  const isCopied = state === "copied";
  const isIdle = state === "idle";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px] gap-1.5 hover:bg-primary/15 hover:text-primary"
          onClick={handleCopy}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          {isCopied && <Check className="h-3 w-3 text-primary" />}
          {isIdle && <ClipboardCopy className="h-3 w-3" />}
          {isCopied ? "Copied!" : "Copy Session Logs"}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs max-w-[200px]">
          Copy all logs and errors from the current session (since injection) to clipboard with full stack traces
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
