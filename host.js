import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { DEFAULT_WORDS, ROLE_META, ROLES, escapeHtml, makeRolePool, normalizeWords, pickSecret, randomRoomCode, shuffle } from './game-core.js';

const $ = id => document.getElementById(id);
let db = null;
let auth = null;
let hostUid = '';
let roomCode = '';
let players = {};
let myPrivate = {};
let publicState = {};
let roleVisible = false;

const path = (suffix = '') => `rooms/${roomCode}${suffix ? '/' + suffix : ''}`;
const entries = () => Object.entries(players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

function setConnection(text, on = false) {
  $('connectionStatus').textContent = text;
  $('connectionStatus').classList.toggle('on', on);
}

function wordsFromEditor() {
  return normalizeWords($('wordDeck').value);
}

function updateWordCount() {
  const count = wordsFromEditor().length;
  $('wordCount').textContent = `${count} คำ`;
  localStorage.setItem('insider_word_deck', $('wordDeck').value);
}

function renderPlayers() {
  const list = entries();
  $('playerCount').textContent = `${list.length} / 6`;
  $('playerList').innerHTML = list.length
    ? list.map(([uid, p]) => `
      <div class="player-row">
        <div>
          <div class="player-name"><span class="dot ${p.connected !== false ? 'on' : ''}"></span>${escapeHtml(p.name)}${uid === hostUid ? ' • คุณ' : ''}</div>
          <div class="player-sub">${p.connected === false ? 'ออฟไลน์' : 'ออนไลน์'}${p.assigned ? ' • มี Role แล้ว' : ''}</div>
        </div>
      </div>`).join('')
    : '<div class="panel-desc">รอผู้เล่นเข้าห้อง…</div>';
  $('assignBtn').disabled = list.length < 3 || list.length > 6;
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

function renderMyRole() {
  const hasRole = Boolean(myPrivate?.role);
  $('hostRoleArea').classList.toggle('hidden', !hasRole);
  if (!hasRole) return;
  $('hostRoleCard').innerHTML = roleMarkup(myPrivate);
  $('hostRoleCard').classList.toggle('hidden', !roleVisible);
  $('hostRoleRevealBtn').textContent = roleVisible ? '🙈 ซ่อน Role' : '🔒 แตะเพื่อดู Role';
}

function renderHero() {
  if (!roomCode) return;
  const round = publicState?.roundNumber || 0;
  if (!round) {
    $('heroTitle').textContent = 'รอผู้เล่นให้ครบ แล้วสุ่มได้เลย';
    $('heroCopy').textContent = 'Host มีหน้าที่สร้างห้องและกดสุ่มเท่านั้น ไม่ต้องเป็น MASTER และไม่ต้องคุมคำตอบหรือการโหวต';
    $('roundInfo').classList.add('hidden');
  } else {
    $('heroTitle').textContent = `รอบ ${round} พร้อมเล่น`;
    $('heroCopy').textContent = 'ทุกคนเปิดดูการ์ดของตัวเองแล้วเริ่มเล่นด้วยเสียงได้เลย เว็บจะไม่แทรกแซงระหว่างเกม';
    $('roundInfo').textContent = 'คำลับถูกส่งเฉพาะเครื่องของ MASTER และ INSIDER';
    $('roundInfo').classList.remove('hidden');
  }
}

function renderAll() {
  const created = Boolean(roomCode);
  $('roomPanel').classList.toggle('hidden', !created);
  $('playersPanel').classList.toggle('hidden', !created);
  $('settingsPanel').classList.toggle('hidden', !created);
  if (created) $('roomCode').textContent = roomCode;
  renderPlayers();
  renderMyRole();
  renderHero();
}

function attachRoom() {
  onValue(ref(db, path('players')), snap => {
    players = snap.val() || {};
    renderAll();
  });
  // สำคัญ: Host อ่าน private ของตัวเองเท่านั้น ไม่ดึง Role/คำลับของคนอื่น
  onValue(ref(db, path(`private/${hostUid}`)), snap => {
    const oldRound = myPrivate?.roundId;
    myPrivate = snap.val() || {};
    if (myPrivate.roundId && myPrivate.roundId !== oldRound) roleVisible = false;
    renderAll();
  });
  onValue(ref(db, path('public')), snap => {
    publicState = snap.val() || {};
    renderAll();
  });
}

async function createRoom() {
  const name = $('hostNameInput').value.trim();
  if (!name) return alert('กรุณาใส่ชื่อของคุณ');
  if (!db || !hostUid) return alert('Firebase ยังไม่พร้อม');

  let code = '';
  for (let i = 0; i < 10; i++) {
    const candidate = randomRoomCode();
    if (!(await get(ref(db, `rooms/${candidate}/hostUid`))).exists()) {
      code = candidate;
      break;
    }
  }
  if (!code) return alert('สร้าง Room Code ไม่สำเร็จ');

  roomCode = code;
  localStorage.setItem('insider_host_name', name);
  localStorage.setItem('insider_host_room', roomCode);

  await set(ref(db, path('hostUid')), hostUid);
  await set(ref(db, path('public')), { gameType: 'insider-lite', status: 'lobby', roundNumber: 0, createdAt: Date.now() });
  await update(ref(db, path(`players/${hostUid}`)), {
    name,
    connected: true,
    joinedAt: Date.now(),
    isHost: true,
    assigned: false
  });
  try { await onDisconnect(ref(db, path(`players/${hostUid}/connected`))).set(false); } catch {}
  attachRoom();
  renderAll();
}

async function assignRound() {
  const list = entries();
  if (list.length < 3 || list.length > 6) return alert('ต้องมีผู้เล่น 3-6 คน');
  const words = wordsFromEditor();
  if (!words.length) return alert('กรุณาใส่คำลับอย่างน้อย 1 คำ');

  const roles = makeRolePool(list.length);
  const shuffledPlayers = shuffle(list);
  const secretWord = pickSecret(words);
  const roundNumber = Number(publicState?.roundNumber || 0) + 1;
  const roundId = `round_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const updates = {};

  shuffledPlayers.forEach(([uid], index) => {
    const role = roles[index];
    updates[`private/${uid}`] = {
      role,
      roleTh: ROLE_META[role].th,
      secretWord: [ROLES.MASTER, ROLES.INSIDER].includes(role) ? secretWord : null,
      roundId,
      roundNumber
    };
    updates[`players/${uid}/assigned`] = true;
  });

  updates.public = {
    gameType: 'insider-lite',
    status: 'ready',
    roundId,
    roundNumber,
    assignedAt: Date.now()
  };

  await update(ref(db, path()), updates);
  roleVisible = false;
}

async function copyLink() {
  if (!roomCode) return;
  const url = new URL('player.html', location.href);
  url.searchParams.set('room', roomCode);
  try {
    await navigator.clipboard.writeText(url.toString());
    $('copyLinkBtn').textContent = 'คัดลอกแล้ว ✓';
    setTimeout(() => $('copyLinkBtn').textContent = 'คัดลอกลิงก์', 1200);
  } catch {
    prompt('คัดลอกลิงก์นี้', url.toString());
  }
}

$('createRoomBtn').addEventListener('click', createRoom);
$('copyLinkBtn').addEventListener('click', copyLink);
$('assignBtn').addEventListener('click', assignRound);
$('hostRoleRevealBtn').addEventListener('click', () => {
  roleVisible = !roleVisible;
  renderMyRole();
});
$('wordDeck').addEventListener('input', updateWordCount);

(async () => {
  $('hostNameInput').value = localStorage.getItem('insider_host_name') || '';
  $('wordDeck').value = localStorage.getItem('insider_word_deck') || DEFAULT_WORDS.join('\n');
  updateWordCount();

  try {
    if (!isFirebaseConfigured()) throw new Error('Firebase config ไม่ครบ');
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    hostUid = (await signInAnonymously(auth)).user.uid;
    setConnection('Firebase พร้อม', true);
  } catch (error) {
    console.error(error);
    setConnection('เชื่อม Firebase ไม่สำเร็จ');
    $('createRoomBtn').disabled = true;
  }
})();
