import { useState, useEffect } from 'react';
import { getCode, saveCode, deleteCode, verifyAdmin } from './api';
import './code.css';

export default function CodePage({ onNavBack }) {
  const [name, setName] = useState('');
  const [codeText, setCodeText] = useState('');

  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyStatusId, setCopyStatusId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadSnippets();
    }
  }, [isAuthenticated]);

  const loadSnippets = async () => {
    setLoading(true);
    try {
      const data = await getCode();
      if (Array.isArray(data)) {
        setSnippets(data);
      }
    } catch (err) {
      setError('Failed to load code snippets from backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !codeText.trim()) return;
    setSaving(true);
    setError('');
    try {
      await saveCode({ name, code_text: codeText });
      setName('');
      setCodeText('');
      await loadSnippets();
    } catch (err) {
      setError('Failed to save code snippet: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (snippet) => {
    navigator.clipboard.writeText(snippet.code_text).then(() => {
      setCopyStatusId(snippet.id);
      setTimeout(() => setCopyStatusId(null), 2000);
    }).catch(() => {
      // ignore
    });
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteCode(id);
      await loadSnippets();
    } catch (err) {
      setError('Failed to delete code snippet: ' + err.message);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      await verifyAdmin({ admin_password: adminPassword });
      setIsAuthenticated(true);
    } catch (err) {
      setAuthError('Incorrect password');
    } finally {
      setAuthLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="name-gate">
        <div className="name-gate-card">
          <h1>Admin Access</h1>
          <p>Please enter the admin password</p>
          <form onSubmit={handleAuth}>
            <input
              type="password"
              placeholder="Admin Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoFocus
            />
            {authError && <div className="modal-error" style={{ marginBottom: '1rem' }}>{authError}</div>}
            <button type="submit" disabled={!adminPassword || authLoading}>
              {authLoading ? 'Verifying...' : 'Enter Code Page'}
            </button>
          </form>
          <button type="button" className="btn-ghost" onClick={onNavBack} style={{ marginTop: '1rem', width: '100%' }}>
            &larr; Back to Answer Sheet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="code-app">
      <header className="answer-top answer-top-fixed">
        <h1 className='code-sin' >Code Snippets</h1>
        <button type="button" className="btn-ghost" onClick={onNavBack}>
          &larr; Back to Answer Sheet
        </button>
      </header>

      <div className="code-body">
        {error && <div className="answer-error">{error}</div>}

        <div className="code-form">
          <input
            type="text"
            className="code-input-name"
            placeholder="Snippet Name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="code-editor-container">
            <textarea
              className="code-textarea"
              value={codeText}
              onChange={(e) => setCodeText(e.target.value)}
              placeholder="Paste your code here..."
              spellCheck="false"
            />
          </div>
          <div className="code-actions" style={{ marginTop: '15px' }}>
            <button
              type="button"
              className="btn-save"
              onClick={handleSave}
              disabled={saving || loading || !name.trim() || !codeText.trim()}
            >
              {saving ? 'Saving...' : 'Submit Snippet'}
            </button>
          </div>
        </div>

        <div className="code-list-section">
          <h2 className="code-list-title">Saved Snippets</h2>
          {loading && snippets.length === 0 ? (
            <p>Loading snippets...</p>
          ) : snippets.length === 0 ? (
            <p className="empty">No code snippets saved yet.</p>
          ) : (
            <ul className="code-list">
              {snippets.map((s) => (
                <li key={s.id} className="code-list-item">
                  <div className="code-list-header">
                    <h3>{s.name}</h3>
                    <div className="code-list-actions">
                      <button
                        type="button"
                        className="btn-ai-primary"
                        onClick={() => handleCopy(s)}
                      >
                        {copyStatusId === s.id ? 'Copied!' : 'Copy Code'}
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleDelete(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <pre className="code-display">{s.code_text}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
