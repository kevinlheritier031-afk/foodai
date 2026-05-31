from __future__ import annotations
import os
import json
import re
import logging
from typing import Optional

from google import genai
from google.genai import types

from .models import (
    ProfilClinique,
    SeuilsNutritionnels,
    VerdictNephrologue,
    VerdictDiabetologue,
    VerdictDieteticien,
    NiveauAlerte,
    DISCLAIMER_TEXT,
)

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
_DEFAULT_PROFIL = ProfilClinique()
_DEFAULT_SEUILS = SeuilsNutritionnels()
_gemini: Optional[genai.Client] = None


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def _client() -> genai.Client:
    global _gemini
    if _gemini is None:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise EnvironmentError("GOOGLE_API_KEY non définie.")
        _gemini = genai.Client(api_key=api_key)
    return _gemini


def _extraire_json(texte: str) -> dict:
    texte = texte.strip()
    try:
        return json.loads(texte)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", texte)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    m = re.search(r"\{[\s\S]*\}", texte)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"JSON introuvable : {texte[:300]}")


def _formater_nutrition(aliment: dict, quantite_g: float) -> str:
    f = quantite_g / 100
    return (
        f"Aliment      : {aliment['nom']}\n"
        f"Portion      : {quantite_g} g\n"
        f"Énergie      : {aliment['energie_kcal'] * f:.1f} kcal\n"
        f"Protéines    : {aliment['proteines_g'] * f:.2f} g\n"
        f"Glucides     : {aliment['glucides_g'] * f:.2f} g\n"
        f"Lipides      : {aliment['lipides_g'] * f:.2f} g\n"
        f"Potassium    : {aliment['potassium_mg'] * f:.1f} mg  ← clé IRC\n"
        f"Sodium       : {aliment['sodium_mg'] * f:.1f} mg\n"
        f"Phosphore    : {aliment['phosphore_mg'] * f:.1f} mg\n"
        f"Fibres       : {aliment['fibres_g'] * f:.2f} g\n"
        f"(Source : {aliment.get('source', 'inconnue')})"
    )


def _call_gemini(system: str, user: str, max_tokens: int = 1024) -> dict:
    resp = _client().models.generate_content(
        model=MODEL,
        contents=[types.Part(text=user)],
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            thinking_config=types.ThinkingConfig(thinking_budget=0),
            temperature=0.2,
            max_output_tokens=max_tokens,
        ),
    )
    return _extraire_json(resp.text)


# ---------------------------------------------------------------------------
# Constructeurs de prompts dynamiques
# ---------------------------------------------------------------------------

def _prompt_nephrologue(p: ProfilClinique, s: SeuilsNutritionnels) -> str:
    hta = " + HTA" if getattr(p, "hypertension", False) else ""
    return f"""Tu es le module RÉNAL de FoodAI, outil d'accompagnement nutritionnel NON MÉDICAL.

PROFIL CLINIQUE :
• Néphropathie diabétique — IRC Stade {p.stade_irc} (KDIGO){hta}
• DFG : {p.dfg_ml_min} mL/min/1.73m²
• Kaliémie : {f"{p.kaliemie_mmol_l} mmol/L  ← {'LIMITE HAUTE → vigilance maximale' if p.kaliemie_mmol_l >= 5.0 else 'surveiller'}" if p.kaliemie_mmol_l is not None else "Non renseignée"}

SEUILS QUOTIDIENS (médecin) :
• Potassium  ≤ {s.potassium_max_mg_jour} mg/j
• Phosphore  ≤ {s.phosphore_max_mg_jour} mg/j
• Sodium     ≤ {s.sodium_max_mg_jour} mg/j

SEUILS ALERTE (par portion analysée) :
• Potassium > {s.potassium_alerte_mg_100g} mg → orange | > {s.potassium_danger_mg_100g} mg → rouge
• Phosphore > {s.phosphore_alerte_mg_100g} mg → orange
• Sodium    > {s.sodium_alerte_mg_100g} mg → orange

{DISCLAIMER_TEXT}

Réponds UNIQUEMENT en JSON valide :
{{"niveau_alerte":"vert|orange|rouge","potassium_evaluation":"...","phosphore_evaluation":"...","sodium_evaluation":"...","message":"...","contre_indique":false}}"""


def _prompt_diabetologue(p: ProfilClinique, s: SeuilsNutritionnels) -> str:
    return f"""Tu es le module GLYCÉMIQUE de FoodAI, outil d'accompagnement nutritionnel NON MÉDICAL.

PROFIL :
• Diabète de {p.diabete_type}
• IRC Stade {p.stade_irc} — restriction protéines ≤ {s.proteines_max_g_kg_jour} g/kg/j

{DISCLAIMER_TEXT}

Réponds UNIQUEMENT en JSON valide :
{{"niveau_alerte":"vert|orange|rouge","index_glycemique_estime":"bas (<55)|moyen (55-70)|élevé (>70)","charge_glucidique_g":0.0,"message":"...","recommandation_portion":"..."}}"""


def _prompt_dieteticien(p: ProfilClinique, s: SeuilsNutritionnels) -> str:
    hta = ", HTA" if getattr(p, "hypertension", False) else ""
    return f"""Tu es le module DIÉTÉTIQUE de FoodAI, outil d'accompagnement nutritionnel NON MÉDICAL.

PROFIL : IRC Stade {p.stade_irc}, kaliémie {f"{p.kaliemie_mmol_l} mmol/L" if p.kaliemie_mmol_l is not None else "non renseignée"}, Diabète {p.diabete_type}{hta}
SEUILS : K ≤ {s.potassium_max_mg_jour} mg/j | P ≤ {s.phosphore_max_mg_jour} mg/j | Na ≤ {s.sodium_max_mg_jour} mg/j

Propose des astuces culinaires concrètes (trempage, cuisson à l'eau changée…) et des alternatives.
Sois chaleureux(se) et encourageant(e).

{DISCLAIMER_TEXT}

Réponds UNIQUEMENT en JSON valide :
{{"niveau_alerte":"vert|orange|rouge","astuces_preparation":["..."],"alternatives_proposees":["..."],"conseil_portion":"...","message":"..."}}"""


# ---------------------------------------------------------------------------
# Agents publics
# ---------------------------------------------------------------------------

def analyser_nephrologue(
    aliment: dict,
    quantite_g: float,
    profil: Optional[ProfilClinique] = None,
    seuils: Optional[SeuilsNutritionnels] = None,
) -> VerdictNephrologue:
    p, s = profil or _DEFAULT_PROFIL, seuils or _DEFAULT_SEUILS
    nutrition = _formater_nutrition(aliment, quantite_g)
    try:
        donnees = _call_gemini(
            _prompt_nephrologue(p, s),
            f"Analyse l'impact rénal :\n\n{nutrition}",
        )
        return VerdictNephrologue(**donnees)
    except Exception as exc:
        logger.error("Erreur néphrologue : %s", exc)
        return VerdictNephrologue(
            niveau_alerte=NiveauAlerte.ORANGE,
            potassium_evaluation="Indisponible", phosphore_evaluation="Indisponible",
            sodium_evaluation="Indisponible",
            message=f"Service indisponible. {DISCLAIMER_TEXT}", contre_indique=False,
        )


def analyser_diabetologue(
    aliment: dict,
    quantite_g: float,
    profil: Optional[ProfilClinique] = None,
    seuils: Optional[SeuilsNutritionnels] = None,
) -> VerdictDiabetologue:
    p, s = profil or _DEFAULT_PROFIL, seuils or _DEFAULT_SEUILS
    nutrition = _formater_nutrition(aliment, quantite_g)
    try:
        donnees = _call_gemini(
            _prompt_diabetologue(p, s),
            f"Analyse l'impact glycémique :\n\n{nutrition}",
        )
        return VerdictDiabetologue(**donnees)
    except Exception as exc:
        logger.error("Erreur diabétologue : %s", exc)
        charge = aliment.get("glucides_g", 0) * quantite_g / 100
        return VerdictDiabetologue(
            niveau_alerte=NiveauAlerte.ORANGE,
            index_glycemique_estime="Indisponible",
            charge_glucidique_g=round(charge, 2),
            message=f"Service indisponible. {DISCLAIMER_TEXT}",
        )


def analyser_dieteticien(
    aliment: dict,
    quantite_g: float,
    verdict_nephrologue: Optional[dict] = None,
    verdict_diabetologue: Optional[dict] = None,
    profil: Optional[ProfilClinique] = None,
    seuils: Optional[SeuilsNutritionnels] = None,
) -> VerdictDieteticien:
    p, s = profil or _DEFAULT_PROFIL, seuils or _DEFAULT_SEUILS
    nutrition = _formater_nutrition(aliment, quantite_g)
    contexte = ""
    if verdict_nephrologue:
        contexte += f"\nVerdict rénal : {verdict_nephrologue.get('niveau_alerte','?').upper()} — {verdict_nephrologue.get('message','')}"
    if verdict_diabetologue:
        contexte += f"\nVerdict glycémique : {verdict_diabetologue.get('niveau_alerte','?').upper()} — {verdict_diabetologue.get('message','')}"
    try:
        donnees = _call_gemini(
            _prompt_dieteticien(p, s),
            f"Conseils diététiques :\n\n{nutrition}{contexte}",
            max_tokens=1500,
        )
        return VerdictDieteticien(**donnees)
    except Exception as exc:
        logger.error("Erreur diététicien : %s", exc)
        return VerdictDieteticien(
            niveau_alerte=NiveauAlerte.ORANGE,
            astuces_preparation=["Consultez votre diététicien."],
            alternatives_proposees=[], conseil_portion="Non évalué",
            message=f"Service indisponible. {DISCLAIMER_TEXT}",
        )


# ---------------------------------------------------------------------------
# Agent vision — Analyse de prise de sang
# ---------------------------------------------------------------------------

def aria_chat(
    message: str,
    profil: ProfilClinique,
    seuils: SeuilsNutritionnels,
    resume_jour: Optional[dict] = None,
    historique: Optional[list[dict]] = None,
    aliment_data: Optional[dict] = None,
) -> str:
    """Aria — assistante diététique IA, multi-tour, avec collaboration néphrologue/diabétologue."""
    if historique is None:
        historique = []

    hta = " + HTA" if getattr(profil, "hypertension", False) else ""
    kaliemie_str = f"{profil.kaliemie_mmol_l} mmol/L" if profil.kaliemie_mmol_l is not None else "non renseignée"

    # ── Collaboration agents spécialistes (si un aliment est identifié) ──────
    avis_specialistes = ""
    if aliment_data:
        try:
            v_nephro  = analyser_nephrologue(aliment_data, 100.0, profil, seuils)
            v_diabeto = analyser_diabetologue(aliment_data, 100.0, profil, seuils)
            niveaux   = ["vert", "orange", "rouge"]
            niveau    = max(niveaux.index(v_nephro.niveau_alerte.value),
                           niveaux.index(v_diabeto.niveau_alerte.value))
            badge     = ["✅", "⚠️", "🔴"][niveau]
            avis_specialistes = (
                f"\n── DONNÉES NUTRITIONNELLES RÉELLES (pour 100 g) ──\n"
                f"Aliment  : {aliment_data['nom']}\n"
                f"Énergie  : {aliment_data['energie_kcal']:.0f} kcal  |  Protéines : {aliment_data['proteines_g']:.1f} g\n"
                f"Potassium: {aliment_data['potassium_mg']:.0f} mg    |  Phosphore : {aliment_data['phosphore_mg']:.0f} mg\n"
                f"Sodium   : {aliment_data['sodium_mg']:.0f} mg       |  Glucides  : {aliment_data['glucides_g']:.1f} g\n"
                f"\n🩺 Néphrologue {badge} : {v_nephro.message}\n"
                f"🍬 Diabétologue {badge} : {v_diabeto.message}\n"
                f"   IG estimé : {v_diabeto.index_glycemique_estime} | Charge glucidique : {v_diabeto.charge_glucidique_g:.1f} g\n"
            )
        except Exception as exc:
            logger.warning("Agents spécialistes indisponibles : %s", exc)

    # ── Résumé apports du jour ───────────────────────────────────────────────
    today_ctx = ""
    if resume_jour:
        k_r  = seuils.potassium_max_mg_jour - (resume_jour.get("total_potassium_mg", 0) or 0)
        p_r  = seuils.phosphore_max_mg_jour - (resume_jour.get("total_phosphore_mg", 0) or 0)
        na_r = seuils.sodium_max_mg_jour    - (resume_jour.get("total_sodium_mg",    0) or 0)
        gl_r = seuils.glucides_max_g_jour   - (resume_jour.get("total_glucides_g",   0) or 0)
        today_ctx = (
            f"\n📊 APPORTS DÉJÀ CONSOMMÉS AUJOURD'HUI :\n"
            f"• Potassium : {resume_jour.get('total_potassium_mg', 0):.0f} / {seuils.potassium_max_mg_jour:.0f} mg (reste {k_r:.0f} mg)\n"
            f"• Phosphore : {resume_jour.get('total_phosphore_mg', 0):.0f} / {seuils.phosphore_max_mg_jour:.0f} mg (reste {p_r:.0f} mg)\n"
            f"• Sodium    : {resume_jour.get('total_sodium_mg', 0):.0f} / {seuils.sodium_max_mg_jour:.0f} mg (reste {na_r:.0f} mg)\n"
            f"• Glucides  : {resume_jour.get('total_glucides_g', 0):.1f} / {seuils.glucides_max_g_jour:.0f} g (reste {gl_r:.1f} g)\n"
            f"• Protéines : {resume_jour.get('total_proteines_g', 0):.1f} g\n"
        )

    system = f"""Tu es Aria ✦, l'assistante diététique IA de FoodAI. Tu incarnes 3 experts qui collaborent :
🩺 Dr. Rénal (néphrologue) — surveille K⁺, phosphore, sodium pour les reins
🍬 Dr. Sucre (diabétologue) — surveille glucides, index glycémique, charge glucidique
🥗 Aria (diététicienne) — synthétise et guide avec bienveillance et expertise pratique

PROFIL DU PATIENT :
• IRC Stade {profil.stade_irc}{hta} — DFG {profil.dfg_ml_min} mL/min/1.73m²
• Kaliémie K⁺ : {kaliemie_str}
• Diabète : {profil.diabete_type}

SEUILS PRESCRITS :
• Potassium ≤ {seuils.potassium_max_mg_jour:.0f} mg/j | Phosphore ≤ {seuils.phosphore_max_mg_jour:.0f} mg/j
• Sodium    ≤ {seuils.sodium_max_mg_jour:.0f} mg/j    | Glucides  ≤ {seuils.glucides_max_g_jour:.0f} g/j
• Protéines ≤ {seuils.proteines_max_g_kg_jour} g/kg/j
{today_ctx}{avis_specialistes}
RÈGLES DE RÉPONSE (toujours respecter) :
1. 😊 Utilise des emojis pour rendre la réponse vivante, chaleureuse et facile à lire
2. ⚖️ Donne TOUJOURS une quantité recommandée en grammes ("une portion de 80 g, c'est parfait !")
3. 🏠 Compare fait maison vs industriel quand pertinent (les produits transformés contiennent souvent du phosphore ajouté, plus de sodium, additifs…)
4. 💡 Propose une astuce concrète : trempage 12h + eau changée, rinçage des légumes en conserve, cuisson à l'eau jetée, etc.
5. 🔄 Si l'aliment est risqué, propose une alternative adaptée ("à la place, tu pourrais essayer…")
6. 📊 Mentionne les seuils restants si on approche d'une limite
7. ⚠️ Si situation à risque (kaliémie élevée + aliment riche en K, hypoglycémie…), sois directe et proactive
8. Structure en courts paragraphes lisibles sur mobile
9. Longueur : 4-8 phrases pour une question simple ; plus si détails demandés
10. Termine TOUJOURS par un encouragement ou une astuce bonus 💪

{DISCLAIMER_TEXT}"""

    contents = []
    for msg in historique[-12:]:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    try:
        resp = _client().models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                temperature=0.75,
                max_output_tokens=900,
            ),
        )
        return resp.text or "Désolée, je n'ai pas pu répondre. Réessayez !"
    except Exception as exc:
        logger.error("Erreur Aria : %s", exc)
        return "Je rencontre un problème technique. Réessayez dans un instant 😊"


def analyser_prise_de_sang(images: list[dict]) -> dict:
    """
    Analyse une ou plusieurs pages de résultats de prise de sang en un seul appel Gemini.
    Chaque élément de `images` est {"base64": str, "mime_type": str}.
    Retourne les valeurs biologiques détectées sous forme de dict.
    """
    import base64 as _b64
    KEYS = ["kaliemie", "dfg", "phosphore", "sodium", "creatinine", "hemoglobine"]

    prompt = (
        "Tu es un agent médical spécialisé en néphrologie. "
        f"Analyse {'ces ' + str(len(images)) + ' pages' if len(images) > 1 else 'cette page'} "
        "de résultats de prise de sang et extrait les valeurs biologiques suivantes "
        "si elles sont présentes et lisibles sur l'ensemble des pages :\n\n"
        "- kaliemie : Potassium (K+) en mmol/L\n"
        "- dfg : DFG ou eGFR en mL/min/1.73m²\n"
        "- phosphore : Phosphore ou Phosphate en mmol/L\n"
        "- sodium : Sodium (Na+) en mmol/L\n"
        "- creatinine : Créatinine en µmol/L\n"
        "- hemoglobine : Hémoglobine en g/dL\n\n"
        "Réponds UNIQUEMENT avec un objet JSON, sans texte autour. "
        "Si une valeur n'est pas présente ou illisible, mets null.\n"
        "Exemple : {\"kaliemie\": 5.1, \"dfg\": 32, \"phosphore\": null, \"sodium\": 138, \"creatinine\": 145, \"hemoglobine\": null}"
    )

    contents = [
        types.Part.from_bytes(
            data=_b64.b64decode(img["base64"]),
            mime_type=img.get("mime_type", "image/jpeg"),
        )
        for img in images
    ]
    contents.append(types.Part(text=prompt))

    client = _client()
    response = client.models.generate_content(model=MODEL, contents=contents)
    raw = response.text or ""
    try:
        data = _extraire_json(raw)
        return {k: (float(data[k]) if data.get(k) is not None else None) for k in KEYS}
    except Exception as exc:
        logger.error("Erreur parsing prise de sang : %s — %s", exc, raw[:200])
        return {k: None for k in KEYS}
