import { AnalysisResult, ClinicalProfile, NutritionalThresholds, DailySummary, ChatMessage } from '../types';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodai-api.vercel.app';

function makeTimeoutSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

interface AnalyzeRequest {
  aliment: string;
  quantite_g: number;
  profil: ClinicalProfile;
  seuils: NutritionalThresholds;
}

export async function analyzeFood(request: AnalyzeRequest): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: makeTimeoutSignal(90_000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(error.detail ?? `Erreur ${response.status}`);
  }

  return response.json();
}

interface LeaChatRequest {
  message: string;
  profil: ClinicalProfile;
  seuils: NutritionalThresholds;
  resume_jour?: Partial<DailySummary> | null;
  historique: Pick<ChatMessage, 'role' | 'content'>[];
}

export async function sendAriaMessage(request: LeaChatRequest): Promise<string> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: makeTimeoutSignal(60_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(error.detail ?? `Erreur ${response.status}`);
  }
  const data = await response.json();
  return data.response as string;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/health`, { signal: makeTimeoutSignal(5_000) });
    return r.ok;
  } catch {
    return false;
  }
}
