"""
Import de la Table CIQUAL 2025 (ANSES) dans la base SQLite locale.
Usage : python database/import_ciqual.py
"""
from __future__ import annotations
import sqlite3
import re
from pathlib import Path

import openpyxl

BASE_DIR  = Path(__file__).parent
XLSX_PATH = BASE_DIR / "Table_CIQUAL.xlsx"
DB_PATH   = BASE_DIR / "ciqual_local.db"
SHEET     = "composition nutritionnelle"

# Indices des colonnes dans l'Excel (0-based, ligne 1 = en-têtes)
COL_CODE       = 6
COL_NOM        = 7
COL_KCAL       = 10   # Energie kcal/100 g (Règlement UE 1169/2011)
COL_PROTEINES  = 14   # Protéines N x Jones (g/100 g)
COL_GLUCIDES   = 16   # Glucides (g/100 g)
COL_LIPIDES    = 17   # Lipides (g/100 g)
COL_FIBRES     = 26   # Fibres alimentaires (g/100 g)
COL_PHOSPHORE  = 57   # Phosphore (mg/100 g)
COL_POTASSIUM  = 58   # Potassium (mg/100 g)
COL_SODIUM     = 60   # Sodium (mg/100 g)


def parse_val(raw) -> float:
    """Convertit une valeur CIQUAL en float (gère '-', '<X', 'traces', virgule FR)."""
    if raw is None:
        return 0.0
    s = str(raw).strip()
    if s in ("-", "", "traces", "Traces"):
        return 0.0
    # Valeur < seuil : ex "<0.001" → prendre 0
    if s.startswith("<"):
        return 0.0
    # Séparateur décimal français
    s = s.replace(",", ".").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def run():
    if not XLSX_PATH.exists():
        print(f"Fichier introuvable : {XLSX_PATH}")
        return

    print(f"Lecture de {XLSX_PATH.name}...")
    wb = openpyxl.load_workbook(str(XLSX_PATH), read_only=True, data_only=True)
    ws = wb[SHEET]

    rows_data = list(ws.iter_rows(min_row=2, values_only=True))  # sauter l'en-tête
    print(f"   {len(rows_data)} aliments trouvés dans le fichier.")

    with sqlite3.connect(DB_PATH) as conn:
        # Vider l'ancienne table (données de test + ancienne version)
        conn.execute("DELETE FROM ciqual_nutrition")
        conn.execute("DELETE FROM sqlite_sequence WHERE name='ciqual_nutrition'")

        inserted = 0
        skipped  = 0
        for row in rows_data:
            code = str(row[COL_CODE]).strip() if row[COL_CODE] is not None else None
            nom  = str(row[COL_NOM]).strip()  if row[COL_NOM]  is not None else None
            if not code or not nom:
                skipped += 1
                continue

            conn.execute(
                """INSERT OR REPLACE INTO ciqual_nutrition
                   (alim_code, alim_nom_fr,
                    energie_kcal, proteines_g, glucides_g, lipides_g,
                    potassium_mg, sodium_mg, phosphore_mg, fibres_g)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    code, nom,
                    parse_val(row[COL_KCAL]),
                    parse_val(row[COL_PROTEINES]),
                    parse_val(row[COL_GLUCIDES]),
                    parse_val(row[COL_LIPIDES]),
                    parse_val(row[COL_POTASSIUM]),
                    parse_val(row[COL_SODIUM]),
                    parse_val(row[COL_PHOSPHORE]),
                    parse_val(row[COL_FIBRES]),
                ),
            )
            inserted += 1

        conn.commit()

    print(f"Import termine : {inserted} aliments importes, {skipped} lignes ignorees.")
    print(f"Base : {DB_PATH}")

    # Verification rapide
    with sqlite3.connect(DB_PATH) as conn:
        total = conn.execute("SELECT COUNT(*) FROM ciqual_nutrition").fetchone()[0]
        ex = conn.execute(
            "SELECT alim_nom_fr, potassium_mg, phosphore_mg FROM ciqual_nutrition "
            "WHERE alim_nom_fr LIKE '%banane%' LIMIT 2"
        ).fetchall()
        print(f"Total en base : {total} aliments")
        print("Exemple (banane) :", ex)


if __name__ == "__main__":
    run()
