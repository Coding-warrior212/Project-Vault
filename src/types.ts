export type AppPage = 'overview' | 'sources' | 'ledger' | 'review' | 'handover' | 'settings';

export type WorkflowStageId = 'CONNECT' | 'RECONSTRUCT' | 'VERIFY' | 'REVIEW' | 'HANDOVER';

export interface WorkflowStage {
  id: WorkflowStageId;
  name: string;
  stepNumber: number;
  status: 'completed' | 'in_progress' | 'awaiting' | 'planned';
  description: string;
  metrics: string;
  targetPage: AppPage;
}

export type SourceType = 'pdf' | 'markdown' | 'text' | 'github';

export type SourceStatus = 'ingested' | 'parsing' | 'needs_review' | 'error';

export type ExtractionStatus = 'success' | 'empty' | 'unsupported_scanned' | 'failed' | 'pending';

export interface PageContent {
  pageNumber: number;
  text: string;
  charCount: number;
}

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  filename: string;
  size: string;
  sizeBytes?: number;
  ingestedAt: string;
  timestamp?: number;
  claimsCount: number;
  status: SourceStatus;
  extractionStatus?: ExtractionStatus;
  reconstructStatus?: 'not_started' | 'processing' | 'completed' | 'failed';
  reconstructedAt?: string;
  author: string;
  repoBranch?: string;
  summary: string;
  rawExcerpt: string;
  extractedText?: string;
  pages?: PageContent[];
  pageCount?: number;
  charCount?: number;
  wordCount?: number;
  errorMessage?: string;
  contentHash?: string;
  isUserUploaded?: boolean;
  mimeType?: string;
  tags: string[];
}

export type ClaimCategory = 
  | 'Architecture' 
  | 'Infrastructure' 
  | 'Security' 
  | 'Business Logic' 
  | 'Dependencies'
  | 'Technical Decisions'
  | 'Project Requirements'
  | 'System Components'
  | 'Tasks & Action Items'
  | 'Risks & Blockers'
  | 'Constraints'
  | 'Important Facts'
  | 'Unresolved Questions'
  | 'Operational Procedures';

export type ConfidenceTier = 'high' | 'moderate' | 'low';

export type VerificationStatus = 'verified' | 'unverified' | 'conflicted' | 'rejected';

export interface ConflictingEvidence {
  claimId: string;
  sourceId: string;
  sourceName: string;
  sourceLocation: string;
  conflictingStatement: string;
  conflictReason: string;
  extractedDate: string;
}

export interface SourceLocator {
  pageNumber?: number;
  charStart?: number;
  charEnd?: number;
  lineStart?: number;
  lineEnd?: number;
  isAvailable: boolean;
  locatorText: string;
}

export interface KnowledgeClaim {
  id: string; // e.g. "CLM-101" or "CLM-EXT-..."
  statement: string;
  category: ClaimCategory;
  confidenceScore: number; // 0-100
  confidenceTier: ConfidenceTier;
  confidenceRationale?: string;
  verificationStatus: VerificationStatus; // All AI extracted claims start 'unverified'
  sourceId: string;
  sourceName: string;
  sourceLocation: string; // e.g. "Spec.pdf · Page 18"
  sourceEvidenceQuote: string; // Verbatim quote from source document
  sourceLocator?: SourceLocator;
  pageNumber?: number;
  charOffsetStart?: number;
  charOffsetEnd?: number;
  evidenceGrounded?: boolean; // verified against source text
  extractionTimestamp?: string;
  extractedAt?: string;
  aiExplanation?: string;
  isUserExtracted?: boolean;
  conflictingEvidence?: ConflictingEvidence;
  humanReviewNotes?: string;
  lastReviewedBy?: string;
  lastReviewedAt?: string;
  isFlagged?: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagReason?: string;
  importance: 'critical' | 'high' | 'standard';
}

export interface ActivityEvent {
  id: string;
  type: 'source_ingested' | 'claim_verified' | 'conflict_detected' | 'handover_drafted' | 'claim_rejected' | 'knowledge_reconstructed' | 'claim_flagged' | 'claim_unflagged';
  timestamp: string;
  title: string;
  description: string;
  actor: string;
  claimId?: string;
  sourceId?: string;
}

export interface Workspace {
  id: string;
  name: string;
  code: string;
  description: string;
  role: string;
  projectType: string;
  createdAt: string;
}

export interface ProjectConflict {
  id: string;
  title: string;
  description: string;
  relatedClaimIds: string[];
  supportingEvidence: string[];
  sourceReferences: string[];
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'open' | 'resolved' | 'dismissed';
  resolvedNote?: string;
  isAiDetected?: boolean;
  detectedAt?: string;
}

export interface MissingInfoFinding {
  id: string;
  category: string;
  title: string;
  description: string;
  whyItMatters: string;
  supportingClaimIds?: string[];
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved' | 'dismissed';
  actionSuggestion?: string;
}

export interface UnresolvedQuestion {
  id: string;
  question: string;
  context: string;
  relatedClaimIds?: string[];
  status: 'open' | 'answered' | 'dismissed';
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
}
