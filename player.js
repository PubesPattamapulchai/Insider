import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, get, update, onValue, onDisconnect } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { ROLE_META, ROLES, escapeHtml } from './game-core.js';

const $ = id => document.getElementById(id);
let db = null;
let auth = null;
let uid = '';
let roomCode = '';
let myName = '';
let players = {};
let privateState = {};
let publicState = {};
let roleVisible = false;

const path = (suffix = '') => `rooms/${roomCode}${suffix ? '/' + suffix : ''}`;

function setConnection(text, on = false) {
  $('connectionStatus').textContent = text;
  $('connectionStatus').classList.toggle('on', on);
}

function playerEntries() {
  return Object.entries(players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
}

function renderPlayers() {
  const list = playerEntries();
  $('playerList').innerHTML = list.length ? list.map(([id, p]) => `
    <div class="player-row">
      <div>
        <div class="player-name"><span class="dot ${p.connected !== false ? 'on' : ''}"></span>${escapeHtml(p.name)}${id === uid ? ' • คุณ' : ''}</div>
        <div class="player-sub">${p.connected === false ? 'ออฟไลน์' : 'ออนไลน์'}${p.isHost ? ' • Host' : ''}</div>
      </div>
    </div>`).join('') : '<div class="panel-desc">ยังไม่มีผู้เล่น</div>';
}

function roleMarkup(data) {
  const meta = ROLE_META[data.role] || ROLE_META.CITIZEN;
  const hasWord = [ROLES.MASTER, ROLES.INSIDER].includes(data.role) && data.secretWord;
  return `
    <div class="role-card ${meta.className}">
      <div class="role-icon">${meta.icon}</div>
      <div class="role-name">${escapeHtml(data.role)}</div>
      <div class="role-th">${escapeHtml(meta.th)}</div>
      <div class="role-desc">${escapeHtml(meta.description)}</div>
      ${hasWord ? `<div class="secret"><div class="secret-label">คำลับ</div><div class="secret-word">${escapeHtml(data.secretWord)}</div></div>` : '<div class="no-secret">คุณไม่รู้คำลับในรอบนี้</div>'}
    </div>`;
}

function renderRole() {
  const hasRole = Boolean(privateState?.role);
  $('waitingCard').classList.toggle('hidden', hasRole);
  $('roleArea').classList.toggle('hidden', !hasRole);
  if (!hasRole) {
    $('waitingTitle').textContent = 'รอ Host สุ่ม Role';
    $('waitingCopy').textContent = 'เมื่อสุ่มแล้ว การ์ดลับของคุณจะปรากฏตรงนี้';
    return;
  }
  $('roleCard').innerHTML = roleMarkup(privateState);
  $('roleCard').classList.toggle('hidden', !roleVisible);
  $('roleRevealBtn').textContent = roleVisible ? '🙈 ซ่อน Role' : '🔒 แตะเพื่อดู Role';
}

function render() {
  renderPlayers();
  renderRole();
}

function attachRoom() {
  onValue(ref(db, path('players')), snap => {
    players = snap.val() || {};
    render();
  });
  onValue(ref(db, path(`private/${uid}`)), snap => {
    const oldRound = privateState?.roundId;
    privateState = snap.val() || {};
    if (privateState.roundId && privateState.roundId !== oldRound) roleVisible = false;
    render();
  });
  onValue(ref(db, path('public')), snap => {
    publicState = snap.val() || {};
    render();
  });
}

async function joinRoom() {
  if (!db || !uid) return alert('Firebase ยังไม่พร้อม');
  const code = $('roomInput').value.trim().toUpperCase();
  const name = $('nameInput').value.trim();
  if (code.length !== 6 || !code.startsWith('I')) return alert('Room Code ต้องมี 6 ตัวและขึ้นต้นด้วย I');
  if (!name) return alert('กรุณาใส่ชื่อ');
  if (!(await get(ref(db, `rooms/${code}/hostUid`))).exists()) return alert('ไม่พบห้องนี้');

  roomCode = code;
  myName = name;
  const playerRef = ref(db, path(`players/${uid}`));
  const old = await get(playerRef);
  const data = { name, connected: true };
  if (!old.exists()) data.joinedAt = Date.now();
  await update(playerRef, data);
  try { await onDisconnect(ref(db, path(`players/${uid}/connected`))).set(false); } catch {}

  localStorage.setItem('insider_player_room', roomCode);
  localStorage.setItem('insider_player_name', myName);
  $('roomText').textContent = roomCode;
  $('meText').textContent = myName;
  $('joinView').classList.add('hidden');
  $('gameView').classList.remove('hidden');
  attachRoom();
}

$('joinBtn').addEventListener('click', joinRoom);
$('roleRevealBtn').addEventListener('click', () => {
  roleVisible = !roleVisible;
  renderRole();
});
$('roomInput').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
});

(async () => {
  const query = new URLSearchParams(location.search);
  $('roomInput').value = (query.get('room') || localStorage.getItem('insider_player_room') || '').toUpperCase();
  $('nameInput').value = localStorage.getItem('insider_player_name') || '';
  try {
    if (!isFirebaseConfigured()) throw new Error('Firebase config ไม่ครบ');
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    uid = (await signInAnonymously(auth)).user.uid;
    setConnection('ออนไลน์ ✓', true);
  } catch (error) {
    console.error(error);
    setConnection('เชื่อม Firebase ไม่สำเร็จ');
    $('joinBtn').disabled = true;
  }
})();
