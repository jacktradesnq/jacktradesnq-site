// Keeps /giveaways up to date from the #giveaways channel (Angelo, 04/11/2026: « faudra peut-être
// trouver un truc pour traquer les giveaways », then « le reste fais oui »). Pure: the Discord
// messages come in, the new list goes out. scripts/sync-giveaways.mjs does the reading and writing,
// scripts/giveaway-sync.test.mjs checks this. A giveaway run on X only is added by hand.

// « Congratulations, <@a>, <@b>! You won **lot**! » (Giveaway-Bot, JTNQ's bot), « Congratulations
// <@a>! You won the **lot**! » (the old GiveawayBot). Its rerolls never name the lot: not matched.
const WON = /^Congratulations,? (.+?)! You won (?:the )?\*\*(.+?)\*\*!?\s*$/;
const MENTION = /<@!?(\d+)>/g;
const WEEK = 7 * 24 * 3600 * 1000;

const winnersIn = (text) => new Set([...text.matchAll(MENTION)].map((m) => m[1])).size;

/**
 * Giveaway-Bot and JTNQ's bot both announce the same giveaway, a reroll can announce it again: the
 * same lot within a week is one giveaway, dated by its first announcement.
 * @param {{ content?: string; timestamp: string; author?: { bot?: boolean } }[]} messages
 * @returns {{ prize: string; winners: number; at: string }[]}  oldest first
 */
export function endedGiveaways(messages) {
  const found = [];
  const byTime = [...messages].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (const m of byTime) {
    if (!m.author?.bot) continue;
    const won = WON.exec((m.content ?? '').trim());
    if (!won) continue;
    const prize = won[2].trim();
    const winners = winnersIn(won[1]);
    const same = found.find((g) => g.prize === prize && Date.parse(m.timestamp) - Date.parse(g.at) < WEEK);
    if (same) same.winners = Math.max(same.winners, winners);
    else if (winners > 0) found.push({ prize, winners, at: m.timestamp });
  }
  return found;
}

/**
 * Adds to `past` the giveaways that ended after `cursor`, newest first. A lot already listed within a
 * week is not added again, so a late reroll or two reads of the same day change nothing.
 * @param {{ date: string; prize: string; winners: number }[]} past
 * @param {string} cursor  ISO time: everything before it is already handled
 * @param {{ content?: string; timestamp: string; author?: { bot?: boolean } }[]} messages
 * @returns {{ past: { date: string; prize: string; winners: number }[]; cursor: string; added: number }}
 */
export function addNewGiveaways(past, cursor, messages) {
  const from = Date.parse(cursor);
  if (!Number.isFinite(from)) throw new Error(`curseur illisible : « ${cursor} »`);
  const fresh = endedGiveaways(messages.filter((m) => Date.parse(m.timestamp) > from)).filter(
    (g) => !past.some((p) => p.prize === g.prize && Math.abs(Date.parse(g.at) - Date.parse(p.date)) < WEEK),
  );
  if (!fresh.length) return { past, cursor, added: 0 };
  const added = fresh.map((g) => ({ date: g.at.slice(0, 10), prize: g.prize, winners: g.winners }));
  const last = fresh.map((g) => g.at).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return {
    // Same day: the new one first, the list stays newest first.
    past: [...added.reverse(), ...past].sort((a, b) => b.date.localeCompare(a.date)),
    cursor: last,
    added: added.length,
  };
}
