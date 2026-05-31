# Politique de confidentialité — FoodAI
**Version 1.0.0 — En vigueur le 31 mai 2026**

## 1. Qui sommes-nous ?
FoodAI est une application d'aide au suivi nutritionnel pour les personnes atteintes d'insuffisance rénale chronique et/ou de diabète. Elle n'est pas un dispositif médical.

## 2. Données collectées et stockage

### Données stockées LOCALEMENT sur votre appareil (jamais transmises)
- Profil clinique : DFG, stade IRC, kaliémie, seuils nutritionnels
- Journal alimentaire quotidien
- Historique des analyses

**Ces données ne quittent jamais votre téléphone.**

### Données transmises à nos serveurs
- **Nom de l'aliment analysé** (anonyme, sans identifiant utilisateur)
- **Seuils nutritionnels agrégés** (sans données personnelles identifiables)

Ces données transitent vers notre API pour interroger le modèle d'IA Gemini (Google). Elles ne sont pas stockées sur nos serveurs.

### Données d'authentification (Supabase)
- Adresse email et mot de passe (chiffré)
- Tokens de session (stockés dans le trousseau sécurisé de votre appareil)

## 3. Base légale (RGPD)
- **Consentement explicite** : recueilli au premier lancement (Art. 6.1.a RGPD)
- **Données de santé** : Art. 9.2.a RGPD — consentement explicite pour le traitement local

## 4. Vos droits
Conformément au RGPD, vous disposez des droits suivants :
- **Accès** : export de toutes vos données depuis Paramètres → Exporter mes données
- **Suppression** : suppression complète depuis Paramètres → Supprimer toutes mes données
- **Portabilité** : format JSON standard
- **Rectification** : modification dans l'écran Profil

## 5. Conservation des données
Les données locales sont conservées jusqu'à désinstallation de l'application ou suppression manuelle.
Les données d'authentification Supabase sont supprimées sur demande.

## 6. Sécurité
- Données cliniques : stockées dans expo-sqlite (sandbox applicatif sécurisé)
- Tokens d'authentification : expo-secure-store (Keystore Android / Keychain iOS)
- Transmissions réseau : HTTPS uniquement

## 7. Transferts hors UE
L'API Gemini (Google) peut traiter les noms d'aliments en dehors de l'UE.
Aucune donnée de santé personnelle n'est incluse dans ces requêtes.

## 8. Contact
Pour toute question relative à vos données : privacy@foodai.app

## 9. Avertissement médical
FoodAI est un outil d'aide au suivi nutritionnel. Il ne pose aucun diagnostic médical et ne remplace pas les recommandations de votre équipe soignante. Consultez toujours votre médecin avant de modifier votre alimentation.
