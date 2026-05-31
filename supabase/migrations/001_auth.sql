-- FoodAI — Supabase migration
-- Auth uniquement : aucune donnée de santé n'est stockée côté serveur.
-- Toutes les données médicales restent sur l'appareil (expo-sqlite).

-- La table auth.users est gérée automatiquement par Supabase Auth.
-- Ce fichier documente la politique : pas de tables de santé côté cloud.

-- Si une fonctionnalité de sync est ajoutée en Phase 3 (HDS),
-- les migrations correspondantes seront ajoutées ici.

SELECT 'FoodAI auth-only schema — données de santé stockées localement sur l''appareil' AS info;
