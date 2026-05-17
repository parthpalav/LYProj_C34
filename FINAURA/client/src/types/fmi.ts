export interface FMIRecord {
  score: number;
  band: string;
  dimensions: { D1: number; D2: number; D3: number; D4: number; D5: number };
  reasons: string[];
  createdAt?: string;
}
