# Enum Pattern

**Version:** 2.0.0  
**Status:** Complete  
**Updated:** 2026-02-11

---

## Core Pattern

All enums MUST use `byte` as the underlying type for memory efficiency and performance.

### Declaration

```go
package provider

// Variant represents the provider type
type Variant byte

const (
    // Invalid is the zero value (always first)
    Invalid Variant = iota
    
    // SerpAPI is the SerpAPI provider
    SerpAPI
    
    // MapsScraper is the gosom maps scraper
    MapsScraper
    
    // Colly is the Colly web scraper
    Colly
)
```

---

## Rules

### 1. Always Start with Invalid

The first constant MUST be `Invalid` as the zero-value representing an invalid state:

```go
const (
    Invalid Variant = iota  // Always first
    // ... other values
)
```

### 2. Use `byte` Type

```go
// ✅ Correct
type Variant byte

// ❌ Wrong
type Variant string
type Variant int
```

### 3. Use `iota` for Sequential Values

```go
// ✅ Correct
const (
    Invalid Variant = iota
    TypeA
    TypeB
)

// ❌ Wrong - explicit values
const (
    Invalid Variant = 0
    TypeA   Variant = 1
    TypeB   Variant = 2
)
```

### 4. PascalCase for Variant Names

```go
// ✅ Correct
const (
    SerpAPI     Variant = iota
    MapsScraper
)

// ❌ Wrong
const (
    SERP_API     Variant = iota
    maps_scraper
)
```

### 5. Document Each Variant

```go
const (
    // Invalid represents an unspecified provider
    Invalid Variant = iota
    
    // SerpAPI uses the commercial SerpAPI service
    SerpAPI
    
    // MapsScraper uses gosom/google-maps-scraper
    MapsScraper
)
```

---

## Internal Lookup Table

Use a single unexported array for all lookups, serialization, and display:

```go
var variantLabels = [...]string{
    Invalid:     "invalid",
    SerpAPI:     "serpapi",
    MapsScraper: "maps_scraper",
    Colly:       "colly",
}
```

> **Note:** A single `variantLabels` table replaces the previous dual-table pattern (`variantStrings` + `variantLabels`). `Label()` delegates to `String()`.

---

## Why `byte`?

| Aspect | `byte` | `string` | `int` |
|--------|--------|----------|-------|
| Memory | 1 byte | 16+ bytes | 8 bytes |
| Comparison | O(1) | O(n) | O(1) |
| Switch | Jump table | String compare | Jump table |
| JSON size | Uses String() | Direct | Uses String() |
| Type safety | ✅ Strong | ⚠️ Weak | ✅ Strong |

---

## Anti-Patterns

### ❌ String-Based Enums

```go
// DON'T DO THIS
type Provider string

const (
    SerpAPI Provider = "serpapi"
)
```

### ❌ Hardcoded Strings in Logic

```go
// DON'T DO THIS
if provider == "serpapi" { ... }

// DO THIS
if provider.IsSerpAPI() { ... }
```

### ❌ Switch Without Exhaustive Check

```go
// DON'T DO THIS
switch p {
case SerpAPI:
    // ...
}

// DO THIS
switch p {
case SerpAPI:
    // ...
case MapsScraper:
    // ...
case Colly:
    // ...
default:
    return fmt.Errorf("invalid provider: %s", p)
}
```

### ❌ Using "Unknown" as Zero Value

```go
// DON'T DO THIS
const (
    Unknown Variant = iota
)

// DO THIS
const (
    Invalid Variant = iota
)
```

---

*Core enum pattern specification.*
