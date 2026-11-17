import { mergeArchive } from './core/archive.mjs';
// CAS retries merge the server's intervening write instead of overwriting it.
export async function syncArchive({ read, merge, remote, allowed = () => true }) {
  let current = await remote.read();
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!allowed()) return false;
    await merge(current.document);
    const sent = mergeArchive(current.document, read());
    const result = await remote.save(current.revision, sent);
    if (!allowed()) return false;
    if (result.accepted) {
      await merge(result.document);
      if (JSON.stringify(mergeArchive(read(), result.document)) === JSON.stringify(mergeArchive(result.document, result.document))) return true;
    }
    current = result;
  }
  throw new Error('Another device is saving. Your changes are safe here; try Sync again.');
}
export function supabaseRemote(client) {
  return {
    async read() {
      const { data, error } = await client.from('blockrooms_profiles').select('revision,document').maybeSingle();
      if (error) throw error;
      return data || { revision: 0, document: { v: 1 } };
    },
    async save(revision, document) {
      const { data, error } = await client.rpc('blockrooms_save_profile', { expected_revision: revision, payload: document });
      if (error) throw error;
      return data;
    },
  };
}
