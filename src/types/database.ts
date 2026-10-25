export type MatchStatus = "SCHEDULED" | "IN_PLAY" | "HT" | "FINISHED";

export interface LiveStats {
  home_possession?: number;
  away_possession?: number;
  home_xg?: number;
  away_xg?: number;
  home_shots?: number;
  away_shots?: number;
  home_rank_label?: string;
  away_rank_label?: string;
  home_odds?: string;
  away_odds?: string;
  half_label?: string;
  is_spotlight?: boolean;
}

export interface MatchRow {
  id: number;
  season: number;
  stage: string;
  matchday: number | null;
  bracket_slot: string | null;
  leg: number | null;
  kickoff_at: string;
  status: MatchStatus;
  elapsed_minute: number | null;
  extra_minute: number | null;
  home_team_id: number;
  home_team_name: string;
  home_team_crest: string;
  away_team_id: number;
  away_team_name: string;
  away_team_crest: string;
  home_score: number;
  away_score: number;
  aggregate_home_score: number | null;
  aggregate_away_score: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  live_stats: LiveStats | null;
  venue: string | null;
  referee: string | null;
  updated_at: string;
}

export interface MatchEventRow {
  id: string;
  match_id: number;
  minute: number;
  extra_minute: number | null;
  team_id: number;
  player_name: string;
  assist_or_sub_name: string | null;
  event_type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION" | string;
  detail: string | null;
  created_at: string;
}

export interface PredictionRow {
  match_id: number;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  predicted_home_goals: number;
  predicted_away_goals: number;
  recent_form_score: Record<string, unknown> | null;
  stats_xg_score: Record<string, unknown> | null;
  hierarchy_score: Record<string, unknown> | null;
  h2h_score: Record<string, unknown> | null;
  explanation_summary: string;
  updated_at: string;
}

export interface StandingRow {
  team_id: number;
  season: number;
  rank: number;
  team_name: string;
  team_short_name: string | null;
  team_crest_url: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  form: string | null;
  qualification_zone: string;
  uefa_coefficient: number | null;
  updated_at: string;
}

export interface MatchWithDetails extends MatchRow {
  prediction?: PredictionRow | null;
  events?: MatchEventRow[];
}

export type KnockoutStageKey = "R16" | "QF" | "SF" | "FINAL";

export interface KnockoutTeamSlot {
  team_id: number;
  team_name: string;
  team_short: string;
  team_crest: string;
  seed: number;
}

export interface KnockoutTieNode {
  slot: string; // e.g. "R16-1", "QF-1", "SF-1", "FINAL"
  stage: KnockoutStageKey;
  routeLabel: string; // e.g. "Octavo 1 • Ruta A"
  dateLabel: string;
  venueLabel?: string;
  status: MatchStatus;
  elapsed_minute?: number | null;
  homeTeam: KnockoutTeamSlot | null;
  awayTeam: KnockoutTeamSlot | null;
  homeLeg1Score: number | null;
  awayLeg1Score: number | null;
  homeLeg2Score: number | null;
  awayLeg2Score: number | null;
  homeAggregate: number | null;
  awayAggregate: number | null;
  winnerTeamId: number | null;
}

export interface UserBracketData {
  r16: Record<string, number>;
  qf: Record<string, number>;
  sf: Record<string, number>;
  final: number | null;
  customScores?: Record<string, { home: number; away: number }>;
}

export interface UserBracketRow {
  id: string;
  user_id: string;
  season: number;
  bracket_name: string;
  bracket_data: UserBracketData;
  champion_team_id: number | null;
  champion_team_name: string | null;
  updated_at: string;
  created_at?: string;
}

export interface NewsArticleRow {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  source_name: string;
  category: string | null;
  club_tag: string | null;
  published_at: string;
  created_at?: string;
}

export interface PlayerInjuryRow {
  id: string;
  player_name: string;
  team_id: number | null;
  team_name: string;
  team_short_name?: string | null;
  team_crest_url?: string | null;
  injury_type: string;
  status: "OUT" | "DOUBTFUL" | "QUESTIONABLE" | string;
  estimated_return: string;
  expected_return_date: string | null;
  detail: string | null;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  sources_used?: string[] | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  favorite_team_id: number | null;
  created_at: string;
  updated_at: string;
}



