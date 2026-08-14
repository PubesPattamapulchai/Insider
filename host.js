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
let frozenWords = [];
let attachedRoomCode = '';
let toastTimer = null;

const path = (suffix = '') => `rooms/${roomCode}${suffix ? '/' + suffix : ''}`;
const entries = () => Object.entries(players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

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

function wordsFromEditor() {
  return normalizeWords($('wordDeck')?.value || '');
}

function updateWordCount() {
  const editor = $('wordDeck');
  if (!editor) return;
  const count = wordsFromEditor().length;
  $('wordCount').textContent = `${count.toLocaleString('th-TH')} คำ`;
  localStorage.setItem('insider_word_deck', editor.value);
}

function initials(name = '') {
  return Array.from(name.trim())[0]?.toUpperCase() || '?';
}

function renderPlayers() {
  const list = entries();
  const round = Number(publicState?.roundNumber || 0);
  $('playerCount').textContent = `${list.length} / 6`;
  $('playerList').innerHTML = list.length
    ? list.map(([uid, p]) => `
      <div class="player-row">
        <div class="player-avatar">${escapeHtml(initials(p.name))}</div>
        <div class="player-body">
          <div class="player-name">${escapeHtml(p.name)}${uid === hostUid ? '<span class="host-chip">HOST • YOU</span>' : ''}</div>
          <div class="player-sub"><span class="dot ${p.connected !== false ? 'on' : ''}"></span>${p.connected === false ? 'ออฟไลน์' : 'ออนไลน์'} <span class="player-role-state ${p.assigned ? 'ready' : ''}">${p.assigned ? '• มีการ์ดแล้ว' : '• รอสุ่ม'}</span></div>
        </div>
      </div>`).join('')
    : '<div class="panel-desc">แชร์ Room Code ให้เพื่อนเข้าห้องได้เลย</div>';

  const validCount = list.length >= 3 && list.length <= 6;
  const hasDeck = frozenWords.length > 0;
  $('assignBtn').disabled = !validCount || !hasDeck;

  if (!hasDeck && roomCode) {
    $('playerHint').textContent = 'ชุดคำของห้องนี้ไม่อยู่ใน session แล้ว • สร้างห้องใหม่เพื่อเล่นต่อ';
    $('assignBtn').textContent = 'สร้างห้องใหม่เพื่อสุ่มต่อ';
  } else if (list.length < 3) {
    $('playerHint').textContent = `รออีก ${3 - list.length} คน • ต้องมีอย่างน้อย 3 คน`;
    $('assignBtn').textContent = `รอผู้เล่น ${list.length} / 3`;
  } else if (list.length > 6) {
    $('playerHint').textContent = 'ผู้เล่นเกิน 6 คน • เกมชุดนี้รองรับ 3–6 คน';
    $('assignBtn').textContent = 'ผู้เล่นเกินจำนวนที่รองรับ';
  } else {
    const unassigned = list.filter(([, p]) => !p.assigned).length;
    if (round && unassigned) {
      $('playerHint').textContent = `มีผู้เล่นใหม่ ${unassigned} คน • สุ่มรอบใหม่เพื่อแจกการ์ดให้ครบ`;
      $('assignBtn').textContent = '🎲 สุ่มรอบใหม่ให้ทุกคน';
    } else {
      $('playerHint').textContent = round ? 'ทุกคนมีการ์ดแล้ว • พร้อมเริ่มรอบใหม่เมื่ออยากเล่นต่อ' : 'ครบขั้นต่ำแล้ว • พร้อมสุ่ม Role + คำลับ';
      $('assignBtn').textContent = round ? '🎲 สุ่มรอบใหม่' : '🎲 สุ่ม Role + คำลับ';
    }
  }
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

function renderRevealButton(button, visible) {
  if (!button) return;
  button.classList.toggle('revealed', visible);
  button.innerHTML = visible
    ? '<span class="cover-symbol" aria-hidden="true">×</span><strong>ซ่อนการ์ด</strong><small>แตะก่อนให้คนอื่นมองหน้าจอ</small>'
    : '<span class="cover-symbol" aria-hidden="true">⌾</span><strong>แตะเพื่อเปิดการ์ด</strong><small>Role และคำลับจะอยู่ใต้การ์ดนี้</small>';
}

function renderMyRole() {
  const hasRole = Boolean(myPrivate?.role);
  $('hostRoleArea').classList.toggle('hidden', !hasRole);
  if (!hasRole) return;
  $('hostRoleCard').innerHTML = roleMarkup(myPrivate);
  $('hostRoleCard').classList.toggle('hidden', !roleVisible);
  renderRevealButton($('hostRoleRevealBtn'), roleVisible);
}

function renderHero() {
  const round = Number(publicState?.roundNumber || 0);
  if (!roomCode) {
    $('heroTitle').textContent = 'พร้อมสร้างห้อง';
    $('heroCopy').textContent = 'เว็บจะจัดการเฉพาะสิ่งที่ต้องเป็นความลับ: Role และคำลับ ส่วนการถาม ตอบ จับเวลา และโหวต เล่นกันด้วยเสียงตามปกติ';
    $('roundInfo').classList.add('hidden');
    return;
  }

  if (!round) {
    $('heroTitle').textContent = 'แชร์ห้อง แล้วรอให้ครบ 3 คน';
    $('heroCopy').textContent = 'Host เป็นผู้เล่นธรรมดาเหมือนทุกคน เมื่อสมาชิกครบก็กดสุ่มได้เลย ไม่มีขั้นตอนตั้งค่า Role เพิ่ม';
    $('roundInfo').classList.add('hidden');
  } else {
    $('heroTitle').textContent = `รอบ ${round} พร้อมเล่น`;
    $('heroCopy').textContent = 'ทุกคนเปิดดูการ์ดของตัวเองแล้ววางมือถือ จากนี้ถาม–ตอบ อภิปราย และโหวตกันด้วยเสียงตามปกติ';
    $('roundInfo').textContent = '◈ คำลับถูกส่งเฉพาะเครื่องของ MASTER และ INSIDER เท่านั้น';
    $('roundInfo').classList.remove('hidden');
  }
}

function renderAll() {
  const created = Boolean(roomCode);
  $('preRoomControls').classList.toggle('hidden', created);
  $('settingsPanel').classList.toggle('hidden', created);
  $('createRoomControl').classList.toggle('hidden', created);
  $('roomPanel').classList.toggle('hidden', !created);
  $('playersPanel').classList.toggle('hidden', !created);
  if (created) $('roomCode').textContent = roomCode;
  renderPlayers();
  renderMyRole();
  renderHero();
}

function attachRoom() {
  if (!roomCode || attachedRoomCode === roomCode) return;
  attachedRoomCode = roomCode;
  onValue(ref(db, path('players')), snap => {
    players = snap.val() || {};
    renderAll();
  });
  // Host อ่าน private ของตัวเองเท่านั้น จึงไม่เห็น Role/คำของคนอื่น
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

  const preparedWords = wordsFromEditor();
  if (!preparedWords.length) return alert('กรุณาใส่คำลับอย่างน้อย 1 คำก่อนสร้างห้อง');

  const button = $('createRoomBtn');
  button.disabled = true;
  button.innerHTML = '<span>กำลังสร้างห้อง…</span><span>•••</span>';

  try {
    let code = '';
    for (let i = 0; i < 10; i++) {
      const candidate = randomRoomCode();
      if (!(await get(ref(db, `rooms/${candidate}/hostUid`))).exists()) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error('สร้าง Room Code ไม่สำเร็จ');

    roomCode = code;
    frozenWords = [...preparedWords];
    sessionStorage.setItem('insider_frozen_words', JSON.stringify(frozenWords));
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

    localStorage.removeItem('insider_word_deck');
    $('wordDeck').value = '';
    $('wordCount').textContent = '';
    $('wordDeckDetails')?.removeAttribute('open');

    attachRoom();
    renderAll();
    toast('สร้างห้องแล้ว • ชุดคำถูกซ่อนเรียบร้อย');
  } catch (error) {
    console.error(error);
    alert(error?.message || 'สร้างห้องไม่สำเร็จ');
    button.disabled = false;
    button.innerHTML = '<span>สร้างห้อง Insider</span><span aria-hidden="true">→</span>';
  }
}

async function assignRound() {
  const list = entries();
  if (list.length < 3 || list.length > 6) return alert('ต้องมีผู้เล่น 3–6 คน');
  if (!frozenWords.length) return alert('ไม่พบชุดคำของห้องนี้ กรุณาสร้างห้องใหม่');

  const button = $('assignBtn');
  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = 'กำลังสับการ์ด…';

  try {
    const roles = makeRolePool(list.length);
    const shuffledPlayers = shuffle(list);
    const secretWord = pickSecret(frozenWords);
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
    toast(`สุ่มรอบ ${roundNumber} แล้ว • ทุกคนเปิดการ์ดได้`);
  } catch (error) {
    console.error(error);
    alert('สุ่ม Role ไม่สำเร็จ กรุณาลองใหม่');
  } finally {
    button.textContent = previousText;
    renderPlayers();
  }
}

function joinUrl() {
  const url = new URL('player.html', location.href);
  url.searchParams.set('room', roomCode);
  return url;
}

async function copyLink() {
  if (!roomCode) return;
  const url = joinUrl();
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('คัดลอกลิงก์เข้าห้องแล้ว');
  } catch {
    prompt('คัดลอกลิงก์นี้', url.toString());
  }
}

async function shareLink() {
  if (!roomCode) return;
  const url = joinUrl().toString();
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Insider Room', text: `เข้าห้อง Insider รหัส ${roomCode}`, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyLink();
}

$('createRoomBtn').addEventListener('click', createRoom);
$('copyLinkBtn').addEventListener('click', copyLink);
$('shareLinkBtn').addEventListener('click', shareLink);
$('assignBtn').addEventListener('click', assignRound);
$('hostRoleRevealBtn').addEventListener('click', () => {
  roleVisible = !roleVisible;
  renderMyRole();
});
$('wordDeck').addEventListener('input', updateWordCount);
$('resetWordDeckBtn').addEventListener('click', () => {
  if (roomCode) return;
  $('wordDeck').value = DEFAULT_WORDS.join('\n');
  updateWordCount();
  toast('คืนค่าชุดคำเริ่มต้นแล้ว');
});

(async () => {
  $('hostNameInput').value = localStorage.getItem('insider_host_name') || '';
  $('wordDeck').value = localStorage.getItem('insider_word_deck') || DEFAULT_WORDS.join('\n');
  updateWordCount();
  renderAll();

  try {
    if (!isFirebaseConfigured()) throw new Error('Firebase config ไม่ครบ');
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    hostUid = (await signInAnonymously(auth)).user.uid;
    setConnection('Firebase พร้อม', true);
    $('createRoomBtn').disabled = false;

    // รองรับการ refresh ในแท็บเดิมโดยไม่เอาคลังคำกลับมาแสดงบน UI
    const savedRoom = localStorage.getItem('insider_host_room') || '';
    if (savedRoom) {
      const hostSnap = await get(ref(db, `rooms/${savedRoom}/hostUid`));
      if (hostSnap.val() === hostUid) {
        const publicSnap = await get(ref(db, `rooms/${savedRoom}/public/gameType`));
        if (publicSnap.val() === 'insider-lite') {
          roomCode = savedRoom;
          try { frozenWords = JSON.parse(sessionStorage.getItem('insider_frozen_words') || '[]'); } catch { frozenWords = []; }
          attachRoom();
          renderAll();
        }
      }
    }
  } catch (error) {
    console.error(error);
    setConnection('เชื่อมไม่สำเร็จ');
    $('createRoomBtn').disabled = true;
  }
})();
