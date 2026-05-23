const API = process.env.REACT_APP_API_URL || 'https://answer-backend.vercel.app';

export async function fetchJson(path, options) {
  const res = await fetch(`${API}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 304) {
    return [];
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const getQuestions = () => fetchJson('/api/questions');
export const getAnswers = () => fetchJson('/api/answers');
export const saveAnswer = (body) =>
  fetchJson('/api/answers', { method: 'POST', body: JSON.stringify(body) });
export const getComments = () => fetchJson('/api/comments');
export const postComment = (body) =>
  fetchJson('/api/comments', { method: 'POST', body: JSON.stringify(body) });
export const getRecentActivity = () => fetchJson('/api/activity/recent');
export const getUpdateActivity = () => fetchJson('/api/activity/updates');
export const deleteAllData = (body) =>
  fetchJson('/api/admin/delete-all', { method: 'POST', body: JSON.stringify(body) });
export const getAiResponses = () => fetchJson('/api/ai/responses');
export const saveAiResponse = (body) =>
  fetchJson('/api/ai/responses', { method: 'POST', body: JSON.stringify(body) });
export const callOpenAI = (body) =>
  fetchJson('/api/ai/call', { method: 'POST', body: JSON.stringify(body) });
