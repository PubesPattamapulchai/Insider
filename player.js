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
let toastTimer = null;

const path = (suffix = '') => `rooms/${roomCode}${suffix ? '/' + suffix : ''}`;

function setConnection(text, on = false) {
  const el = $('connectionStatus');
  if (!el) return;
  el.classList.toggle('on', on);
  const label = el.querySelector('span:last-child');
  if (label) label.textContent = text;
  else el.textContent = text;
}

function toast(text) {
  const el = $('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = text;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function playerEntries() {
  return Object.entries(players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
}

function initials(name = '') {
  return Array.from(name.trim())[0]?.toUpperCase() || '?';
}

function renderPlayers() {
  const list = playerEntries();
  $('playerCount').textContent = `${list.length} คน`;
  $('playerList').innerHTML = list.length ? list.map(([id, p]) => `
    <div class="player-row">
      <div class="player-avatar">${escapeHtml(initials(p.name))}</div>
      <div class="player-body">
        <div class="player-name">${escapeHtml(p.name)}${p.isHost ? '<span class="host-chip">HOST</span>' : ''}${id === uid ? '<span class="host-chip">YOU</span>' : ''}</div>
        <div class="player-sub"><span class="dot ${p.connected !== false ? 'on' : ''}"></span>${p.connected === false ? 'ออฟไลน์' : 'ออนไลน์'} <span class="player-role-state ${p.assigned ? 'ready' : ''}">${p.assigned ? '• มีการ์ดแล้ว' : '• รอสุ่ม'}</span></div>
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
      ${hasWord
        ? `<div class="secret"><div class="secret-label">SECRET WORD</div><div class="secret-word">${escapeHtml(data.secretWord)}</div></div>`
        : '<div class="no-secret">CITIZEN • รอบนี้คุณไม่เห็นคำลับ ให้ช่วยกันถาม MASTER เพื่อหาคำให้เจอ</div>'}
    </div>`;
}

function renderRevealButton(visible) {
  const button = $('roleRevealBtn');
  button.classList.toggle('revealed', visible);
  button.innerHTML = visible
    ? '<span class="cover-symbol" aria-hidden="true">×</span><strong>ซ่อนการ์ด</strong><small>แตะก่อนให้คนอื่นมองหน้าจอ</small>'
    : '<span class="cover-symbol" aria-hidden="true">⌾</span><strong>แตะเพื่อเปิดการ์ด</strong><small>อย่าให้ผู้เล่นคนอื่นเห็นหน้าจอ</small>';
}

function renderRole() {
  const hasRole = Boolean(privateState?.role);
  $('waitingCard').classList.toggle('hidden', hasRole);
  $('roleArea').classList.toggle('hidden', !hasRole);

  if (!hasRole) {
    const round = Number(publicState?.roundNumber || 0);
    $('waitingTitle').textContent = round ? 'เข้าหลังเริ่มรอบ' : 'เข้าห้องแล้ว';
    $('waitingCopy').textContent = round
      ? 'รอบปัจจุบันแจกการ์ดไปแล้ว รอ Host กดสุ่มรอบใหม่ แล้วคุณจะได้รับ Role พร้อมทุกคน'
      : 'รอ Host สุ่ม Role เมื่อพร้อม การ์ดลับจะปรากฏบนหน้าจอนี้โดยอัตโนมัติ';
    return;
  }

  $('roleCard').innerHTML = roleMarkup(privateState);
  $('roleCard').classList.toggle('hidden', !roleVisible);
  renderRevealButton(roleVisible);
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
    if (privateState.roundId && privateState.roundId !== oldRound) {
      roleVisible = false;
      if (oldRound) toast(`ได้การ์ดรอบ ${privateState.roundNumber || ''} แล้ว`);
    }
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

  const button = $('joinBtn');
  button.disabled = true;
  button.textContent = 'กำลังเข้าห้อง…';

  try {
    const hostSnap = await get(ref(db, `rooms/${code}/hostUid`));
    if (!hostSnap.exists()) throw new Error('ไม่พบห้องนี้');
    const gameTypeSnap = await get(ref(db, `rooms/${code}/public/gameType`));
    if (gameTypeSnap.val() !== 'insider-lite') throw new Error('ห้องนี้ไม่ใช่ห้อง Insider');
    const playersSnap = await get(ref(db, `rooms/${code}/players`));
    const currentPlayers = playersSnap.val() || {};
    if (!currentPlayers[uid] && Object.keys(currentPlayers).length >= 6) throw new Error('ห้องนี้มีผู้เล่นครบ 6 คนแล้ว');

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
    toast('เข้าห้องแล้ว');
  } catch (error) {
    console.error(error);
    alert(error?.message || 'เข้าห้องไม่สำเร็จ');
    button.disabled = false;
    button.innerHTML = 'เข้าห้อง <span aria-hidden="true">→</span>';
  }
}

$('joinBtn').addEventListener('click', joinRoom);
$('roleRevealBtn').addEventListener('click', () => {
  roleVisible = !roleVisible;
  renderRole();
});
$('roomInput').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
});
$('roomInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('nameInput').focus();
});
$('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('joinBtn').disabled) joinRoom();
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
    setConnection('ออนไลน์', true);
    $('joinBtn').disabled = false;
  } catch (error) {
    console.error(error);
    setConnection('เชื่อมไม่สำเร็จ');
    $('joinBtn').disabled = true;
  }
})();
