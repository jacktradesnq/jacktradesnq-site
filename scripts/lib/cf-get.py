#!/usr/bin/env python3
"""cf-get : lit une page publique avec curl_cffi (impersonate chrome, puis safari).

Pourquoi (Angelo, 23/11/2026) : lucidtrading.com, support.lucidtrading.com et help.tradeify.co répondent
parfois 403 « cf-mitigated: challenge » (Cloudflare) à fetch / urllib / curl. curl_cffi reprend l'empreinte
TLS et HTTP/2 d'un vrai navigateur et passe. Mesuré le 23/11/2026 : depuis la maison, 'chrome' passe ; depuis
un runner GitHub (IP de datacenter), 'chrome' reçoit 403 cinq fois sur six sur lucidtrading.com et 'safari'
200 six fois sur six : les profils sont donc essayés dans l'ordre, deux tours (pause de 3 s entre les tours).

  python3 scripts/lib/cf-get.py <url> [--timeout 45] [--profiles chrome,safari]

Le corps de la réponse sort sur stdout (octets bruts), stderr dit « HTTP <code> » puis « via <profil> ».
Seuls 403 / 429 / 503 (blocage ou limite) font essayer le profil suivant ; un 404 est rendu tel quel.
Code de sortie : 0 = 2xx · 3 = autre statut HTTP (corps quand même sur stdout) · 4 = curl_cffi absent
(pip install curl_cffi) · 5 = erreur réseau / délai dépassé.
"""
import sys
import time


def main(argv):
    import argparse
    ap = argparse.ArgumentParser(prog='cf-get.py', description='lit une page publique avec curl_cffi')
    ap.add_argument('url')
    ap.add_argument('--timeout', type=float, default=45.0)
    ap.add_argument('--profiles', default='chrome,safari')
    args = ap.parse_args(argv[1:])
    try:
        from curl_cffi import requests
    except ImportError:
        sys.stderr.write('curl_cffi absent (pip install curl_cffi)\n')
        return 4
    res, via, erreur, fini = None, None, None, False
    for tour in range(2):
        for profil in args.profiles.split(','):
            try:
                essai = requests.get(args.url, impersonate=profil, timeout=args.timeout)
            except Exception as e:  # réseau, TLS, délai, profil inconnu
                erreur = f'{type(e).__name__} : {e}'
                continue
            res, via = essai, profil
            if essai.status_code not in (403, 429, 503):  # 2xx, 404… : une réponse franche, on n'insiste pas
                fini = True
                break
        if fini:
            break
        if tour == 0:
            time.sleep(3)
    if res is None:
        sys.stderr.write(f'erreur réseau : {erreur}\n')
        return 5
    sys.stderr.write(f'HTTP {res.status_code}\nvia {via}\n')
    sys.stdout.buffer.write(res.content)
    sys.stdout.buffer.flush()
    return 0 if 200 <= res.status_code < 300 else 3


if __name__ == '__main__':
    sys.exit(main(sys.argv))
