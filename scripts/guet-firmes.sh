#!/bin/zsh
# Lanceur du guet des firmes (scripts/guet-firmes.mjs) pour le LaunchAgent com.angelo.guet-firmes (Mac, IP de maison :
# les pages de règles Lucid et Tradeify sont derrière Cloudflare, un runner GitHub prend un 403 une fois sur deux).
#
# Le guet tourne depuis SON clone du site (~/.local/share/guet-firmes/site, dépôt public, clone partiel), jamais depuis
# ~/jacktradesnq-site ni un slot : chaque tour le remet sur le main de GitHub (code du guet + JSON des offres que la
# synchro commite chaque jour), puis lance le guet. État, aperçu et textes des pages : ~/.local/share/guet-firmes.
#
#   zsh scripts/guet-firmes.sh             # aperçu seulement (aucun envoi)
#   zsh scripts/guet-firmes.sh --envoyer   # ce que lance le LaunchAgent
#
# Tout le corps est entre accolades : zsh le lit en entier avant de l'exécuter, le checkout peut donc réécrire ce
# fichier sans casser le tour en cours.
{
  set -u
  DOSSIER=${GUET_DOSSIER:-$HOME/.local/share/guet-firmes}
  SITE=$DOSSIER/site
  mkdir -p "$DOSSIER" || exit 1
  if [[ ! -d $SITE/.git ]]; then
    git clone -q --filter=blob:none --no-checkout https://github.com/jacktradesnq/jacktradesnq-site.git "$SITE" || exit 1
  fi
  git -C "$SITE" fetch -q origin main || { echo "guet-firmes : git fetch raté" >&2; exit 1; }
  git -C "$SITE" checkout -q --detach FETCH_HEAD || { echo "guet-firmes : checkout raté" >&2; exit 1; }
  echo "guet-firmes : $(date '+%F %T') main $(git -C "$SITE" rev-parse --short HEAD)"
  exec node "$SITE/scripts/guet-firmes.mjs" --depot "$SITE" --ref HEAD --etat "$DOSSIER" "$@"
}
