from __future__ import annotations
import sqlite3
import json
import logging
from pathlib import Path
from typing import Optional

import httpx

from .models import AlimentNutrition

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "database" / "ciqual_local.db"
SCHEMA_PATH = BASE_DIR / "database" / "schema_ciqual.sql"

OPENFOODFACTS_URL = "https://world.openfoodfacts.org/cgi/search.pl"
API_TIMEOUT = 8.0


class DatabaseManager:
    """
    Recherche les données nutritionnelles d'un aliment via deux sources :
    1. API OpenFoodFacts (corpus français, données en ligne)
    2. Fallback automatique sur la base SQLite locale CIQUAL (hors-ligne)
    """

    def __init__(
        self,
        db_path: Path = DB_PATH,
        schema_path: Path = SCHEMA_PATH,
    ) -> None:
        self.db_path = db_path
        self.schema_path = schema_path
        self._initialiser_db()

    def _initialiser_db(self) -> None:
        """Crée la base SQLite locale depuis le schéma SQL si elle n'existe pas encore."""
        if self.db_path.exists():
            return
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        schema_sql = self.schema_path.read_text(encoding="utf-8")
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(schema_sql)
        logger.info("Base SQLite locale initialisée : %s", self.db_path)

    # ------------------------------------------------------------------
    # Source primaire : API OpenFoodFacts
    # ------------------------------------------------------------------

    def _rechercher_api(self, nom: str) -> Optional[AlimentNutrition]:
        params = {
            "search_terms": nom,
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "lc": "fr",
            "cc": "fr",
            "fields": "product_name_fr,product_name,nutriments",
            "page_size": 3,
        }
        try:
            with httpx.Client(timeout=API_TIMEOUT) as client:
                resp = client.get(OPENFOODFACTS_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            logger.warning("API OpenFoodFacts inaccessible : %s", exc)
            return None

        def _to_mg(val: float) -> float:
            return val if val > 10 else val * 1000

        for produit in data.get("products", []):
            n = produit.get("nutriments", {})
            if not n:
                continue
            try:
                energie = float(n.get("energy-kcal_100g") or 0)
                glucides = float(n.get("carbohydrates_100g") or 0)
                proteines = float(n.get("proteins_100g") or 0)
                # Rejeter les produits sans données macro (résultats incomplets)
                if energie == 0 and glucides == 0 and proteines == 0:
                    logger.debug("Produit ignoré (données nutritionnelles absentes)")
                    continue
                nom_produit = (
                    produit.get("product_name_fr")
                    or produit.get("product_name")
                    or nom
                )
                return AlimentNutrition(
                    nom=nom_produit,
                    energie_kcal=energie,
                    proteines_g=proteines,
                    glucides_g=glucides,
                    lipides_g=float(n.get("fat_100g") or 0),
                    potassium_mg=_to_mg(float(n.get("potassium_100g") or 0)),
                    sodium_mg=_to_mg(float(n.get("sodium_100g") or 0)),
                    phosphore_mg=_to_mg(float(n.get("phosphorus_100g") or 0)),
                    fibres_g=float(n.get("fiber_100g") or 0),
                    source="openfoodfacts_api",
                )
            except (KeyError, ValueError, TypeError) as exc:
                logger.debug("Produit ignoré (erreur de parsing) : %s", exc)
                continue
        return None

    # ------------------------------------------------------------------
    # Source de secours : SQLite local CIQUAL
    # ------------------------------------------------------------------

    def _rechercher_local_top(self, nom: str, limit: int = 5) -> list[AlimentNutrition]:
        """Recherche classée par pertinence : exact > commence par > contient."""
        query = """
            SELECT alim_nom_fr, energie_kcal, proteines_g, glucides_g, lipides_g,
                   potassium_mg, sodium_mg, phosphore_mg, fibres_g,
                   CASE
                     WHEN LOWER(alim_nom_fr) = LOWER(?)          THEN 3
                     WHEN LOWER(alim_nom_fr) LIKE LOWER(?) || '%' THEN 2
                     ELSE 1
                   END AS score
            FROM   ciqual_nutrition
            WHERE  alim_nom_fr LIKE '%' || ? || '%' COLLATE NOCASE
            ORDER  BY score DESC, LENGTH(alim_nom_fr) ASC
            LIMIT  ?
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, (nom, nom, nom, limit)).fetchall()
        return [
            AlimentNutrition(
                nom=row["alim_nom_fr"],
                energie_kcal=float(row["energie_kcal"] or 0),
                proteines_g=float(row["proteines_g"] or 0),
                glucides_g=float(row["glucides_g"] or 0),
                lipides_g=float(row["lipides_g"] or 0),
                potassium_mg=float(row["potassium_mg"] or 0),
                sodium_mg=float(row["sodium_mg"] or 0),
                phosphore_mg=float(row["phosphore_mg"] or 0),
                fibres_g=float(row["fibres_g"] or 0),
                source="sqlite_local",
            )
            for row in rows
        ]

    def _rechercher_local(self, nom: str) -> Optional[AlimentNutrition]:
        results = self._rechercher_local_top(nom, limit=1)
        return results[0] if results else None

    # ------------------------------------------------------------------
    # Points d'entrée publics
    # ------------------------------------------------------------------

    def rechercher_aliment(self, nom: str) -> Optional[AlimentNutrition]:
        """Retourne le meilleur résultat : CIQUAL local (prioritaire) → OpenFoodFacts."""
        result = self._rechercher_local(nom)
        if result:
            logger.info("Données CIQUAL trouvées en local pour '%s'", nom)
            return result
        logger.info("Non trouvé en local — recherche API OpenFoodFacts pour '%s'", nom)
        result = self._rechercher_api(nom)
        if result:
            logger.info("Données trouvées via API pour '%s'", nom)
        return result

    def rechercher_aliments(self, nom: str, limit: int = 5) -> list[AlimentNutrition]:
        """Retourne jusqu'à `limit` suggestions classées par pertinence (CIQUAL uniquement)."""
        return self._rechercher_local_top(nom, limit=min(limit, 10))
