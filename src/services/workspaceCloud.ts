import { supabase } from '../lib/supabase';
import type { ActivityEvent, KnowledgeClaim, MissingInfoFinding, ProjectConflict, Source, UnresolvedQuestion } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}
function requiredWorkspace(id: string) {
  if (!id || id.length > 128) throw new Error('A valid active workspace is required.');
  return id;
}
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString() : '';
const iso = (value?: string) => value ? new Date(value).toISOString() : null;

export type CloudWorkspaceData = {
  sources: Source[];
  claims: KnowledgeClaim[];
  conflicts: ProjectConflict[];
  missingInfo: MissingInfoFinding[];
  questions: UnresolvedQuestion[];
  activity: ActivityEvent[];
};

export async function loadWorkspaceData(workspaceId: string): Promise<CloudWorkspaceData> {
  const ws = requiredWorkspace(workspaceId);
  const db = client();
  const tables = ['sources','claims','conflicts','missing_info','questions','activity_events'] as const;
  const results = await Promise.all(tables.map((table) =>
    db.from(table).select('*').eq('workspace_id', ws).order('created_at', { ascending: false })
  ));
  const failure = results.find((r) => r.error);
  if (failure?.error) throw failure.error;
  const [sourceRows, claimRows, conflictRows, missingRows, questionRows, activityRows] = results.map(r => r.data ?? []);
  const claims: KnowledgeClaim[] = claimRows.map((r: any) => ({
    id:r.id, statement:r.statement, category:r.category, confidenceScore:r.confidence_score,
    confidenceTier:r.confidence_tier, confidenceRationale:r.confidence_rationale,
    verificationStatus:r.verification_status, sourceId:r.source_id, sourceName:r.source_name,
    sourceLocation:r.source_location, sourceEvidenceQuote:r.source_evidence_quote,
    sourceLocator:r.source_locator ?? undefined, pageNumber:r.page_number ?? undefined,
    charOffsetStart:r.char_offset_start ?? undefined, charOffsetEnd:r.char_offset_end ?? undefined,
    evidenceGrounded:r.evidence_grounded, extractionTimestamp:r.extraction_timestamp ?? undefined,
    extractedAt:r.extracted_at_label ?? undefined, aiExplanation:r.ai_explanation ?? undefined,
    isUserExtracted:r.is_user_extracted, conflictingEvidence:r.conflicting_evidence ?? undefined,
    humanReviewNotes:r.human_review_notes ?? undefined, lastReviewedBy:r.last_reviewed_by ?? undefined,
    lastReviewedAt:r.last_reviewed_at ?? undefined, isFlagged:r.is_flagged, flaggedAt:r.flagged_at ?? undefined,
    flaggedBy:r.flagged_by ?? undefined, flagReason:r.flag_reason ?? undefined, importance:r.importance,
  }));
  const sources: Source[] = sourceRows.map((r: any) => ({
    id:r.id,title:r.title,type:r.type,filename:r.filename,size:r.size_display,sizeBytes:r.size_bytes ?? undefined,
    ingestedAt:r.ingested_at_label,timestamp:r.created_at ? new Date(r.created_at).getTime() : undefined,
    claimsCount:r.claims_count,status:r.status,extractionStatus:r.extraction_status,
    reconstructStatus:r.reconstruct_status,reconstructedAt:r.reconstructed_at ?? undefined,
    author:r.author,repoBranch:r.repo_branch ?? undefined,githubOwner:r.github_owner ?? undefined,githubRepo:r.github_repo ?? undefined,githubUrl:r.github_url ?? undefined,commitSha:r.commit_sha ?? undefined,lastSyncedAt:r.last_synced_at ?? undefined,summary:r.summary,rawExcerpt:r.raw_excerpt,
    extractedText:r.extracted_text ?? undefined,pages:r.pages ?? undefined,pageCount:r.page_count ?? undefined,
    charCount:r.char_count ?? undefined,wordCount:r.word_count ?? undefined,errorMessage:r.error_message ?? undefined,
    contentHash:r.content_hash ?? undefined,isUserUploaded:r.is_user_uploaded,mimeType:r.mime_type ?? undefined,tags:r.tags ?? [],
  }));
  const conflicts: ProjectConflict[] = conflictRows.map((r: any) => ({
    id:r.id,title:r.title,description:r.description,relatedClaimIds:r.related_claim_ids ?? [],
    supportingEvidence:r.supporting_evidence ?? [],sourceReferences:r.source_references ?? [],
    severity:r.severity,status:r.status,resolvedNote:r.resolved_note ?? undefined,
    isAiDetected:r.is_ai_detected,detectedAt:r.detected_at ?? undefined,
  }));
  const missingInfo: MissingInfoFinding[] = missingRows.map((r: any) => ({
    id:r.id,category:r.category,title:r.title,description:r.description,whyItMatters:r.why_it_matters,
    supportingClaimIds:r.supporting_claim_ids ?? [],severity:r.severity,status:r.status,
    actionSuggestion:r.action_suggestion ?? undefined,
  }));
  const questions: UnresolvedQuestion[] = questionRows.map((r: any) => ({
    id:r.id,question:r.question,context:r.context,relatedClaimIds:r.related_claim_ids ?? [],
    status:r.status,answer:r.answer ?? undefined,answeredBy:r.answered_by ?? undefined,answeredAt:r.answered_at ?? undefined,
  }));
  const activity: ActivityEvent[] = activityRows.map((r: any) => ({
    id:r.id,type:r.type,timestamp:r.timestamp_label,title:r.title,description:r.description,
    actor:r.actor,claimId:r.claim_id ?? undefined,sourceId:r.source_id ?? undefined,
  }));
  return { sources, claims, conflicts, missingInfo, questions, activity };
}

export async function saveWorkspaceSource(workspaceId: string, source: Source) {
  const ws = requiredWorkspace(workspaceId);
  const { error } = await client().from('sources').upsert({
    id:source.id,workspace_id:ws,title:source.title,type:source.type,filename:source.filename,
    size_display:source.size,size_bytes:source.sizeBytes ?? null,ingested_at_label:source.ingestedAt,
    claims_count:source.claimsCount,status:source.status,extraction_status:source.extractionStatus ?? 'pending',
    reconstruct_status:source.reconstructStatus ?? 'not_started',reconstructed_at:iso(source.reconstructedAt),
    author:source.author,repo_branch:source.repoBranch ?? null,github_owner:source.githubOwner ?? null,github_repo:source.githubRepo ?? null,github_url:source.githubUrl ?? null,commit_sha:source.commitSha ?? null,last_synced_at:iso(source.lastSyncedAt),summary:source.summary,raw_excerpt:source.rawExcerpt,
    extracted_text:source.extractedText ?? null,pages:source.pages ?? null,page_count:source.pageCount ?? null,
    char_count:source.charCount ?? null,word_count:source.wordCount ?? null,error_message:source.errorMessage ?? null,
    content_hash:source.contentHash ?? null,is_user_uploaded:source.isUserUploaded ?? false,
    mime_type:source.mimeType ?? null,tags:source.tags ?? [],
  }, { onConflict:'id' });
  if (error) throw error;
}

export async function saveWorkspaceClaims(workspaceId: string, claims: KnowledgeClaim[]) {
  const ws = requiredWorkspace(workspaceId);
  if (!claims.length) return 0;
  const rows = claims.map(c => ({
    id:c.id,workspace_id:ws,source_id:c.sourceId,source_name:c.sourceName,source_location:c.sourceLocation,
    source_evidence_quote:c.sourceEvidenceQuote,source_locator:c.sourceLocator ?? null,page_number:c.pageNumber ?? null,
    char_offset_start:c.charOffsetStart ?? null,char_offset_end:c.charOffsetEnd ?? null,
    evidence_grounded:c.evidenceGrounded ?? false,statement:c.statement,category:c.category,
    confidence_score:c.confidenceScore,confidence_tier:c.confidenceTier,confidence_rationale:c.confidenceRationale ?? null,
    importance:c.importance,ai_explanation:c.aiExplanation ?? null,is_user_extracted:c.isUserExtracted ?? false,
    extraction_timestamp:iso(c.extractionTimestamp),extracted_at_label:c.extractedAt ?? null,
    verification_status:c.verificationStatus,conflicting_evidence:c.conflictingEvidence ?? null,
    human_review_notes:c.humanReviewNotes ?? null,last_reviewed_by:c.lastReviewedBy ?? null,
    last_reviewed_at:c.lastReviewedAt ?? null,is_flagged:c.isFlagged ?? false,flagged_at:c.flaggedAt ?? null,
    flagged_by:c.flaggedBy ?? null,flag_reason:c.flagReason ?? null,
  }));
  const { data, error } = await client()
    .from('claims')
    .upsert(rows, { onConflict:'id', ignoreDuplicates:true })
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}

export async function countWorkspaceSourceClaims(
  workspaceId: string,
  sourceId: string,
): Promise<number> {
  const ws = requiredWorkspace(workspaceId);
  const { count, error } = await client()
    .from('claims')
    .select('id', { count:'exact', head:true })
    .eq('workspace_id', ws)
    .eq('source_id', sourceId);

  if (error) throw error;
  return count ?? 0;
}

export async function saveWorkspaceConflicts(workspaceId: string, items: ProjectConflict[]) {
  const ws=requiredWorkspace(workspaceId); if(!items.length)return;
  const rows=items.map(x=>({id:x.id,workspace_id:ws,title:x.title,description:x.description,
    related_claim_ids:x.relatedClaimIds,supporting_evidence:x.supportingEvidence,source_references:x.sourceReferences,
    severity:x.severity,status:x.status,resolved_note:x.resolvedNote ?? null,is_ai_detected:x.isAiDetected ?? false,
    detected_at:iso(x.detectedAt)}));
  const {error}=await client().from('conflicts').upsert(rows,{onConflict:'id'}); if(error)throw error;
}
export async function saveWorkspaceMissingInfo(workspaceId: string, items: MissingInfoFinding[]) {
  const ws=requiredWorkspace(workspaceId); if(!items.length)return;
  const rows=items.map(x=>({id:x.id,workspace_id:ws,category:x.category,title:x.title,description:x.description,
    why_it_matters:x.whyItMatters,supporting_claim_ids:x.supportingClaimIds ?? [],severity:x.severity,
    status:x.status,action_suggestion:x.actionSuggestion ?? null}));
  const {error}=await client().from('missing_info').upsert(rows,{onConflict:'id'}); if(error)throw error;
}
export async function saveWorkspaceQuestions(workspaceId: string, items: UnresolvedQuestion[]) {
  const ws=requiredWorkspace(workspaceId); if(!items.length)return;
  const rows=items.map(x=>({id:x.id,workspace_id:ws,question:x.question,context:x.context,
    related_claim_ids:x.relatedClaimIds ?? [],status:x.status,answer:x.answer ?? null,
    answered_by:x.answeredBy ?? null,answered_at:x.answeredAt ?? null}));
  const {error}=await client().from('questions').upsert(rows,{onConflict:'id'}); if(error)throw error;
}
export async function appendWorkspaceActivity(workspaceId: string, event: ActivityEvent) {
  const ws=requiredWorkspace(workspaceId);
  const {data:{user}}=await client().auth.getUser();
  if(!user)throw new Error('Your session expired. Sign in again.');
  const {error}=await client().from('activity_events').insert({
    id:event.id,workspace_id:ws,type:event.type,timestamp_label:event.timestamp,
    title:event.title,description:event.description,actor:event.actor,actor_user_id:user.id,
    actor_source:'jwt',claim_id:event.claimId ?? null,source_id:event.sourceId ?? null,
  });
  if(error)throw error;
}
export async function deleteWorkspaceSource(workspaceId: string, sourceId: string) {
  const ws=requiredWorkspace(workspaceId);
  const db=client();
  const {data:files,error:fileReadError}=await db.from('source_files').select('storage_bucket,storage_path').eq('workspace_id',ws).eq('source_id',sourceId);
  if(fileReadError)throw fileReadError;
  for(const file of files ?? []){
    const {error:storageError}=await db.storage.from(file.storage_bucket).remove([file.storage_path]);
    if(storageError)throw storageError;
  }
  const {error}=await db.from('sources').delete().eq('workspace_id',ws).eq('id',sourceId);
  if(error)throw error;
}
export async function uploadWorkspaceSourceFile(workspaceId: string, source: Source, file: File, cleanupSourceOnFailure = true) {
  const ws=requiredWorkspace(workspaceId); const db=client();
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120) || 'source.bin';
  const path=ws+'/'+source.id+'/'+crypto.randomUUID()+'-'+safeName;
  const bucket='projectvault-sources';
  const {error:uploadError}=await db.storage.from(bucket).upload(path,file,{contentType:file.type || 'application/octet-stream',upsert:false});
  if(uploadError){ if(cleanupSourceOnFailure) await db.from('sources').delete().eq('workspace_id',ws).eq('id',source.id); throw uploadError; }
  const {data:{user}}=await db.auth.getUser();
  if(!user){await db.storage.from(bucket).remove([path]);if(cleanupSourceOnFailure) await db.from('sources').delete().eq('workspace_id',ws).eq('id',source.id);throw new Error('Your session expired. Sign in again.');}
  const {error:metadataError}=await db.from('source_files').insert({
    workspace_id:ws,source_id:source.id,storage_bucket:bucket,storage_path:path,
    filename:file.name,mime_type:file.type || 'application/octet-stream',size_bytes:file.size,created_by:user.id,
  });
  if(metadataError){await db.storage.from(bucket).remove([path]);if(cleanupSourceOnFailure) await db.from('sources').delete().eq('workspace_id',ws).eq('id',source.id);throw metadataError;}
  return path;
}
export function subscribeWorkspaceChanges(workspaceId: string, onChange: () => void, channelSuffix = 'app') {
  const ws = requiredWorkspace(workspaceId);
  const db = client();
  const tables = ['sources', 'claims', 'conflicts', 'missing_info', 'questions', 'handovers'] as const;

  // Postgres Changes handles INSERT and UPDATE. DELETE is delivered through
  // a separate private Broadcast channel because filtered DELETE payloads
  // are not reliable with REPLICA IDENTITY DEFAULT.
  const postgresChannel = db.channel('pv-workspace-' + ws + '-' + channelSuffix);

  for (const table of tables) {
    for (const event of ['INSERT', 'UPDATE'] as const) {
      postgresChannel.on(
        'postgres_changes',
        { event, schema: 'public', table, filter: 'workspace_id=eq.' + ws },
        onChange
      );
    }
  }

  const deleteChannel = db
    .channel('pv-workspace:' + ws + ':' + channelSuffix, { config: { private: true } })
    .on('broadcast', { event: 'workspace_delete' }, onChange);

  postgresChannel.subscribe();
  deleteChannel.subscribe();

  return () => {
    void db.removeChannel(postgresChannel);
    void db.removeChannel(deleteChannel);
  };
}

export type WorkspaceHandover = {
  id: string; title: string; versionLabel: string; targetAudience: string;
  executiveNote: string; finalComment: string; checklist: Record<string, boolean>;
  isApproved: boolean; approvedBy: string;
};
export async function loadWorkspaceHandover(workspaceId: string): Promise<WorkspaceHandover | null> {
  const ws=requiredWorkspace(workspaceId);
  const {data,error}=await client().from('handovers').select('*').eq('workspace_id',ws).maybeSingle();
  if(error)throw error; if(!data)return null;
  return {id:data.id,title:data.title,versionLabel:data.version_label,targetAudience:data.target_audience,
    executiveNote:data.executive_note,finalComment:data.final_comment,checklist:data.checklist ?? {},
    isApproved:data.is_approved,approvedBy:data.approved_by ?? ''};
}
export async function saveWorkspaceHandover(workspaceId: string, draft: {
  title:string; executiveNote:string; finalComment:string; checklist:Record<string,boolean>;
  isApproved:boolean; approvedBy:string;
}) {
  const ws=requiredWorkspace(workspaceId); const db=client();
  const {data:{user}}=await db.auth.getUser(); if(!user)throw new Error('Your session expired. Sign in again.');
  const {data:existing,error:readError}=await db.from('handovers').select('id').eq('workspace_id',ws).maybeSingle();
  if(readError)throw readError;
  const payload={workspace_id:ws,title:draft.title,executive_note:draft.executiveNote,final_comment:draft.finalComment,
    checklist:draft.checklist,is_approved:draft.isApproved,approved_by:draft.isApproved?draft.approvedBy:null,
    approved_by_user_id:draft.isApproved?user.id:null,approved_at:draft.isApproved?new Date().toISOString():null};
  const result=existing
    ? await db.from('handovers').update(payload).eq('workspace_id',ws).eq('id',existing.id)
    : await db.from('handovers').insert(payload);
  if(result.error)throw result.error;
  if(draft.isApproved) await appendWorkspaceActivity(ws,{id:'act-'+crypto.randomUUID(),type:'handover_approved',
    timestamp:'Just now',title:'Handover approved',description:'Human reviewer approved the workspace handover dossier.',
    actor:draft.approvedBy});
}
export async function downloadWorkspaceSourceFile(workspaceId: string, sourceId: string) {
  const ws=requiredWorkspace(workspaceId); const db=client();
  const {data,error}=await db.from('source_files').select('storage_bucket,storage_path,filename')
    .eq('workspace_id',ws).eq('source_id',sourceId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error; if(!data)throw new Error('No cloud file is attached to this source.');
  const {data:signed,error:signedError}=await db.storage.from(data.storage_bucket).createSignedUrl(data.storage_path,60,{download:data.filename});
  if(signedError)throw signedError; if(!signed?.signedUrl)throw new Error('A secure download link could not be created.');
  return {url:signed.signedUrl,filename:data.filename};
}

export async function findWorkspaceDuplicateSourceByHash(workspaceId: string, contentHash: string) {
  const ws=requiredWorkspace(workspaceId);
  const {data,error}=await client().from('sources').select('id,title,content_hash')
    .eq('workspace_id',ws).eq('content_hash',contentHash).limit(1).maybeSingle();
  if(error)throw error;
  return data ? {id:data.id,title:data.title} : null;
}

export async function updateWorkspaceClaim(workspaceId: string, claim: KnowledgeClaim) {
  const ws=requiredWorkspace(workspaceId);
  const {error}=await client().from('claims').update({
    verification_status:claim.verificationStatus,human_review_notes:claim.humanReviewNotes ?? null,
    last_reviewed_by:claim.lastReviewedBy ?? null,last_reviewed_at:claim.lastReviewedAt ?? null,
    is_flagged:claim.isFlagged ?? false,flagged_at:claim.flaggedAt ?? null,
    flagged_by:claim.flaggedBy ?? null,flag_reason:claim.flagReason ?? null,
  }).eq('workspace_id',ws).eq('id',claim.id);
  if(error)throw error;
}
