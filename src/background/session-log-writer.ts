/**
 * Marco Extension — Session Log File Writer
 *
 * Writes human-readable log files to OPFS alongside SQLite storage.
 * Each session gets a directory: session-logs/session-{id}/
 * containing:
 *   - events.log    — all log entries (appended in real-time)
 *   - errors.log    — all error entries
 *   - scripts.log   — script loading/injection lifecycle
 *   - summary.log   — header with session metadata (written on-demand)
 *
 * @see spec/05-chrome-extension/06-logging-architecture.md
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LogLine {
    level: string;
    source: string;
    category: string;
    action: string;
    detail: string;
    scriptId?: string;
    projectId?: string;
    configId?: string;
}

interface ErrorLine {
    level: string;
    source: string;
    category: string;
    errorCode: string;
    message: string;
    stackTrace?: string;
    context?: string;
    scriptId?: string;
    scriptFile?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LOGS_DIR_NAME = "session-logs";
const SESSION_PREFIX = "session-";
const EVENTS_LOG = "events.log";
const ERRORS_LOG = "errors.log";
const SCRIPTS_LOG = "scripts.log";
const LOG_SEPARATOR = "============================================================";

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let sessionDir: FileSystemDirectoryHandle | null = null;
let sessionId: string | null = null;
let version: string = "0.0.0";
let sessionStartedAt: string = "";

// Buffered writers — we append to the same files
const fileHandleCache = new Map<string, FileSystemFileHandle>();
const pendingWrites = new Map<string, string[]>();
let flushScheduled = false;

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

/** Creates a new session directory in OPFS and prepares file handles. */
export async function initSessionLogDir(sid: string, ver: string): Promise<void> {
    sessionId = sid;
    version = ver;
    sessionStartedAt = new Date().toISOString();

    try {
        const root = await navigator.storage.getDirectory();
        const logsRoot = await root.getDirectoryHandle(LOGS_DIR_NAME, { create: true });
        sessionDir = await logsRoot.getDirectoryHandle(`${SESSION_PREFIX}${sid}`, { create: true });

        // Write initial header to events.log
        const header = [
            LOG_SEPARATOR,
            `  Marco Session Log — Session #${sid}`,
            `  Started:  ${sessionStartedAt}`,
            `  Version:  ${ver}`,
            `  Platform: ${navigator.userAgent}`,
            LOG_SEPARATOR,
            "",
        ].join("\n");

        await appendToFile(EVENTS_LOG, header);
        await appendToFile(ERRORS_LOG, [
            `=== Errors — Session #${sid} — ${sessionStartedAt} ===`,
            "",
        ].join("\n"));
        await appendToFile(SCRIPTS_LOG, [
            `=== Script Lifecycle — Session #${sid} — ${sessionStartedAt} ===`,
            "",
        ].join("\n"));

        console.log(`[session-log-writer] Initialized OPFS dir "opfs-root/${LOGS_DIR_NAME}/${SESSION_PREFIX}${sid}/" with files: [${EVENTS_LOG}, ${ERRORS_LOG}, ${SCRIPTS_LOG}]`);

        // Fire-and-forget: prune old sessions on each new session start
        void pruneOldSessionLogs();
    } catch (err) {
        const absDir = `opfs-root/${LOGS_DIR_NAME}/${SESSION_PREFIX}${sid}`;
        const errDetail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.warn(`[session-log-writer::initSessionDir] OPFS dir init failed at "${absDir}" (${errDetail}). Expected files: [${absDir}/${EVENTS_LOG}, ${absDir}/${ERRORS_LOG}, ${absDir}/${SCRIPTS_LOG}]`);
        sessionDir = null;
    }
}

/* ------------------------------------------------------------------ */
/*  Write helpers                                                      */
/* ------------------------------------------------------------------ */

/** Appends text to a file in the session directory. Buffered + debounced. */
async function appendToFile(filename: string, text: string): Promise<void> {
    if (!sessionDir) return;

    const existing = pendingWrites.get(filename) ?? [];
    existing.push(text);
    pendingWrites.set(filename, existing);

    if (!flushScheduled) {
        flushScheduled = true;
        // Microtask-batch: flush after current call stack clears
        setTimeout(() => void flushPending(), 100);
    }
}

/** Flushes all pending writes to OPFS files. */
async function flushPending(): Promise<void> {
    flushScheduled = false;
    if (!sessionDir) return;

    const entries = Array.from(pendingWrites.entries());
    pendingWrites.clear();

    for (const [filename, chunks] of entries) {
        try {
            let handle = fileHandleCache.get(filename);
            if (!handle) {
                handle = await sessionDir.getFileHandle(filename, { create: true });
                fileHandleCache.set(filename, handle);
            }

            const writable = await handle.createWritable({ keepExistingData: true });
            const file = await handle.getFile();
            // Seek to end
            await writable.seek(file.size);
            const content = chunks.join("");
            await writable.write(content);
            await writable.close();
        } catch (err) {
            const absPath = `opfs-root/${LOGS_DIR_NAME}/${SESSION_PREFIX}${sessionId}/${filename}`;
            const errDetail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            console.warn(`[session-log-writer::flushPending] Failed to write "${absPath}" (${errDetail})`);
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

function ts(): string {
    return new Date().toISOString();
}

function formatLogLine(msg: LogLine): string {
    const t = ts();
    const lvl = (msg.level ?? "INFO").toUpperCase().padEnd(5);
    const src = (msg.source ?? "—").padEnd(12);
    const cat = (msg.category ?? "").padEnd(12);
    const act = msg.action ?? "";
    const det = msg.detail ?? "";
    const sid = msg.scriptId ? ` [${msg.scriptId}]` : "";
    return `${t}  ${lvl}  ${src}  ${cat}  ${act}${sid}  ${det}\n`;
}

function formatErrorLine(msg: ErrorLine): string {
    const t = ts();
    const lvl = (msg.level ?? "ERROR").toUpperCase().padEnd(5);
    const src = (msg.source ?? "—").padEnd(12);
    const code = msg.errorCode ?? "UNKNOWN";
    const m = msg.message ?? "";
    const file = msg.scriptFile ? ` [${msg.scriptFile}]` : "";
    const stack = msg.stackTrace ? `\n    Stack: ${msg.stackTrace}` : "";
    const ctx = msg.context ? `\n    Context: ${msg.context}` : "";
    return `${t}  ${lvl}  ${src}  ${code}${file}  ${m}${stack}${ctx}\n`;
}

/* ------------------------------------------------------------------ */
/*  Public API — called from logging-handler.ts                        */
/* ------------------------------------------------------------------ */

/** Appends a log entry to events.log (and scripts.log if injection-related). */
export function writeLogEntry(msg: LogLine): void {
    const line = formatLogLine(msg);
    void appendToFile(EVENTS_LOG, line);

    // Also log injection & script lifecycle events to scripts.log
    const cat = (msg.category ?? "").toUpperCase();
    if (cat === "INJECTION" || cat === "SCRIPT" || cat === "BOOTSTRAP" || cat === "RESOLVE") {
        void appendToFile(SCRIPTS_LOG, line);
    }
}

/** Appends an error entry to errors.log and events.log. */
export function writeErrorEntry(msg: ErrorLine): void {
    const line = formatErrorLine(msg);
    void appendToFile(ERRORS_LOG, line);
    void appendToFile(EVENTS_LOG, line);
}

/* ------------------------------------------------------------------ */
/*  Session report reader                                              */
/* ------------------------------------------------------------------ */

/** Reads all session log files and builds a comprehensive report string. */
export async function buildSessionReport(sid?: string): Promise<string> {
    const targetSid = sid ?? sessionId;
    if (!targetSid) {
        return "[session-log-writer] No active session.";
    }

    const sessionDirPath = `${LOGS_DIR_NAME}/${SESSION_PREFIX}${targetSid}`;
    const absoluteSessionDirPath = `opfs-root/${sessionDirPath}`;
    const expectedFiles = [EVENTS_LOG, ERRORS_LOG, SCRIPTS_LOG] as const;
    const expectedAbsolutePaths = expectedFiles.map((filename) => `${absoluteSessionDirPath}/${filename}`);

    try {
        const root = await navigator.storage.getDirectory();
        const logsRoot = await root.getDirectoryHandle(LOGS_DIR_NAME);
        const dir = await logsRoot.getDirectoryHandle(`${SESSION_PREFIX}${targetSid}`);

        const sections: string[] = [];
        const found: string[] = [];
        const missing: string[] = [];

        // Read each log file
        for (const filename of expectedFiles) {
            try {
                const handle = await dir.getFileHandle(filename);
                const file = await handle.getFile();
                const text = await file.text();
                if (text.trim()) {
                    sections.push(text);
                }
                found.push(`${absoluteSessionDirPath}/${filename}`);
            } catch {
                missing.push(`${absoluteSessionDirPath}/${filename}`);
            }
        }

        if (sections.length === 0) {
            const missingList = missing.length > 0 ? ` Missing files: [${missing.join(", ")}].` : "";
            const foundList = found.length > 0 ? ` Found but empty: [${found.join(", ")}].` : "";
            return `[session-log-writer] Session #${targetSid} has no readable log data at dir "${absoluteSessionDirPath}".${missingList}${foundList}`;
        }

        const ver = version || "?";
        const header = [
            LOG_SEPARATOR,
            `  Marco Full Session Report`,
            `  Session:   #${targetSid}`,
            `  Generated: ${new Date().toISOString()}`,
            `  Version:   ${ver}`,
            LOG_SEPARATOR,
            "",
        ].join("\n");

        return header + sections.join("\n\n");
    } catch (err) {
        const errName = err instanceof DOMException ? err.name : "UnknownError";
        const errMsg = err instanceof Error ? err.message : String(err);
        return `[session-log-writer] Failed to read session #${targetSid} at OPFS dir "${absoluteSessionDirPath}" (${errName}: ${errMsg}). Expected file paths: [${expectedAbsolutePaths.join(", ")}]. Cause: The session directory was likely pruned or never created.`;
    }
}

/** Purges session directories older than `maxAgeDays`. */
export async function pruneOldSessionLogs(maxAgeDays = 7): Promise<number> {
    let removed = 0;
    try {
        const root = await navigator.storage.getDirectory();
        const logsRoot = await root.getDirectoryHandle(LOGS_DIR_NAME);
        const cutoff = Date.now() - maxAgeDays * 86_400_000;
        const toDelete: string[] = [];

        const entries = (logsRoot as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)[Symbol.asyncIterator]();
        for await (const [name, handle] of { [Symbol.asyncIterator]: () => entries }) {
            if (handle.kind !== "directory" || !name.startsWith(SESSION_PREFIX)) continue;
            // Check events.log modification time as proxy for session age
            try {
                const dir = await logsRoot.getDirectoryHandle(name);
                const fh = await dir.getFileHandle(EVENTS_LOG);
                const file = await fh.getFile();
                if (file.lastModified < cutoff) {
                    toDelete.push(name);
                }
            } catch {
                // No events.log at "opfs-root/session-logs/{name}/events.log" → stale dir, mark for deletion
                toDelete.push(name);
            }
        }

        for (const name of toDelete) {
            await logsRoot.removeEntry(name, { recursive: true });
            removed++;
        }

        if (removed > 0) {
            console.log(`[session-log-writer] Pruned ${removed} session dirs from "opfs-root/${LOGS_DIR_NAME}/" older than ${maxAgeDays}d`);
        }
    } catch (err) {
        const errDetail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.warn(`[session-log-writer::pruneOldSessionLogs] Pruning failed at "opfs-root/${LOGS_DIR_NAME}/" (${errDetail})`);
    }
    return removed;
}

/** Lists all available session IDs from OPFS. */
export async function listSessionIds(): Promise<string[]> {
    try {
        const root = await navigator.storage.getDirectory();
        const logsRoot = await root.getDirectoryHandle(LOGS_DIR_NAME);
        const ids: string[] = [];

        const entries = (logsRoot as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)[Symbol.asyncIterator]();
        for await (const [name, handle] of { [Symbol.asyncIterator]: () => entries }) {
            if (handle.kind === "directory" && name.startsWith(SESSION_PREFIX)) {
                ids.push(name.replace(SESSION_PREFIX, ""));
            }
        }

        return ids.sort((a, b) => Number(b) - Number(a));
    } catch {
        return [];
    }
}

/* ------------------------------------------------------------------ */
/*  OPFS Session Browser                                               */
/* ------------------------------------------------------------------ */

interface SessionFileInfo {
    name: string;
    absolutePath: string;
    sizeBytes: number;
    lastModified: string;
}

interface SessionDirInfo {
    sessionId: string;
    absolutePath: string;
    files: SessionFileInfo[];
    totalSizeBytes: number;
}

/** Browses all OPFS session directories and returns file metadata with absolute paths. */
export async function browseOpfsSessions(): Promise<{
    rootPath: string;
    sessions: SessionDirInfo[];
    totalSessions: number;
}> {
    const rootPath = `opfs-root/${LOGS_DIR_NAME}`;
    const sessions: SessionDirInfo[] = [];

    try {
        const root = await navigator.storage.getDirectory();
        const logsRoot = await root.getDirectoryHandle(LOGS_DIR_NAME);

        const dirEntries = (logsRoot as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)[Symbol.asyncIterator]();
        for await (const [name, handle] of { [Symbol.asyncIterator]: () => dirEntries }) {
            if (handle.kind !== "directory" || !name.startsWith(SESSION_PREFIX)) continue;

            const sid = name.replace(SESSION_PREFIX, "");
            const absoluteDirPath = `${rootPath}/${name}`;
            const files: SessionFileInfo[] = [];
            let totalSizeBytes = 0;

            try {
                const dir = await logsRoot.getDirectoryHandle(name);
                const fileEntries = (dir as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)[Symbol.asyncIterator]();
                for await (const [fileName, fileHandle] of { [Symbol.asyncIterator]: () => fileEntries }) {
                    if (fileHandle.kind !== "file") continue;
                    try {
                        const fh = await dir.getFileHandle(fileName);
                        const file = await fh.getFile();
                        const sizeBytes = file.size;
                        totalSizeBytes += sizeBytes;
                        files.push({
                            name: fileName,
                            absolutePath: `${absoluteDirPath}/${fileName}`,
                            sizeBytes,
                            lastModified: new Date(file.lastModified).toISOString(),
                        });
                    } catch {
                        files.push({
                            name: fileName,
                            absolutePath: `${absoluteDirPath}/${fileName}`,
                            sizeBytes: 0,
                            lastModified: "unknown",
                        });
                    }
                }
            } catch {
                // Directory exists but can't be read
            }

            sessions.push({ sessionId: sid, absolutePath: absoluteDirPath, files, totalSizeBytes });
        }
    } catch {
        // OPFS root or session-logs dir doesn't exist
    }

    sessions.sort((a, b) => Number(b.sessionId) - Number(a.sessionId));
    return { rootPath, sessions, totalSessions: sessions.length };
}
