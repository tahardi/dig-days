export type WorkDayStatus = 'active' | 'needs_recording' | 'needs_processing' | 'needs_review' | 'saved';

export type Pin = { lat: number; lon: number };

export type Trail = { id: number; name: string; notes: string | null; createdAt: string };
export type Feature = { id: number; trailId: number; name: string; notes: string | null; createdAt: string };

export type WorkDay = {
  id: number;
  status: WorkDayStatus;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  lat: number | null;
  lon: number | null;
  audioPath: string | null;
  transcript: string | null;
  draftJson: string | null;
  processError: string | null;
  trailId: number | null;
  featureId: number | null;
  summary: string | null;
  tools: string[];
};

export type Photo = { id: number; workDayId: number; path: string; takenAt: string | null };

export type Totals = {
  minutes: number;
  days: number;
  firstDate: string | null;
  lastDate: string | null;
  topTools: string[];
};

export type NameOrId = { id: number } | { newName: string };

export type ReviewInput = {
  trail: NameOrId;
  feature: NameOrId | null;
  summary: string;
  tools: string[];
  durationMinutes: number;
};

export type ExportData = {
  trails: Trail[];
  features: Feature[];
  workDays: WorkDay[];
  photos: Photo[];
};
