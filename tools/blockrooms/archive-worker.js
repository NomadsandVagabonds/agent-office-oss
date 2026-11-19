// Cookies authenticate each same-origin request. The server also checks owner on
// every read/write so a cookie switch in another tab cannot redirect a save.
export async function archiveRequest(action, body) {
  const options = { cache: 'no-store', credentials: 'same-origin' };
  if (body !== undefined) Object.assign(options, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const res = await fetch('./api/archive?action=' + action, options);
  const data = await res.json();
  if (!res.ok) throw Object.assign(Error(data.error || 'Cloud saves are offline.'), { status: res.status });
  return data;
}
export function workerRemote(owner) {
  return { read: () => archiveRequest('read', { owner }), save: (revision, document) => archiveRequest('save', { owner, revision, document }) };
}
