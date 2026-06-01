from __future__ import annotations
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from src.models import ProfilClinique, SeuilsNutritionnels
from src.database_manager import DatabaseManager
from src.agents import analyser_nephrologue, analyser_diabetologue, analyser_dieteticien, analyser_prise_de_sang, aria_chat

app = FastAPI(title="FoodAI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

_db: DatabaseManager | None = None

def get_db() -> DatabaseManager:
    global _db
    if _db is None:
        _db = DatabaseManager()
    return _db


# ── Recherche d'aliment dans le message pour enrichir Aria ──────────────────

_STOP_WORDS = {
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "me", "te", "se",
    "mon", "ton", "son", "ma", "ta", "sa", "les", "des", "une", "un", "que",
    "qui", "quoi", "dans", "avec", "pour", "sur", "par", "pas", "plus", "très",
    "bien", "peut", "veux", "peux", "dois", "faut", "bon", "bonne", "petit",
    "grande", "manger", "mange", "mang", "fait", "faire", "avoir", "être",
    "aller", "aimer", "vouloir", "pouvoir", "prendre", "mettre", "savoir",
    "comment", "quand", "pourquoi", "combien", "aujourd", "hier", "demain",
    "midi", "soir", "matin", "repas", "aliment", "portion", "gramme", "grammes",
    "quel", "quelle", "quels", "quelles", "aussi", "encore", "toujours", "jamais",
    "suis", "est", "sont", "mais", "donc", "alors", "comme", "ainsi", "cela",
}

def _detecter_aliment(message: str) -> Optional[dict]:
    """Extrait un nom d'aliment du message et retourne ses données nutritionnelles."""
    mots = re.findall(r"[a-zA-Zàâäéèêëîïôùûüç]{4,}", message.lower())
    mots_filtres = [m for m in mots if m not in _STOP_WORDS]
    # Essayer les bigrammes puis les mots seuls (du plus long au plus court)
    bigrammes = [f"{mots_filtres[i]} {mots_filtres[i+1]}" for i in range(len(mots_filtres)-1)]
    candidats = bigrammes + mots_filtres
    db = get_db()
    for candidat in candidats:
        try:
            aliment = db.rechercher_aliment(candidat)
            if aliment:
                return aliment.model_dump()
        except Exception:
            continue
    return None


# ── Endpoints ────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    aliment: str
    quantite_g: float = 100.0
    profil: ProfilClinique
    seuils: SeuilsNutritionnels


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/search")
def search(q: str, limit: int = 5):
    if len(q.strip()) < 2:
        return {"results": []}
    results = get_db().rechercher_aliments(q.strip(), limit=limit)
    return {"results": [r.model_dump() for r in results]}


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest):
    aliment = get_db().rechercher_aliment(request.aliment)
    if aliment is None:
        raise HTTPException(status_code=404, detail=f"Aliment '{request.aliment}' introuvable.")

    aliment_dict = aliment.model_dump()
    q = request.quantite_g

    v_nephro  = analyser_nephrologue(aliment_dict, q, request.profil, request.seuils)
    v_diabeto = analyser_diabetologue(aliment_dict, q, request.profil, request.seuils)
    v_dietet  = analyser_dieteticien(
        aliment_dict, q,
        v_nephro.model_dump(), v_diabeto.model_dump(),
        request.profil, request.seuils,
    )

    alertes = [v.niveau_alerte for v in [v_nephro, v_diabeto, v_dietet]]
    verdict_global = (
        "rouge"  if "rouge"  in alertes else
        "orange" if "orange" in alertes else
        "vert"
    )

    return {
        "aliment":             aliment_dict,
        "quantite_g":          q,
        "verdict_global":      verdict_global,
        "verdict_nephrologue":  v_nephro.model_dump(),
        "verdict_diabetologue": v_diabeto.model_dump(),
        "verdict_dieteticien":  v_dietet.model_dump(),
    }


class BloodTestRequest(BaseModel):
    images: list[dict]


@app.post("/api/analyze-bloodtest")
def analyze_bloodtest(request: BloodTestRequest):
    try:
        valeurs = analyser_prise_de_sang(request.images)
        return {"valeurs": valeurs}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class ChatHistoryItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    profil: ProfilClinique
    seuils: SeuilsNutritionnels
    resume_jour: dict | None = None
    historique: list[ChatHistoryItem] = []

@app.post("/api/chat")
def chat(request: ChatRequest):
    try:
        # Recherche automatique d'un aliment dans le message
        aliment_data = _detecter_aliment(request.message)

        response = aria_chat(
            message=request.message,
            profil=request.profil,
            seuils=request.seuils,
            resume_jour=request.resume_jour,
            historique=[{"role": m.role, "content": m.content} for m in request.historique],
            aliment_data=aliment_data,
        )
        return {"response": response}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
