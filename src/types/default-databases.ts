/**
 * Marco Extension — Default Project Databases
 *
 * Defines the common databases that every project should have by default.
 * The first required default is always a Key-Value database.
 *
 * @see spec/11-chrome-extension/55-storage-ui-redesign.md
 */

/* ------------------------------------------------------------------ */
/*  Database Kind Registry                                             */
/* ------------------------------------------------------------------ */

export interface DatabaseKind {
  id: number;
  name: string;
  description: string;
}

export const DATABASE_KINDS: DatabaseKind[] = [
  { id: 1, name: "KeyValue", description: "General-purpose key-value pair storage" },
  { id: 2, name: "Relational", description: "Structured relational tables with columns" },
  { id: 3, name: "Config", description: "Configuration and settings storage" },
];

/* ------------------------------------------------------------------ */
/*  Default Database Definitions                                       */
/* ------------------------------------------------------------------ */

export interface DefaultDatabaseDef {
  /** Logical database name */
  databaseName: string;
  /** References DatabaseKind.id */
  databaseKindId: number;
  /** Human-readable description */
  description: string;
  /** JSON schema to auto-apply on creation */
  schema: {
    version: string;
    tables: Array<{
      TableName: string;
      Description: string;
      Columns: Array<{ Name: string; Type: string; Nullable?: boolean; Unique?: boolean; Default?: string; Description?: string }>;
    }>;
  };
}

/**
 * Every project gets these databases created automatically.
 * The KV database is always first and required.
 */
export const DEFAULT_PROJECT_DATABASES: DefaultDatabaseDef[] = [
  {
    databaseName: "ProjectKv",
    databaseKindId: 1,
    description: "General-purpose key-value store for any plugin or feature",
    schema: {
      version: "1.0.0",
      tables: [
        {
          TableName: "KeyValueStore",
          Description: "Generic key-value pairs with optional namespace grouping",
          Columns: [
            { Name: "Namespace", Type: "TEXT", Default: "'default'", Description: "Logical namespace for grouping keys" },
            { Name: "Key", Type: "TEXT", Description: "The key identifier" },
            { Name: "Value", Type: "TEXT", Nullable: true, Description: "Stored value (JSON or plain text)" },
            { Name: "ValueType", Type: "TEXT", Default: "'text'", Description: "Value type hint: text, json, number, boolean" },
          ],
        },
      ],
    },
  },
  {
    databaseName: "ProjectMeta",
    databaseKindId: 3,
    description: "Project metadata and configuration registry",
    schema: {
      version: "1.0.0",
      tables: [
        {
          TableName: "ProjectDatabases",
          Description: "Registry of all databases in this project",
          Columns: [
            { Name: "DatabaseName", Type: "TEXT", Unique: true, Description: "Logical database name" },
            { Name: "Namespace", Type: "TEXT", Default: "'default'", Description: "Namespace for grouping" },
            { Name: "DatabaseKindId", Type: "INTEGER", Default: "1", Description: "References DatabaseKind (1=KV, 2=Relational, 3=Config)" },
            { Name: "IsDefault", Type: "INTEGER", Default: "0", Description: "1 if system-created default" },
            { Name: "Description", Type: "TEXT", Nullable: true, Description: "Human-readable purpose" },
          ],
        },
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Namespace-based Database Creation (INCOMPLETE)                     */
/* ------------------------------------------------------------------ */

/**
 * @incomplete — Namespace-based database creation flow.
 *
 * Users must be able to create databases using namespaces.
 * The exact UX flow, validation rules, and naming constraints
 * are not fully provided and remain pending clarification.
 *
 * Planned fields for the creation form:
 * - Namespace (e.g., "MyPlugin.Data")
 * - Database name
 * - Database kind selection
 *
 * Validation rules TBD:
 * - Namespace format constraints
 * - Reserved namespace prefixes
 * - Maximum databases per project
 */
export interface NamespaceDatabaseRequest {
  namespace: string;
  databaseName: string;
  databaseKindId: number;
  description?: string;
}

/** Placeholder validator — real implementation pending spec clarification. */
export function validateNamespace(namespace: string): { valid: boolean; error?: string } {
  if (!namespace || namespace.trim().length === 0) {
    return { valid: false, error: "Namespace is required" };
  }
  if (!/^[A-Za-z][A-Za-z0-9.]*$/.test(namespace)) {
    return { valid: false, error: "Namespace must start with a letter and contain only letters, numbers, and dots" };
  }
  return { valid: true };
}
