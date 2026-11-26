#!/usr/bin/env python3
"""guet-envoi : envoie les messages du guet des firmes (scripts/guet-firmes.mjs) par le chemin des bots du runner.

Même envoi que les messages du runner (runner_auto/evenements_discord.py : expediteur = daily_bias.monitor.
_send_discord_message, sans mention, cadence et reprises sur un 429), dans le salon --salon de
~/jtnq-assistant/state/monitoring_channels.json. Aucun secret nouveau : le jeton est celui des bots.

  PYTHONPATH=~/.local/share/runner-auto/code python guet-envoi.py --salon runner < messages.json

stdin = liste JSON de textes ; stdout = liste JSON de booléens (livré ou non), un par texte.
Code de sortie : 0 tout livré · 1 au moins un raté · 2 salon inconnu ou code du runner introuvable.
"""
import argparse
import json
import sys


def main(argv):
    ap = argparse.ArgumentParser(prog='guet-envoi.py')
    ap.add_argument('--salon', required=True)
    a = ap.parse_args(argv[1:])
    textes = json.load(sys.stdin)
    if not isinstance(textes, list) or not all(isinstance(t, str) for t in textes):
        sys.stderr.write('stdin : une liste JSON de textes est attendue\n')
        print(json.dumps([False] * (len(textes) if isinstance(textes, list) else 0)))
        return 2
    try:
        from runner_auto.evenements_discord import expediteur
        envoi = expediteur(a.salon)
    except Exception as e:  # code du runner absent, salon inconnu
        sys.stderr.write(f'envoi impossible : {type(e).__name__} : {e}\n')
        print(json.dumps([False] * len(textes)))
        return 2
    if envoi is None:
        sys.stderr.write('aucun salon : rien envoyé\n')
        print(json.dumps([False] * len(textes)))
        return 2
    ok = [bool(envoi(t)) for t in textes]
    print(json.dumps(ok))
    return 0 if all(ok) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
