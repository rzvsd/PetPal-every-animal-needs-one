// Run with: deno test supabase/functions/_shared/
import { enqueueStorageCleanup, processStorageCleanupQueue, type QueueEntry } from './storage-cleanup.ts';

function assertEquals(actual: unknown, expected: unknown, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}\n  expected ${e}\n  actual   ${a}`);
}

type Row = QueueEntry & { profile_id: string | null; attempts: number; last_error: string | null };

// In-memory stand-in for the parts of supabase-js the module uses.
function fakeAdmin(rows: Row[], options: { failBuckets?: string[]; storedFiles?: Map<string, Set<string>> } = {}) {
  const files = options.storedFiles || new Map<string, Set<string>>();
  const removeCalls: { bucket: string; paths: string[] }[] = [];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  const admin = {
    removeCalls,
    files,
    rows,
    from(table: string) {
      if (table !== 'storage_cleanup_queue') throw new Error(`unexpected table ${table}`);
      const filters: ((row: Row) => boolean)[] = [];
      let limitCount = Infinity;
      const builder = {
        select() {
          return builder;
        },
        eq(column: keyof Row, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        order() {
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          const data = rows.filter((row) => filters.every((f) => f(row))).slice(0, limitCount);
          return Promise.resolve({ data, error: null });
        },
        delete() {
          return {
            in(_column: string, ids: number[]) {
              for (const id of ids) {
                const index = rows.findIndex((row) => row.id === id);
                if (index >= 0) rows.splice(index, 1);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(newRows: Omit<Row, 'id' | 'attempts' | 'last_error'>[]) {
          for (const row of newRows) {
            if (rows.some((r) => r.bucket_id === row.bucket_id && r.object_path === row.object_path)) continue;
            rows.push({ ...row, id: nextId++, attempts: 0, last_error: null });
          }
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
    storage: {
      from(bucket: string) {
        return {
          remove(paths: string[]) {
            removeCalls.push({ bucket, paths });
            if (options.failBuckets?.includes(bucket)) {
              return Promise.resolve({ data: null, error: { message: 'Storage unavailable' } });
            }
            for (const path of paths) files.get(bucket)?.delete(path);
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    },
    rpc(name: string, args: { queue_ids: number[]; error_input: string }) {
      if (name !== 'record_storage_cleanup_failure') throw new Error(`unexpected rpc ${name}`);
      for (const row of rows) {
        if (args.queue_ids.includes(row.id)) {
          row.attempts += 1;
          row.last_error = args.error_input;
        }
      }
      return Promise.resolve({ error: null });
    },
  };
  return admin;
}

const USER = 'u-1';
const OTHER = 'u-2';

function row(id: number, bucket: string, path: string, profileId: string | null = USER): Row {
  return { id, bucket_id: bucket, object_path: path, profile_id: profileId, attempts: 0, last_error: null };
}

Deno.test('removes a profile\'s queued files and clears their queue entries', async () => {
  const files = new Map([
    ['verification-documents', new Set(['u-1/id.pdf', 'u-2/id.pdf'])],
    ['animal-photos', new Set(['u-1/a/1.jpg'])],
  ]);
  const admin = fakeAdmin(
    [row(1, 'verification-documents', 'u-1/id.pdf'), row(2, 'animal-photos', 'u-1/a/1.jpg'), row(3, 'verification-documents', 'u-2/id.pdf', OTHER)],
    { storedFiles: files },
  );

  const result = await processStorageCleanupQueue(admin, { profileId: USER });

  assertEquals(result, { removed: 2, failed: 0 });
  assertEquals([...files.get('verification-documents')!], ['u-2/id.pdf'], 'only the user\'s document is removed');
  assertEquals(files.get('animal-photos')!.size, 0);
  assertEquals(admin.rows.map((r) => r.id), [3], 'other users\' entries stay queued');
});

Deno.test('a failed removal keeps the entry queued and records the error', async () => {
  const admin = fakeAdmin([row(1, 'verification-documents', 'u-1/id.pdf'), row(2, 'animal-photos', 'u-1/a/1.jpg')], {
    failBuckets: ['verification-documents'],
  });

  const result = await processStorageCleanupQueue(admin, { profileId: USER });

  assertEquals(result, { removed: 1, failed: 1 });
  assertEquals(admin.rows.map((r) => [r.id, r.attempts, r.last_error]), [[1, 1, 'Storage unavailable']]);
});

Deno.test('the next run retries a previously failed ID document until it is gone', async () => {
  const files = new Map([['verification-documents', new Set(['u-1/id.pdf'])]]);
  const failing = fakeAdmin([row(1, 'verification-documents', 'u-1/id.pdf')], {
    failBuckets: ['verification-documents'],
    storedFiles: files,
  });
  await processStorageCleanupQueue(failing, { profileId: USER });
  assertEquals(files.get('verification-documents')!.size, 1, 'file survives the failed attempt');

  // Later sweep with no profile filter, Storage healthy again.
  const healthy = fakeAdmin(failing.rows, { storedFiles: files });
  const result = await processStorageCleanupQueue(healthy);

  assertEquals(result, { removed: 1, failed: 0 });
  assertEquals(files.get('verification-documents')!.size, 0);
  assertEquals(healthy.rows.length, 0);
});

Deno.test('enqueue ignores files that are already queued', async () => {
  const admin = fakeAdmin([row(1, 'animal-photos', 'u-1/a/1.jpg')]);
  await enqueueStorageCleanup(admin, 'animal-photos', ['u-1/a/1.jpg', 'u-1/a/2.jpg'], USER, 'account_deleted');
  assertEquals(admin.rows.map((r) => r.object_path), ['u-1/a/1.jpg', 'u-1/a/2.jpg']);
});

Deno.test('an empty queue makes no storage calls', async () => {
  const admin = fakeAdmin([]);
  const result = await processStorageCleanupQueue(admin, { profileId: USER });
  assertEquals(result, { removed: 0, failed: 0 });
  assertEquals(admin.removeCalls.length, 0);
});
