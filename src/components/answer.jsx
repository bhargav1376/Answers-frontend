import { useCallback, useEffect, useState } from 'react';
import './answer.css';
import {
  getAnswers,
  getComments,
  getQuestions,
  getRecentActivity,
  getUpdateActivity,
  getAiResponses,
  deleteAllData,
  postComment,
  saveAnswer,
} from './api';
import { AiChatButton, AiChatModal, AiModePanel, QuestionAiResponses } from './ai-chat';

const NAME_KEY = 'answer_sheet_user_name';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function optionMetaLabel(saved) {
  if (!saved) return null;
  const created = new Date(saved.created_at).getTime();
  const updated = new Date(saved.updated_at).getTime();
  const wasUpdated = updated - created > 1500;
  return wasUpdated
    ? `${saved.user_name} updated option`
    : `${saved.user_name} set option`;
}

function formatQuestionLabel(number, text) {
  const cleaned = (text || '')
    .replace(/— fill in the blank/gi, '')
    .replace(/fill in the blank/gi, '')
    .replace(/^Question\s+\d+\s*[-—]?\s*/i, '')
    .trim();
  return cleaned ? `Q${number} — ${cleaned}` : `Q${number} — Option & explanation`;
}

function NameGate({ onSubmit }) {
  const [name, setName] = useState('');
  return (
    <div className="name-gate">
      <div className="name-gate-card">
        <h1>Answer Sheet</h1>
        <p>Enter your name to continue</p>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSubmit(name.trim())}
          autoFocus
        />
        <button type="button" disabled={!name.trim()} onClick={() => onSubmit(name.trim())}>
          Continue
        </button>
      </div>
    </div>
  );
}

function RecentItem({ item, option, comment }) {
  const headline =
    item.activity_type === 'answered'
      ? 'set option on'
      : 'added explanation on';

  return (
    <li className="activity-item recent">
      <p className="activity-headline">
        <strong>{item.user_name}</strong> {headline}{' '}
        <span className="q-num">Q{item.question_number}</span>
      </p>
      <div className="activity-line">
        option — <span className="activity-val">{option || '—'}</span>
      </div>
      <div className="activity-line">
        Comment — <span className="activity-val">"{comment || '—'}"</span>
      </div>
      <time>{formatTime(item.created_at)}</time>
    </li>
  );
}

function DeleteModal({ open, onClose, onConfirm, loading, error }) {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>Delete all data</h2>
        <p>This removes every option, explanation, and activity log. Cannot be undone.</p>
        {error && <div className="modal-error">{error}</div>}
        <label>
          ID
          <input
            type="text"
            placeholder="Admin ID"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-delete-confirm"
            disabled={loading || !adminId || !adminPassword}
            onClick={() => onConfirm(adminId, adminPassword)}
          >
            {loading ? 'Deleting…' : 'Delete everything'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateItem({ item }) {
  return (
    <li className="activity-item update">
      <p className="activity-headline">
        <strong>{item.user_name}</strong> changed option on{' '}
        <span className="q-num">Q{item.question_number}</span>
      </p>
      <div className="update-diff">
        <span className="old-val">{item.old_value || '—'}</span>
        <span className="arrow">→</span>
        <span className="new-val highlight">{item.new_value}</span>
      </div>
      <p className="now-answer">
        now answer is <strong>{item.new_value}</strong>
      </p>
      <time>{formatTime(item.created_at)}</time>
    </li>
  );
}

export default function Answer() {
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [comments, setComments] = useState([]);
  const [recent, setRecent] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [optionDrafts, setOptionDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiResponses, setAiResponses] = useState([]);
  const [expandedAiId, setExpandedAiId] = useState(null);
  const [expandedAiIds, setExpandedAiIds] = useState(() => new Set());
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  const toggleAiExpand = (id) => {
    setExpandedAiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadAll = useCallback(async () => {
    try {
      const [q, a, c, r, u, ai] = await Promise.all([
        getQuestions(),
        getAnswers(),
        getComments(),
        getRecentActivity(),
        getUpdateActivity(),
        getAiResponses().catch(() => []),
      ]);
      setQuestions(q);
      setAnswers(a);
      const opts = {};
      a.forEach((row) => {
        opts[row.question_number] = row.answer_text;
      });
      setOptionDrafts(opts);
      setComments(c);
      setRecent(r);
      setUpdates(u);
      setAiResponses(ai);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load. Is backend running on port 3030?');
    }
  }, []);

  useEffect(() => {
    if (!userName) return;
    loadAll();
    const id = setInterval(loadAll, 3000);
    return () => clearInterval(id);
  }, [userName, loadAll]);

  const handleName = (name) => {
    localStorage.setItem(NAME_KEY, name);
    setUserName(name);
  };

  const latestCommentByQ = comments.reduce((acc, c) => {
    if (!acc[c.question_number] || new Date(c.created_at) > new Date(acc[c.question_number].created_at)) {
      acc[c.question_number] = c;
    }
    return acc;
  }, {});

  const handleDeleteAll = async (adminId, adminPassword) => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAllData({ admin_id: adminId, admin_password: adminPassword });
      setOptionDrafts({});
      setCommentDrafts({});
      setDeleteOpen(false);
      await loadAll();
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSave = async (questionNumber) => {
    const option = (optionDrafts[questionNumber] ?? '').trim();
    const explanation = (commentDrafts[questionNumber] ?? '').trim();
    if (!option && !explanation) return;

    setSaving(questionNumber);
    try {
      if (option) {
        await saveAnswer({
          question_number: questionNumber,
          user_name: userName,
          answer_text: option,
        });
      }
      if (explanation) {
        await postComment({
          question_number: questionNumber,
          user_name: userName,
          comment_text: explanation,
        });
        setCommentDrafts((prev) => ({ ...prev, [questionNumber]: explanation }));
      }
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  if (!userName) {
    return <NameGate onSubmit={handleName} />;
  }

  const answerByQ = Object.fromEntries(answers.map((a) => [a.question_number, a]));

  return (
    <div className="answer-app">
      <header className="answer-top answer-top-fixed">
        <h1>Answer Sheet</h1>
        <span className="answer-user">
          Hi, <strong>{userName}</strong>
        </span>
        <AiChatButton onClick={() => setAiOpen(true)} />
        <button
          type="button"
          className="btn-delete"
          onClick={() => {
            setDeleteError('');
            setDeleteOpen(true);
          }}
        >
          Delete
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            localStorage.removeItem(NAME_KEY);
            setUserName('');
          }}
        >
          Change name
        </button>
      </header>

      <DeleteModal
        open={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        onConfirm={handleDeleteAll}
        loading={deleteLoading}
        error={deleteError}
      />

      <AiChatModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        userName={userName}
        questions={questions}
        answerByQ={answerByQ}
        latestCommentByQ={latestCommentByQ}
        onComplete={(row) => {
          if (row?.id) {
            setExpandedAiId(row.id);
            setExpandedAiIds((prev) => new Set(prev).add(row.id));
          }
          loadAll();
        }}
      />

      <div className="answer-body">
        {error && <div className="answer-error">{error}</div>}

        <div className="answer-layout">
        <aside className="answer-side left">
          <h2>Recent activity</h2>
          <ul className="activity-list">
            {recent.length === 0 && <li className="empty">No activity yet</li>}
            {recent.map((item) => {
              const q = item.question_number;
              const currentOption = answerByQ[q]?.answer_text || '';
              const comment =
                item.activity_type === 'commented'
                  ? item.new_value
                  : latestCommentByQ[q]?.comment_text || '';
              const option =
                item.activity_type === 'commented'
                  ? currentOption
                  : item.new_value || currentOption;
              return (
                <RecentItem
                  key={item.id}
                  item={item}
                  option={option}
                  comment={comment}
                />
              );
            })}
          </ul>
        </aside>

        <main className="answer-main">
          <p className="answer-hint">
            For each question: pick an <strong>option</strong> (left) and write your{' '}
            <strong>explanation</strong> (right), then Save.
          </p>



          <div className="question-list">
          {/* {questions.map((q) => { */}
          {questions
  .slice(0, showAllQuestions ? questions.length : 10)
  .map((q) => {
              const saved = answerByQ[q.number];
              const lastComment = latestCommentByQ[q.number];
              return (
                <article key={q.number} className="q-card">
                  <header className="q-card-head">
                    <span className="q-badge">{q.number}</span>
                    <h3 className="q-title">{formatQuestionLabel(q.number, q.text)}</h3>
                    {saved && <span className="q-meta">{optionMetaLabel(saved)}</span>}
                  </header>

                  <div className="q-inputs">
                    <label className="input-block option-block">
                      <span className="input-label">Option</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        placeholder="1"
                        value={optionDrafts[q.number] ?? ''}
                        onChange={(e) =>
                          setOptionDrafts((prev) => ({
                            ...prev,
                            [q.number]: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="input-block comment-block">
                      <span className="input-label">Explanation</span>
                      <input
                        type="text"
                        placeholder="Why you chose this option..."
                        value={commentDrafts[q.number] ?? ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [q.number]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="q-card-actions">
                    <div className="q-card-foot">
                      <button
                        type="button"
                        className="btn-save"
                        disabled={saving === q.number}
                        onClick={() => handleSave(q.number)}
                      >
                        {saving === q.number ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    {(saved?.answer_text || lastComment) && (
                      <div className="q-saved-below">
                        {saved?.answer_text && (
                          <p className="saved-option">
                            Saved option: <strong>{saved.answer_text}</strong>
                          </p>
                        )}
                        {lastComment && (
                          <p className="saved-comment">
                            Latest explanation: <em>{lastComment.comment_text}</em>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <QuestionAiResponses
                    questionNumber={q.number}
                    responses={aiResponses}
                    questions={questions}
                    expandedIds={expandedAiIds}
                    onToggle={toggleAiExpand}
                  />
                </article>
              );
            })}
          </div>

          <section className="comment-log">
            <h3>Explanation log</h3>
            {comments.length === 0 ? (
              <p className="empty-feed">No explanations posted yet</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="log-row">
                  <p className="activity-headline">
                    <strong>{c.user_name}</strong> added explanation on{' '}
                    <span className="q-num">Q{c.question_number}</span>
                  </p>
                  <div className="activity-line">
                    option —{' '}
                    <span className="activity-val">
                      {answerByQ[c.question_number]?.answer_text || '—'}
                    </span>
                  </div>
                  <div className="activity-line">
                    Comment — <span className="activity-val">"{c.comment_text}"</span>
                  </div>
                  <time>{formatTime(c.created_at)}</time>
                </div>
              ))
            )}
          </section>
        </main>

        <aside className="answer-side right">
          <h2>Updated activity</h2>
          <ul className="activity-list">
            {updates.length === 0 && <li className="empty">No updates yet</li>}
            {updates.map((item) => (
              <UpdateItem key={item.id} item={item} />
            ))}
          </ul>
        </aside>
        <AiModePanel
          responses={aiResponses}
          questions={questions}
          expandedId={expandedAiId}
          onToggle={setExpandedAiId}
        />
        </div>
      </div>
    </div>
  );
}
