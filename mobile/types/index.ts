export type AlertLevel = 'vert' | 'orange' | 'rouge';

export interface ClinicalProfile {
  dfg_ml_min: number;
  stade_irc: string;
  kaliemie_mmol_l?: number | null;
  phosphoremie_mg_l?: number | null;
  diabete_type: string;
  hypertension: boolean;
}

export interface BloodPressure {
  id: string;
  profile_id: string;
  systolique: number;
  diastolique: number;
  pouls?: number | null;
  note?: string | null;
  measured_at: string;
  created_at: string;
}

export type MomentGlycemie = 'a_jeun' | 'avant_repas' | 'apres_repas' | 'coucher' | 'autre';

export interface GlycemieEntry {
  id: string;
  profile_id: string;
  glycemie_mg_dl: number;
  moment: MomentGlycemie;
  note?: string | null;
  measured_at: string;
  created_at: string;
}

export interface NutritionalThresholds {
  potassium_max_mg_jour: number;
  phosphore_max_mg_jour: number;
  sodium_max_mg_jour: number;
  proteines_max_g_kg_jour: number;
  glucides_max_g_jour: number;
  potassium_alerte_mg_100g: number;
  potassium_danger_mg_100g: number;
  phosphore_alerte_mg_100g: number;
  sodium_alerte_mg_100g: number;
}

export interface Profile {
  id: string;
  nom: string;
  relation: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicalData extends ClinicalProfile, NutritionalThresholds {
  id: string;
  profile_id: string;
  note_rdv?: string;
  date_rdv?: string;
  created_at: string;
}

export interface FoodNutrition {
  nom: string;
  energie_kcal: number;
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
  potassium_mg: number;
  sodium_mg: number;
  phosphore_mg: number;
  fibres_g: number;
  source: string;
}

export interface AgentVerdict {
  niveau_alerte: AlertLevel;
  message: string;
  [key: string]: unknown;
}

export interface NephrologueVerdict extends AgentVerdict {
  potassium_evaluation: string;
  phosphore_evaluation: string;
  sodium_evaluation: string;
  contre_indique: boolean;
}

export interface DiabetologueVerdict extends AgentVerdict {
  index_glycemique_estime: string;
  charge_glucidique_g: number;
  recommandation_portion?: string;
}

export interface DieteticienVerdict extends AgentVerdict {
  astuces_preparation: string[];
  alternatives_proposees: string[];
  conseil_portion: string;
}

export interface AnalysisResult {
  aliment: FoodNutrition;
  quantite_g: number;
  verdict_global: AlertLevel;
  verdict_nephrologue: NephrologueVerdict;
  verdict_diabetologue: DiabetologueVerdict;
  verdict_dieteticien: DieteticienVerdict;
}

export interface JournalEntry {
  id: string;
  profile_id: string;
  date: string;
  repas: MealType;
  aliment_nom: string;
  quantite_g: number;
  energie_kcal: number;
  potassium_mg: number;
  phosphore_mg: number;
  sodium_mg: number;
  glucides_g: number;
  proteines_g: number;
  verdict_global: AlertLevel;
  verdict_json: string;
  created_at: string;
}

export type MealType = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation';

export interface ChatMessage {
  id: string;
  profile_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface DailySummary {
  date: string;
  total_potassium_mg: number;
  total_phosphore_mg: number;
  total_sodium_mg: number;
  total_glucides_g: number;
  total_proteines_g: number;
  total_energie_kcal: number;
}
