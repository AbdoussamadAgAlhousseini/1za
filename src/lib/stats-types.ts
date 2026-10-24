/** Forme du JSON renvoyé par `stats_dashboard()` (voir docs/STATISTIQUES.md). */
export interface DashboardStats {
  today: string;
  week_start: string;
  month_start: string;
  timezone: string;
  athletes_total: number;
  athletes_new_month: number;
  status_active: number;
  status_expiring_soon: number;
  status_expired: number;
  status_upcoming: number;
  status_suspended: number;
  status_none: number;
  entries_today: number;
  unique_today: number;
  completed_today: number;
  entries_week: number;
  unique_week: number;
  entries_month: number;
  unique_month: number;
  completed_month: number;
  avg_duration_month_seconds: number | null;
  present_now: number;
  long_open_visits: number;
  new_subscriptions_month: number;
  renewals_month: number;
  revenue_month: { currency: string; total: number }[];
}

/** Forme du JSON renvoyé par `stats_athlete()`. */
export interface AthleteStats {
  visits_today: number;
  visits_week: number;
  visits_month: number;
  visits_total: number;
  completed_total: number;
  total_duration_seconds: number;
  avg_duration_seconds: number | null;
  first_visit_at: string | null;
  last_visit_at: string | null;
  is_inside: boolean | null;
}

export interface AttendancePoint {
  bucket: string;
  entries: number;
  unique_athletes: number;
  completed: number;
  avg_duration_seconds: number | null;
  total_duration_seconds: number;
}
