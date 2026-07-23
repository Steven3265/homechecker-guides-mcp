export interface GuideSource {
  title: string;
  publisher: string;
  url: string;
  accessed: string;
}

export interface GuideSection {
  id: string;
  heading: string;
  markdown: string;
}

export interface ChecklistCandidate {
  text: string;
  section: string;
}

export interface GuideRecord {
  slug: string;
  pillar: boolean;
  resourceUri: string;
  canonicalUrl: string;
  question: string;
  title: string;
  summary: string;
  answer: string;
  updated: string;
  publishedAt: string | null;
  updatedAt: string;
  reviewedAt: string | null;
  reviewDue: string | null;
  jurisdiction: string[];
  reviewedBy: string | null;
  methodology: string | null;
  limitations: string | null;
  researchNote: string | null;
  readingTimeMin: number;
  cluster: {
    id: string;
    label: string;
    chip: string;
    blurb: string;
  } | null;
  topics: string[];
  propertyTypes: string[];
  eras: string[];
  buyingStages: string[];
  sections: GuideSection[];
  faqs: Array<{ question: string; answer: string }>;
  checklistCandidates: ChecklistCandidate[];
  sources: GuideSource[];
  related: string[];
  contentMarkdown: string;
}

export interface GuideSnapshot {
  schemaVersion: number;
  generatedAt: string;
  source: {
    name: string;
    origin: string;
    baseUrl: string;
    contentCount: number;
    spokeCount: number;
    latestUpdated: string;
  };
  clusters: Array<{
    id: string;
    label: string;
    chip: string;
    blurb: string;
    slugs: string[];
  }>;
  guides: GuideRecord[];
}

export interface SearchOptions {
  query: string;
  jurisdiction?: string;
  cluster?: string;
  propertyType?: string;
  era?: string;
  buyingStage?: string;
  includePillar?: boolean;
  limit?: number;
}

export interface GuideSearchResult {
  slug: string;
  title: string;
  question: string;
  summary: string;
  answer: string;
  canonicalUrl: string;
  resourceUri: string;
  jurisdiction: string[];
  cluster: GuideRecord['cluster'];
  topics: string[];
  propertyTypes: string[];
  eras: string[];
  buyingStages: string[];
  updatedAt: string;
  reviewedAt: string | null;
  limitations: string | null;
  score: number;
  matchedTerms: string[];
  matchedSections: Array<{
    id: string;
    heading: string;
    snippet: string;
    score: number;
  }>;
}

export interface ChecklistProfile {
  jurisdiction?: string;
  propertyType?: string;
  era?: string;
  buyingStage?: string;
  concerns?: string[];
}

export interface BuyerChecklistItem {
  check: string;
  section: string;
  guideSlug: string;
  guideTitle: string;
  canonicalUrl: string;
}

export interface BuyerChecklist {
  profile: ChecklistProfile;
  guidanceBoundary: string;
  matchedGuides: Array<{
    slug: string;
    title: string;
    canonicalUrl: string;
    answer: string;
  }>;
  items: BuyerChecklistItem[];
}
