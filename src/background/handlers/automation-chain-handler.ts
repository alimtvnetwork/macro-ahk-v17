/**
 * Marco Extension — Automation Chain Handler (Spec 21)
 *
 * CRUD for AutomationChains stored in each project's SQLite DB.
 * Chains are project-scoped — each project has its own set of chains.
 *
 * @see .lovable/memory/architecture/project-scoped-database.md — Project-scoped DB
 */

import {
    initProjectDb,
    getProjectDb,
    flushProjectDb,
    hasProjectDb,
} from "../project-db-manager";

import { type MessageRequest } from "../../shared/messages";

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const CHAIN_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS AutomationChains (
    Id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectId    TEXT NOT NULL DEFAULT 'default',
    Name         TEXT NOT NULL,
    Slug         TEXT NOT NULL,
    StepsJson    TEXT NOT NULL DEFAULT '[]',
    TriggerType  TEXT NOT NULL DEFAULT 'manual',
    TriggerConfigJson TEXT DEFAULT '{}',
    Enabled      INTEGER NOT NULL DEFAULT 1,
    CreatedAt    TEXT NOT NULL DEFAULT (datetime('now')),
    UpdatedAt    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(ProjectId, Slug)
);
`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getProjectChainDb(projectSlug: string) {
    if (!hasProjectDb(projectSlug)) {
        await initProjectDb(projectSlug);
    }
    const db = getProjectDb(projectSlug);
    db.run(CHAIN_TABLE_DDL);
    return db;
}

function resolveProject(msg: Record<string, unknown>): string {
    return (msg.project as string) || "__system__";
}

interface ChainRow {
    Id: number;
    ProjectId: string;
    Name: string;
    Slug: string;
    StepsJson: string;
    TriggerType: string;
    TriggerConfigJson: string;
    Enabled: number;
    CreatedAt: string;
    UpdatedAt: string;
}

function rowToChain(r: Record<string, unknown>) {
    return {
        id: String(r.Id),
        projectId: (r.ProjectId as string) || "default",
        name: r.Name as string,
        slug: r.Slug as string,
        steps: (() => { try { return JSON.parse(r.StepsJson as string); } catch { return []; } })(),
        triggerType: (r.TriggerType as string) || "manual",
        triggerConfig: (() => { try { return JSON.parse((r.TriggerConfigJson as string) || "{}"); } catch { return {}; } })(),
        enabled: !!(r.Enabled as number),
        createdAt: r.CreatedAt as string,
        updatedAt: r.UpdatedAt as string,
    };
}

/* ------------------------------------------------------------------ */
/*  GET_AUTOMATION_CHAINS                                              */
/* ------------------------------------------------------------------ */

export async function handleGetAutomationChains(msg?: MessageRequest): Promise<unknown> {
    const project = resolveProject((msg ?? {}) as Record<string, unknown>);
    const db = await getProjectChainDb(project);
    const stmt = db.prepare("SELECT * FROM AutomationChains ORDER BY Id");
    const chains: unknown[] = [];
    while (stmt.step()) {
        chains.push(rowToChain(stmt.getAsObject()));
    }
    stmt.free();
    return { isOk: true, chains };
}

/* ------------------------------------------------------------------ */
/*  SAVE_AUTOMATION_CHAIN (create or update)                           */
/* ------------------------------------------------------------------ */

export async function handleSaveAutomationChain(msg: MessageRequest): Promise<unknown> {
    const raw = msg as unknown as Record<string, unknown>;
    const project = resolveProject(raw);
    const chain = raw.chain as Record<string, unknown>;
    if (!chain || !chain.name || !chain.slug) {
        return { isOk: false, errorMessage: "Chain name and slug are required" };
    }

    const db = await getProjectChainDb(project);
    const stepsJson = JSON.stringify(chain.steps ?? []);
    const triggerConfigJson = JSON.stringify(chain.triggerConfig ?? {});
    const triggerType = (chain.triggerType as string) || "manual";
    const enabled = chain.enabled !== false ? 1 : 0;
    const projectId = (chain.projectId as string) || "default";

    if (chain.id) {
        // Update
        db.run(
            `UPDATE AutomationChains
             SET Name = ?, Slug = ?, StepsJson = ?, TriggerType = ?,
                 TriggerConfigJson = ?, Enabled = ?, ProjectId = ?,
                 UpdatedAt = datetime('now')
             WHERE Id = ?`,
            [chain.name, chain.slug, stepsJson, triggerType, triggerConfigJson, enabled, projectId, Number(chain.id)],
        );
    } else {
        // Insert
        db.run(
            `INSERT INTO AutomationChains (ProjectId, Name, Slug, StepsJson, TriggerType, TriggerConfigJson, Enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [projectId, chain.name, chain.slug, stepsJson, triggerType, triggerConfigJson, enabled],
        );
    }

    await flushProjectDb(project);
    return { isOk: true };
}

/* ------------------------------------------------------------------ */
/*  DELETE_AUTOMATION_CHAIN                                            */
/* ------------------------------------------------------------------ */

export async function handleDeleteAutomationChain(msg: MessageRequest): Promise<unknown> {
    const raw = msg as unknown as Record<string, unknown>;
    const project = resolveProject(raw);
    const chainId = raw.chainId as string;
    if (!chainId) {
        return { isOk: false, errorMessage: "Missing chainId" };
    }

    const db = await getProjectChainDb(project);
    db.run("DELETE FROM AutomationChains WHERE Id = ?", [Number(chainId)]);
    await flushProjectDb(project);
    return { isOk: true };
}

/* ------------------------------------------------------------------ */
/*  TOGGLE_AUTOMATION_CHAIN                                            */
/* ------------------------------------------------------------------ */

export async function handleToggleAutomationChain(msg: MessageRequest): Promise<unknown> {
    const raw = msg as unknown as Record<string, unknown>;
    const project = resolveProject(raw);
    const chainId = raw.chainId as string;
    if (!chainId) {
        return { isOk: false, errorMessage: "Missing chainId" };
    }

    const db = await getProjectChainDb(project);
    db.run(
        "UPDATE AutomationChains SET Enabled = CASE WHEN Enabled = 1 THEN 0 ELSE 1 END, UpdatedAt = datetime('now') WHERE Id = ?",
        [Number(chainId)],
    );
    await flushProjectDb(project);
    return { isOk: true };
}

/* ------------------------------------------------------------------ */
/*  IMPORT_AUTOMATION_CHAINS (bulk insert)                             */
/* ------------------------------------------------------------------ */

export async function handleImportAutomationChains(msg: MessageRequest): Promise<unknown> {
    const raw = msg as unknown as Record<string, unknown>;
    const project = resolveProject(raw);
    const chains = raw.chains as Array<Record<string, unknown>>;
    if (!Array.isArray(chains)) {
        return { isOk: false, errorMessage: "Expected chains array" };
    }

    const db = await getProjectChainDb(project);
    let imported = 0;

    for (const c of chains) {
        const name = (c.name as string) || "Imported";
        const slug = (c.slug as string) || `chain-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const stepsJson = JSON.stringify(c.steps ?? []);
        const triggerType = (c.triggerType as string) || "manual";
        const triggerConfigJson = JSON.stringify(c.triggerConfig ?? {});
        const enabled = c.enabled !== false ? 1 : 0;
        const projectId = (c.projectId as string) || "default";

        db.run(
            `INSERT INTO AutomationChains (ProjectId, Name, Slug, StepsJson, TriggerType, TriggerConfigJson, Enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [projectId, name, slug, stepsJson, triggerType, triggerConfigJson, enabled],
        );
        imported++;
    }

    await flushProjectDb(project);
    return { isOk: true, imported };
}
