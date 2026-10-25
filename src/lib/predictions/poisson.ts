import type { MatchRow, PredictionRow, StandingRow } from "@/types/database";

/**
 * Factorial para la función de masa de probabilidad de Poisson: P(k; λ) = (e^-λ * λ^k) / k!
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * Convierte la cadena de racha ("V,V,E,D,V" o "W,W,D,L,W") en un puntaje normalizado [0, 100].
 */
function parseFormScore(form: string | null | undefined): number {
  if (!form) return 60;
  const tokens = form
    .split(/[,;\s-]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 5);

  if (tokens.length === 0) return 60;

  let points = 0;
  for (const token of tokens) {
    if (token === "V" || token === "W") points += 3;
    else if (token === "E" || token === "D") points += 1;
  }

  const maxPoints = tokens.length * 3;
  return Math.round((points / maxPoints) * 100);
}

/**
 * Coeficientes históricos UEFA de respaldo para clubes de la Champions League
 */
const UEFA_COEFFICIENT_FALLBACK: Record<string, number> = {
  "real madrid": 136.0,
  "manchester city": 138.0,
  "bayern": 132.0,
  "liverpool": 126.0,
  "paris": 116.0,
  "psg": 116.0,
  "inter": 115.0,
  "barcelona": 118.0,
  "arsenal": 112.0,
  "dortmund": 109.0,
  "leverkusen": 108.0,
  "atlético": 104.0,
  "atletico": 104.0,
  "juventus": 95.0,
  "milan": 93.0,
  "benfica": 90.0,
  "aston villa": 78.0,
};

function resolveUefaHierarchyScore(
  teamName: string,
  standing?: StandingRow
): number {
  if (standing?.uefa_coefficient && standing.uefa_coefficient > 0) {
    return Math.min(100, Math.round((standing.uefa_coefficient / 140) * 100));
  }
  const lower = teamName.toLowerCase();
  for (const [key, coeff] of Object.entries(UEFA_COEFFICIENT_FALLBACK)) {
    if (lower.includes(key)) {
      return Math.min(100, Math.round((coeff / 140) * 100));
    }
  }
  return 62;
}

/**
 * Calcula el Pronóstico Algorítmico de un partido de la UEFA Champions League
 * utilizando la Distribución de Poisson y las 4 ponderaciones oficiales de AGENTS.md:
 * - 30% Rendimiento Reciente (racha y puntos por partido en Fase de Liga)
 * - 30% Estadísticas / xG (capacidad goleadora vs goles concedidos por partido)
 * - 25% Jerarquía UEFA (coeficiente UEFA a 5 años y peso histórico)
 * - 15% H2H / Localía (ventaja estadística de estadio local en noches europeas)
 */
export function calculatePoissonMatchPrediction(
  match: MatchRow,
  standingsByTeamId: Map<number, StandingRow>,
  standingsByName: Map<string, StandingRow>
): PredictionRow {
  const homeStanding =
    standingsByTeamId.get(match.home_team_id) ??
    standingsByName.get(match.home_team_name.toLowerCase());
  const awayStanding =
    standingsByTeamId.get(match.away_team_id) ??
    standingsByName.get(match.away_team_name.toLowerCase());

  // 1. Rendimiento Reciente (30%)
  const homeForm = parseFormScore(homeStanding?.form);
  const awayForm = parseFormScore(awayStanding?.form);
  const homePpg =
    homeStanding && homeStanding.played > 0
      ? (homeStanding.points / (homeStanding.played * 3)) * 100
      : 62;
  const awayPpg =
    awayStanding && awayStanding.played > 0
      ? (awayStanding.points / (awayStanding.played * 3)) * 100
      : 58;

  const homeRecentScore = Math.round(homeForm * 0.55 + homePpg * 0.45);
  const awayRecentScore = Math.round(awayForm * 0.55 + awayPpg * 0.45);

  // 2. Estadísticas / xG (30%)
  const homeGfPerGame =
    homeStanding && homeStanding.played > 0
      ? homeStanding.goals_for / homeStanding.played
      : 1.75;
  const homeGaPerGame =
    homeStanding && homeStanding.played > 0
      ? homeStanding.goals_against / homeStanding.played
      : 1.15;

  const awayGfPerGame =
    awayStanding && awayStanding.played > 0
      ? awayStanding.goals_for / awayStanding.played
      : 1.55;
  const awayGaPerGame =
    awayStanding && awayStanding.played > 0
      ? awayStanding.goals_against / awayStanding.played
      : 1.25;

  const homeXgStat =
    match.live_stats?.home_xg ??
    Number(((homeGfPerGame * 0.65 + awayGaPerGame * 0.35) * 1.05).toFixed(2));
  const awayXgStat =
    match.live_stats?.away_xg ??
    Number(((awayGfPerGame * 0.65 + homeGaPerGame * 0.35) * 0.95).toFixed(2));

  const homeStatsScore = Math.min(
    99,
    Math.max(35, Math.round(50 + (homeGfPerGame - homeGaPerGame) * 18))
  );
  const awayStatsScore = Math.min(
    99,
    Math.max(35, Math.round(50 + (awayGfPerGame - awayGaPerGame) * 18))
  );

  // 3. Jerarquía UEFA (25%)
  const homeHierarchyScore = resolveUefaHierarchyScore(
    match.home_team_name,
    homeStanding
  );
  const awayHierarchyScore = resolveUefaHierarchyScore(
    match.away_team_name,
    awayStanding
  );

  // 4. H2H y Localía (15%) — El local recibe bonificación de estadio UEFA
  const homeH2hLocalityScore = 68;
  const awayH2hLocalityScore = 48;

  // Índice compuesto ponderado (30% Reciente + 30% Stats/xG + 25% Jerarquía UEFA + 15% H2H/Localía)
  const homeComposite =
    homeRecentScore * 0.3 +
    homeStatsScore * 0.3 +
    homeHierarchyScore * 0.25 +
    homeH2hLocalityScore * 0.15;

  const awayComposite =
    awayRecentScore * 0.3 +
    awayStatsScore * 0.3 +
    awayHierarchyScore * 0.25 +
    awayH2hLocalityScore * 0.15;

  // Tasas esperadas de goles (λ_home y λ_away) para la distribución de Poisson
  const baseHomeLambda = (homeGfPerGame + awayGaPerGame) / 2;
  const baseAwayLambda = (awayGfPerGame + homeGaPerGame) / 2;

  const compositeRatioHome = homeComposite / Math.max(40, awayComposite);
  const compositeRatioAway = awayComposite / Math.max(40, homeComposite);

  const lambdaHome = Math.min(
    3.6,
    Math.max(0.65, baseHomeLambda * 0.55 + 1.45 * Math.pow(compositeRatioHome, 0.75) * 0.45)
  );
  const lambdaAway = Math.min(
    3.4,
    Math.max(0.55, baseAwayLambda * 0.55 + 1.25 * Math.pow(compositeRatioAway, 0.75) * 0.45)
  );

  // Evaluación de la matriz de Poisson Bivariada para marcadores 0..7 goles
  let probHomeWin = 0;
  let probDraw = 0;
  let probAwayWin = 0;
  let bestScoreProb = -1;
  let mostLikelyHomeGoals = Math.round(lambdaHome);
  let mostLikelyAwayGoals = Math.round(lambdaAway);

  for (let h = 0; h <= 7; h++) {
    const pH = poissonPmf(h, lambdaHome);
    for (let a = 0; a <= 7; a++) {
      const pA = poissonPmf(a, lambdaAway);
      const jointProb = pH * pA;

      if (h > a) probHomeWin += jointProb;
      else if (h === a) probDraw += jointProb;
      else probAwayWin += jointProb;

      if (jointProb > bestScoreProb) {
        bestScoreProb = jointProb;
        mostLikelyHomeGoals = h;
        mostLikelyAwayGoals = a;
      }
    }
  }

  const totalProb = probHomeWin + probDraw + probAwayWin || 1;
  let homeWinPct = Math.round((probHomeWin / totalProb) * 100);
  const drawPct = Math.round((probDraw / totalProb) * 100);
  let awayWinPct = 100 - homeWinPct - drawPct;

  if (awayWinPct < 5) {
    awayWinPct = 5;
    homeWinPct = 100 - drawPct - awayWinPct;
  }

  const favoriteLabel =
    homeWinPct >= awayWinPct + 6
      ? `Ventaja ${match.home_team_name} (${homeWinPct}%)`
      : awayWinPct >= homeWinPct + 6
        ? `Ventaja ${match.away_team_name} (${awayWinPct}%)`
        : `Duelo equilibrado (${homeWinPct}% vs ${awayWinPct}%)`;

  const explanationSummary = `${favoriteLabel} • Modelo Poisson (λ Local ${lambdaHome.toFixed(
    2
  )} vs λ Visita ${lambdaAway.toFixed(
    2
  )}) ponderando Rendimiento Reciente (30%), xG/Estadísticas (30%), Jerarquía UEFA (25%) y Localía/H2H (15%).`;

  return {
    match_id: match.id,
    home_win_prob: homeWinPct,
    draw_prob: drawPct,
    away_win_prob: awayWinPct,
    predicted_home_goals: mostLikelyHomeGoals,
    predicted_away_goals: mostLikelyAwayGoals,
    recent_form_score: {
      weight: 30,
      home: homeRecentScore,
      away: awayRecentScore,
      note: `Racha ${homeStanding?.form ?? "Estable"} vs ${awayStanding?.form ?? "Estable"}`,
    },
    stats_xg_score: {
      weight: 30,
      home: homeStatsScore,
      away: awayStatsScore,
      lambda_home: Number(lambdaHome.toFixed(2)),
      lambda_away: Number(lambdaAway.toFixed(2)),
      home_xg: homeXgStat,
      away_xg: awayXgStat,
      note: `xG proyectado ${lambdaHome.toFixed(2)} vs ${lambdaAway.toFixed(2)}`,
    },
    hierarchy_score: {
      weight: 25,
      home: homeHierarchyScore,
      away: awayHierarchyScore,
      note: "Coeficiente UEFA 5 años y palmarés continental",
    },
    h2h_score: {
      weight: 15,
      home: homeH2hLocalityScore,
      away: awayH2hLocalityScore,
      note: `Factor localía en ${match.venue ?? "Estadio UEFA"}`,
    },
    explanation_summary: explanationSummary,
    updated_at: new Date().toISOString(),
  };
}
