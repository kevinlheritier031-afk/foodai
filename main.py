#!/usr/bin/env python3
"""
FoodAI — Script de simulation
Analyse nutritionnelle pour une patiente atteinte de néphropathie diabétique.

Usage :
    python main.py                        # analyse une banane (100 g)
    python main.py "pomme de terre" 150   # analyse 150 g de pomme de terre
    python main.py cabillaud 120 "dîner"  # avec contexte repas
"""
from __future__ import annotations
import sys
import logging
from pathlib import Path

# Force UTF-8 sur le terminal Windows (évite les erreurs avec les emojis)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Chargement des variables d'environnement depuis .env (si python-dotenv est installé)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s : %(message)s",
    datefmt="%H:%M:%S",
)

from src.graph import analyser

SEP = "─" * 62


def afficher_rapport(etat: dict) -> None:
    print(f"\n{SEP}")

    if etat.get("synthese"):
        print(etat["synthese"])
    else:
        print("⚠️  Aucune synthèse générée.")

    # Tableau nutritionnel détaillé
    if alim := etat.get("aliment_nutrition"):
        q = etat.get("quantite_g", 100)
        f = q / 100
        print(f"\n{'─'*30}")
        print(f"📊 Détail nutritionnel — {alim['nom']} ({q} g)")
        print(f"   Énergie    : {alim['energie_kcal'] * f:.1f} kcal")
        print(f"   Potassium  : {alim['potassium_mg'] * f:.1f} mg  ← clé IRC stade 3b")
        print(f"   Phosphore  : {alim['phosphore_mg'] * f:.1f} mg")
        print(f"   Sodium     : {alim['sodium_mg'] * f:.1f} mg")
        print(f"   Glucides   : {alim['glucides_g'] * f:.1f} g")
        print(f"   Protéines  : {alim['proteines_g'] * f:.1f} g")
        print(f"   Source     : {alim['source']}")

    print(SEP)


def main() -> None:
    aliment  = sys.argv[1] if len(sys.argv) > 1 else "banane"
    quantite = float(sys.argv[2]) if len(sys.argv) > 2 else 100.0
    contexte = sys.argv[3] if len(sys.argv) > 3 else None

    print(f"\n🍽️  FoodAI — Analyse nutritionnelle multi-agents")
    print(f"   Patiente : Néphropathie diabétique | IRC 3b | Kaliémie 5.1 mmol/L")
    print(f"   Aliment  : {aliment!r}  |  Portion : {quantite} g"
          + (f"  |  Contexte : {contexte}" if contexte else ""))
    print(SEP)
    print("⏳ Analyse en cours : récupération → néphrologue → diabétologue → diététicien…\n")

    try:
        etat_final = analyser(aliment, quantite, contexte)
        afficher_rapport(etat_final)
    except EnvironmentError as exc:
        print(f"\n❌ Configuration manquante : {exc}")
        print("   → Copiez .env.example en .env et renseignez votre ANTHROPIC_API_KEY")
        sys.exit(1)
    except Exception as exc:
        logging.exception("Erreur inattendue")
        print(f"\n❌ Erreur inattendue : {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
