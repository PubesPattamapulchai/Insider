export const ROLES = Object.freeze({
  MASTER: 'MASTER',
  INSIDER: 'INSIDER',
  CITIZEN: 'CITIZEN'
});

export const ROLE_META = Object.freeze({
  MASTER: {
    th: 'มาสเตอร์',
    icon: '🎙️',
    className: 'master',
    description: 'คุณเป็นคนตอบคำถามของกลุ่ม และคุณรู้คำลับ'
  },
  INSIDER: {
    th: 'อินไซเดอร์',
    icon: '🕵️',
    className: 'insider',
    description: 'คุณรู้คำลับเหมือน MASTER แต่ต้องช่วยชี้นำแบบไม่ให้ถูกจับได้'
  },
  CITIZEN: {
    th: 'คนทั่วไป',
    icon: '👥',
    className: 'citizen',
    description: 'คุณไม่รู้คำลับ ช่วยกันถาม MASTER และตามหา INSIDER'
  }
});

// คำตัวอย่างที่เขียนขึ้นใหม่สำหรับเว็บ สามารถแก้/เพิ่มจากหน้า Host ได้
export const DEFAULT_WORDS = Object.freeze([
  'ช้าง','มะม่วง','จักรยาน','โรงเรียน','แมว','ทะเล','เครื่องบิน','กีตาร์','กาแฟ','ภูเขา',
  'นาฬิกา','ร่ม','พิซซ่า','ห้องสมุด','ฟุตบอล','ดาวเทียม','ไอศกรีม','รถไฟ','ตลาด','กล้องถ่ายรูป',
  'คอมพิวเตอร์','ดอกไม้','แม่น้ำ','หนังสือ','ช้อน','โทรศัพท์','สวนสัตว์','ข้าวผัด','โรงพยาบาล','เรือ',
  'พระจันทร์','รองเท้า','ช็อกโกแลต','พิพิธภัณฑ์','ไมโครโฟน','น้ำตก','เต็นท์','เปียโน','แตงโม','สนามบิน',
  'แว่นตา','หุ่นยนต์','ขนมปัง','สะพาน','ตู้เย็น','ต้นไม้','หมอน','โรงภาพยนตร์','ลูกโป่ง','รถเมล์'
]);

export function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'I';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeRolePool(playerCount) {
  if (playerCount < 3 || playerCount > 6) {
    throw new Error('รองรับผู้เล่น 3-6 คน');
  }
  return shuffle([
    ROLES.MASTER,
    ROLES.INSIDER,
    ...Array.from({ length: playerCount - 2 }, () => ROLES.CITIZEN)
  ]);
}

export function normalizeWords(text) {
  return [...new Set(String(text || '')
    .split(/[\n,]/)
    .map(v => v.trim())
    .filter(Boolean))];
}

export function pickSecret(words) {
  if (!words.length) throw new Error('กรุณาใส่คำลับอย่างน้อย 1 คำ');
  return words[Math.floor(Math.random() * words.length)];
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);
}
