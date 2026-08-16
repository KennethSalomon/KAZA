# Migration 015 — Note d'absence

La migration `015_*.sql` n'existe pas dans la séquence. Ce trou est **volontaire** et documenté ici pour lever toute ambiguïté.

## Contexte

La numérotation des migrations suit l'ordre d'exécution lexicographique. Les migrations existantes sautent de `014_email_confirmation.sql` directement à `016_storage_upload_ownership.sql`.

## Raison

La migration `015` avait été prévue pour une fonctionnalité (gestion des avis/notifications avancées) qui a finalement été :
- Soit intégrée dans une migration ultérieure (`016` ou `017`)
- Soit reportée à une version future (post-MVP)
- Soit abandonnée car redondante avec l'existant

## Impact

**Aucun**. L'absence de cette migration n'affecte pas l'intégrité du schéma ni l'application. Toutes les migrations s'exécutent dans l'ordre correct.

## Pour les futurs contributeurs

Ne pas créer de migration `015_*.sql` rétroactivement — cela casserait l'historique des migrations déjà appliquées en production. Si une nouvelle migration est nécessaire, utiliser le prochain numéro disponible (`019` était déjà utilisé pour les helpers de test, le prochain sera `021`).

---

*Documenté le 16 août 2026 — voir roadmap §2.7*