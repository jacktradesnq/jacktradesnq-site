/**
 * Relit #giveaways et ajoute à content/giveaways/giveaways.json les giveaways terminés depuis le
 * dernier passage (lib/giveaway-sync.mjs). Lancé chaque jour par update-prop-firms.yml.
 *
 * Trois sorties, distinctes dans les logs :
 *   « OK — rien de nouveau (N messages lus) »   code 0
 *   « OK — N giveaway(s) ajouté(s) »            code 0
 *   « ÉCHEC — … »                               code 1 : token absent, Discord illisible, salon introuvable
 *
 *   DISCORD_BOT_TOKEN=… node scripts/sync-giveaways.mjs         relit et écrit
 *   DISCORD_BOT_TOKEN=… node scripts/sync-giveaways.mjs --dry   relit, n'écrit rien
 */

import fs from 'node:fs';
import { addNewGiveaways } from '../lib/giveaway-sync.mjs';

const DATA_URL = new URL('../content/giveaways/giveaways.json', import.meta.url);
const GUILD_ID = '1528081759512825916';
const API = 'https://discord.com/api/v10';
const PAGE = 100;
const MAX_PAGES = 10;

async function discord(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bot ${token}`, 'user-agent': 'DiscordBot (https://jacktradesnq.com, 1.0)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Discord HTTP ${res.status} sur ${path}`);
  return res.json();
}

/** Les messages du salon jusqu'au curseur, page par page. */
async function messagesSince(channelId, cursor, token) {
  const from = Date.parse(cursor);
  const all = [];
  let before = null;
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const page = await discord(`/channels/${channelId}/messages?limit=${PAGE}${before ? `&before=${before}` : ''}`, token);
    all.push(...page);
    if (page.length < PAGE || Date.parse(page[page.length - 1].timestamp) <= from) break;
    before = page[page.length - 1].id;
  }
  return all;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN absent');
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));
  const channels = await discord(`/guilds/${GUILD_ID}/channels`, token);
  const channel = channels.find((c) => c.type === 0 && c.name.endsWith('-giveaways'));
  if (!channel) throw new Error('salon #giveaways introuvable');
  const messages = await messagesSince(channel.id, data.syncedThrough, token);
  if (!messages.length) throw new Error('aucun message lu dans #giveaways');
  const r = addNewGiveaways(data.past, data.syncedThrough, messages);
  if (!r.added) {
    console.log(`giveaways: OK — rien de nouveau (${messages.length} messages lus)`);
    return;
  }
  console.log(`giveaways: OK — ${r.added} giveaway(s) ajouté(s) : ${r.past.slice(0, r.added).map((g) => g.prize).join(' | ')}`);
  if (dry) {
    console.log('--dry : rien écrit.');
    return;
  }
  fs.writeFileSync(DATA_URL, `${JSON.stringify({ ...data, past: r.past, syncedThrough: r.cursor }, null, 2)}\n`);
}

main().catch((e) => {
  console.error(`giveaways: ÉCHEC — ${e.message}`);
  process.exit(1);
});
