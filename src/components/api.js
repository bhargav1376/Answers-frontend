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
export const deleteAllPersonalData = (body) =>
  fetchJson('/api/admin/delete-personal', { method: 'POST', body: JSON.stringify(body) });
export const deleteUser = (body) =>
  fetchJson('/api/admin/delete-user', { method: 'POST', body: JSON.stringify(body) });
export const checkUser = (userName) =>
  fetchJson(`/api/user/check?user_name=${encodeURIComponent(userName)}`);
export const renameUser = (body) =>
  fetchJson('/api/user/rename', { method: 'POST', body: JSON.stringify(body) });
export const getAiResponses = () => fetchJson('/api/ai/responses');
export const saveAiResponse = (body) =>
  fetchJson('/api/ai/responses', { method: 'POST', body: JSON.stringify(body) });
export const callOpenAI = (body) =>
  fetchJson('/api/ai/call', { method: 'POST', body: JSON.stringify(body) });
export const getCode = () => fetchJson('/api/code');
export const saveCode = (body) =>
  fetchJson('/api/code', { method: 'POST', body: JSON.stringify(body) });
export const deleteCode = (id) =>
  fetchJson(`/api/code/${id}`, { method: 'DELETE' });
export const verifyAdmin = (body) =>
  fetchJson('/api/admin/verify', { method: 'POST', body: JSON.stringify(body) });
export const getChatMessages = () => fetchJson('/api/chat');
export const postChatMessage = (body) =>
  fetchJson('/api/chat', { method: 'POST', body: JSON.stringify(body) });
export const loginUser = (body) =>
  fetchJson('/api/login', { method: 'POST', body: JSON.stringify(body) });
export const getPersonalChatSummary = (userName) =>
  fetchJson(`/api/personal_chat/summary?user_name=${encodeURIComponent(userName)}`);
export const getPersonalChatMessages = (user1, user2) =>
  fetchJson(`/api/personal_chat/messages?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`);
export const postPersonalChatMessage = (body) =>
  fetchJson('/api/personal_chat/messages', { method: 'POST', body: JSON.stringify(body) });
export const markPersonalChatRead = (body) =>
  fetchJson('/api/personal_chat/read', { method: 'POST', body: JSON.stringify(body) });
