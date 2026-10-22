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
