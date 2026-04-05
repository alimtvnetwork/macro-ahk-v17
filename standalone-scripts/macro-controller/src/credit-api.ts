import { cCbAvail, cCbBilling, cCbBonus, cCbDaily, cCbEmpty, cCbRollover, cLogInfo, cPrimaryLight, creditBarWidthPx, tFont, tFontSm, trSlow } from './shared-state';

/**
 * MacroLoop Controller — Credit Calculation & Rendering Module
 * Step 2h: Extracted from macro-looping.ts
 *
 * Contains: credit math helpers, segment percentages, credit bar HTML renderer.
 * Pure functions with no side effects (except renderCreditBar which reads theme colors).
 */
// ── Extracted string constants (sonarjs/no-duplicate-string) ──
const CSS_SPAN_COLOR = '<span style="color:';
const CSS_BAR_SEGMENT_TAIL = '%;height:100%;background:linear-gradient(90deg,';
const CSS_TRANSITION_TAIL = ');transition:width ';
const CSS_EASE_CLOSE = ' ease;"></div>';
const CSS_STYLE_WIDTH = '" style="width:';
// ============================================
// Credit Calculation Helpers (pure functions)
// ============================================
export function calcTotalCredits(granted: number, dailyLimit: number, billingLimit: number, topupLimit: number, rolloverLimit: number): number {
  return Math.round((granted || 0) + (dailyLimit || 0) + (billingLimit || 0) + (topupLimit || 0) + (rolloverLimit || 0));
}

export function calcAvailableCredits(totalCredits: number, rolloverUsed: number, dailyUsed: number, billingUsed: number, freeUsed: number): number {
  return Math.max(0, Math.round(totalCredits - (rolloverUsed || 0) - (dailyUsed || 0) - (billingUsed || 0) - (freeUsed || 0)));
}

export function calcFreeCreditAvailable(dailyLimit: number, dailyUsed: number): number {
  return Math.max(0, Math.round((dailyLimit || 0) - (dailyUsed || 0)));
}

interface SegmentPercents {
  free: number;
  billing: number;
  rollover: number;
  daily: number;
}

export function calcSegmentPercents(totalCredits: number, freeRemaining: number, billingAvailable: number, rollover: number, dailyFree: number): SegmentPercents {
  const total = Math.max(0, Math.round(totalCredits || 0));
  const free = Math.max(0, Math.round(freeRemaining || 0));
  const billing = Math.max(0, Math.round(billingAvailable || 0));
  const roll = Math.max(0, Math.round(rollover || 0));
  const daily = Math.max(0, Math.round(dailyFree || 0));

  if (total <= 0) {
    return { free: 0, billing: 0, rollover: 0, daily: 0 };
  }

  let freePct = (free / total) * 100;
  let billingPct = (billing / total) * 100;
  let rollPct = (roll / total) * 100;
  let dailyPct = (daily / total) * 100;
  const sum = freePct + billingPct + rollPct + dailyPct;

  if (sum > 100) {
    const scale = 100 / sum;
    freePct *= scale;
    billingPct *= scale;
    rollPct *= scale;
    dailyPct *= scale;
  }

  return {
    free: Number(freePct.toFixed(2)),
    billing: Number(billingPct.toFixed(2)),
    rollover: Number(rollPct.toFixed(2)),
    daily: Number(dailyPct.toFixed(2))
  };
}

// ============================================
// Credit Bar Renderer
// ============================================
interface CreditBarOpts {
  totalCredits?: number;
  available?: number;
  totalUsed?: number;
  freeRemaining?: number;
  billingAvail?: number;
  rollover?: number;
  dailyFree?: number;
  compact?: boolean;
  maxTotalCredits?: number;
  marginTop?: string;
}

// eslint-disable-next-line max-lines-per-function
export function renderCreditBar(opts: CreditBarOpts): string {
  const tc = opts.totalCredits || 0;
  const av = opts.available || 0;
  const tu = opts.totalUsed || 0;
  const fr = opts.freeRemaining || 0;
  const ba = opts.billingAvail || 0;
  const ro = opts.rollover || 0;
  const df = opts.dailyFree || 0;
  const compact = opts.compact || false;
  const maxTc = opts.maxTotalCredits || tc;
  const mt = opts.marginTop ? 'margin-top:' + opts.marginTop + ';' : '';
  const segments = calcSegmentPercents(tc, fr, ba, ro, df);
  const bH = compact ? '14px' : '18px';
  const bR = compact ? '5px' : '7px';
  const bW = creditBarWidthPx + 'px';
  const bBorder = compact ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(255,255,255,.15)';
  const bShadow = compact ? 'box-shadow:inset 0 1px 2px rgba(0,0,0,0.2);' : 'box-shadow:inset 0 2px 4px rgba(0,0,0,0.3);';
  const wW = compact ? 'width:100%;' : '';
  const bTitle = 'Available: ' + av + ' / Total: ' + tc + ' (Used: ' + tu + ')';
  const fillPct = maxTc > 0 ? Math.min(100, (tc / maxTc) * 100) : 100;
  let h = '<div style="display:flex;align-items:center;gap:8px;' + mt + wW + '">';
  h += '<div title="' + bTitle + '" style="flex:none;height:' + bH + ';width:' + bW + ';min-width:' + bW + ';max-width:' + bW + ';background:' + cCbEmpty + ';border-radius:' + bR + ';overflow:hidden;display:flex;border:' + bBorder + ';' + bShadow + '">';
  h += '<div style="width:' + fillPct.toFixed(2) + '%;height:100%;display:flex;transition:width ' + trSlow + ' ease;">';
  h += '<div title="🎁 Bonus: ' + fr + CSS_STYLE_WIDTH + segments.free + CSS_BAR_SEGMENT_TAIL + cCbBonus[0] + ',' + cCbBonus[1] + CSS_TRANSITION_TAIL + trSlow + CSS_EASE_CLOSE;
  h += '<div title="💰 Monthly: ' + ba + CSS_STYLE_WIDTH + segments.billing + CSS_BAR_SEGMENT_TAIL + cCbBilling[0] + ',' + cCbBilling[1] + CSS_TRANSITION_TAIL + trSlow + CSS_EASE_CLOSE;
  h += '<div title="🔄 Rollover: ' + ro + CSS_STYLE_WIDTH + segments.rollover + CSS_BAR_SEGMENT_TAIL + cCbRollover[0] + ',' + cCbRollover[1] + CSS_TRANSITION_TAIL + trSlow + CSS_EASE_CLOSE;
  h += '<div title="📅 Free: ' + df + CSS_STYLE_WIDTH + segments.daily + CSS_BAR_SEGMENT_TAIL + cCbDaily[0] + ',' + cCbDaily[1] + CSS_TRANSITION_TAIL + trSlow + CSS_EASE_CLOSE;
  h += '</div>';
  h += '</div>';
  const icoStyle = 'display:inline-block;min-width:32px;text-align:right;';
  const icoStyleWide = 'display:inline-block;min-width:52px;text-align:right;font-weight:700;';
  if (compact) {
    h += '<span style="font-size:' + tFontSm + ';font-family:' + tFont + ';white-space:nowrap;">';
    h += CSS_SPAN_COLOR + cPrimaryLight + ';' + icoStyle + '" title="🎁 Bonus — Promotional one-time credits">🎁' + fr + '</span> ';
    h += CSS_SPAN_COLOR + cCbBilling[1] + ';' + icoStyle + '" title="💰 Monthly — Credits from subscription plan">💰' + ba + '</span> ';
    h += CSS_SPAN_COLOR + cLogInfo + ';' + icoStyle + '" title="🔄 Rollover — Unused credits from previous period">🔄' + ro + '</span> ';
    h += CSS_SPAN_COLOR + cCbDaily[1] + ';' + icoStyle + '" title="📅 Free — Daily free credits">📅' + df + '</span> ';
    h += CSS_SPAN_COLOR + cCbAvail + ';' + icoStyleWide + '" title="Available / Total credits">⚡' + av + '/' + tc + '</span>';
    h += '</span>';
  } else {
    h += '<span style="font-size:' + tFontSm + ';white-space:nowrap;font-family:' + tFont + ';line-height:1;">';
    h += CSS_SPAN_COLOR + cPrimaryLight + ';' + icoStyle + '" title="🎁 Bonus — Promotional one-time credits">🎁' + fr + '</span> ';
    h += CSS_SPAN_COLOR + cCbBilling[1] + ';' + icoStyle + '" title="💰 Monthly — Credits from subscription plan">💰' + ba + '</span> ';
    h += CSS_SPAN_COLOR + cLogInfo + ';' + icoStyle + '" title="🔄 Rollover — Unused credits carried from previous period">🔄' + ro + '</span> ';
    h += CSS_SPAN_COLOR + cCbDaily[1] + ';' + icoStyle + '" title="📅 Free — Daily free credits (refreshed daily)">📅' + df + '</span> ';
    h += CSS_SPAN_COLOR + cCbAvail + ';' + icoStyleWide + '" title="⚡ Available / Total credits">⚡' + av + '/' + tc + '</span>';
    h += '</span>';
  }
  h += '</div>';
  return h;
}
