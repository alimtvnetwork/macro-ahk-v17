/**
 * Tests for the Schema Meta Engine — JSON-driven table creation + doc generation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import {
    ensureMetaTables,
    applyJsonSchema,
    getMetaTables,
    getMetaColumns,
    getMetaRelations,
    generateMarkdownDocs,
    generatePrismaSchema,
    type JsonSchemaDef,
} from "../../../src/background/schema-meta-engine";

let db: Database;

beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    // Also need ProjectSchema for backwards compat
    db.run(`CREATE TABLE IF NOT EXISTS ProjectSchema (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        TableName TEXT NOT NULL UNIQUE,
        ColumnDefs TEXT NOT NULL,
        EndpointName TEXT,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        UpdatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    ensureMetaTables(db);
});

const SAMPLE_SCHEMA: JsonSchemaDef = {
    version: "1.0.0",
    tables: [
        {
            TableName: "Customers",
            Description: "Customer records",
            Columns: [
                { Name: "FullName", Type: "TEXT", Description: "Customer full name" },
                { Name: "Email", Type: "TEXT", Unique: true, Validation: { type: "regex", pattern: "^.+@.+\\..+$" } },
                { Name: "Age", Type: "INTEGER", Nullable: true },
            ],
        },
        {
            TableName: "Orders",
            Description: "Purchase orders",
            Columns: [
                { Name: "CustomerId", Type: "INTEGER" },
                { Name: "Total", Type: "REAL", Default: "0.0" },
                { Name: "Status", Type: "TEXT", Default: "'pending'", Validation: { type: "enum", values: ["pending", "shipped", "delivered"] } },
            ],
            Relations: [
                { SourceColumn: "CustomerId", TargetTable: "Customers", OnDelete: "CASCADE" },
            ],
        },
    ],
};

describe("Schema Meta Engine", () => {
    it("creates meta tables without error", () => {
        const tables = getMetaTables(db);
        expect(tables).toEqual([]);
    });

    it("applies JSON schema and creates tables", () => {
        const result = applyJsonSchema(db, SAMPLE_SCHEMA);

        expect(result.errors).toEqual([]);
        expect(result.tablesCreated).toContain("Customers");
        expect(result.tablesCreated).toContain("Orders");
    });

    it("registers tables in MetaTables", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);
        const tables = getMetaTables(db);

        expect(tables).toHaveLength(2);
        expect(tables.find((t) => t.TableName === "Customers")?.Description).toBe("Customer records");
    });

    it("registers columns in MetaColumns with validation", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);
        const cols = getMetaColumns(db, "Customers");

        // 3 user columns + 3 auto (Id, CreatedAt, UpdatedAt)
        expect(cols.length).toBeGreaterThanOrEqual(3);

        const emailCol = cols.find((c) => c.ColumnName === "Email");
        expect(emailCol?.IsUnique).toBe(true);
        expect(emailCol?.ValidationJson).toBeTruthy();
        const validation = JSON.parse(emailCol!.ValidationJson!);
        expect(validation.type).toBe("regex");
    });

    it("registers relations in MetaRelations", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);
        const rels = getMetaRelations(db, "Orders");

        expect(rels).toHaveLength(1);
        expect(rels[0].SourceColumn).toBe("CustomerId");
        expect(rels[0].TargetTable).toBe("Customers");
        expect(rels[0].OnDelete).toBe("CASCADE");
    });

    it("adds missing columns on re-apply (additive migration)", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);

        // Add a new column
        const extendedSchema: JsonSchemaDef = {
            ...SAMPLE_SCHEMA,
            tables: [
                {
                    ...SAMPLE_SCHEMA.tables[0],
                    Columns: [
                        ...SAMPLE_SCHEMA.tables[0].Columns,
                        { Name: "Phone", Type: "TEXT", Nullable: true },
                    ],
                },
                SAMPLE_SCHEMA.tables[1],
            ],
        };

        const result = applyJsonSchema(db, extendedSchema);
        expect(result.tablesCreated).toEqual([]); // no new tables
        expect(result.columnsAdded).toContainEqual({ table: "Customers", column: "Phone" });
    });

    it("is idempotent — re-apply same schema has no effect", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);
        const result2 = applyJsonSchema(db, SAMPLE_SCHEMA);

        expect(result2.tablesCreated).toEqual([]);
        expect(result2.columnsAdded).toEqual([]);
    });

    it("generates Markdown docs", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);
        const md = generateMarkdownDocs(db);

        expect(md).toContain("## Customers");
        expect(md).toContain("## Orders");
        expect(md).toContain("FullName");
        expect(md).toContain("Customers.Id");
    });

    it("generates Prisma-style schema", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);
        const prisma = generatePrismaSchema(db);

        expect(prisma).toContain("model Customers");
        expect(prisma).toContain("model Orders");
        expect(prisma).toContain("@id");
        expect(prisma).toContain("@relation");
    });

    it("can insert data into created tables", () => {
        applyJsonSchema(db, SAMPLE_SCHEMA);

        db.run(`INSERT INTO Customers (FullName, Email) VALUES (?, ?)`, ["John Doe", "john@example.com"]);
        const result = db.exec("SELECT * FROM Customers");

        expect(result[0].values).toHaveLength(1);
        expect(result[0].values[0]).toContain("John Doe");
    });
});
