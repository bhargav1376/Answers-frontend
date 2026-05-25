import { useEffect, useState } from 'react';
import './ai.css';
import { getAiResponses, saveAiResponse, callOpenAI } from './api';

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
  const [images, setImages] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);

  if (!open) return null;

  const qNum = Number(questionNumber);
  const selectedQ = questions.find((q) => q.number === qNum);
  const saved = answerByQ[qNum];
  const lastComment = latestCommentByQ[qNum];

  const reset = () => {
    setStep(1);
    setQuestionNumber('');
    setQuestionPrompt('');
    setImages([]);
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
      const rawData = await callOpenAI({
        questionText: questionPrompt.trim(),
        sheetOption: saved?.answer_text || '',
        sheetExplanation: lastComment?.comment_text || '',
        images: images,
      });
      const raw = rawData.text || '';
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
        images: images,
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
        <p className="ai-modal-sub">ChatGPT (GPT-5.4-mini)</p>
        {error && <div className="modal-error">{error}</div>}

        {lightboxImg && (
          <div className="ai-lightbox" onClick={() => setLightboxImg(null)}>
            <img src={lightboxImg} alt="Enlarged" onClick={(e) => e.stopPropagation()} />
            <button className="ai-lightbox-close" onClick={() => setLightboxImg(null)}>&times;</button>
          </div>
        )}

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
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      const file = items[i].getAsFile();
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setImages((prev) => {
                          if (prev.length >= 4) return prev;
                          return [...prev, ev.target.result];
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                }}
                placeholder="Type your question here or paste an image..."
                autoFocus
              />
            </label>
            {images.length > 0 && (
              <div className="ai-image-previews">
                {images.map((img, idx) => (
                  <div key={idx} className="ai-image-preview">
                    <img src={img} alt={`Preview ${idx}`} onClick={() => setLightboxImg(img)} />
                    <button type="button" onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}>&times;</button>
                  </div>
                ))}
              </div>
            )}
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

function AiResponseBody({ item, questions, onImageClick, onRecheck, recheckLoading }) {
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpImages, setFollowUpImages] = useState([]);

  const q = questions.find((x) => x.number === item.question_number);
  const title = q
    ? formatQuestionLabel(item.question_number, q.text)
    : `Q${item.question_number} — Option & explanation`;

  let imagesArray = [];
  try {
    if (item.images) {
      const parsed = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
      if (Array.isArray(parsed)) imagesArray = parsed;
    }
  } catch (e) { }

  const handleSubmit = () => {
    if (onRecheck) {
      onRecheck(item, followUpText, followUpImages);
      setShowFollowUp(false);
      setFollowUpText('');
      setFollowUpImages([]);
    }
  };

  return (
    <>
      <p className="ai-q-title">{title}</p>
      <p className="ai-asked-line">
        <span className="ai-key">Question asked</span> — {item.question_prompt}
      </p>
      {imagesArray.length > 0 && (
        <div className="ai-response-images">
          {imagesArray.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`Input ${idx}`}
              onClick={() => onImageClick && onImageClick(img)}
            />
          ))}
        </div>
      )}
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
      <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
        {!showFollowUp ? (
          <button 
            type="button" 
            className="btn-ai-primary" 
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            onClick={() => setShowFollowUp(true)}
            disabled={recheckLoading === item.id}
          >
            {recheckLoading === item.id ? 'Checking deeply…' : 'Ai check again deeply'}
          </button>
        ) : (
          <div className="ai-follow-up-box" style={{ marginTop: '0.5rem' }}>
            <textarea
              rows={2}
              value={followUpText}
              onChange={(e) => setFollowUpText(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setFollowUpImages((prev) => {
                        if (prev.length >= 4) return prev;
                        return [...prev, ev.target.result];
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }
              }}
              placeholder="Why is it wrong? Paste text or image here..."
              style={{
                width: '100%',
                padding: '8px',
                boxSizing: 'border-box',
                background: '#0c1014',
                color: '#fff',
                border: '1px solid #2a3848',
                borderRadius: '6px',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.85rem'
              }}
              autoFocus
            />
            {followUpImages.length > 0 && (
              <div className="ai-image-previews" style={{ marginTop: '0.5rem' }}>
                {followUpImages.map((img, idx) => (
                  <div key={idx} className="ai-image-preview">
                    <img src={img} alt={`Preview ${idx}`} onClick={() => onImageClick && onImageClick(img)} />
                    <button type="button" onClick={() => setFollowUpImages((prev) => prev.filter((_, i) => i !== idx))}>&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-ai-primary" 
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={handleSubmit} 
                disabled={recheckLoading === item.id || (!followUpText.trim() && followUpImages.length === 0)}
              >
                {recheckLoading === item.id ? 'Checking deeply…' : 'Submit Check'}
              </button>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={() => { setShowFollowUp(false); setFollowUpText(''); setFollowUpImages([]); }} 
                disabled={recheckLoading === item.id}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
  onRecheck,
  recheckLoading,
}) {
  const [lightboxImg, setLightboxImg] = useState(null);

  const forQ = responses
    .filter((r) => r.question_number === questionNumber)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (forQ.length === 0) return null;

  return (
    <div className="q-ai-section">
      {lightboxImg && (
        <div className="ai-lightbox" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Enlarged" onClick={(e) => e.stopPropagation()} />
          <button className="ai-lightbox-close" onClick={() => setLightboxImg(null)}>&times;</button>
        </div>
      )}
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
              <AiResponseBody 
                item={item} 
                questions={questions} 
                onImageClick={setLightboxImg} 
                onRecheck={onRecheck}
                recheckLoading={recheckLoading}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AiResponseCard({ item, questions, expanded, onToggle, onRecheck, recheckLoading }) {
  return (
    <li className="ai-response-item">
      <AiResponseToggle item={item} expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div className="ai-response-body">
          <AiResponseBody 
            item={item} 
            questions={questions} 
            onImageClick={item.onImageClick} 
            onRecheck={onRecheck}
            recheckLoading={recheckLoading}
          />
        </div>
      )}
    </li>
  );
}

export function AiModePanel({ responses, questions, expandedId, onToggle, onRecheck, recheckLoading }) {
  const sorted = [...responses].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const [viewIndex, setViewIndex] = useState(0);
  const [lightboxImg, setLightboxImg] = useState(null);

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

      {lightboxImg && (
        <div className="ai-lightbox" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Enlarged" onClick={(e) => e.stopPropagation()} />
          <button className="ai-lightbox-close" onClick={() => setLightboxImg(null)}>&times;</button>
        </div>
      )}

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
                item={{ ...item, onImageClick: setLightboxImg }}
                questions={questions}
                expanded={expandedId === item.id}
                onToggle={() =>
                  onToggle(
                    expandedId === item.id
                      ? null
                      : item.id
                  )
                }
                onRecheck={onRecheck}
                recheckLoading={recheckLoading}
              />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
