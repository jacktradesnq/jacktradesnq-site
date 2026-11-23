/**
 * Lecture d'une page publique par curl_cffi (impersonate chrome), pour les sites derrière Cloudflare.
 * Un fetch Node reçoit parfois 403 « cf-mitigated: challenge » (lucidtrading.com, help.tradeify.co,
 * constaté le 23/11/2026), curl_cffi non : il reprend l'empreinte TLS d'un navigateur. Appelle
 * scripts/lib/cf-get.py (python3 + `pip install curl_cffi`), sans shell : l'URL est un argument.
 *
 *   const { status, text, via } = await cfFetch('https://lucidtrading.com/');
 *
 * Rend { status, text, via } pour tout statut HTTP (à l'appelant de juger ; via = profil curl_cffi qui a répondu :
 * chrome, puis safari si chrome est bloqué, 2 tours) ; lève une erreur si curl_cffi manque, si le réseau est coupé ou
 * si le délai est dépassé. CF_PYTHON choisit un autre python3.
 */
import { execFile } from 'node:child_process';

const CF_GET = new URL('./cf-get.py', import.meta.url).pathname;

export function cfFetch(url, { timeoutMs = 30_000, python = process.env.CF_PYTHON || 'python3' } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      python,
      [CF_GET, url, '--timeout', String(Math.max(1, Math.floor(timeoutMs / 1000)))],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 4 * timeoutMs + 10_000 },
      (err, stdout, stderr) => {
        const errText = stderr?.toString('utf8').trim() ?? '';
        const status = Number(errText.match(/^HTTP (\d{3})/m)?.[1]);
        if (Number.isFinite(status)) return resolve({ status, text: stdout.toString('utf8'), via: errText.match(/^via (\S+)/m)?.[1] ?? null });
        if (err?.code === 'ENOENT') return reject(new Error(`${python} introuvable (python3 + pip install curl_cffi requis)`));
        reject(new Error(`cf-get : ${errText || err?.message || 'échec sans message'}`));
      },
    );
  });
}

/**
 * Texte d'une page : fetch simple d'abord (il passe là où le site ne bloque pas : tradeify.co, BluSky…), et seulement sur
 * un 403 / 429 / 503 (défi Cloudflare, limite) la même page par curl_cffi. Lève « HTTP <code> sur <url> » si rien ne passe.
 */
export async function fetchPageText(url, { headers = {}, timeoutMs = 30_000, fetchImpl = fetch, viaCurl = cfFetch } = {}) {
  const res = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  if (res.ok) return res.text();
  if (![403, 429, 503].includes(res.status)) throw new Error(`HTTP ${res.status} sur ${url}`);
  let alt;
  try {
    alt = await viaCurl(url, { timeoutMs });
  } catch (e) {
    throw new Error(`HTTP ${res.status} sur ${url} (repli curl_cffi impossible : ${e.message})`);
  }
  if (alt.status >= 200 && alt.status < 300) return alt.text;
  throw new Error(`HTTP ${res.status} sur ${url} (curl_cffi : HTTP ${alt.status})`);
}
