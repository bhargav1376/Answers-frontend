import { useEffect, useState } from 'react';
import './ai.css';
import { getAiResponses, saveAiResponse } from './api';

export function getDeepAIUrl() {
  const configured = (process.env.REACT_APP_DEEPAI_URL ?? '').trim();
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return configured;
  }
  if (configured.startsWith('/')) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.deepai.org/hacking_is_a_serious_crime';
  }
  return '/hacking_is_a_serious_crime';
}

const API_KEY = (process.env.REACT_APP_DEEPAI_API_KEY ?? '').trim();
const DEEPAI_URL = getDeepAIUrl();

export function formatQuestionLabel(number, text) {
  const cleaned = (text || '')
    .replace(/— fill in the blank/gi, '')
    .replace(/fill in the blank/gi, '')
    .replace(/^Question\s+\d+\s*[-—]?\s*/i, '')
    .trim();
  return cleaned ? `Q${number} — ${cleaned}` : `Q${number} — Option & explanation`;
}

export function formatAiResponseTitle(item) {
  if (item.response_index > 1) {
    return `AI response ${item.response_index} for Q${item.question_number} by ${item.user_name}`;
  }
  return `AI response for Q${item.question_number} by ${item.user_name}`;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseAiResponse(raw) {
  const text = (raw || '').trim();
  const answerMatch =
    text.match(/ANSWER:\s*([\s\S]*?)(?=EXPLANATION:|$)/i) ||
    text.match(/OPTION:\s*([\s\S]*?)(?=EXPLANATION:|$)/i);
  const explainMatch = text.match(/EXPLANATION:\s*([\s\S]*?)$/i);
  return {
    ai_option: answerMatch ? answerMatch[1].trim() : '',
    ai_explanation: explainMatch ? explainMatch[1].trim() : text,
    raw_response: text,
  };
}

export async function callDeepAI({ questionText, sheetOption, sheetExplanation }) {
  if (!API_KEY || !DEEPAI_URL) {
    throw new Error(
      'Missing DeepAI config — add REACT_APP_DEEPAI_API_KEY and REACT_APP_DEEPAI_URL to answer-frontend/.env, then restart npm start'
    );
  }

  const userMessage = [
    questionText.trim(),
    sheetOption ? `Saved option on sheet: ${sheetOption}` : '',
    sheetExplanation ? `Saved explanation on sheet: ${sheetExplanation}` : '',
    '',
    'Summarize and give the best answer. Reply exactly:',
    'ANSWER: [the correct answer — not just option number, full answer text]',
    'EXPLANATION: [clear explanation]',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const formData = new FormData();
  formData.append('chat_style', 'ai-code');
  formData.append(
    'chatHistory',
    JSON.stringify([{ role: 'user', content: userMessage }])
  );
  formData.append('model', 'standard');
  formData.append('session_uuid', crypto.randomUUID());
  formData.append('sensitivity_request_id', crypto.randomUUID());
  formData.append('hacker_is_stinky', 'very_stinky');
  formData.append('enabled_tools', '["image_generator","image_editor"]');

  const response = await fetch(DEEPAI_URL, {
    method: 'POST',
    headers: { accept: '*/*', 'api-key': API_KEY },
    body: formData,
  });

  const resText = await response.text();
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Unauthorized — check your DeepAI api-key'
        : `DeepAI request failed (${response.status})`
    );
  }

  try {
    const resJson = JSON.parse(resText);
    return String(resJson.output || resJson.text || resText).trim();
  } catch {
    return resText.trim();
  }
}

export function AiChatButton({ onClick }) {
  return (
    <button type="button" className="btn-ai-chat" onClick={onClick}>
      AI Chat
    </button>
  );
}

export function AiChatModal({
  open,
  onClose,
  userName,
  questions,
  answerByQ,
  latestCommentByQ,
  onComplete,
}) {
  const [step, setStep] = useState(1);
  const [questionNumber, setQuestionNumber] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const qNum = Number(questionNumber);
  const selectedQ = questions.find((q) => q.number === qNum);
  const saved = answerByQ[qNum];
  const lastComment = latestCommentByQ[qNum];

  const reset = () => {
    setStep(1);
    setQuestionNumber('');
    setQuestionPrompt('');
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const goToQuestionForm = () => {
    if (!questionNumber) return;
    setQuestionPrompt('');
    setStep(2);
    setError('');
  };

  const handleSummarize = async () => {
    if (!questionPrompt.trim()) {
      setError('Enter your question');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const raw = await callDeepAI({
        questionText: questionPrompt.trim(),
        sheetOption: saved?.answer_text || '',
        sheetExplanation: lastComment?.comment_text || '',
      });
      const parsed = parseAiResponse(raw);

      const existing = await getAiResponses().catch(() => []);
      const countForQ = existing.filter((r) => r.question_number === qNum).length;

      const savedRow = await saveAiResponse({
        question_number: qNum,
        response_index: countForQ + 1,
        user_name: userName,
        question_prompt: questionPrompt.trim(),
        options_text: null,
        sheet_option: saved?.answer_text || '',
        sheet_explanation: lastComment?.comment_text || '',
        ai_option: parsed.ai_option,
        ai_explanation: parsed.ai_explanation,
        raw_response: parsed.raw_response,
      });

      reset();
      onClose();
      onComplete?.(savedRow);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay ai-overlay" onClick={handleClose} role="presentation">
      <div className="modal-card ai-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>AI Chat</h2>
        <p className="ai-modal-sub">DeepAI · {getDeepAIUrl()}</p>
        {error && <div className="modal-error">{error}</div>}

        {step === 1 && (
          <>
            <p className="ai-step-label">Step 1 — Select question number</p>
            <select
              value={questionNumber}
              onChange={(e) => setQuestionNumber(e.target.value)}
              className="ai-select"
            >
              <option value="">Choose Q1 – Q20</option>
              {questions.map((q) => (
                <option key={q.number} value={q.number}>
                  Q{q.number}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-ai-primary"
                disabled={!questionNumber}
                onClick={goToQuestionForm}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="ai-step-label">Step 2 — Type your question, then Summarize</p>
            <div className="ai-q-header">
              <span className="ai-q-badge">Q{questionNumber}</span>
              {selectedQ && <span className="ai-q-topic">{selectedQ.text}</span>}
            </div>
            <label>
              Question
              <textarea
                rows={4}
                value={questionPrompt}
                onChange={(e) => setQuestionPrompt(e.target.value)}
                placeholder="Type your question here..."
                autoFocus
              />
            </label>
            {(saved?.answer_text || lastComment?.comment_text) && (
              <p className="ai-sheet-hint">
                Sheet: option <strong>{saved?.answer_text || '—'}</strong>
                {lastComment?.comment_text && (
                  <> · explanation <em>{lastComment.comment_text}</em></>
                )}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn-ai-primary"
                disabled={loading}
                onClick={handleSummarize}
              >
                {loading ? 'Summarizing…' : 'Summarize'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AiResponseBody({ item, questions }) {
  const q = questions.find((x) => x.number === item.question_number);
  const title = q
    ? formatQuestionLabel(item.question_number, q.text)
    : `Q${item.question_number} — Option & explanation`;

  return (
    <>
      <p className="ai-q-title">{title}</p>
      <p className="ai-asked-line">
        <span className="ai-key">Question asked</span> — {item.question_prompt}
      </p>
      {(item.sheet_option || item.sheet_explanation) && (
        <p className="ai-sheet-line">
          Sheet — option <strong>{item.sheet_option || '—'}</strong>
          {item.sheet_explanation && (
            <> · explanation <em>{item.sheet_explanation}</em></>
          )}
        </p>
      )}
      <div className="ai-result-block">
        <p className="ai-result-line">
          <span className="ai-key">answer</span> — <strong>{item.ai_option || '—'}</strong>
        </p>
        <p className="ai-result-line ai-explain">
          <span className="ai-key">explain</span> — {item.ai_explanation || '—'}
        </p>
      </div>
      <time>{formatTime(item.created_at)}</time>
    </>
  );
}

function AiResponseToggle({ item, expanded, onToggle, compact }) {
  return (
    <button
      type="button"
      className={`ai-response-toggle${compact ? ' ai-response-toggle--compact' : ''}`}
      onClick={onToggle}
    >
      <span className="ai-response-label">{formatAiResponseTitle(item)}</span>
      <span className="ai-toggle-icon">{expanded ? '▼' : '▶'}</span>
    </button>
  );
}

export function QuestionAiResponses({
  questionNumber,
  responses,
  questions,
  expandedIds,
  onToggle,
}) {
  const forQ = responses
    .filter((r) => r.question_number === questionNumber)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (forQ.length === 0) return null;

  return (
    <div className="q-ai-section">
      <p className="q-ai-section-label">
        AI responses for Q{questionNumber} ({forQ.length})
      </p>
      {forQ.map((item) => (
        <div key={item.id} className="ai-response-item ai-response-item--inline">
          <AiResponseToggle
            item={item}
            expanded={expandedIds.has(item.id)}
            onToggle={() => onToggle(item.id)}
            compact
          />
          {expandedIds.has(item.id) && (
            <div className="ai-response-body">
              <AiResponseBody item={item} questions={questions} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AiResponseCard({ item, questions, expanded, onToggle }) {
  return (
    <li className="ai-response-item">
      <AiResponseToggle item={item} expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div className="ai-response-body">
          <AiResponseBody item={item} questions={questions} />
        </div>
      )}
    </li>
  );
}

export function AiModePanel({ responses, questions, expandedId, onToggle }) {
  const sorted = [...responses].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const [viewIndex, setViewIndex] = useState(0);

  useEffect(() => {
    if (!expandedId || responses.length === 0) return;
    const idx = sorted.findIndex((r) => r.id === expandedId);
    if (idx >= 0) setViewIndex(idx);
  }, [expandedId, responses]);

  const current = sorted[viewIndex];
  const openCurrent = current && expandedId === current.id;

  const showAt = (idx) => {
    const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
    setViewIndex(clamped);
    const item = sorted[clamped];
    if (item) onToggle(item.id);
  };

  return (
<aside className="answer-side ai-side">
  <h2>AI mode</h2>

  {sorted.length === 0 ? (
    <p className="empty">No AI searches yet</p>
  ) : (
    <>
      <p className="ai-mode-count">
        {sorted.length} result
        {sorted.length !== 1 ? 's' : ''} — click title to open
      </p>

      <ul className="activity-list ai-list">
        {sorted.map((item) => (
          <AiResponseCard
            key={item.id}
            item={item}
            questions={questions}
            expanded={expandedId === item.id}
            onToggle={() =>
              onToggle(
                expandedId === item.id
                  ? null
                  : item.id
              )
            }
          />
        ))}
      </ul>
    </>
  )}
</aside>
  );
}
