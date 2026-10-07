// Whitelist of true red-folder events for NQ/GC. Crude Oil, PMI, Philly Fed
// etc. are flagged "High" by the upstream feed but not relevant for our setups.
export const RED_FOLDER_WHITELIST = new Set([
  // ── Backtested (10 canonical) ─────────────────────────────────────────────
  'CPI', 'Core CPI',
  'NFP', 'Non-Farm Payrolls', 'Employment Situation',
  'PPI', 'Core PPI',
  'PCE', 'Core PCE',
  'GDP', 'GDP Advance', 'GDP (Advance)',
  'Jobless Claims', 'Initial Jobless Claims',
  'Retail Sales', 'Core Retail Sales',
  'Empire State Manufacturing Index', 'Empire State Manufacturing', 'Empire State',
  'Employment Cost Index',
  'FOMC Statement', 'FOMC Rate Decision', 'FOMC Press Conference', 'Fed Interest Rate Decision',
  'Federal Funds Rate', 'FOMC Minutes',
  // ── FF red folder (co-released w/ NFP dropped; orange events dropped) ─
  'ISM Manufacturing PMI',
  'ISM Services PMI', 'ISM Non-Manufacturing PMI',
  'ADP Non-Farm Employment Change',
  'JOLTS Job Openings',
  'CB Consumer Confidence',
  'Philadelphia Fed Manufacturing Index',
  'Durable Goods Orders', 'Core Durable Goods Orders',
]);
