import { API_BASE, BUILD_ID } from './config';

export const api = (path) => API_BASE + path;

export function checkBuild(data) {
  if (data.build_id !== BUILD_ID) {
    throw new Error(`Version mismatch: viewer ${BUILD_ID}, backend ${data.build_id || 'older/unidentified'}. Update the backend and restart it.`);
  }
}

export async function getJson(path, init) {
  const response = await fetch(api(path), init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function postJson(path, body) {
  const response = await fetch(api(path), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !data.error) data.error = `HTTP ${response.status}`;
  return data;                       // callers read data.error, same contract as the old viewer
}

// Chunked upload keeps every request under Cloud Run's 32 MB body limit.
export const CHUNK_SIZE = 8 * 1024 * 1024;
export async function uploadChunked(file, kind, sessionId, onBytes) {
  const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  for (let i = 0; i < total; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const form = new FormData();
    form.append('session_id', sessionId);
    form.append('chunk_index', i);
    form.append('total_chunks', total);
    form.append('filename', file.name);
    form.append('kind', kind);
    form.append('chunk', chunk, file.name);
    const r = await fetch(api('/upload-chunk'), { method: 'POST', body: form });
    if (!r.ok) throw new Error(`Chunk upload failed (${file.name} part ${i + 1}/${total}): HTTP ${r.status}`);
    onBytes(chunk.size);
    const j = await r.json();
    if (i === total - 1) return j.gcs_path;
  }
}
