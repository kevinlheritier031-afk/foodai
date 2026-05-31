from __future__ import annotations
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field

DISCLAIMER_TEXT = (
    "⚠️ INFORMATION IMPORTANTE : FoodAI est un outil d'aide au suivi nutritionnel, "
    "pas un dispositif médical. Il ne pose aucun diagnostic et ne remplace pas les "
    "recommandations de votre équipe soignante (néphrologue, diabétologue, diététicien). "
    "Les seuils utilisés sont ceux communiqués par votre médecin traitant."
)


class NiveauAlerte(str, Enum):
    VERT = "vert"
    ORANGE = "orange"
    ROUGE = "rouge"


class ProfilClinique(BaseModel):
    """Profil clinique de la patiente — valeurs fixées par l'équipe soignante."""
    dfg_ml_min: float = Field(32.0, description="Débit de filtration glomérulaire mL/min/1.73m²")
    stade_irc: str = Field("3b", description="Stade IRC selon classification KDIGO")
    kaliemie_mmol_l: Optional[float] = Field(None, description="Kaliémie mmol/L — null si non renseignée")
    diabete_type: str = Field("Type 2")
    hypertension: bool = Field(False, description="Hypertension artérielle")
    poids_kg: Optional[float] = Field(None, description="Poids kg pour calcul protéines/kg/j")


class SeuilsNutritionnels(BaseModel):
    """Seuils quotidiens fixés par l'équipe soignante — à ne jamais modifier sans accord médical."""
    potassium_max_mg_jour: float = Field(2000.0, description="Apport max potassium mg/j")
    phosphore_max_mg_jour: float = Field(900.0, description="Apport max phosphore mg/j")
    sodium_max_mg_jour: float = Field(2000.0, description="Apport max sodium mg/j")
    proteines_max_g_kg_jour: float = Field(0.8, description="Apport max protéines g/kg/j")
    # Seuils de rapidité pour évaluation par portion de 100 g
    glucides_max_g_jour: float = Field(150.0, description="Apport max glucides g/j (suivi diabétique)")
    potassium_alerte_mg_100g: float = Field(200.0, description="Seuil orange potassium/100g")
    potassium_danger_mg_100g: float = Field(300.0, description="Seuil rouge potassium/100g")
    phosphore_alerte_mg_100g: float = Field(150.0, description="Seuil orange phosphore/100g")
    sodium_alerte_mg_100g: float = Field(300.0, description="Seuil orange sodium/100g")


class AlimentNutrition(BaseModel):
    """Données nutritionnelles d'un aliment pour 100 g."""
    nom: str
    energie_kcal: float = 0.0
    proteines_g: float = 0.0
    glucides_g: float = 0.0
    lipides_g: float = 0.0
    potassium_mg: float = 0.0
    sodium_mg: float = 0.0
    phosphore_mg: float = 0.0
    fibres_g: float = 0.0
    source: str = Field("inconnu", description="ciqual_api | openfoodfacts_api | sqlite_local")


class DemandeAnalyse(BaseModel):
    aliment: str
    quantite_g: float = Field(100.0, ge=1.0, le=2000.0)
    contexte_repas: Optional[str] = None


class VerdictNephrologue(BaseModel):
    """Verdict du néphrologue sur la sécurité rénale de l'aliment."""
    niveau_alerte: NiveauAlerte
    potassium_evaluation: str
    phosphore_evaluation: str
    sodium_evaluation: str
    message: str
    contre_indique: bool = False


class VerdictDiabetologue(BaseModel):
    """Verdict du diabétologue sur l'impact glycémique de l'aliment."""
    niveau_alerte: NiveauAlerte
    index_glycemique_estime: str
    charge_glucidique_g: float
    message: str
    recommandation_portion: Optional[str] = None


class VerdictDieteticien(BaseModel):
    """Conseils pratiques du diététicien : préparation, alternatives, portions."""
    niveau_alerte: NiveauAlerte
    astuces_preparation: List[str]
    alternatives_proposees: List[str]
    conseil_portion: str
    message: str


class RapportComplet(BaseModel):
    """Rapport final synthétisant les 3 verdicts spécialisés."""
    aliment: AlimentNutrition
    quantite_g: float
    verdict_nephrologue: Optional[VerdictNephrologue] = None
    verdict_diabetologue: Optional[VerdictDiabetologue] = None
    verdict_dieteticien: Optional[VerdictDieteticien] = None
    synthese: Optional[str] = None
    disclaimer: str = DISCLAIMER_TEXT
