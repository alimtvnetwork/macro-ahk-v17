/**
 * Macro Controller — API & Data Record Type Definitions
 *
 * Semantic type aliases that replace `Record<string, unknown>` across the codebase.
 * Each alias carries domain intent and narrows the value type.
 */

/** Primitive value types found in API responses and DB rows. */
export type FieldValue = string | number | boolean | null;

/**
 * A single row from a database table.
 * All field values are primitives (no nested objects).
 */
export type DatabaseRow = Record<string, FieldValue>;

/**
 * Raw workspace item from the /user/workspaces credit API.
 * Contains flat numeric/string fields + optional nested `workspace` sub-object.
 */
export interface RawWorkspaceApiItem {
  id?: string;
  name?: string;
  workspace?: Record<string, string | number>;
  billing_period_credits_used?: number;
  billing_period_credits_limit?: number;
  daily_credits_used?: number;
  daily_credits_limit?: number;
  rollover_credits_used?: number;
  rollover_credits_limit?: number;
  credits_granted?: number;
  credits_used?: number;
  topup_credits_limit?: number;
  total_credits_used?: number;
  subscription_status?: string;
  role?: string;
  plan?: string;
  [key: string]: string | number | boolean | Record<string, string | number> | undefined;
}

/**
 * Top-level response shape from the credit/workspaces API.
 */
export interface WorkspacesApiResponse {
  workspaces?: RawWorkspaceApiItem[];
  [key: string]: RawWorkspaceApiItem[] | string | number | boolean | undefined;
}

/**
 * Generic mutation payload sent to APIs (rename, update, etc.).
 * Values are primitives only.
 */
export type MutationPayload = Record<string, FieldValue | undefined>;

/**
 * Schema validation rules — maps field names to constraint values.
 */
export type ValidationRules = Record<string, string | number | boolean>;

/**
 * Generic API response data with known primitive fields.
 * For responses that may contain nested objects, use more specific types.
 */
export type ApiResponseData = Record<string, FieldValue | FieldValue[] | Record<string, FieldValue>>;

/**
 * Auto-attach configuration from JSON config.
 */
export type AutoAttachRawConfig = Record<string, string | number | boolean | Array<Record<string, string | string[]>>>;

/**
 * Column definition payload for schema operations.
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  primaryKey?: boolean;
  notNull?: boolean;
  defaultValue?: string | number | boolean | null;
  unique?: boolean;
  validation?: ValidationRules;
}
