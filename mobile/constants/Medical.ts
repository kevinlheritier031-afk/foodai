import { NutritionalThresholds } from '../types';

export const IRC_STAGES = ['1', '2', '3a', '3b', '4', '5'] as const;
export type IrcStage = typeof IRC_STAGES[number];

export const IRC_STAGE_DEFAULTS: Record<IrcStage, NutritionalThresholds> = {
  '1':  { potassium_max_mg_jour: 3500, phosphore_max_mg_jour: 1200, sodium_max_mg_jour: 2300, proteines_max_g_kg_jour: 1.0, glucides_max_g_jour: 200, potassium_alerte_mg_100g: 400, potassium_danger_mg_100g: 600, phosphore_alerte_mg_100g: 200, sodium_alerte_mg_100g: 400 },
  '2':  { potassium_max_mg_jour: 2500, phosphore_max_mg_jour: 1000, sodium_max_mg_jour: 2000, proteines_max_g_kg_jour: 0.8, glucides_max_g_jour: 180, potassium_alerte_mg_100g: 300, potassium_danger_mg_100g: 500, phosphore_alerte_mg_100g: 175, sodium_alerte_mg_100g: 350 },
  '3a': { potassium_max_mg_jour: 2000, phosphore_max_mg_jour: 900,  sodium_max_mg_jour: 2000, proteines_max_g_kg_jour: 0.8, glucides_max_g_jour: 160, potassium_alerte_mg_100g: 200, potassium_danger_mg_100g: 300, phosphore_alerte_mg_100g: 150, sodium_alerte_mg_100g: 300 },
  '3b': { potassium_max_mg_jour: 2000, phosphore_max_mg_jour: 900,  sodium_max_mg_jour: 2000, proteines_max_g_kg_jour: 0.8, glucides_max_g_jour: 160, potassium_alerte_mg_100g: 200, potassium_danger_mg_100g: 300, phosphore_alerte_mg_100g: 150, sodium_alerte_mg_100g: 300 },
  '4':  { potassium_max_mg_jour: 1500, phosphore_max_mg_jour: 700,  sodium_max_mg_jour: 1500, proteines_max_g_kg_jour: 0.6, glucides_max_g_jour: 150, potassium_alerte_mg_100g: 150, potassium_danger_mg_100g: 250, phosphore_alerte_mg_100g: 100, sodium_alerte_mg_100g: 250 },
  '5':  { potassium_max_mg_jour: 1000, phosphore_max_mg_jour: 600,  sodium_max_mg_jour: 1000, proteines_max_g_kg_jour: 0.6, glucides_max_g_jour: 130, potassium_alerte_mg_100g: 100, potassium_danger_mg_100g: 150, phosphore_alerte_mg_100g:  80, sodium_alerte_mg_100g: 200 },
};

export const MEAL_LABELS: Record<string, string> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
};

export const MEAL_ICONS: Record<string, string> = {
  petit_dejeuner: '🌅',
  dejeuner: '☀️',
  diner: '🌙',
  collation: '🍎',
};

export const DISCLAIMER =
  '⚠️ FoodAI est un outil d\'aide au suivi nutritionnel, pas un dispositif médical. ' +
  'Il ne pose aucun diagnostic et ne remplace pas les recommandations de votre équipe soignante. ' +
  'Les seuils utilisés sont ceux communiqués par votre médecin traitant.';

export const RGPD_VERSION = '1.0.0';
