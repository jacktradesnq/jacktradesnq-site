/**
 * terminology.ts — Single source of truth for human-readable names and glossary.
 * Contract section B verbatim. All leaf components import from here.
 * Framework-agnostic: no React imports. Safe for server and client modules.
 */

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

export type InstrumentCode = 'NQ' | 'ES' | 'GC' | 'SI' | 'YM';

export interface InstrumentEntry {
  /** Short display name, e.g. "Nasdaq 100" */
  short: string;
  /** Long name, e.g. "E-mini Nasdaq-100 futures" */
  long: string;
}

export const INSTRUMENTS: Record<InstrumentCode, InstrumentEntry> = {
  NQ: { short: 'Nasdaq 100',  long: 'E-mini Nasdaq-100 futures' },
  ES: { short: 'S&P 500',     long: 'E-mini S&P 500 futures'    },
  GC: { short: 'Gold',        long: 'Gold futures'               },
  SI: { short: 'Silver',      long: 'Silver futures'             },
  YM: { short: 'Dow Jones',   long: 'E-mini Dow futures'         },
};

/**
 * Returns "Nasdaq 100 (NQ)" style label for use in pills / titles.
 * Falls back to the raw code if not found.
 */
export function assetLabel(code: string): string {
  const upper = code.toUpperCase() as InstrumentCode;
  const entry = INSTRUMENTS[upper];
  if (!entry) return code.toUpperCase();
  return `${entry.short} (${upper})`;
}

/**
 * Returns the short name only, e.g. "Nasdaq 100".
 * Used in pill buttons where space is tight but still needs full name.
 */
export function assetShort(code: string): string {
  const upper = code.toUpperCase() as InstrumentCode;
  return INSTRUMENTS[upper]?.short ?? code.toUpperCase();
}

// ---------------------------------------------------------------------------
// News events
// ---------------------------------------------------------------------------

export interface EventEntry {
  /** Full display name, verbatim from contract */
  full: string;
  /** Optional one-line tooltip gloss */
  gloss?: string;
}

/**
 * Keyed by the lowercase/hyphenated slug used in the codebase
 * (matches HubFilters EVENT_LABELS keys and TradeMiniChart EVENT_SHORT values).
 */
export const EVENTS: Record<string, EventEntry> = {
  cpi:                 { full: 'Consumer Price Index',      gloss: 'monthly US inflation report'                  },
  nfp:                 { full: 'Non-Farm Payrolls',         gloss: 'monthly US jobs report'                       },
  ppi:                 { full: 'Producer Price Index',      gloss: 'wholesale inflation'                          },
  pce:                 { full: 'PCE Inflation',             gloss: "the Fed's preferred inflation gauge"          },
  gdp:                 { full: 'Gross Domestic Product',    gloss: 'US economic growth'                           },
  fomc:                { full: 'Fed Rate Decision',         gloss: 'FOMC interest-rate announcement'              },
  adp:                 { full: 'ADP Employment',            gloss: 'private-sector jobs, NFP preview'             },
  jolts:               { full: 'Job Openings',              gloss: 'labor-market openings & turnover'             },
  'ism-mfg':           { full: 'ISM Manufacturing',         gloss: 'factory-sector activity index'                },
  'ism-manufacturing': { full: 'ISM Manufacturing',         gloss: 'factory-sector activity index'                },
  'ism-services':      { full: 'ISM Services',              gloss: 'services-sector activity index'               },
  'retail-sales':      { full: 'Retail Sales'                                                                     },
  'jobless-claims':    { full: 'Jobless Claims',            gloss: 'weekly unemployment filings'                  },
  'cb-confidence':     { full: 'Consumer Confidence',       gloss: 'Conference Board sentiment survey'            },
  'cb-consumer-confidence': { full: 'Consumer Confidence',  gloss: 'Conference Board sentiment survey'            },
  empirestate:         { full: 'Empire State Mfg',          gloss: 'NY regional factory survey'                   },
  'empire-state':      { full: 'Empire State Mfg',          gloss: 'NY regional factory survey'                   },
  'empire-state-mfg':  { full: 'Empire State Mfg',          gloss: 'NY regional factory survey'                   },
  'durable-goods':     { full: 'Durable Goods Orders'                                                             },
  'philly-fed':        { full: 'Philadelphia Fed Index'                                                           },
  'es-ifvg-smt':       { full: 'ES IFVG + NQ SMT',  gloss: 'ES IFVG across all news events, filtered by NQ SMT'   },
  'si-ifvg-smt':       { full: 'SI IFVG + GC SMT',  gloss: 'SI IFVG across all news events, filtered by GC SMT'   },
};

/**
 * Returns the full display name for a given event key.
 * Falls back to title-cased key if not found.
 */
export function eventFull(key: string): string {
  if (EVENTS[key]) return EVENTS[key].full;
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Trading concepts
// ---------------------------------------------------------------------------

export interface ConceptEntry {
  full: string;
  gloss: string;
}

export const CONCEPTS: Record<string, ConceptEntry> = {
  IFVG:      { full: 'Inverse Fair Value Gap',     gloss: 'an ICT price imbalance that flips into support/resistance' },
  FVG:       { full: 'Fair Value Gap',             gloss: 'a price imbalance / gap left by a fast move'               },
  SMT:       { full: 'SMT Divergence',             gloss: 'two correlated markets disagree - an ICT reversal signal'  },
  IB50:      { full: 'Initial Balance 50%',        gloss: "entry at the 50% retrace of the session's first range"     },
  straddle:  { full: 'Straddle',                   gloss: 'bracket both sides of a news release, take whichever direction fires' },
  killzone:  { full: 'Killzone',                   gloss: 'a high-activity trading session window (ICT)'              },
  NWOG:      { full: 'New Week Opening Gap',       gloss: 'the gap between Friday close and Sunday open'              },
  TP:        { full: 'Take Profit',                gloss: 'the target price level where a trade is closed for a gain' },
  SL:        { full: 'Stop Loss',                  gloss: 'the price level that closes a trade to limit a loss'       },
  BE:        { full: 'Break Even',                 gloss: 'moving the stop loss to the entry price'                   },
};

// ---------------------------------------------------------------------------
// TradeMiniChart — EVENT_SHORT map (display name -> json slug)
// Centralised here so TradeMiniChart imports from one place.
// ---------------------------------------------------------------------------

export const EVENT_SHORT_MAP: Record<string, string> = {
  'Consumer Price Index':          'cpi',
  'Non-Farm Payrolls':             'nfp',
  'Producer Price Index':          'ppi',
  'PCE Inflation':                 'pce',
  'Gross Domestic Product':        'gdp',
  'Jobless Claims':                'joblessclaims',
  'Retail Sales':                  'retailsales',
  'Empire State Mfg':              'empirestate',
  'ADP Employment':                'adp',
  'Job Openings':                  'jolts',
  'ISM Manufacturing':             'ism_mfg',
  'ISM Services':                  'ism_services',
  'Consumer Confidence':           'cb_confidence',
  'Philadelphia Fed Index':        'philly_fed',
  'Durable Goods Orders':          'durable_goods',
  'Fed Rate Decision':             'fomc',
  // Legacy keys kept for backwards compat (chart code may use old display names)
  'CPI':                           'cpi',
  'NFP':                           'nfp',
  'PPI':                           'ppi',
  'PCE':                           'pce',
  'GDP':                           'gdp',
  'Jobless Claims (legacy)':       'joblessclaims',
  'Retail Sales (legacy)':         'retailsales',
  'Empire State':                  'empirestate',
  'Employment Cost':               'employmentcostindex',
  'FOMC':                          'fomc',
  'ADP':                           'adp',
  'JOLTS':                         'jolts',
  'ISM Manufacturing PMI':         'ism_mfg',
  'ISM Services PMI':              'ism_services',
  'CB Consumer Confidence':        'cb_confidence',
  'Philadelphia Fed Manufacturing':'philly_fed',
  'Durable Goods Orders (legacy)': 'durable_goods',
};
