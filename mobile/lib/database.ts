import * as SQLite from 'expo-sqlite';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
  Profile, ClinicalData, JournalEntry, DailySummary, MealType,
  ClinicalProfile, NutritionalThresholds, BloodPressure, GlycemieEntry, MomentGlycemie, ChatMessage,
} from '../types';

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('foodai.db');
      await initSchema(db);
      return db;
    })();
  }
  return _dbPromise;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS profiles (
      id          TEXT PRIMARY KEY,
      nom         TEXT NOT NULL,
      relation    TEXT NOT NULL DEFAULT 'moi',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clinical_data (
      id                          TEXT PRIMARY KEY,
      profile_id                  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      dfg_ml_min                  REAL NOT NULL DEFAULT 30,
      stade_irc                   TEXT NOT NULL DEFAULT '3b',
      kaliemie_mmol_l             REAL,
      phosphoremie_mg_l           REAL,
      diabete_type                TEXT NOT NULL DEFAULT 'Type 2',
      hypertension                INTEGER NOT NULL DEFAULT 0,
      potassium_max_mg_jour        REAL NOT NULL DEFAULT 2000,
      phosphore_max_mg_jour        REAL NOT NULL DEFAULT 900,
      sodium_max_mg_jour           REAL NOT NULL DEFAULT 2000,
      proteines_max_g_kg_jour      REAL NOT NULL DEFAULT 0.8,
      glucides_max_g_jour          REAL NOT NULL DEFAULT 150,
      potassium_alerte_mg_100g    REAL NOT NULL DEFAULT 200,
      potassium_danger_mg_100g    REAL NOT NULL DEFAULT 300,
      phosphore_alerte_mg_100g    REAL NOT NULL DEFAULT 150,
      sodium_alerte_mg_100g       REAL NOT NULL DEFAULT 300,
      note_rdv                    TEXT,
      date_rdv                    TEXT,
      created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      date          TEXT NOT NULL,
      repas         TEXT NOT NULL,
      aliment_nom   TEXT NOT NULL,
      quantite_g    REAL NOT NULL,
      energie_kcal  REAL NOT NULL DEFAULT 0,
      potassium_mg  REAL NOT NULL DEFAULT 0,
      phosphore_mg  REAL NOT NULL DEFAULT 0,
      sodium_mg     REAL NOT NULL DEFAULT 0,
      glucides_g    REAL NOT NULL DEFAULT 0,
      proteines_g   REAL NOT NULL DEFAULT 0,
      verdict_global TEXT NOT NULL DEFAULT 'vert',
      verdict_json  TEXT NOT NULL DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_journal_profile_date
      ON journal_entries(profile_id, date);

    CREATE TABLE IF NOT EXISTS daily_summaries (
      profile_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      date                TEXT NOT NULL,
      total_potassium_mg  REAL NOT NULL DEFAULT 0,
      total_phosphore_mg  REAL NOT NULL DEFAULT 0,
      total_sodium_mg     REAL NOT NULL DEFAULT 0,
      total_glucides_g    REAL NOT NULL DEFAULT 0,
      total_proteines_g   REAL NOT NULL DEFAULT 0,
      total_energie_kcal  REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (profile_id, date)
    );

    CREATE TABLE IF NOT EXISTS consent_log (
      id          TEXT PRIMARY KEY,
      version     TEXT NOT NULL,
      accepted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blood_pressure (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      systolique    INTEGER NOT NULL,
      diastolique   INTEGER NOT NULL,
      pouls         INTEGER,
      note          TEXT,
      measured_at   TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bp_profile_date
      ON blood_pressure(profile_id, measured_at);

    CREATE TABLE IF NOT EXISTS blood_test_results (
      id                TEXT PRIMARY KEY,
      profile_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      kaliemie_mmol_l   REAL,
      dfg_ml_min        REAL,
      phosphore_mmol_l  REAL,
      sodium_mmol_l     REAL,
      creatinine_umol_l REAL,
      hemoglobine_g_dl  REAL,
      note              TEXT,
      measured_at       TEXT NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_btr_profile_date
      ON blood_test_results(profile_id, measured_at);

    CREATE TABLE IF NOT EXISTS glycemie_entries (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      glycemie_mg_dl  REAL NOT NULL,
      moment          TEXT NOT NULL DEFAULT 'autre',
      note            TEXT,
      measured_at     TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_glycemie_profile_date
      ON glycemie_entries(profile_id, measured_at);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chat_profile
      ON chat_messages(profile_id, created_at);
  `);
  // Migrations colonnes ajoutées après la v1
  try { await db.execAsync('ALTER TABLE glycemie_entries RENAME COLUMN glycemie_mmol_l TO glycemie_mg_dl'); } catch {}
  try { await db.execAsync('ALTER TABLE clinical_data ADD COLUMN glucides_max_g_jour REAL NOT NULL DEFAULT 150'); } catch {}
  try { await db.execAsync("ALTER TABLE clinical_data ADD COLUMN phosphoremie_mg_l REAL"); } catch {}
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const db = await getDb();
  return db.getAllAsync<Profile>('SELECT * FROM profiles ORDER BY created_at ASC');
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const db = await getDb();
  return db.getFirstAsync<Profile>('SELECT * FROM profiles WHERE id = ?', [id]) ?? null;
}

export async function createProfile(nom: string, relation: string): Promise<Profile> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO profiles (id, nom, relation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, nom, relation, now, now],
  );
  return { id, nom, relation, created_at: now, updated_at: now };
}

export async function updateProfile(id: string, nom: string, relation: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE profiles SET nom = ?, relation = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [nom, relation, id],
  );
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM profiles WHERE id = ?', [id]);
}

// ─── Clinical Data ────────────────────────────────────────────────────────────

export async function getClinicalData(profileId: string): Promise<ClinicalData | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ClinicalData & { hypertension: number }>(
    'SELECT * FROM clinical_data WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1',
    [profileId],
  );
  if (!row) return null;
  return { ...row, hypertension: row.hypertension === 1 };
}

export async function saveClinicalData(
  profileId: string,
  clinical: ClinicalProfile,
  seuils: NutritionalThresholds,
  noteRdv?: string,
  dateRdv?: string,
): Promise<void> {
  const db = await getDb();
  const existing = await getClinicalData(profileId);

  if (existing) {
    await db.runAsync(
      `UPDATE clinical_data SET
        dfg_ml_min = ?, stade_irc = ?, kaliemie_mmol_l = ?, phosphoremie_mg_l = ?,
        diabete_type = ?, hypertension = ?,
        potassium_max_mg_jour = ?, phosphore_max_mg_jour = ?, sodium_max_mg_jour = ?,
        proteines_max_g_kg_jour = ?, glucides_max_g_jour = ?,
        potassium_alerte_mg_100g = ?, potassium_danger_mg_100g = ?,
        phosphore_alerte_mg_100g = ?, sodium_alerte_mg_100g = ?,
        note_rdv = ?, date_rdv = ?
       WHERE profile_id = ?`,
      [
        clinical.dfg_ml_min, clinical.stade_irc, clinical.kaliemie_mmol_l ?? null,
        clinical.phosphoremie_mg_l ?? null, clinical.diabete_type,
        clinical.hypertension ? 1 : 0,
        seuils.potassium_max_mg_jour, seuils.phosphore_max_mg_jour,
        seuils.sodium_max_mg_jour, seuils.proteines_max_g_kg_jour, seuils.glucides_max_g_jour,
        seuils.potassium_alerte_mg_100g, seuils.potassium_danger_mg_100g,
        seuils.phosphore_alerte_mg_100g, seuils.sodium_alerte_mg_100g,
        noteRdv ?? null, dateRdv ?? null, profileId,
      ],
    );
  } else {
    await db.runAsync(
      `INSERT INTO clinical_data (
        id, profile_id, dfg_ml_min, stade_irc, kaliemie_mmol_l, phosphoremie_mg_l,
        diabete_type, hypertension, potassium_max_mg_jour, phosphore_max_mg_jour,
        sodium_max_mg_jour, proteines_max_g_kg_jour, glucides_max_g_jour,
        potassium_alerte_mg_100g, potassium_danger_mg_100g,
        phosphore_alerte_mg_100g, sodium_alerte_mg_100g,
        note_rdv, date_rdv
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(), profileId,
        clinical.dfg_ml_min, clinical.stade_irc, clinical.kaliemie_mmol_l ?? null,
        clinical.phosphoremie_mg_l ?? null, clinical.diabete_type,
        clinical.hypertension ? 1 : 0,
        seuils.potassium_max_mg_jour, seuils.phosphore_max_mg_jour,
        seuils.sodium_max_mg_jour, seuils.proteines_max_g_kg_jour, seuils.glucides_max_g_jour,
        seuils.potassium_alerte_mg_100g, seuils.potassium_danger_mg_100g,
        seuils.phosphore_alerte_mg_100g, seuils.sodium_alerte_mg_100g,
        noteRdv ?? null, dateRdv ?? null,
      ],
    );
  }
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export async function getJournalEntries(profileId: string, date: string): Promise<JournalEntry[]> {
  const db = await getDb();
  return db.getAllAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE profile_id = ? AND date = ? ORDER BY created_at ASC',
    [profileId, date],
  );
}

export async function addJournalEntry(
  profileId: string,
  date: string,
  repas: MealType,
  entry: {
    aliment_nom: string; quantite_g: number;
    energie_kcal: number; potassium_mg: number; phosphore_mg: number;
    sodium_mg: number; glucides_g: number; proteines_g: number;
    verdict_global: string; verdict_json: object;
  },
): Promise<JournalEntry> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const verdictStr = JSON.stringify(entry.verdict_json);

  await db.runAsync(
    `INSERT INTO journal_entries
      (id, profile_id, date, repas, aliment_nom, quantite_g,
       energie_kcal, potassium_mg, phosphore_mg, sodium_mg,
       glucides_g, proteines_g, verdict_global, verdict_json, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, profileId, date, repas, entry.aliment_nom, entry.quantite_g,
      entry.energie_kcal, entry.potassium_mg, entry.phosphore_mg, entry.sodium_mg,
      entry.glucides_g, entry.proteines_g, entry.verdict_global, verdictStr, now,
    ],
  );

  await updateDailySummary(db, profileId, date);

  return {
    id, profile_id: profileId, date, repas, created_at: now,
    aliment_nom: entry.aliment_nom, quantite_g: entry.quantite_g,
    energie_kcal: entry.energie_kcal, potassium_mg: entry.potassium_mg,
    phosphore_mg: entry.phosphore_mg, sodium_mg: entry.sodium_mg,
    glucides_g: entry.glucides_g, proteines_g: entry.proteines_g,
    verdict_global: entry.verdict_global as 'vert' | 'orange' | 'rouge',
    verdict_json: verdictStr,
  };
}

export async function deleteJournalEntry(id: string, profileId: string, date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM journal_entries WHERE id = ? AND profile_id = ?', [id, profileId]);
  await updateDailySummary(db, profileId, date);
}

async function updateDailySummary(db: SQLite.SQLiteDatabase, profileId: string, date: string): Promise<void> {
  await db.runAsync(
    'DELETE FROM daily_summaries WHERE profile_id = ? AND date = ?',
    [profileId, date],
  );
  await db.runAsync(
    `INSERT INTO daily_summaries (profile_id, date,
       total_potassium_mg, total_phosphore_mg, total_sodium_mg,
       total_glucides_g, total_proteines_g, total_energie_kcal)
     SELECT profile_id, date,
       SUM(potassium_mg), SUM(phosphore_mg), SUM(sodium_mg),
       SUM(glucides_g), SUM(proteines_g), SUM(energie_kcal)
     FROM journal_entries WHERE profile_id = ? AND date = ?
     GROUP BY profile_id, date`,
    [profileId, date],
  );
}

export async function getDailySummary(profileId: string, date: string): Promise<DailySummary | null> {
  const db = await getDb();
  return db.getFirstAsync<DailySummary>(
    'SELECT * FROM daily_summaries WHERE profile_id = ? AND date = ?',
    [profileId, date],
  ) ?? null;
}

export async function getWeeklySummaries(profileId: string, fromDate: string): Promise<DailySummary[]> {
  const db = await getDb();
  return db.getAllAsync<DailySummary>(
    'SELECT * FROM daily_summaries WHERE profile_id = ? AND date >= ? ORDER BY date DESC LIMIT 7',
    [profileId, fromDate],
  );
}

// ─── Consent ──────────────────────────────────────────────────────────────────

export async function hasConsented(version: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM consent_log WHERE version = ? LIMIT 1',
    [version],
  );
  return !!row;
}

export async function recordConsent(version: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO consent_log (id, version) VALUES (?, ?)',
    [uuidv4(), version],
  );
}

// ─── RGPD Export & Delete ─────────────────────────────────────────────────────

export async function exportAllData(profileId: string): Promise<object> {
  const db = await getDb();
  const profile = await db.getFirstAsync<Profile>('SELECT * FROM profiles WHERE id = ?', [profileId]);
  const clinical = await getClinicalData(profileId);
  const entries = await db.getAllAsync<JournalEntry>(
    'SELECT * FROM journal_entries WHERE profile_id = ? ORDER BY date DESC',
    [profileId],
  );
  return { profile, clinical, journal_entries: entries, exported_at: new Date().toISOString() };
}

export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM glycemie_entries; DELETE FROM blood_test_results; DELETE FROM blood_pressure; DELETE FROM journal_entries; DELETE FROM clinical_data; DELETE FROM profiles; DELETE FROM consent_log;');
}

// ─── Tension artérielle ───────────────────────────────────────────────────────

export async function addBloodPressure(
  profileId: string,
  systolique: number,
  diastolique: number,
  pouls: number | null,
  note: string | null,
  measuredAt: string,
): Promise<BloodPressure> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO blood_pressure (id, profile_id, systolique, diastolique, pouls, note, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, systolique, diastolique, pouls ?? null, note ?? null, measuredAt, now],
  );
  return { id, profile_id: profileId, systolique, diastolique, pouls, note, measured_at: measuredAt, created_at: now };
}

export async function getBloodPressures(profileId: string, limit = 50): Promise<BloodPressure[]> {
  const db = await getDb();
  return db.getAllAsync<BloodPressure>(
    'SELECT * FROM blood_pressure WHERE profile_id = ? ORDER BY measured_at DESC LIMIT ?',
    [profileId, limit],
  );
}

export async function deleteBloodPressure(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM blood_pressure WHERE id = ?', [id]);
}

// ─── Chat Aria ───────────────────────────────────────────────────────────────

export async function addChatMessage(profileId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO chat_messages (id, profile_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, profileId, role, content, now],
  );
  return { id, profile_id: profileId, role, content, created_at: now };
}

export async function getChatMessages(profileId: string, limit = 60): Promise<ChatMessage[]> {
  const db = await getDb();
  return db.getAllAsync<ChatMessage>(
    'SELECT * FROM chat_messages WHERE profile_id = ? ORDER BY created_at ASC LIMIT ?',
    [profileId, limit],
  );
}

export async function clearChatHistory(profileId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM chat_messages WHERE profile_id = ?', [profileId]);
}

// ─── Glycémie capillaire ──────────────────────────────────────────────────────

export async function addGlycemieEntry(
  profileId: string,
  glycemieMgDl: number,
  moment: MomentGlycemie,
  note: string | null,
  measuredAt: string,
): Promise<GlycemieEntry> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO glycemie_entries (id, profile_id, glycemie_mg_dl, moment, note, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, glycemieMgDl, moment, note ?? null, measuredAt, now],
  );
  return { id, profile_id: profileId, glycemie_mg_dl: glycemieMgDl, moment, note, measured_at: measuredAt, created_at: now };
}

export async function getGlycemieEntries(profileId: string, limit = 50): Promise<GlycemieEntry[]> {
  const db = await getDb();
  return db.getAllAsync<GlycemieEntry>(
    'SELECT * FROM glycemie_entries WHERE profile_id = ? ORDER BY measured_at DESC LIMIT ?',
    [profileId, limit],
  );
}

export async function deleteGlycemieEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM glycemie_entries WHERE id = ?', [id]);
}
