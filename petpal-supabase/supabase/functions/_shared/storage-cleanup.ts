// Drains public.storage_cleanup_queue (migration 0032). A queue entry is only
// deleted after Storage confirms the removal; a failure is recorded on the
// entry and it is retried by the next run, so a file is never forgotten.

// Only the client calls this module uses, so tests can pass a fake.
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

export type QueueEntry = { id: number; bucket_id: string; object_path: string };

export type CleanupResult = { removed: number; failed: number };

const BATCH_SIZE = 500; // Storage accepts at most 1000 paths per remove call.

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}

export async function enqueueStorageCleanup(
  admin: AdminClient,
  bucketId: string,
  paths: string[],
  profileId: string | null,
  reason: string,
) {
  if (!paths.length) return;
  const rows = paths.map((objectPath) => ({ bucket_id: bucketId, object_path: objectPath, profile_id: profileId, reason }));
  const { error } = await admin
    .from('storage_cleanup_queue')
    .upsert(rows, { onConflict: 'bucket_id,object_path', ignoreDuplicates: true });
  if (error) throw error;
}

// Processes queued files, either one profile's (profileId) or the oldest due
// entries across all profiles. Never throws for a storage failure: it records
// it and reports it in the result.
export async function processStorageCleanupQueue(
  admin: AdminClient,
  options: { profileId?: string; limit?: number } = {},
): Promise<CleanupResult> {
  const limit = Math.min(options.limit ?? BATCH_SIZE, BATCH_SIZE);
  let query = admin.from('storage_cleanup_queue').select('id, bucket_id, object_path');
  if (options.profileId) query = query.eq('profile_id', options.profileId);
  const { data, error } = await query
    .order('last_attempt_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const entries = (data || []) as QueueEntry[];
  const byBucket = new Map<string, QueueEntry[]>();
  for (const entry of entries) {
    const list = byBucket.get(entry.bucket_id) || [];
    list.push(entry);
    byBucket.set(entry.bucket_id, list);
  }

  let removed = 0;
  let failed = 0;
  for (const [bucketId, bucketEntries] of byBucket) {
    const ids = bucketEntries.map((entry) => entry.id);
    try {
      const { error: removeError } = await admin.storage.from(bucketId).remove(bucketEntries.map((entry) => entry.object_path));
      if (removeError) throw removeError;
      const { error: deleteError } = await admin.from('storage_cleanup_queue').delete().in('id', ids);
      if (deleteError) throw deleteError;
      removed += ids.length;
    } catch (cleanupError) {
      failed += ids.length;
      console.error('storage cleanup failed', bucketId, cleanupError);
      const { error: recordError } = await admin.rpc('record_storage_cleanup_failure', {
        queue_ids: ids,
        error_input: errorText(cleanupError),
      });
      if (recordError) console.error('could not record storage cleanup failure', recordError);
    }
  }

  return { removed, failed };
}
