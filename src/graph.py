from __future__ import annotations
import logging
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, START, END

from .agents import analyser_nephrologue, analyser_diabetologue, analyser_dieteticien
from .database_manager import DatabaseManager
from .models import DISCLAIMER_TEXT

logger = logging.getLogger(__name__)

_db: Optional[DatabaseManager] = None


def _get_db() -> DatabaseManager:
    global _db
    if _db is None:
        _db = DatabaseManager()
    return _db


# ---------------------------------------------------------------------------
# État partagé du graphe LangGraph
# ---------------------------------------------------------------------------

class EtatAnalyse(TypedDict):
    demande_aliment: str
    quantite_g: float
    contexte_repas: Optional[str]
    aliment_nutrition: Optional[dict]     # AlimentNutrition.model_dump()
    verdict_nephrologue: Optional[dict]
    verdict_diabetologue: Optional[dict]
    verdict_dieteticien: Optional[dict]
    synthese: Optional[str]
    erreur: Optional[str]


# ---------------------------------------------------------------------------
# Nœuds du graphe
# ---------------------------------------------------------------------------

def node_recuperer_nutrition(state: EtatAnalyse) -> EtatAnalyse:
    try:
        aliment = _get_db().rechercher_aliment(state["demande_aliment"])
    except Exception as exc:
        return {**state, "erreur": f"Erreur base de données : {exc}"}
    if aliment is None:
        return {**state, "erreur": f"Aliment '{state['demande_aliment']}' introuvable."}
    return {**state, "aliment_nutrition": aliment.model_dump(), "erreur": None}


def node_nephrologue(state: EtatAnalyse) -> EtatAnalyse:
    if state.get("erreur") or not state.get("aliment_nutrition"):
        return state
    verdict = analyser_nephrologue(state["aliment_nutrition"], state["quantite_g"])
    return {**state, "verdict_nephrologue": verdict.model_dump()}


def node_diabetologue(state: EtatAnalyse) -> EtatAnalyse:
    if state.get("erreur") or not state.get("aliment_nutrition"):
        return state
    verdict = analyser_diabetologue(state["aliment_nutrition"], state["quantite_g"])
    return {**state, "verdict_diabetologue": verdict.model_dump()}


def node_dieteticien(state: EtatAnalyse) -> EtatAnalyse:
    if state.get("erreur") or not state.get("aliment_nutrition"):
        return state
    verdict = analyser_dieteticien(
        state["aliment_nutrition"],
        state["quantite_g"],
        state.get("verdict_nephrologue"),
        state.get("verdict_diabetologue"),
    )
    return {**state, "verdict_dieteticien": verdict.model_dump()}


def node_synthese(state: EtatAnalyse) -> EtatAnalyse:
    if state.get("erreur"):
        return {**state, "synthese": f"❌ Erreur : {state['erreur']}"}

    verdicts = [
        state.get("verdict_nephrologue"),
        state.get("verdict_diabetologue"),
        state.get("verdict_dieteticien"),
    ]
    alertes = [v["niveau_alerte"] for v in verdicts if v]

    alerte_globale = "vert"
    if "rouge" in alertes:
        alerte_globale = "rouge"
    elif "orange" in alertes:
        alerte_globale = "orange"

    emoji_global = {"vert": "✅", "orange": "⚠️", "rouge": "🔴"}[alerte_globale]
    alim = state.get("aliment_nutrition", {})
    nom = alim.get("nom", state["demande_aliment"])

    lignes = [
        f"{emoji_global} VERDICT GLOBAL : {alerte_globale.upper()}",
        f"Aliment : {nom}  |  Portion analysée : {state['quantite_g']} g",
        "",
    ]

    if v := state.get("verdict_nephrologue"):
        e = {"vert": "✅", "orange": "⚠️", "rouge": "🔴"}.get(v["niveau_alerte"], "")
        lignes += [f"🫀 Rénal {e} ({v['niveau_alerte'].upper()}) :", f"   {v['message']}", ""]

    if v := state.get("verdict_diabetologue"):
        e = {"vert": "✅", "orange": "⚠️", "rouge": "🔴"}.get(v["niveau_alerte"], "")
        lignes += [f"🩸 Glycémie {e} ({v['niveau_alerte'].upper()}) :", f"   {v['message']}", ""]

    if v := state.get("verdict_dieteticien"):
        e = {"vert": "✅", "orange": "⚠️", "rouge": "🔴"}.get(v["niveau_alerte"], "")
        lignes += [f"🥗 Diététique {e} ({v['niveau_alerte'].upper()}) :", f"   {v['message']}"]
        if astuces := v.get("astuces_preparation"):
            lignes.append("   Astuces  : " + " | ".join(astuces))
        if alts := v.get("alternatives_proposees"):
            lignes.append("   Alts     : " + ", ".join(alts))
        if conseil := v.get("conseil_portion"):
            lignes.append(f"   Portion  : {conseil}")
        lignes.append("")

    lignes.append(DISCLAIMER_TEXT)
    return {**state, "synthese": "\n".join(lignes)}


# ---------------------------------------------------------------------------
# Compilation du graphe LangGraph
# ---------------------------------------------------------------------------

def _construire_graphe():
    g = StateGraph(EtatAnalyse)

    g.add_node("recuperer_nutrition", node_recuperer_nutrition)
    g.add_node("nephrologue",         node_nephrologue)
    g.add_node("diabetologue",        node_diabetologue)
    g.add_node("dieteticien",         node_dieteticien)
    g.add_node("synthese",            node_synthese)

    g.add_edge(START,                "recuperer_nutrition")
    g.add_edge("recuperer_nutrition", "nephrologue")
    g.add_edge("nephrologue",         "diabetologue")
    g.add_edge("diabetologue",        "dieteticien")
    g.add_edge("dieteticien",         "synthese")
    g.add_edge("synthese",            END)

    return g.compile()


graphe_foodai = _construire_graphe()


def analyser(
    aliment: str,
    quantite_g: float = 100.0,
    contexte: Optional[str] = None,
) -> dict:
    """Point d'entrée public : retourne l'état final avec synthèse et verdicts."""
    etat_initial: EtatAnalyse = {
        "demande_aliment": aliment,
        "quantite_g": quantite_g,
        "contexte_repas": contexte,
        "aliment_nutrition": None,
        "verdict_nephrologue": None,
        "verdict_diabetologue": None,
        "verdict_dieteticien": None,
        "synthese": None,
        "erreur": None,
    }
    return graphe_foodai.invoke(etat_initial)
