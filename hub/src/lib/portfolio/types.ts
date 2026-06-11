export type Maturity = 'L1' | 'L2' | 'L3';
export type InvestmentType = 'probe' | 'spike' | 'exploration';
export type Origin = 'team-driven' | 'prospecting';
export type Status = 'idea' | 'started' | 'paused' | 'completed' | 'archived';

export interface PortfolioExperiment {
  slug: string;
  title: string;
  description: string;
  type: string;
  status: Status;
  themes: string[];
  tags: string[];
  maturity?: Maturity;
  investment_type?: InvestmentType;
  origin?: Origin;
  depends_on: string[];
  surface: string | null;
  owner?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ThemeConfig {
  name: string;
  short: string;
  color: string;
}

export interface MaturityConfig {
  name: string;
  sub: string;
}

export interface InvestmentTypeConfig {
  label: string;
  short: string;
}

export interface Pillar {
  name: string;
  themes: string[];
}

export interface Taxonomy {
  pillars: Pillar[];
  themes: Record<string, ThemeConfig>;
  maturity: Record<string, MaturityConfig>;
  investment_types: Record<string, InvestmentTypeConfig>;
  statuses: string[];
}
