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
  callOpenAI,
  saveAiResponse,
  getChatMessages,
  postChatMessage,
  loginUser,
  getPersonalChatSummary,
  getPersonalChatMessages,
  postPersonalChatMessage,
  markPersonalChatRead,
  deleteAllPersonalData,
  checkUser,
  renameUser,
  deleteUser,
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await checkUser(name.trim());
      if (res.exists) {
        setError('This name is already taken. If this is you returning, click "Force Login".');
      } else {
        onSubmit(name.trim());
      }
    } catch (e) {
      setError('Failed to check name: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="name-gate">
      <div className="name-gate-card">
        <h1>Answer Sheet</h1>
        <p>Enter your name to continue</p>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        {error && (
          <div style={{ color: '#e11d48', fontSize: '0.8rem', marginTop: '8px', marginBottom: '8px' }}>
            {error}
            <div style={{ marginTop: '4px' }}>
              <button type="button" className="btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => onSubmit(name.trim())}>Force Login</button>
            </div>
          </div>
        )}
        <button type="button" disabled={!name.trim() || loading} onClick={handleSubmit} style={{ marginTop: error ? 0 : '16px' }}>
          {loading ? 'Checking...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function RenameModal({ open, onClose, onConfirm, loading, error, currentName }) {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (open) setNewName('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>Rename User</h2>
        <p>Change your display name ({currentName}) across all your previous chats and answers.</p>
        {error && <div className="modal-error">{error}</div>}
        <label>
          New Name
          <input
            type="text"
            placeholder="Enter new name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-ai-primary"
            disabled={loading || !newName.trim() || newName.trim() === currentName}
            onClick={() => onConfirm(newName.trim())}
          >
            {loading ? 'Renaming…' : 'Rename'}
          </button>
        </div>
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

function DeleteUserModal({ open, onClose, onConfirm, loading, error, users }) {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [targetUser, setTargetUser] = useState('');

  useEffect(() => {
    if (open) {
      setAdminId('');
      setAdminPassword('');
      setTargetUser('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>Delete User</h2>
        <p>This completely removes a user and all of their data. Cannot be undone.</p>
        {error && <div className="modal-error">{error}</div>}
        <label>
          Select User
          <select
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
            style={{ display: 'block', width: '95%', marginTop: '0.35rem', padding: '10px 12px', border: '1px solid #2a3848', borderRadius: '8px', background: '#0c1014', color: '#e8eaed', fontSize: '0.95rem' }}
          >
            <option value="">-- Select a user --</option>
            {users.map(u => (
              <option key={u.user_name} value={u.user_name}>{u.user_name}</option>
            ))}
          </select>
        </label>
        <label>
          ID
          <input
            type="text"
            placeholder="Admin ID"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
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
            disabled={loading || !adminId || !adminPassword || !targetUser}
            onClick={() => onConfirm(adminId, adminPassword, targetUser)}
          >
            {loading ? 'Deleting…' : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ open, onClose, onConfirm, loading, error, title, description, confirmText }) {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (open) {
      setAdminId('');
      setAdminPassword('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>{title || 'Delete data'}</h2>
        <p>{description}</p>
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
            {loading ? 'Deleting…' : (confirmText || 'Delete')}
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

export default function Answer({ onNavCode }) {
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [comments, setComments] = useState([]);
  const [recent, setRecent] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [optionDrafts, setOptionDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);

  const [leftTab, setLeftTab] = useState('team'); // 'team' or 'personal'
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [personalMessages, setPersonalMessages] = useState([]);
  const [personalDraft, setPersonalDraft] = useState('');
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState('all'); // 'all' or 'personal'
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');

  const [aiOpen, setAiOpen] = useState(false);
  const [aiResponses, setAiResponses] = useState([]);
  const [expandedAiId, setExpandedAiId] = useState(null);
  const [expandedAiIds, setExpandedAiIds] = useState(() => new Set());
  const [showAllQuestions] = useState(false);
  const [recheckLoading, setRecheckLoading] = useState(null);

  const handleRecheckAi = async (item) => {
    if (recheckLoading) return;
    setRecheckLoading(item.id);
    try {
      let imagesArray = [];
      try {
        if (item.images) {
          const parsed = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
          if (Array.isArray(parsed)) imagesArray = parsed;
        }
      } catch (e) { }

      const prompt = `Check again and check deeply and give answer. Original question: ${item.question_prompt}`;

      const rawData = await callOpenAI({
        questionText: prompt,
        sheetOption: item.sheet_option || '',
        sheetExplanation: item.sheet_explanation || '',
        images: imagesArray,
      });

      const raw = rawData.text || '';
      const text = raw.trim();
      const answerMatch =
        text.match(/ANSWER:\s*([\s\S]*?)(?=EXPLANATION:|$)/i) ||
        text.match(/OPTION:\s*([\s\S]*?)(?=EXPLANATION:|$)/i);
      const explainMatch = text.match(/EXPLANATION:\s*([\s\S]*?)$/i);

      const parsed = {
        ai_option: answerMatch ? answerMatch[1].trim() : '',
        ai_explanation: explainMatch ? explainMatch[1].trim() : text,
        raw_response: text,
      };

      const existing = aiResponses;
      const countForQ = existing.filter((r) => r.question_number === item.question_number).length;

      const savedRow = await saveAiResponse({
        question_number: item.question_number,
        response_index: countForQ + 1,
        user_name: userName,
        question_prompt: prompt,
        options_text: null,
        sheet_option: item.sheet_option || '',
        sheet_explanation: item.sheet_explanation || '',
        ai_option: parsed.ai_option,
        ai_explanation: parsed.ai_explanation,
        raw_response: parsed.raw_response,
        images: imagesArray,
      });
      await loadAll();
      setExpandedAiIds((prev) => new Set(prev).add(savedRow.id));
      setExpandedAiId(savedRow.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setRecheckLoading(null);
    }
  };

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
      const [q, a, c, r, u, ai, chatMsgs, contactsSummary] = await Promise.all([
        getQuestions(),
        getAnswers(),
        getComments(),
        getRecentActivity(),
        getUpdateActivity(),
        getAiResponses().catch(() => []),
        getChatMessages().catch(() => []),
        getPersonalChatSummary(userName).catch(() => []),
      ]);
      setQuestions(q);
      setAnswers(a);
      setComments(c);
      setRecent(r);
      setUpdates(u);
      setAiResponses(ai);
      setChatMessages(chatMsgs);
      setContacts(contactsSummary || []);
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

  const handleName = async (name) => {
    localStorage.setItem(NAME_KEY, name);
    setUserName(name);
    try {
      await loginUser({ user_name: name });
    } catch (e) {
      console.error('Failed to register user:', e);
    }
  };

  const handleSendChat = async () => {
    if (!chatDraft.trim()) return;
    try {
      await postChatMessage({
        user_name: userName,
        content: chatDraft.trim(),
        reply_to_id: replyTo ? replyTo.id : null,
      });
      setChatDraft('');
      setReplyTo(null);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!userName || !selectedContact) return;
    const loadMsgs = async () => {
      try {
        const msgs = await getPersonalChatMessages(userName, selectedContact);
        setPersonalMessages(msgs);
        if (msgs.some(m => m.sender_name === selectedContact && m.receiver_name === userName && !m.read_status)) {
          await markPersonalChatRead({ sender_name: selectedContact, receiver_name: userName });
          loadAll(); // update summary
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadMsgs();
    const id = setInterval(loadMsgs, 3000);
    return () => clearInterval(id);
  }, [userName, selectedContact, loadAll]);

  const handleSendPersonalChat = async () => {
    if (!personalDraft.trim() || !selectedContact) return;
    try {
      await postPersonalChatMessage({
        sender_name: userName,
        receiver_name: selectedContact,
        content: personalDraft.trim(),
      });
      setPersonalDraft('');
      const msgs = await getPersonalChatMessages(userName, selectedContact);
      setPersonalMessages(msgs);
    } catch (e) {
      setError(e.message);
    }
  };

  const answerByQ = answers.reduce((acc, row) => {
    if (!acc[row.question_number] || new Date(row.created_at) > new Date(acc[row.question_number].created_at)) {
      acc[row.question_number] = row;
    }
    return acc;
  }, {});

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
      setDeleteOpen(false);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeletePersonal = async (id, password) => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAllPersonalData({ admin_id: id, admin_password: password });
      await loadAll();
      setDeleteOpen(false);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRename = async (newName) => {
    setRenameLoading(true);
    setRenameError('');
    try {
      await renameUser({ old_name: userName, new_name: newName });
      localStorage.setItem(NAME_KEY, newName);
      setUserName(newName);
      setRenameOpen(false);
      await loadAll();
    } catch (e) {
      setRenameError(e.message);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteUser = async (adminId, adminPassword, targetUser) => {
    setDeleteUserLoading(true);
    setDeleteUserError('');
    try {
      await deleteUser({ admin_id: adminId, admin_password: adminPassword, target_user: targetUser });
      setDeleteUserOpen(false);
      await loadAll();
    } catch (e) {
      setDeleteUserError(e.message);
    } finally {
      setDeleteUserLoading(false);
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
        setOptionDrafts((prev) => {
          const next = { ...prev };
          delete next[questionNumber];
          return next;
        });
      }
      if (explanation) {
        await postComment({
          question_number: questionNumber,
          user_name: userName,
          comment_text: explanation,
        });
        setCommentDrafts((prev) => {
          const next = { ...prev };
          delete next[questionNumber];
          return next;
        });
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
  return (
    <div className="answer-app">
      <header className="answer-top answer-top-fixed">
        <h1>Answer Sheet</h1>
        <span className="answer-user">
          Hi, <strong>{userName}</strong>
        </span>
        <button type="button" className="btn-ghost" onClick={onNavCode}>
          Code
        </button>
        <button
          type="button"
          className="btn-ai-primary"
          onClick={() => setRenameOpen(true)}
        >
          Change name
        </button>
        <div className="answer-header-actions">
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setDeleteUserOpen(true)}
          >
            Delete user
          </button>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => { setDeleteTarget('all'); setDeleteOpen(true); }}
          >
            Delete data
          </button>
          <AiChatButton onClick={() => setAiOpen(true)} />
        </div>
      </header>

      <RenameModal
        open={renameOpen}
        onClose={() => !renameLoading && setRenameOpen(false)}
        onConfirm={handleRename}
        loading={renameLoading}
        error={renameError}
        currentName={userName}
      />

      <DeleteUserModal
        open={deleteUserOpen}
        onClose={() => !deleteUserLoading && setDeleteUserOpen(false)}
        onConfirm={handleDeleteUser}
        loading={deleteUserLoading}
        error={deleteUserError}
        users={contacts}
      />

      <DeleteModal
        open={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        onConfirm={deleteTarget === 'all' ? handleDeleteAll : handleDeletePersonal}
        loading={deleteLoading}
        error={deleteError}
        title={deleteTarget === 'all' ? 'Delete all data' : 'Delete personal chats'}
        description={deleteTarget === 'all' ? 'This removes every option, explanation, activity log, and team chat message. Cannot be undone.' : 'This will permanently delete all personal chat messages between all users. Cannot be undone.'}
        confirmText={deleteTarget === 'all' ? 'Delete everything' : 'Delete personal chats'}
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
          <aside className="answer-side chat-side left" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setLeftTab('team')}
                style={{ flex: 1, padding: '8px', background: leftTab === 'team' ? '#1c252e' : 'transparent', border: '1px solid #2a3848', color: leftTab === 'team' ? '#00e5ff' : '#888', cursor: 'pointer', borderRadius: '4px' }}
              >Team Chat</button>
              <div className="tab-btn-container">
                <button
                  type="button"
                  onClick={() => { setLeftTab('personal'); setSelectedContact(null); }}
                  style={{ flex: 1, width: '100%', padding: '8px', background: leftTab === 'personal' ? '#1c252e' : 'transparent', border: '1px solid #2a3848', color: leftTab === 'personal' ? '#00e5ff' : '#888', cursor: 'pointer', borderRadius: '4px' }}
                >Personal Chat</button>
                {contacts.reduce((acc, c) => acc + c.unread_count, 0) > 0 && (
                  <span className="unread-badge-pop">
                    {contacts.reduce((acc, c) => acc + c.unread_count, 0)}
                  </span>
                )}
              </div>
            </div>

            {leftTab === 'team' ? (
              <>
                <div className="chat-input-box" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                  {replyTo && (
                    <div style={{ fontSize: '0.75rem', color: '#00e5ff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Replying to {replyTo.user_name}</span>
                      <button type="button" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setReplyTo(null)}>✕</button>
                    </div>
                  )}
                  <textarea
                    rows={2}
                    placeholder="Type a message..."
                    className='text-area-value'
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                  />
                  <button type="button" className="btn-ai-primary" onClick={handleSendChat} style={{ padding: '6px' }}>Send</button>
                </div>

                <ul className="chat-list" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', listStyle: 'none', padding: 0 }}>
                  {chatMessages.length === 0 && <li className="empty">No messages yet</li>}
                  {chatMessages.map((msg) => {
                    const repliedMsg = msg.reply_to_id ? chatMessages.find(m => m.id === msg.reply_to_id) : null;
                    return (
                      <li key={msg.id} className="chat-msg" style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#1c252e', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ color: '#00e5ff' }}>{msg.user_name}</strong>
                          <span style={{ fontSize: '0.7rem', color: '#888' }}>{formatTime(msg.created_at)}</span>
                        </div>
                        {repliedMsg && (
                          <div style={{ fontSize: '0.75rem', color: '#aaa', borderLeft: '2px solid #555', paddingLeft: '4px', marginBottom: '4px' }}>
                            Replying to <strong>{repliedMsg.user_name}</strong>: {repliedMsg.content.length > 40 ? repliedMsg.content.substring(0, 40) + '...' : repliedMsg.content}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg.content}</p>
                        <div style={{ textAlign: 'right', marginTop: '4px' }}>
                          <button type="button" className="btn-ghost" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => setReplyTo(msg)}>Reply</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <>
                {selectedContact ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '10px' }}>
                      <button type="button" className="btn-ghost" onClick={() => setSelectedContact(null)}>← Back</button>
                      <h3 style={{ margin: 0 }}>Chat with {selectedContact}</h3>
                    </div>
                    <div className="chat-input-box" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                      <textarea
                        rows={2}
                        placeholder="Type a message..."
                        className='text-area-value'
                        value={personalDraft}
                        onChange={(e) => setPersonalDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendPersonalChat();
                          }
                        }}
                      />
                      <button type="button" className="btn-ai-primary" onClick={handleSendPersonalChat} style={{ padding: '6px' }}>Send</button>
                    </div>
                    <ul className="chat-list" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', listStyle: 'none', padding: 0 }}>
                      {personalMessages.length === 0 && <li className="empty">No messages yet</li>}
                      {personalMessages.map((msg) => (
                        <li key={msg.id} className="chat-msg" style={{ marginBottom: '0.75rem', padding: '0.5rem', background: msg.sender_name === userName ? '#2a3848' : '#1c252e', borderRadius: '4px', marginLeft: msg.sender_name === userName ? '20px' : '0', marginRight: msg.sender_name === userName ? '0' : '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong style={{ color: msg.sender_name === userName ? '#a78bfa' : '#00e5ff' }}>{msg.sender_name}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#888' }}>{formatTime(msg.created_at)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg.content}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 10px 0' }}>
                      <button type="button" className="btn-danger-outline" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setDeleteTarget('personal'); setDeleteOpen(true); }}>Delete</button>
                    </div>
                    <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0 }}>
                      {contacts.length === 0 && <li className="empty">No other users online yet</li>}
                      {contacts.map((c) => (
                        <li key={c.user_name} style={{ padding: '10px', borderBottom: '1px solid #2a3848', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => setSelectedContact(c.user_name)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '1.1rem', color: '#e8eaed' }}>{c.user_name}</strong>
                            {c.unread_count > 0 && (
                              <span className="contact-unread-badge">
                                {c.unread_count} new
                              </span>
                            )}
                          </div>
                          {c.last_message && (
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.last_message}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
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
                            value={optionDrafts[q.number] !== undefined ? optionDrafts[q.number] : (saved?.answer_text || '')}
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
                            value={commentDrafts[q.number] !== undefined ? commentDrafts[q.number] : (lastComment?.comment_text || '')}
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
                        onRecheck={handleRecheckAi}
                        recheckLoading={recheckLoading}
                      />
                    </article>
                  );
                })}
            </div>
          </main>

          <aside className="answer-side right" style={{ background: 'transparent', border: 'none' }}>
            <h2 style={{ paddingLeft: '1rem' }}>Answer Sheet</h2>
            <ul className="activity-list" style={{ overflowY: 'auto', padding: '0 1rem' }}>
              {/* {questions.slice(0, 20).map((q) => { */}
              {questions.slice(0, 10).map((q) => {
                const ans = answerByQ[q.number];
                const cmt = latestCommentByQ[q.number];
                return (
                  <li key={q.number} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 0', borderBottom: '1px solid #1c252e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#00e5ff', fontSize: '1.1rem' }}>Q{q.number}</strong>
                      <input
                        type="text"
                        maxLength={3}
                        style={{ width: '45px', padding: '4px', background: '#0c1014', color: '#fff', border: '1px solid #00e5ff', borderRadius: '4px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' }}
                        value={optionDrafts[q.number] !== undefined ? optionDrafts[q.number] : (ans?.answer_text || '')}
                        onChange={(e) => setOptionDrafts(prev => ({ ...prev, [q.number]: e.target.value }))}
                        onBlur={() => handleSave(q.number)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSave(q.number);
                            e.target.blur();
                          }
                        }}
                      />
                    </div>
                    {cmt && (
                      <p style={{ fontSize: '0.85rem', color: '#888', margin: 0 }}>
                        {cmt.comment_text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>

        <div className="bottom-sections" style={{ display: 'flex', gap: '1rem', padding: '1rem', marginTop: '2rem', flexWrap: 'nowrap', justifyContent: 'space-between', overflowX: 'auto', alignItems: 'stretch' }}>
          <aside className="answer-side" style={{ flex: '1 1 0', minWidth: '250px', display: 'flex', flexDirection: 'column' }}>
            <h2>Recent activity</h2>
            <ul className="activity-list" style={{ flex: 1, overflowY: 'auto' }}>
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

          <section className="comment-log answer-side" style={{ flex: '1 1 0', minWidth: '250px', display: 'flex', flexDirection: 'column' }}>
            <h2>Explanation log</h2>
            <ul className="activity-list" style={{ flex: 1, overflowY: 'auto' }}>
              {comments.length === 0 ? (
                <li className="empty-feed">No explanations posted yet</li>
              ) : (
                comments.map((c) => (
                  <li key={c.id} className="log-row activity-item">
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
                  </li>
                ))
              )}
            </ul>
          </section>

          <aside className="answer-side" style={{ flex: '1 1 0', minWidth: '250px', display: 'flex', flexDirection: 'column' }}>
            <h2>Updated activity</h2>
            <ul className="activity-list" style={{ flex: 1, overflowY: 'auto' }}>
              {updates.length === 0 && <li className="empty">No updates yet</li>}
              {updates.map((item) => (
                <UpdateItem key={item.id} item={item} />
              ))}
            </ul>
          </aside>

          <div style={{ flex: '1 1 0', minWidth: '250px', display: 'flex' }}>
            <AiModePanel
              responses={aiResponses}
              questions={questions}
              expandedId={expandedAiId}
              onToggle={setExpandedAiId}
              onRecheck={handleRecheckAi}
              recheckLoading={recheckLoading}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
