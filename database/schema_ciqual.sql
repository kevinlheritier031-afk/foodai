-- FoodAI — Base CIQUAL locale (secours hors-ligne)
-- Source : Table de composition nutritionnelle CIQUAL 2020, ANSES
-- Unités : énergie en kcal/100g | macronutriments en g/100g | minéraux en mg/100g

CREATE TABLE IF NOT EXISTS ciqual_nutrition (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    alim_code       TEXT    NOT NULL UNIQUE,
    alim_nom_fr     TEXT    NOT NULL,
    energie_kcal    REAL    DEFAULT 0,
    proteines_g     REAL    DEFAULT 0,
    glucides_g      REAL    DEFAULT 0,
    lipides_g       REAL    DEFAULT 0,
    potassium_mg    REAL    DEFAULT 0,   -- Critique IRC stade 3b
    sodium_mg       REAL    DEFAULT 0,
    phosphore_mg    REAL    DEFAULT 0,
    fibres_g        REAL    DEFAULT 0,
    cree_le         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ciqual_nom        ON ciqual_nutrition (alim_nom_fr COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_ciqual_potassium  ON ciqual_nutrition (potassium_mg);
CREATE INDEX IF NOT EXISTS idx_ciqual_phosphore  ON ciqual_nutrition (phosphore_mg);
CREATE INDEX IF NOT EXISTS idx_ciqual_code       ON ciqual_nutrition (alim_code);

-- -----------------------------------------------------------------------
-- Données de test — valeurs CIQUAL 2020 pour 100 g d'aliment cru/cuit
-- -----------------------------------------------------------------------

INSERT OR IGNORE INTO ciqual_nutrition
    (alim_code, alim_nom_fr,
     energie_kcal, proteines_g, glucides_g, lipides_g,
     potassium_mg, sodium_mg, phosphore_mg, fibres_g)
VALUES
    -- Banane crue : potassium très élevé → ROUGE pour IRC 3b (kaliémie 5.1)
    ('2002',
     'Banane, crue',
     89.0, 1.09, 22.84, 0.33,
     358.0, 1.0, 22.0, 2.60),

    -- Pâtes cuites : faibles en potassium, glucides modérés → VERT rénal / ORANGE glycémique
    ('9000',
     'Pâtes alimentaires, cuites',
     131.0, 5.00, 25.00, 1.10,
     44.0, 1.0, 58.0, 1.80),

    -- Sauce tomate conserve : potassium modéré mais sodium élevé → ORANGE
    ('11053',
     'Sauce tomate, en conserve',
     35.0, 1.50, 6.00, 0.40,
     220.0, 300.0, 25.0, 1.50),

    -- Cabillaud vapeur : protéines élevées + potassium modéré → ORANGE rénal
    ('26020',
     'Cabillaud, filet, cuit à la vapeur',
     82.0, 17.80, 0.00, 0.70,
     340.0, 54.0, 180.0, 0.00),

    -- Pomme de terre bouillie : potassium très élevé → ROUGE (réduit ~30 % par trempage)
    ('20012',
     'Pomme de terre, bouillie sans sel',
     87.0, 2.00, 20.00, 0.10,
     379.0, 3.0, 44.0, 1.80);
