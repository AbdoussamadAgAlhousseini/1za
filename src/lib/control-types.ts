import type { ControlOutcome } from "@/lib/domain/status";

export interface ControlCheck {
  outcome: ControlOutcome;
  matricule: string;
  validity?: string;
  checked_at: string;
  subscription: { starts_on: string; ends_on: string; plan_name: string | null; days_remaining: number } | null;
  open_visit: { entered_at: string } | null;
}

export interface ControlPanelData {
  overview: {
    present_now: number;
    long_open_visits: number;
    entries_today: number;
    my_entries_today: number;
    my_exits_today: number;
  };
  present: { matricule: string; entered_at: string }[];
  activity: { kind: "entry" | "exit"; matricule: string; occurred_at: string }[];
}

export interface EntryReceipt {
  matricule: string;
  entered_at: string;
}

export interface ExitReceipt {
  matricule: string;
  entered_at: string;
  exited_at: string;
  duration_seconds: number;
}
