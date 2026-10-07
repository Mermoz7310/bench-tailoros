# TailorOS — Spécification MVP (banc d'essai n°1)

Gestion d'atelier de couture : clients, fiches de mesures, commandes avec acompte.
Construit sur factory-template. Spec gelée : toute modification crée une v2.

## Rôles

Ceux du gabarit : `owner`, `admin`, `member`. Tout membre gère clients, mesures, commandes et paiements.
Seuls `admin` et `owner` peuvent supprimer un client ou annuler une commande.

## User stories

| # | En tant que | Je veux | Afin de | Test d'acceptation |
| --- | --- | --- | --- | --- |
| S1 | membre | créer un client (nom obligatoire, téléphone) et retrouver la liste en le cherchant par nom ou téléphone | ne plus perdre mes clients | `customers.spec.ts` |
| S2 | membre | enregistrer une fiche de mesures datée pour un client (tour de poitrine, taille, hanches, épaule, longueur manche, longueur totale, en cm) et voir la plus récente en premier | ne plus chercher les mesures dans un cahier | `measurements.spec.ts` |
| S3 | membre | créer une commande pour un client avec description, prix total et date de livraison prévue | suivre le travail promis | `orders.spec.ts` |
| S4 | membre | enregistrer un acompte ou un paiement sur une commande et voir le reste à payer | savoir qui me doit de l'argent | `orders.spec.ts` |
| S5 | membre | faire avancer le statut d'une commande (reçue → en cours → prête → livrée) et voir sur le tableau de bord les commandes en retard et le total restant à encaisser | ne rater aucune livraison | `dashboard.spec.ts` |

## Règles métier (vérifiées en base et par les tests)

1. Montants en francs CFA entiers (XOF), strictement positifs pour un paiement, ≥ 0 pour un prix.
2. La somme des paiements d'une commande ne peut jamais dépasser son prix total.
3. Mesures : entre 1 et 300 cm, au moins une mesure renseignée.
4. Statuts : `received → in_progress → ready → delivered`, un pas en avant à la fois ; `cancelled` possible avant `delivered` (admin/owner).
5. Une commande est en retard si la date prévue est passée et qu'elle n'est ni livrée ni annulée.
6. Isolation : aucune donnée d'une organisation n'est visible ni modifiable par une autre.

## Hors périmètre MVP

Rappels WhatsApp, modèles/photos, factures PDF, paiements en ligne : versions suivantes.
