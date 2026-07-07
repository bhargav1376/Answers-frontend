import { useCallback, useEffect, useState, useRef } from 'react';
import './answer.css';
import {
  getAiResponses,
  clearAiChat,
  clearPersonalChat,
  deleteAllData,
  callDeepAI,
  saveAiResponse,
  getChatMessages,
  postChatMessage,
  loginUser,
  getPersonalChatSummary,
  getPersonalChatMessages,
  postPersonalChatMessage,
  markPersonalChatRead,
  checkUser,
  renameUser,
  deleteUser,
  pingUser,
} from './api';

const NAME_KEY = 'answer_sheet_user_name';

const PRESET_STICKERS = [
  { id: 'heart', display: '❤️' }, { id: 'laugh', display: '😂' }, { id: 'thumbs_up', display: '👍' },
  { id: 'fire', display: '🔥' }, { id: 'rocket', display: '🚀' }, { id: 'party', display: '🎉' },
  { id: 'clap', display: '👏' }, { id: 'partying_face', display: '🥳' }, { id: 'mind_blown', display: '🤯' },
  { id: 'cool', display: '😎' }, { id: 'alien', display: '👽' }, { id: 'ghost', display: '👻' },
  { id: 'smile', display: '😊' }, { id: 'sad', display: '😢' }, { id: 'angry', display: '😡' },
  { id: 'poop', display: '💩' }, { id: 'skull', display: '💀' }, { id: 'star', display: '⭐' },
  { id: 'crying', display: '😭' }, { id: 'pleading', display: '🥺' }, { id: 'sweat_smile', display: '😅' },
  { id: 'thinking', display: '🤔' }, { id: 'shush', display: '🤫' }, { id: 'clown', display: '🤡' }
];

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Typewriter({ text }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    if (!text) return;

    // Split by spaces but preserve whitespace tokens
    const tokens = text.split(/(\s+)/);
    let i = 0;

    const interval = setInterval(() => {
      setDisplayed((prev) => prev + (tokens[i] || ''));
      i++;
      if (i >= tokens.length) clearInterval(interval);
    }, 50);

    return () => clearInterval(interval);
  }, [text]);

  return <span className="natural-ai-text">{displayed}</span>;
}

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

function cleanAiText(text) {
  if (!text) return '';
  const answerMatch = text.match(/ANSWER:\s*([\s\S]*?)(?=EXPLANATION:|$)/i) || text.match(/OPTION:\s*([\s\S]*?)(?=EXPLANATION:|$)/i);
  if (answerMatch) {
    return answerMatch[1].trim();
  }
  const explainIndex = text.toUpperCase().indexOf('EXPLANATION:');
  if (explainIndex !== -1) {
    return text.substring(0, explainIndex).trim();
  }
  return text;
}

function CustomAudioPlayer({ src }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => setProgress((audio.currentTime / audio.duration) * 100);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => { setPlaying(false); setProgress(0); };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    audioRef.current.currentTime = percent * audioRef.current.duration;
    setProgress(percent * 100);
  };

  const formatSecs = (secs) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="custom-audio-player">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="audio-play-btn" onClick={togglePlay}>
        {playing ? <i className="fa fa-pause"></i> : <i className="fa fa-play"></i>}
      </button>
      <div className="audio-progress-bar" onClick={handleSeek}>
        <div className="audio-progress-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <span className="audio-time">
        {formatSecs(audioRef.current ? audioRef.current.currentTime : 0)} / {formatSecs(duration)}
      </span>
    </div>
  );
}

function SplashScreen({ onComplete }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2700);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className={`splash-container ${isFadingOut ? 'fade-out' : ''}`}>
      <button className="splash-skip-btn" onClick={handleSkip}>
        Skip Intro &rarr;
      </button>

      <div className="splash-glow glow-blue"></div>
      <div className="splash-glow glow-green"></div>
      <div className="splash-glow glow-orange"></div>

      <div className="splash-logo-wrapper">
        <div className="splash-ring"></div>
        <img
          src={process.env.PUBLIC_URL + '/Logo.png'}
          alt="The BA Chat Logo"
          className="splash-logo"
        />
      </div>

      <h1 className="splash-title">
        The <span className="letter-b">B</span> <span className="letter-a">A</span> Chat
      </h1>
      <p className="splash-tagline">Connect. Collaborate. Smile.</p>
    </div>
  );
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
      if (res.exists) setError('This name is already taken. Click "Force Login" if this is you.');
      else onSubmit(name.trim());
    } catch (e) { setError('Failed to check name: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="name-gate glass-bg">
      <div className="name-gate-card glass-panel">
        <h1>Welcome to Chat</h1>
        <p>Enter your name to continue</p>
        <input type="text" placeholder="Your name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} autoFocus />
        {error && <div className="error-text">{error}<div style={{ marginTop: '8px' }}><button type="button" className="btn-glass" onClick={() => onSubmit(name.trim())}>Force Login</button></div></div>}
        <button type="button" className="btn-primary" disabled={!name.trim() || loading} onClick={handleSubmit}>{loading ? 'Checking...' : 'Continue'}</button>
      </div>
    </div>
  );
}

function RenameModal({ open, onClose, onConfirm, loading, error, currentName }) {
  const [newName, setNewName] = useState('');
  useEffect(() => { if (open) setNewName(''); }, [open]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Rename User</h2>
        <p>Change your display name ({currentName}) across all your previous chats.</p>
        {error && <div className="modal-error">{error}</div>}
        <label>New Name<input type="text" placeholder="Enter new name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus /></label>
        <div className="modal-actions">
          <button type="button" className="btn-glass" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="btn-primary" disabled={loading || !newName.trim() || newName.trim() === currentName} onClick={() => onConfirm(newName.trim())}>
            {loading ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({ open, onClose, onConfirm, loading, error, users }) {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [targetUser, setTargetUser] = useState('');

  useEffect(() => {
    if (open) { setAdminId(''); setAdminPassword(''); setTargetUser(''); }
  }, [open]);
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel">
        <h3>Delete User & All Data</h3>
        <p>This will delete the user and all their comments, and messages.</p>
        <label>User to Delete<select value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
          <option value="">-- Select a user --</option>
          {users && users.map(u => <option key={u.user_name} value={u.user_name}>{u.user_name}</option>)}
        </select></label>
        <label>Admin ID<input type="text" value={adminId} onChange={(e) => setAdminId(e.target.value)} /></label>
        <label>Admin Password<input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></label>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-glass" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="btn-danger" disabled={!adminId || !adminPassword || !targetUser || loading} onClick={() => onConfirm(adminId, adminPassword, targetUser)}>
            {loading ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ open, onClose, onConfirm, loading, error, title, description, confirmText }) {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  useEffect(() => { if (open) { setAdminId(''); setAdminPassword(''); } }, [open]);
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{title || 'Delete data'}</h2>
        <p>{description}</p>
        {error && <div className="modal-error">{error}</div>}
        <label>ID<input type="text" value={adminId} onChange={(e) => setAdminId(e.target.value)} autoFocus /></label>
        <label>Password<input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></label>
        <div className="modal-actions">
          <button type="button" className="btn-glass" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="btn-danger" disabled={loading || !adminId || !adminPassword} onClick={() => onConfirm(adminId, adminPassword)}>
            {loading ? 'Deleting…' : (confirmText || 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateGroupModal({ open, onClose, onCreate, contacts }) {
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedContacts, setSelectedContacts] = useState(new Set());

  useEffect(() => {
    if (open) { setGroupName(''); setGroupDesc(''); setSelectedContacts(new Set()); }
  }, [open]);
  if (!open) return null;

  const handleToggle = (name) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!groupName.trim() || selectedContacts.size < 1) return;
    onCreate({ name: groupName.trim(), description: groupDesc.trim(), participants: Array.from(selectedContacts) });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel">
        <h3>Create New Group</h3>
        <p>Start a new group chat with your team. Select at least 1 contact.</p>
        <label>Group Name *<input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus /></label>
        <label>Description<input type="text" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} /></label>
        <div className="privacy-contacts-select" style={{ marginTop: '12px' }}>
          <strong>Select Participants:</strong>
          {(!contacts || contacts.length === 0) ? <p>No contacts available</p> : contacts.map(c => (
            <label key={c.user_name} className="checkbox-label">
              <input type="checkbox" checked={selectedContacts.has(c.user_name)} onChange={() => handleToggle(c.user_name)} />{c.user_name}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-glass" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!groupName.trim() || selectedContacts.size < 1}>Create</button>
        </div>
      </div>
    </div>
  );
}

function PrivacySettingsModal({ open, onClose, contacts, profileVisibility, visibleToContacts, onSave }) {
  const [visibility, setVisibility] = useState(profileVisibility);
  const [selectedContacts, setSelectedContacts] = useState(new Set(visibleToContacts));
  useEffect(() => {
    if (open) { setVisibility(profileVisibility); setSelectedContacts(new Set(visibleToContacts)); }
  }, [open, profileVisibility, visibleToContacts]);
  if (!open) return null;

  const handleToggleContact = (name) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel">
        <h3>Profile Privacy Settings</h3>
        <p>Control who can see your profile photo and online status.</p>
        <div className="privacy-option-group">
          <strong>Who can see my profile?</strong>
          <label className="radio-label"><input type="radio" value="everyone" checked={visibility === 'everyone'} onChange={() => setVisibility('everyone')} /> Everyone</label>
          <label className="radio-label"><input type="radio" value="selected" checked={visibility === 'selected'} onChange={() => setVisibility('selected')} /> Only Selected</label>
          <label className="radio-label"><input type="radio" value="nobody" checked={visibility === 'nobody'} onChange={() => setVisibility('nobody')} /> Nobody</label>
        </div>
        {visibility === 'selected' && (
          <div className="privacy-contacts-select">
            <strong>Allow access for:</strong>
            {contacts.length === 0 ? <p>No contacts online</p> : contacts.map(c => (
              <label key={c.user_name} className="checkbox-label"><input type="checkbox" checked={selectedContacts.has(c.user_name)} onChange={() => handleToggleContact(c.user_name)} /> {c.user_name}</label>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-glass" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => { onSave({ profileVisibility: visibility, visibleToContacts: Array.from(selectedContacts) }); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function Answer({ onNavCode }) {
  const [showSplash, setShowSplash] = useState(true);
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [activeChat, setActiveChat] = useState('ai');
  const [mobilePane, setMobilePane] = useState('list');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [groups, setGroups] = useState([{ id: 'team', name: 'Team Chat', description: 'General collaboration sheet channel', participants: [] }]);
  const [activeGroupId, setActiveGroupId] = useState('team');

  const [profileVisibility, setProfileVisibility] = useState('everyone');
  const [visibleToContacts, setVisibleToContacts] = useState([]);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);

  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [personalMessages, setPersonalMessages] = useState([]);
  const [personalDraft, setPersonalDraft] = useState('');

  const [aiResponses, setAiResponses] = useState([]);
  const [aiDraft, setAiDraft] = useState('');
  const [aiImages, setAiImages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const [showStickers, setShowStickers] = useState(false);
  const [draftImages, setDraftImages] = useState([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioDraft, setAudioDraft] = useState(null);

  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);

  const [toast, setToast] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');
  const [clearAiOpen, setClearAiOpen] = useState(false);
  const [clearAiLoading, setClearAiLoading] = useState(false);
  const [clearAiError, setClearAiError] = useState('');
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const teamChatEndRef = useRef(null);
  const personalChatEndRef = useRef(null);
  const aiChatEndRef = useRef(null);
  const lastMsgCountRef = useRef({ team: 0, personal: 0 });
  const lastTypingPingRef = useRef(0);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTyping = (target) => {
    const now = Date.now();
    if (now - lastTypingPingRef.current > 3000) {
      lastTypingPingRef.current = now;
      pingUser({ user_name: userName, typing_on: target }).catch(() => { });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      pingUser({ user_name: userName, typing_on: null }).catch(() => { });
    }, 3000);
  };

  useEffect(() => {
    if (!isScrolledUp && !isSearching) {
      if (activeChat === 'team') teamChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      else if (activeChat === 'personal') personalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      else if (activeChat === 'ai') aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, personalMessages, aiResponses, activeChat, isScrolledUp, isSearching]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = () => {
    if (activeChat === 'team') teamChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else if (activeChat === 'personal') personalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else if (activeChat === 'ai') aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
  };

  const formatRecordingTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      showToast("Microphone access denied.", 'error');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
      setAudioDraft(null);
      audioChunksRef.current = [];
    }
  };

  const handleInterceptSend = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => { executeDispatchSend(reader.result); };
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
    } else {
      executeDispatchSend(audioDraft);
    }
  };

  const executeDispatchSend = (finalAudioBase64) => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    pingUser({ user_name: userName, typing_on: null }).catch(() => { });

    setAudioDraft(null);
    if (activeChat === 'ai') handleSendAiChat(finalAudioBase64);
    else if (activeChat === 'team') handleSendChat(finalAudioBase64);
    else if (activeChat === 'personal') handleSendPersonalChat(finalAudioBase64);
  };

  const handleClearAiChatConfirm = async (adminId, adminPassword) => {
    setClearAiLoading(true);
    setClearAiError('');
    if (
      (adminId === 'admin' && adminPassword === 'admin') ||
      (adminId === 'bhargav' && adminPassword === 'bhargav12')
    ) {
      try {
        await clearAiChat(userName);
        setAiResponses([]);
        setClearAiOpen(false);
      } catch (e) {
        showToast(e.message);
        setClearAiError(e.message);
      } finally {
        setClearAiLoading(false);
      }
    } else {
      setClearAiError('Invalid admin credentials.');
      setClearAiLoading(false);
    }
  };

  const handleClearPersonalChat = async () => {
    if (!selectedContact) return;
    if (!window.confirm(`Clear chat with ${selectedContact}?`)) return;
    try {
      await clearPersonalChat(userName, selectedContact);
      setPersonalMessages([]);
    } catch (e) { showToast(e.message); }
  };

  const handleSendAiChat = async (audioToSend = null) => {
    if (!aiDraft.trim() && aiImages.length === 0 && !audioToSend) return;

    const tempId = Date.now();
    const promptText = audioToSend ? (aiDraft.trim() || '[Voice Message]') : aiDraft.trim();
    const finalStoredPrompt = audioToSend || promptText;

    const newAiMessage = {
      id: tempId, question_number: 1, response_index: aiResponses.length + 1,
      user_name: userName, question_prompt: finalStoredPrompt, raw_response: '...',
      images: aiImages, created_at: new Date().toISOString()
    };

    setAiResponses(prev => [...prev, newAiMessage]);
    setAiLoading(true);

    const submittedDraft = promptText;
    const submittedImages = [...aiImages];
    setAiDraft('');
    setAiImages([]);

    try {
      const rawData = await callDeepAI({ questionText: submittedDraft, sheetOption: '', sheetExplanation: '', images: submittedImages, user_name: userName });
      const savedRow = await saveAiResponse({
        question_number: 1, response_index: aiResponses.length + 1, user_name: userName,
        question_prompt: finalStoredPrompt, options_text: null, sheet_option: '', sheet_explanation: '',
        ai_option: null, ai_explanation: null, raw_response: rawData.text || '', images: submittedImages,
      });
      // Update local state and flag as new so Typewriter fires
      setAiResponses(prev => prev.map(m => m.id === tempId ? { ...savedRow, isNew: true } : m));
    } catch (e) {
      showToast('AI Search Failed: ' + e.message, 'error');
      setAiResponses(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setAiLoading(false);
    }
  };

  const handleUniversalImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (activeChat === 'ai') setAiImages(prev => (prev.length >= 4 ? prev : [...prev, ev.target.result]));
        else setDraftImages(prev => (prev.length >= 4 ? prev : [...prev, ev.target.result]));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendSticker = async (stickerId) => {
    const stickerString = `[STICKER:${stickerId}]`;
    setShowStickers(false);

    if (activeChat === 'ai') {
      setAiLoading(true);
      try {
        const tempId = Date.now();
        const rawData = await callDeepAI({ questionText: `Sent a sticker emoji ${stickerId}`, sheetOption: '', sheetExplanation: '', images: [], user_name: userName });
        const savedRow = await saveAiResponse({
          question_number: 1, response_index: aiResponses.length + 1, user_name: userName,
          question_prompt: stickerString, options_text: null, sheet_option: '', sheet_explanation: '',
          ai_option: null, ai_explanation: null, raw_response: rawData.text || '', images: [],
        });
        setAiResponses(prev => [...prev, { ...savedRow, isNew: true }]);
      } catch (e) { showToast(e.message); }
      finally { setAiLoading(false); }
    } else if (activeChat === 'team') {
      const tempId = Date.now();
      setChatMessages(prev => [...prev, { id: tempId, user_name: userName, content: stickerString, created_at: new Date().toISOString() }]);
      setTimeout(async () => {
        try {
          await postChatMessage({ user_name: userName, content: stickerString, reply_to_id: replyTo ? replyTo.id : null });
          setReplyTo(null);
          loadAll();
        } catch (e) { showToast(e.message); }
      }, 0);
    } else if (activeChat === 'personal' && selectedContact) {
      const tempId = Date.now();
      setPersonalMessages(prev => [...prev, { id: tempId, sender_name: userName, receiver_name: selectedContact, content: stickerString, created_at: new Date().toISOString() }]);
      setTimeout(async () => {
        try {
          await postPersonalChatMessage({ sender_name: userName, receiver_name: selectedContact, content: stickerString });
          const msgs = await getPersonalChatMessages(userName, selectedContact);
          setPersonalMessages(msgs);
        } catch (e) { showToast(e.message); }
      }, 0);
    }
  };

  const loadAll = useCallback(async (overrideName) => {
    const activeName = typeof overrideName === 'string' ? overrideName : userName;
    if (!activeName) return;
    try {
      const [ai, chatMsgs, contactsSummary] = await Promise.all([
        getAiResponses(activeName).catch(() => []),
        getChatMessages().catch(() => []),
        getPersonalChatSummary(activeName).catch((e) => {
          if (e.message === 'User deleted') { localStorage.removeItem(NAME_KEY); setUserName(''); }
          return [];
        }),
      ]);

      // Preserve isNew flag for AI responses if they already exist in state,
      // and retain any temporary loading messages (with raw_response: '...')
      setAiResponses(prev => {
        const loadingMessages = prev.filter(p => p.raw_response === '...');
        const updated = ai.map(newMsg => {
          const existing = prev.find(p => p.id === newMsg.id);
          if (existing && existing.isNew) return { ...newMsg, isNew: true };
          return newMsg;
        });
        return [...updated, ...loadingMessages];
      });

      const prevTeamCount = lastMsgCountRef.current.team;
      if (prevTeamCount > 0 && chatMsgs.length > prevTeamCount) {
        const newMsgs = chatMsgs.slice(prevTeamCount);
        newMsgs.forEach(m => {
          if (m.user_name !== activeName && "Notification" in window && Notification.permission === "granted") {
            new Notification(`New message from ${m.user_name}`, { body: m.content.startsWith('data:') ? (m.content.startsWith('data:audio') ? '🎤 Voice Message' : '📸 Image') : m.content });
          }
        });
      }
      lastMsgCountRef.current.team = chatMsgs.length;
      setChatMessages(chatMsgs);
      setContacts(contactsSummary || []);
    } catch (e) {
      showToast(e.message || 'Failed to load.');
    }
  }, [userName]);

  useEffect(() => {
    if (!userName) return;
    loadAll();
    const id = setInterval(loadAll, 3000);
    const pingId = setInterval(() => { pingUser({ user_name: userName }).catch(() => { }); }, 10000);
    return () => { clearInterval(id); clearInterval(pingId); };
  }, [userName, loadAll]);

  const handleName = async (name) => {
    localStorage.setItem(NAME_KEY, name);
    setUserName(name);
    try { await loginUser({ user_name: name }); await loadAll(name); } catch (e) { }
  };

  const handleSendChat = (audioToSend = null) => {
    if (!chatDraft.trim() && draftImages.length === 0 && !audioToSend) return;

    const imgs = [...draftImages];
    const text = chatDraft.trim();
    const tempIdBase = Date.now();

    const newMsgs = [];
    if (audioToSend) newMsgs.push({ id: tempIdBase - 1, user_name: userName, content: audioToSend, created_at: new Date().toISOString(), reply_to_id: replyTo ? replyTo.id : null });
    imgs.forEach((img, idx) => newMsgs.push({ id: tempIdBase + idx, user_name: userName, content: img, created_at: new Date().toISOString(), reply_to_id: replyTo ? replyTo.id : null }));
    if (text) newMsgs.push({ id: tempIdBase + 100, user_name: userName, content: text, created_at: new Date().toISOString(), reply_to_id: replyTo ? replyTo.id : null });

    setChatMessages(prev => [...prev, ...newMsgs]);
    setChatDraft('');
    setDraftImages([]);

    setTimeout(async () => {
      try {
        if (audioToSend) await postChatMessage({ user_name: userName, content: audioToSend, reply_to_id: replyTo ? replyTo.id : null });
        for (const img of imgs) await postChatMessage({ user_name: userName, content: img, reply_to_id: replyTo ? replyTo.id : null });
        if (text) await postChatMessage({ user_name: userName, content: text, reply_to_id: replyTo ? replyTo.id : null });
        setReplyTo(null);
        loadAll();
      } catch (e) { showToast(e.message); }
    }, 0);
  };

  useEffect(() => {
    if (!userName || !selectedContact) return;
    const loadMsgs = async () => {
      try {
        const msgs = await getPersonalChatMessages(userName, selectedContact);
        const prevPersCount = lastMsgCountRef.current.personal;
        if (prevPersCount > 0 && msgs.length > prevPersCount) {
          const newMsgs = msgs.slice(prevPersCount);
          newMsgs.forEach(m => {
            if (m.sender_name !== userName && "Notification" in window && Notification.permission === "granted") {
              new Notification(`Direct message from ${m.sender_name}`, { body: m.content.startsWith('data:') ? (m.content.startsWith('data:audio') ? '🎤 Voice Message' : '📸 Image') : m.content });
            }
          });
        }
        lastMsgCountRef.current.personal = msgs.length;
        setPersonalMessages(msgs);
        if (msgs.some(m => m.sender_name === selectedContact && m.receiver_name === userName && !m.read_status)) {
          await markPersonalChatRead({ sender_name: selectedContact, receiver_name: userName });
          loadAll();
        }
      } catch (e) { }
    };
    loadMsgs();
    const id = setInterval(loadMsgs, 3000);
    return () => clearInterval(id);
  }, [userName, selectedContact, loadAll]);

  const handleSendPersonalChat = (audioToSend = null) => {
    if ((!personalDraft.trim() && draftImages.length === 0 && !audioToSend) || !selectedContact) return;

    const imgs = [...draftImages];
    const text = personalDraft.trim();
    const tempIdBase = Date.now();

    const newMsgs = [];
    if (audioToSend) newMsgs.push({ id: tempIdBase - 1, sender_name: userName, receiver_name: selectedContact, content: audioToSend, created_at: new Date().toISOString() });
    imgs.forEach((img, idx) => newMsgs.push({ id: tempIdBase + idx, sender_name: userName, receiver_name: selectedContact, content: img, created_at: new Date().toISOString() }));
    if (text) newMsgs.push({ id: tempIdBase + 100, sender_name: userName, receiver_name: selectedContact, content: text, created_at: new Date().toISOString() });

    setPersonalMessages(prev => [...prev, ...newMsgs]);
    setPersonalDraft('');
    setDraftImages([]);

    setTimeout(async () => {
      try {
        if (audioToSend) await postPersonalChatMessage({ sender_name: userName, receiver_name: selectedContact, content: audioToSend });
        for (const img of imgs) await postPersonalChatMessage({ sender_name: userName, receiver_name: selectedContact, content: img });
        if (text) await postPersonalChatMessage({ sender_name: userName, receiver_name: selectedContact, content: text });
        const msgs = await getPersonalChatMessages(userName, selectedContact);
        setPersonalMessages(msgs);
      } catch (e) { showToast(e.message); }
    }, 0);
  };

  const handleDeleteAll = async (adminId, adminPassword) => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAllData({ admin_id: adminId, admin_password: adminPassword });
      setDeleteOpen(false);
      await loadAll();
    } catch (e) { showToast(e.message); setDeleteError(e.message); }
    finally { setDeleteLoading(false); }
  };

  const handleRename = async (newName) => {
    setRenameLoading(true);
    try {
      await renameUser({ old_name: userName, new_name: newName });
      localStorage.setItem(NAME_KEY, newName);
      setUserName(newName);
      setRenameOpen(false);
      await loadAll(newName);
    } catch (e) { showToast(e.message); }
    finally { setRenameLoading(false); }
  };

  const handleDeleteUser = async (adminId, adminPassword, targetUser) => {
    setDeleteUserLoading(true);
    try {
      await deleteUser({ admin_id: adminId, admin_password: adminPassword, target_user: targetUser });
      setDeleteUserOpen(false);
      await loadAll();
      if (targetUser === userName) { localStorage.removeItem(NAME_KEY); setUserName(''); }
    } catch (e) { showToast(e.message); }
    finally { setDeleteUserLoading(false); }
  };

  const handleCreateGroup = (groupData) => {
    const newGroup = { id: `group_${Date.now()}`, name: groupData.name, description: groupData.description || 'Custom group channel', participants: groupData.participants };
    setGroups(prev => [...prev, newGroup]);
    setActiveChat('team');
    setActiveGroupId(newGroup.id);
    setMobilePane('chat');
  };

  const handleSavePrivacy = (privacyData) => {
    setProfileVisibility(privacyData.profileVisibility);
    setVisibleToContacts(privacyData.visibleToContacts);
  };

  const scrollToMatch = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
    }
  };

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();
    let foundIds = [];

    if (activeChat === 'ai') foundIds = [...aiResponses].filter(m => (m.question_prompt || '').toLowerCase().includes(query) || (m.raw_response || '').toLowerCase().includes(query)).map(m => `msg-ai-${m.id}`);
    else if (activeChat === 'team') foundIds = [...chatMessages].filter(m => m.content.toLowerCase().includes(query)).map(m => `msg-team-${m.id}`);
    else if (activeChat === 'personal') foundIds = [...personalMessages].filter(m => m.content.toLowerCase().includes(query)).map(m => `msg-personal-${m.id}`);

    if (foundIds.length > 0) {
      setSearchResults(foundIds);
      setSearchIndex(foundIds.length - 1);
      scrollToMatch(foundIds[foundIds.length - 1]);
    } else {
      showToast("Message not found.");
      setSearchResults([]);
    }
  };

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    let nextIdx = searchIndex + 1;
    if (nextIdx >= searchResults.length) nextIdx = 0;
    setSearchIndex(nextIdx);
    scrollToMatch(searchResults[nextIdx]);
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    let prevIdx = searchIndex - 1;
    if (prevIdx < 0) prevIdx = searchResults.length - 1;
    setSearchIndex(prevIdx);
    scrollToMatch(searchResults[prevIdx]);
  };

  const renderMessageContent = (contentStr, isAudio = false) => {
    if (isAudio || contentStr.startsWith('data:audio/')) {
      return <CustomAudioPlayer src={contentStr} />;
    }
    if (contentStr.startsWith('data:image/')) {
      return <img className="msg-image" src={contentStr} alt="Attachment" onClick={() => setLightboxImg(contentStr)} />;
    }
    const isSticker = contentStr.startsWith('[STICKER:');
    const stickerId = isSticker ? contentStr.match(/^\[STICKER:(.+)\]$/)?.[1] : null;
    const stickerObj = PRESET_STICKERS.find(s => s.id === stickerId);
    if (isSticker && stickerObj) return <div className="sticker-img">{stickerObj.display}</div>;
    return <p>{contentStr}</p>;
  };

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  if (!userName) return <NameGate onSubmit={handleName} />;
  const isProfileVisibleTo = (contactName) => {
    if (profileVisibility === 'everyone') return true;
    if (profileVisibility === 'nobody') return false;
    if (profileVisibility === 'selected') return visibleToContacts.includes(contactName);
    return true;
  };

  const sortedAiResponses = [...aiResponses].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const sortedTeamMessages = [...chatMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const sortedPersonalMessages = [...personalMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const currentActiveGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  return (
    <div className="answer-app">
      {toast && (
        <div className="toast-container">
          <div className={`toast-notification ${toast.type}`}>
            <i className={toast.type === 'success' ? 'fa fa-check-circle' : 'fa fa-exclamation-circle'}></i>
            {toast.message}
          </div>
        </div>
      )}

      {lightboxImg && (
        <div className="ai-lightbox" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Enlarged" onClick={(e) => e.stopPropagation()} />
          <button className="ai-lightbox-close" onClick={() => setLightboxImg(null)}>&times;</button>
        </div>
      )}

      {/* Global Header */}
      <header className="app-global-header glass-panel">
        <div className="header-brand">
          <img src={process.env.PUBLIC_URL + '/Logo.png'} alt="Logo" className="brand-logo" />
          <h1>
            The <span style={{ letterSpacing: '-4px' }}>B</span> <span style={{ fontSize: '25px', letterSpacing: '-2px' }}>A</span> Chat
          </h1>
        </div>

        <button className="mobile-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <i className={mobileMenuOpen ? "fa fa-times" : "fa fa-bars"}></i>
        </button>

        <div className={`header-controls ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <span className="current-user-badge" style={{ marginBottom: mobileMenuOpen ? '8px' : '0' }}>👤 {userName}</span>
          <button type="button" className="btn-glass" onClick={() => { setMobileMenuOpen(false); onNavCode(); }}>Code Data</button>
          <button type="button" className="btn-glass" onClick={() => { setMobileMenuOpen(false); setRenameOpen(true); }}>Rename</button>
          <button type="button" className="btn-glass btn-danger" onClick={() => { setMobileMenuOpen(false); setClearAiOpen(true); }}>Clear AI Chat</button>
          <button type="button" className="btn-glass btn-danger" onClick={() => { setMobileMenuOpen(false); setDeleteUserOpen(true); }}>Delete User & All Data</button>
          <button type="button" className="btn-glass btn-danger" onClick={() => { setMobileMenuOpen(false); setDeleteOpen(true); }}>Clear Data</button>
        </div>
      </header>

      <div className="chat-app-container">
        <div className={`chat-layout show-${mobilePane}`}>

          <aside className="chat-sidebar glass-panel">
            <div className="sidebar-profile-card">
              <div className="profile-avatar-large" onClick={() => setPrivacyModalOpen(true)} title="Privacy Settings">
                {userName.charAt(0).toUpperCase()}
                <span className="privacy-badge">&#128274;</span>
              </div>
              <div className="profile-info">
                <h3>{userName}</h3>
                <span>{profileVisibility === 'everyone' ? 'Public' : profileVisibility === 'nobody' ? 'Private' : 'Limited'} Profile</span>
              </div>
              <div className="sidebar-top-actions">
                <button type="button" className="btn-icon" title="Create Group" onClick={() => setCreateGroupModalOpen(true)}>&#10133;</button>
              </div>
            </div>

            <div className="sidebar-scrollable custom-scrollbar">
              <h2 className="section-title">Conversations</h2>
              <ul className="thread-list">
                <li className={`thread-item ${activeChat === 'ai' ? 'active' : ''}`} onClick={() => { setActiveChat('ai'); setMobilePane('chat'); setIsSearching(false); setSearchResults([]); }}>
                  <div className="thread-avatar ai">AI</div>
                  <div className="thread-text">
                    <div className="thread-head"><strong>AI Assistant</strong><span className="badge">Meta AI</span></div>
                    <p>Ask questions with images</p>
                  </div>
                </li>
                {groups.map(group => {
                  const isSelected = activeChat === 'team' && activeGroupId === group.id;
                  return (
                    <li key={group.id} className={`thread-item ${isSelected ? 'active' : ''}`} onClick={() => { setActiveChat('team'); setActiveGroupId(group.id); setMobilePane('chat'); setIsSearching(false); setSearchResults([]); }}>
                      <div className="thread-avatar team">G</div>
                      <div className="thread-text">
                        <div className="thread-head"><strong>{group.name}</strong></div>
                        <p>{group.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <h2 className="section-title" style={{ marginTop: '1rem' }}>Direct Messages</h2>
              <ul className="thread-list contacts-list">
                {contacts.length === 0 && <li className="empty-state">No contacts online</li>}
                {contacts.map(c => {
                  const isOnline = (new Date() - new Date(c.last_seen) < 30000);
                  const isSelected = activeChat === 'personal' && selectedContact === c.user_name;
                  const allowedToSee = isProfileVisibleTo(c.user_name);
                  const isTypingToUs = isOnline && c.typing_on === userName && (new Date() - new Date(c.typing_at) < 5000);

                  return (
                    <li key={c.user_name} className={`thread-item ${isSelected ? 'active' : ''}`} onClick={() => { setActiveChat('personal'); setSelectedContact(c.user_name); setMobilePane('chat'); setIsSearching(false); setSearchResults([]); }}>
                      <div className="thread-avatar user">
                        {allowedToSee ? c.user_name.charAt(0).toUpperCase() : '?'}
                        {allowedToSee && <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></span>}
                      </div>
                      <div className="thread-text">
                        <div className="thread-head">
                          <strong>{c.user_name}</strong>
                          {c.unread_count > 0 && <span className="unread-count">{c.unread_count}</span>}
                        </div>
                        <p style={{ color: isTypingToUs ? '#10b981' : 'var(--text-muted)' }}>
                          {isTypingToUs ? (
                            <em>typing...</em>
                          ) : c.last_message ? (
                            c.last_message.startsWith('data:image/') ? '[Image]' : c.last_message.startsWith('data:audio/') ? '[Voice Message]' : c.last_message.startsWith('[STICKER:') ? '[Sticker]' : c.last_message
                          ) : (
                            isOnline ? 'Online' : 'Offline'
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          <main className="chat-main glass-panel">
            <div className="chat-header">
              <button className="mobile-back-btn" onClick={() => setMobilePane('list')}>&larr; Back</button>

              {activeChat === 'ai' && (
                <div className="chat-header-details">
                  <div className="thread-avatar ai">AI</div>
                  <div><h3>AI Assistant (Meta AI)</h3><span>{aiLoading ? 'Meta AI is typing...' : 'DeepAI (standard) active'}</span></div>
                </div>
              )}
              {activeChat === 'team' && (() => {
                const teamTypingUsers = contacts.filter(c => c.typing_on === 'team' && (new Date() - new Date(c.typing_at) < 5000) && (new Date() - new Date(c.last_seen) < 30000));
                const teamTypingText = teamTypingUsers.length > 0
                  ? `${teamTypingUsers.map(u => u.user_name).join(', ')} ${teamTypingUsers.length === 1 ? 'is' : 'are'} typing...`
                  : currentActiveGroup.description;
                return (
                  <div className="chat-header-details">
                    <div className="thread-avatar team">G</div>
                    <div><h3>{currentActiveGroup.name}</h3><span style={{ color: teamTypingUsers.length > 0 ? '#10b981' : 'inherit' }}>{teamTypingText}</span></div>
                  </div>
                );
              })()}
              {activeChat === 'personal' && (
                <div className="chat-header-details">
                  {selectedContact ? (() => {
                    const contactData = contacts.find(c => c.user_name === selectedContact);
                    const isOnline = contactData && (new Date() - new Date(contactData.last_seen) < 30000);
                    const isTyping = isOnline && contactData.typing_on === userName && (new Date() - new Date(contactData.typing_at) < 5000);
                    const statusText = isTyping ? 'typing...' : (isOnline ? 'Online' : 'Offline');
                    return (
                      <>
                        <div className="thread-avatar user">
                          {isProfileVisibleTo(selectedContact) ? selectedContact.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <h3>{selectedContact}</h3>
                          <span style={{ color: isTyping ? '#10b981' : 'inherit' }}>{statusText}</span>
                        </div>
                      </>
                    );
                  })() : (
                    <div><h3>Direct Chat</h3><span>Select a contact</span></div>
                  )}
                </div>
              )}

              <div style={{ flex: 1 }}></div>

              {!isSearching ? (
                <div className="chat-header-options">
                  {activeChat === 'ai' && (
                    <>
                      {userName.toLowerCase() === 'bhargav' && (
                        <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => setDeleteOpen(true)} title="Erase All Data (Admin)"><i className="fa fa-bomb"></i></button>
                      )}
                    </>
                  )}
                  {activeChat === 'personal' && selectedContact && (
                    <button className="btn-icon" onClick={handleClearPersonalChat} title="Clear Personal Chat"><i className="fa fa-trash"></i></button>
                  )}
                  <button className="btn-icon" onClick={() => setShowSearchMenu(!showSearchMenu)}>&#8942;</button>
                  {showSearchMenu && (
                    <div className="search-popover glass-panel">
                      <button className="dropdown-item" onClick={() => { setIsSearching(true); setShowSearchMenu(false); }}>Search Messages</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="chat-header-search" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="text" placeholder="Search in chat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()} autoFocus className="search-input glass-input" />
                  {searchResults.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{searchIndex + 1}/{searchResults.length}</span>}
                  <button className="btn-icon" onClick={handleSearchPrev} title="Previous Match" disabled={searchResults.length === 0}>&lt;</button>
                  <button className="btn-icon" onClick={handleSearchNext} title="Next Match" disabled={searchResults.length === 0}>&gt;</button>
                  <button className="btn-glass btn-small" onClick={() => { setIsSearching(false); setSearchQuery(''); setSearchResults([]); }}>Cancel</button>
                </div>
              )}
            </div>

            <div className="chat-history custom-scrollbar" onScroll={handleScroll}>
              {activeChat === 'ai' && (
                <div className="message-feed">
                  {sortedAiResponses.length === 0 && <div className="chat-placeholder"><h2>Chat with Meta AI</h2><p>Ask anything, attach images with `+`, or send stickers!</p></div>}
                  {sortedAiResponses.map(item => {
                    let imgs = [];
                    try { if (item.images) imgs = typeof item.images === 'string' ? JSON.parse(item.images) : item.images; } catch (e) { }
                    const isAudio = item.question_prompt?.startsWith('data:audio/');
                    return (
                      <div key={item.id} className="chat-block" id={`msg-ai-${item.id}`}>
                        <div className="msg right">
                          {(() => {
                            const rendered = renderMessageContent(item.question_prompt || '', isAudio);
                            const isBubbleFree = rendered.type === 'div' && rendered.props.className === 'sticker-img';
                            return isBubbleFree ? rendered : (
                              <div className="bubble my-bubble">
                                {rendered}
                                {imgs.length > 0 && (
                                  <div className="bubble-gallery">
                                    {imgs.map((img, i) => (
                                      <img key={i} src={img} alt="upload" onClick={() => setLightboxImg(img)} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="msg left">
                          <div className="bubble ai-bubble natural-chat">
                            <span className="sender-name">Meta AI</span>
                            {item.raw_response === '...' ? (
                              <TypingIndicator />
                            ) : item.isNew ? (
                              <Typewriter text={cleanAiText(item.raw_response || item.ai_explanation || '—')} />
                            ) : (
                              <p className="natural-ai-text">{cleanAiText(item.raw_response || item.ai_explanation || '—')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={aiChatEndRef} />
                </div>
              )}

              {activeChat === 'team' && (
                <div className="message-feed">
                  {sortedTeamMessages.length === 0 && <p className="chat-placeholder">No messages in group yet</p>}
                  {sortedTeamMessages.map(msg => {
                    const repliedMsg = msg.reply_to_id ? chatMessages.find(m => m.id === msg.reply_to_id) : null;
                    const isMe = msg.user_name === userName;
                    const rendered = renderMessageContent(msg.content);
                    const isBubbleFree = rendered.type === 'div' && rendered.props.className === 'sticker-img';

                    return (
                      <div key={msg.id} id={`msg-team-${msg.id}`} className={`msg ${isMe ? 'right' : 'left'}`}>
                        {isBubbleFree ? rendered : (
                          <div className={`bubble ${isMe ? 'my-bubble' : 'other-bubble'}`}>
                            <div className="msg-info"><strong>{msg.user_name}</strong><span>{formatTime(msg.created_at)}</span></div>
                            {repliedMsg && <div className="reply-quote"><strong>{repliedMsg.user_name}</strong>: {repliedMsg.content.startsWith('data:image/') ? '[Image]' : repliedMsg.content.startsWith('data:audio/') ? '[Voice Message]' : repliedMsg.content}</div>}
                            {rendered}
                            <div className="bubble-actions"><button onClick={() => setReplyTo(msg)}>Reply</button></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={teamChatEndRef} />
                </div>
              )}

              {activeChat === 'personal' && (
                <div className="message-feed">
                  {!selectedContact ? <p className="chat-placeholder">Select a contact to begin messaging.</p> : sortedPersonalMessages.length === 0 ? <p className="chat-placeholder">No messages with {selectedContact} yet</p> : (
                    sortedPersonalMessages.map(msg => {
                      const isMe = msg.sender_name === userName;
                      const rendered = renderMessageContent(msg.content);
                      const isBubbleFree = rendered.type === 'div' && rendered.props.className === 'sticker-img';

                      return (
                        <div key={msg.id} id={`msg-personal-${msg.id}`} className={`msg ${isMe ? 'right' : 'left'}`}>
                          {isBubbleFree ? rendered : (
                            <div className={`bubble ${isMe ? 'my-bubble' : 'other-bubble'}`}>
                              <div className="msg-info"><strong>{msg.sender_name}</strong><span>{formatTime(msg.created_at)}</span></div>
                              {rendered}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={personalChatEndRef} />
                </div>
              )}
            </div>

            {isScrolledUp && <button className="btn-scroll-bottom" onClick={scrollToBottom}>⬇</button>}

            <div className="chat-input-area glass-panel-inner">

              {((activeChat === 'ai' && aiImages.length > 0) || (activeChat !== 'ai' && draftImages.length > 0)) && (
                <div className="draft-images-tray">
                  {(activeChat === 'ai' ? aiImages : draftImages).map((img, idx) => (
                    <div key={idx} className="draft-thumb-wrap">
                      <img src={img} alt="preview" className="draft-thumb" />
                      <button className="remove-thumb-btn" onClick={() => activeChat === 'ai' ? setAiImages(prev => prev.filter((_, i) => i !== idx)) : setDraftImages(prev => prev.filter((_, i) => i !== idx))}>&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {showStickers && (
                <div className="sticker-popover glass-panel">
                  <div className="sticker-popover-head">
                    <strong>Send Sticker</strong>
                    <button className="btn-icon" onClick={() => setShowStickers(false)}>&times;</button>
                  </div>
                  <div className="sticker-grid">
                    {PRESET_STICKERS.map(st => <button key={st.id} className="sticker-btn" onClick={() => handleSendSticker(st.id)}>{st.display}</button>)}
                  </div>
                </div>
              )}

              <div className="input-toolbar">
                <label className="btn-icon-large" title="Attach file">
                  &#10133;
                  <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleUniversalImageUpload} />
                </label>

                <button className="btn-icon-large" title="Stickers" onClick={() => setShowStickers(!showStickers)}>&#128512;</button>

                {isRecording ? (
                  <div className="recording-bar">
                    <div className={`record-dot ${isPaused ? 'paused' : ''}`}></div>
                    <span className="record-time">{formatRecordingTime(recordingTime)}</span>
                    <button className="btn-glass btn-small" onClick={pauseRecording}>{isPaused ? '▶ Resume' : '⏸ Pause'}</button>
                    <button className="btn-danger btn-small" onClick={cancelRecording}>🗑 Delete</button>
                  </div>
                ) : (
                  <textarea
                    className="chat-textarea custom-scrollbar"
                    placeholder="Type a message..."
                    value={activeChat === 'ai' ? aiDraft : activeChat === 'team' ? chatDraft : personalDraft}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (activeChat === 'ai') {
                        setAiDraft(val);
                        handleTyping('ai');
                      } else if (activeChat === 'team') {
                        setChatDraft(val);
                        handleTyping('team');
                      } else if (activeChat === 'personal') {
                        setPersonalDraft(val);
                        if (selectedContact) handleTyping(selectedContact);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleInterceptSend();
                      }
                    }}
                    disabled={activeChat === 'personal' && !selectedContact}
                  />
                )}

                {!isRecording && (
                  <button className="btn-icon-large" title="Voice Message" onClick={startRecording} disabled={activeChat === 'personal' && !selectedContact}>
                    <i className="fa fa-microphone"></i>
                  </button>
                )}

                <button
                  className="btn-send-message"
                  onClick={handleInterceptSend}
                  disabled={
                    !isRecording && (
                      (activeChat === 'ai' && (aiLoading || (!aiDraft.trim() && aiImages.length === 0))) ||
                      (activeChat === 'team' && (!chatDraft.trim() && draftImages.length === 0)) ||
                      (activeChat === 'personal' && ((!personalDraft.trim() && draftImages.length === 0) || !selectedContact))
                    )
                  }
                >
                  &#10148;
                </button>
              </div>

              {activeChat === 'ai' && (
                <div className="ai-disclaimer">
                  AI can make mistakes. Check important info.
                </div>
              )}

            </div>
          </main>
        </div>
      </div>

      {deferredPrompt && showInstallBanner && (
        <div className="cookie-toast">
          <span style={{ color: '#fff', fontSize: '0.9rem' }}>Install our App for a better experience!</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn-primary btn-small" onClick={handleInstallApp}>Install</button>
            <button className="btn-icon" onClick={() => setShowInstallBanner(false)}>&times;</button>
          </div>
        </div>
      )}

      <CreateGroupModal open={createGroupModalOpen} onClose={() => setCreateGroupModalOpen(false)} onCreate={handleCreateGroup} contacts={contacts} />
      <PrivacySettingsModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} contacts={contacts} profileVisibility={profileVisibility} visibleToContacts={visibleToContacts} onSave={handleSavePrivacy} />
      <RenameModal open={renameOpen} onClose={() => !renameLoading && setRenameOpen(false)} onConfirm={handleRename} loading={renameLoading} error={renameError} currentName={userName} />
      <DeleteUserModal open={deleteUserOpen} onClose={() => { setDeleteUserOpen(false); setDeleteUserError(''); }} onConfirm={handleDeleteUser} loading={deleteUserLoading} error={deleteUserError} users={contacts} />
      <DeleteModal open={deleteOpen} onClose={() => !deleteLoading && setDeleteOpen(false)} onConfirm={handleDeleteAll} loading={deleteLoading} error={deleteError} title="Delete all data" description="This removes all options, comments, and messages. Cannot be undone." confirmText="Delete everything" />
      <DeleteModal open={clearAiOpen} onClose={() => !clearAiLoading && setClearAiOpen(false)} onConfirm={handleClearAiChatConfirm} loading={clearAiLoading} error={clearAiError} title="Clear AI Chat" description="Please enter the admin ID and admin password to clear all AI history." confirmText="Clear AI Chat" />
    </div>
  );
}
