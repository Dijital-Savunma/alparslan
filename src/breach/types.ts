export interface BreachEntry {
  domain: string;
  name: string;
  date: string;
  accountsAffected: number;
  dataTypes: string[];
}

export interface BreachCheckResult {
  isBreached: boolean;
  breaches: BreachEntry[];
}
