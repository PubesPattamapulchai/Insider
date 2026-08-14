# Insider Connected Game

เว็บช่วยเล่น **Insider** แบบหลายเครื่อง โดยตั้งใจทำให้เรียบง่ายที่สุด: เว็บทำหน้าที่เพียงสร้างห้อง, สุ่ม Role, สุ่มคำลับ และแสดงข้อมูลลับบนมือถือของแต่ละคนเท่านั้น

หลังจากแจก Role แล้ว การถาม–ตอบ การจับเวลา การอภิปราย และการโหวตทั้งหมดทำกันด้วยเสียง/บนโต๊ะตามปกติ **ไม่มีปุ่มตอบ MASTER และไม่มี state machine คุม Phase**

## สิ่งที่เว็บทำ

- Host สร้างห้องและเข้าร่วมเป็นผู้เล่นคนหนึ่ง
- รองรับผู้เล่น 3-6 คน
- สุ่ม `MASTER` 1 คน
- สุ่ม `INSIDER` 1 คน
- ที่เหลือเป็น `CITIZEN`
- สุ่มคำลับ 1 คำจากชุดคำของ Host
- ส่งคำลับให้เฉพาะ `MASTER` และ `INSIDER`
- `CITIZEN` เห็นเฉพาะ Role ของตัวเองและไม่เห็นคำลับ
- กดสุ่มใหม่เพื่อเริ่มรอบใหม่ได้ทันที

## แนวคิดสำคัญ

Host **ไม่ใช่ Moderator ของเกม** และไม่จำเป็นต้องเป็น MASTER ระบบสุ่ม Host เหมือนผู้เล่นคนอื่นทุกคน

หน้า Host อ่าน `private/<hostUid>` ของตัวเองเท่านั้น และห้อง Insider-lite มี `public/gameType = insider-lite` เพื่อให้ Firebase Rules ปิดการอ่าน `private` ทั้งห้องจาก Host ในเกมนี้ ดังนั้น Host ที่สุ่มได้ CITIZEN จะไม่เห็นคำลับของ MASTER/INSIDER

## วิธีเล่น

1. Host เปิด `index.html` ใส่ชื่อ แล้วสร้างห้อง
2. ผู้เล่นคนอื่นเปิด `player.html` หรือใช้ลิงก์จาก Host
3. ทุกคนใส่ชื่อและเข้า Room Code เดียวกัน
4. เมื่อครบ 3-6 คน Host กด **สุ่ม Role + คำลับ**
5. ทุกคนแตะดูการ์ดลับของตัวเอง
6. MASTER และ INSIDER จะเห็นคำลับเดียวกัน ส่วน CITIZEN ไม่เห็น
7. วางมือถือ/ซ่อน Role แล้วเล่นเกมด้วยการพูดคุยตามปกติ
8. จบรอบแล้ว Host กดสุ่มอีกครั้งเพื่อเริ่มรอบใหม่

## ไฟล์

- `index.html` — หน้า Host สำหรับสร้างห้อง/สุ่มรอบ
- `host.js` — Firebase room + role/word assignment
- `player.html` — หน้า Player Companion
- `player.js` — join room + private role card
- `game-core.js` — roles, word deck และ helper functions
- `theme.css` — UI
- `firebase-config.js` — Firebase config
- `firebase.rules.json` — Realtime Database rules

## Firebase

ใช้ Firebase Realtime Database และ Anonymous Authentication เหมือน Repo Werewolf ต้นฉบับ

โครงข้อมูลหลัก:

```text
rooms/<roomCode>/
  hostUid
  public/
    gameType     # insider-lite
    status
    roundId
    roundNumber
  players/<uid>/
    name
    connected
    joinedAt
    isHost
    assigned
  private/<uid>/
    role
    roleTh
    secretWord   # มีค่าเฉพาะ MASTER / INSIDER
    roundId
    roundNumber
```

ตัวแอป Insider ไม่ใช้ `actions` และ `votes` เพราะไม่ต้องส่งคำตอบหรือโหวตผ่านระบบแล้ว แต่ Rules ยังเก็บ path เดิมไว้เพื่อไม่ทำให้ Repo Werewolf เดิมเสีย หากทั้งสองเกมใช้ Firebase project เดียวกัน

## Deploy GitHub Pages

ตั้ง GitHub Pages ให้ deploy จาก branch `main` และ root directory

- Host: `https://YOURNAME.github.io/Insider-Board-Game/`
- Player: `https://YOURNAME.github.io/Insider-Board-Game/player.html`
