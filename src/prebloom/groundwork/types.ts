export interface CompetitorInfo {
  name: string;
  website?: string;
  description: string;
  funding?: string;
  pricing?: string;
  strengths: string[];
  weaknesses: string[];
}

export interface MarketResearchResult {
  id: string;
  createdAt: string;
  query: string;
  summary: string;
  marketSize?: string;
  trends: string[];
  directCompetitors: CompetitorInfo[];
  indirectCompetitors: CompetitorInfo[];
  gaps: string[];
  opportunities: string[];
  threats: string[];
  recommendations: string[];
  sources: string[];
  researchType: "quick" | "deep";
}

export interface ResearchRequest {
  idea: string;
  industry?: string;
  researchType: "quick" | "deep";
}
