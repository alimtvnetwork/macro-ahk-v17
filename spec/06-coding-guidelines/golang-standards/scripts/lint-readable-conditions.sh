#!/usr/bin/env bash
# lint-readable-conditions.sh — RC1–RC4 + P1–P2 Linter for Go
#
# Version: 1.1.0
# Standard: spec/03-imported-spec/05-golang-standards/03-readable-conditions.md
#           spec/03-imported-spec/05-golang-standards/02-boolean-standards.md
#
# Usage:
#   ./lint-readable-conditions.sh [dir]        # lint all .go files under dir (default: .)
#   ./lint-readable-conditions.sh --staged      # lint only git-staged .go files (pre-commit mode)
#
# Exit codes:
#   0 — no violations
#   1 — violations found
#
# Exemptions (per RC2 §6):
#   - err != nil / err == nil (idiomatic error check)
#   - if !ok (comma-ok pattern)
#   - if !requireService / !decodeJSON / !parseJSON (handler guards)
#   - Single well-named is*/has* boolean used alone
#
# Integration:
#   Pre-commit hook:  Add to .git/hooks/pre-commit or use pre-commit framework
#   CI pipeline:      Run as a step in your Go lint job
# ---------------------------------------------------------------------------

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

VIOLATIONS=0
FILES_CHECKED=0

# ── Collect files ──────────────────────────────────────────────────────────

if [[ "${1:-}" == "--staged" ]]; then
  mapfile -t GO_FILES < <(git diff --cached --name-only --diff-filter=ACM | grep '\.go$' || true)
else
  TARGET_DIR="${1:-.}"
  mapfile -t GO_FILES < <(find "$TARGET_DIR" -name '*.go' -not -path '*/vendor/*' -not -path '*/.git/*')
fi

if [[ ${#GO_FILES[@]} -eq 0 ]]; then
  echo "No Go files to lint."
  exit 0
fi

# ── Helper ─────────────────────────────────────────────────────────────────

report() {
  local rule="$1" file="$2" line="$3" msg="$4"
  echo -e "${RED}[$rule]${NC} ${file}:${line} — ${msg}"
  ((VIOLATIONS++))
}

# ── RC1: No inline negation at if site ─────────────────────────────────────
# Flags: if !someVar / if !some.Method() — except exemptions
lint_rc1() {
  local file="$1"
  local line_num=0

  while IFS= read -r line; do
    ((line_num++))

    # Match: if !something { (but not exempt patterns)
    if [[ "$line" =~ ^[[:space:]]*if[[:space:]]+\! ]]; then
      # Exempt: if !ok
      [[ "$line" =~ if[[:space:]]+\!ok ]] && continue
      # Exempt: handler guards (requireService, decodeJSON, parseJSON, etc.)
      [[ "$line" =~ if[[:space:]]+\!(require|decode|parse) ]] && continue
      # Exempt: stdlib single-use (strings.Has*, filepath.Is*, etc.)
      [[ "$line" =~ if[[:space:]]+\!(strings\.|filepath\.|bytes\.|sort\.) ]] && continue

      report "RC1" "$file" "$line_num" "Inline negation at if site: ${line##*( )}"
    fi
  done < "$file"
}

# ── RC2: No raw comparisons in if ─────────────────────────────────────────
# Flags: if x > 0 / if x == "" / if len(x) == 0 / if x != nil (except err)
lint_rc2() {
  local file="$1"
  local line_num=0

  while IFS= read -r line; do
    ((line_num++))

    # Only check lines that start an if block
    [[ "$line" =~ ^[[:space:]]*if[[:space:]] ]] || continue

    # Exempt: err != nil / err == nil
    [[ "$line" =~ err[[:space:]]*(!=|==)[[:space:]]*nil ]] && continue

    # Flag: raw numeric/string/nil comparisons in if
    if [[ "$line" =~ if[[:space:]].*[[:space:]](==|!=|'>'|'>='|'<'|'<=')[[:space:]] ]]; then
      # Exempt: comparisons against named booleans (already extracted)
      # We only flag if there's a dot-access, function call, or literal on both sides
      report "RC2" "$file" "$line_num" "Raw comparison in if: ${line##*( )}"
    fi

    # Flag: len() inside if
    if [[ "$line" =~ if[[:space:]].*len\( ]]; then
      report "RC2" "$file" "$line_num" "Raw len() check in if: ${line##*( )}"
    fi
  done < "$file"
}

# ── RC3: No compound conditions without named intermediates ────────────────
# Flags: if x && y / if x || y (where x or y are not simple named booleans)
lint_rc3() {
  local file="$1"
  local line_num=0

  while IFS= read -r line; do
    ((line_num++))

    [[ "$line" =~ ^[[:space:]]*if[[:space:]] ]] || continue

    # Check for && or || in if lines
    if [[ "$line" =~ if[[:space:]].*(\&\&|\|\|) ]]; then
      # Exempt: err != nil && resp != nil (common pattern handled by decomposition)
      # Flag everything else — reviewer decides if intermediates exist above
      report "RC3" "$file" "$line_num" "Compound condition in if (verify decomposed): ${line##*( )}"
    fi
  done < "$file"
}

# ── RC4: Blank line before if using named boolean ──────────────────────────
# Flags: varName := <expr> followed immediately by if varName {
lint_rc4() {
  local file="$1"
  local prev_line=""
  local prev_line_num=0
  local line_num=0

  while IFS= read -r line; do
    ((line_num++))

    # Check: current line is `if someVar {` and previous line declared that var
    if [[ "$line" =~ ^[[:space:]]*if[[:space:]]+(is[A-Z]|has[A-Z])[a-zA-Z]*[[:space:]]*\{ ]]; then
      local var_name
      var_name=$(echo "$line" | grep -oP '(is|has)[A-Za-z]+' | head -1)

      if [[ -n "$var_name" && "$prev_line" =~ $var_name[[:space:]]*:= ]]; then
        report "RC4" "$file" "$line_num" "Missing blank line before if (declared on line $prev_line_num): ${line##*( )}"
      fi
    fi

    if [[ -n "${line// /}" ]]; then
      prev_line="$line"
      prev_line_num=$line_num
    fi
  done < "$file"
}

# ── P1–P2 Exempt Enum Variants ─────────────────────────────────────────────
# Enum variant checkers where the variant itself has a negative-sounding name
# are permitted per Boolean Standards §1 exception. Add new variants here.
P1_EXEMPT_VARIANTS=(
  "IsNotFound"
  "IsNotSet"
  "IsNotApplicable"
  "IsUnknown"
  "IsUndefined"
  "IsUnspecified"
  "IsNone"
  "IsInvalid"
  "IsInactive"
  "IsIncomplete"
  "IsDisconnected"
  "IsUnavailable"
  "IsUnsupported"
  "IsUninitialized"
  "IsUnresolved"
)

is_p1_exempt() {
  local line="$1"
  for variant in "${P1_EXEMPT_VARIANTS[@]}"; do
    [[ "$line" =~ $variant ]] && return 0
  done
  return 1
}

# ── P1: No negative boolean function declarations ─────────────────────────
# Flags: func IsNot*, func HasNo* declarations
# Exempt: enum variant checkers listed in P1_EXEMPT_VARIANTS
lint_p1() {
  local file="$1"
  local line_num=0

  while IFS= read -r line; do
    ((line_num++))

    # Match: func (receiver) IsNot* or func IsNot*
    if [[ "$line" =~ ^[[:space:]]*(func[[:space:]]+\([^)]+\)[[:space:]]+|func[[:space:]]+)IsNot[A-Z] ]]; then
      is_p1_exempt "$line" && continue
      report "P1" "$file" "$line_num" "Negative boolean func name: ${line##*( )}"
    fi

    # Match: func (receiver) HasNo* or func HasNo*
    if [[ "$line" =~ ^[[:space:]]*(func[[:space:]]+\([^)]+\)[[:space:]]+|func[[:space:]]+)HasNo[A-Z] ]]; then
      is_p1_exempt "$line" && continue
      report "P1" "$file" "$line_num" "Negative boolean func name: ${line##*( )}"
    fi

    # Match: func (receiver) IsUn* — only flag if not in exempt list
    if [[ "$line" =~ ^[[:space:]]*(func[[:space:]]+\([^)]+\)[[:space:]]+|func[[:space:]]+)IsUn[a-z] ]]; then
      is_p1_exempt "$line" && continue
      # Not exempt — flag it
      report "P1" "$file" "$line_num" "Negative boolean func name: ${line##*( )}"
    fi
  done < "$file"
}

# ── P2: No negative-word boolean variable names ───────────────────────────
# Flags: isNot*, hasNo*, not*, no* variable declarations
lint_p2() {
  local file="$1"
  local line_num=0

  while IFS= read -r line; do
    ((line_num++))

    # Match: isNot* := or hasNo* := variable declarations
    if [[ "$line" =~ ^[[:space:]]*(isNot[A-Z][a-zA-Z]*|hasNo[A-Z][a-zA-Z]*)[[:space:]]*:= ]]; then
      report "P2" "$file" "$line_num" "Negative-word boolean variable: ${line##*( )}"
    fi

    # Match: not* := or no* := (standalone negative prefixes)
    if [[ "$line" =~ ^[[:space:]]*(not[A-Z][a-zA-Z]*|no[A-Z][a-zA-Z]*)[[:space:]]*:= ]]; then
      report "P2" "$file" "$line_num" "Negative-prefix variable name: ${line##*( )}"
    fi
  done < "$file"
}

# ── Main ───────────────────────────────────────────────────────────────────

echo -e "${CYAN}RC1–RC4 + P1–P2 Readable Conditions & Boolean Naming Linter${NC}"
echo -e "${CYAN}Checking ${#GO_FILES[@]} Go file(s)...${NC}"
echo ""

for file in "${GO_FILES[@]}"; do
  ((FILES_CHECKED++))
  lint_rc1 "$file"
  lint_rc2 "$file"
  lint_rc3 "$file"
  lint_rc4 "$file"
  lint_p1 "$file"
  lint_p2 "$file"
done

echo ""
echo -e "${CYAN}────────────────────────────────────${NC}"
echo -e "Files checked: ${FILES_CHECKED}"

if [[ $VIOLATIONS -gt 0 ]]; then
  echo -e "${RED}Violations found: ${VIOLATIONS}${NC}"
  echo -e "${YELLOW}See: spec/03-imported-spec/05-golang-standards/03-readable-conditions.md${NC}"
  echo -e "${YELLOW}See: spec/03-imported-spec/05-golang-standards/02-boolean-standards.md${NC}"
  exit 1
else
  echo -e "${CYAN}All clear — 0 violations ✅${NC}"
  exit 0
fi
