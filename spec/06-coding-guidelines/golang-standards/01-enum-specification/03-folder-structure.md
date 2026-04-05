# Folder Structure

**Version:** 2.0.0  
**Status:** Complete  
**Updated:** 2026-02-11

---

## Standard Layout

All enums MUST be placed in the `internal/enums/` directory at the project root.

```
{cli-root}/
├── cmd/
│   └── root.go
├── internal/
│   ├── enums/
│   │   ├── provider/
│   │   │   └── variant.go
│   │   ├── platform/
│   │   │   └── variant.go
│   │   ├── engine/
│   │   │   └── variant.go
│   │   ├── search_mode/
│   │   │   └── variant.go
│   │   ├── output_format/
│   │   │   └── variant.go
│   │   └── registry.go       # Optional: Central registry
│   ├── models/
│   ├── services/
│   └── api/
└── pkg/
```

---

## Naming Conventions

### Package Names

- Use `snake_case` for multi-word packages
- Keep names short and descriptive
- One enum per package

| ✅ Correct | ❌ Wrong |
|-----------|----------|
| `provider` | `providers` |
| `search_mode` | `searchMode` |
| `output_format` | `OutputFormat` |
| `movie_provider` | `movieProvider` |

### File Names

- Always name the file `variant.go`
- Additional helper files allowed: `helpers.go`, `validation.go`

```
internal/enums/provider/
├── variant.go      # Main enum definition
├── helpers.go      # Optional: Helper functions
└── validation.go   # Optional: Validation logic
```

---

## Import Pattern

```go
import (
    "myapp/internal/enums/provider"
    "myapp/internal/enums/platform"
    "myapp/internal/enums/engine"
)

func main() {
    p := provider.SerpAPI
    if p.IsSerpAPI() {
        // ...
    }
    
    platforms := []platform.Variant{
        platform.YouTube,
        platform.Reddit,
    }
}
```

---

## Enum Categories by CLI

### GSearch CLI

```
internal/enums/
├── provider/           # SerpAPI, MapsScraper, Colly
├── platform/           # YouTube, Reddit, LinkedIn, etc.
├── engine/             # Google, Bing, DuckDuckGo
├── search_mode/        # Sequential, Parallel, RoundRobin
├── output_format/      # JSON, CSV, Table, Markdown
├── movie_provider/     # Tmdb, Omdb, Trakt, ImdbScraper
├── social_media/       # LinkedIn, Twitter, Instagram, etc.
└── content_type/       # Web, Image, Video, News
```

### BRun CLI

```
internal/enums/
├── build_type/         # Debug, Release, Test
├── run_mode/           # Foreground, Background, Watch
├── log_level/          # Debug, Info, Warn, Error
└── profile/            # Development, Staging, Production
```

### AI Bridge CLI

```
internal/enums/
├── model_provider/     # Ollama, OpenAI, Anthropic
├── reasoning_mode/     # SinglePrompt, TwoStage, Research
├── step_type/          # Search, Fetch, Parse, Embed, etc.
├── execution_status/   # Pending, Running, Success, Failed
├── checkpoint_type/    # Auto, Manual, Rollback
└── memory_flag/        # IsCritical, IsImportant, Standard
```

### Nexus Flow CLI

```
internal/enums/
├── node_type/          # Start, End, Task, Decision, Fork, Join
├── flow_status/        # Draft, Active, Paused, Completed
├── trigger_type/       # Manual, Scheduled, Webhook, Event
└── execution_mode/     # Sequential, Parallel
```

### Spec Reverse CLI

```
internal/enums/
├── output_format/      # Markdown, JSON, YAML
├── parser_type/        # Go, TypeScript, Python
└── extraction_mode/    # Full, Summary, Skeleton
```

### WP SEO Publish CLI

```
internal/enums/
├── content_type/       # Post, Page, Product
├── publish_status/     # Draft, Pending, Published
├── seo_score/          # Poor, Fair, Good, Excellent
└── media_type/         # Image, Video, Document
```

### AI Transcribe CLI

```
internal/enums/
├── audio_format/       # MP3, WAV, FLAC, OGG
├── transcribe_provider/ # Whisper, DeepGram, AssemblyAI
├── output_format/      # SRT, VTT, TXT, JSON
└── language/           # EN, ES, FR, DE, etc.
```

---

## Registry Pattern (Optional)

For CLIs with many enums, create a central registry:

```go
// internal/enums/registry.go
package enums

import (
    "myapp/internal/enums/provider"
    "myapp/internal/enums/platform"
    "myapp/internal/enums/engine"
)

// Re-export for convenience
type (
    Provider   = provider.Variant
    Platform   = platform.Variant
    Engine     = engine.Variant
)

// Constants re-export
const (
    ProviderSerpAPI     = provider.SerpAPI
    ProviderMapsScraper = provider.MapsScraper
    ProviderColly       = provider.Colly
    
    PlatformYouTube     = platform.YouTube
    PlatformReddit      = platform.Reddit
    
    EngineGoogle        = engine.Google
    EngineBing          = engine.Bing
)
```

**Usage:**
```go
import "myapp/internal/enums"

p := enums.ProviderSerpAPI
```

---

## File Template

```go
// internal/enums/{category}/variant.go
package {category}

import (
    "encoding/json"
    "fmt"
    "strings"
)

// Variant represents a {category} type
type Variant byte

const (
    // Invalid is the zero value
    Invalid Variant = iota
    
    // Add variants here...
)

var variantLabels = [...]string{
    Invalid: "invalid",
    // Add mappings...
}

// String returns the string representation
func (v Variant) String() string {
    if !v.IsValid() {
        return variantLabels[Invalid]
    }
    return variantLabels[v]
}

// Label delegates to String
func (v Variant) Label() string {
    return v.String()
}

// IsValid checks if the variant is valid
func (v Variant) IsValid() bool {
    return v > Invalid && v < Variant(len(variantLabels))
}

// Add Is{Value}() methods for each variant...

// All returns all valid variants
func All() []Variant {
    // Return all except Invalid
}

// ByIndex returns variant by index
func ByIndex(i int) Variant {
    isIndexOutOfRange := i < 0 || i >= len(variantLabels)

    if isIndexOutOfRange {
        return Invalid
    }

    return Variant(i)
}

// Parse parses a string to variant
func Parse(s string) (Variant, error) {
    lower := strings.ToLower(strings.TrimSpace(s))
    for i, str := range variantLabels {
        if str == lower {
            return Variant(i), nil
        }
    }
    return Invalid, fmt.Errorf("invalid {category}: %q", s)
}

// Values returns all string values
func Values() []string {
    result := make([]string, 0, len(variantLabels)-1)
    for _, s := range variantLabels[1:] {
        result = append(result, s)
    }
    return result
}

// MarshalJSON implements json.Marshaler
func (v Variant) MarshalJSON() ([]byte, error) {
    return json.Marshal(v.String())
}

// UnmarshalJSON implements json.Unmarshaler
func (v *Variant) UnmarshalJSON(data []byte) error {
    var s string
    if err := json.Unmarshal(data, &s); err != nil {
        return err
    }
    parsed, err := Parse(s)
    if err != nil {
        return err
    }
    *v = parsed
    return nil
}
```

---

*Folder structure standard for enum organization.*
