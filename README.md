# Insider Connected Game

เว็บช่วยเล่น **Insider** แบบหลายเครื่อง โดยตั้งใจทำให้เรียบง่ายที่สุด: เว็บทำหน้าที่เพียงสร้างห้อง, สุ่ม Role, สุ่มคำลับ และแสดงข้อมูลลับบนมือถือของแต่ละคนเท่านั้น

หลังจากแจก Role แล้ว การถาม–ตอบ การจับเวลา การอภิปราย และการโหวตทั้งหมดทำกันด้วยเสียง/บนโต๊ะตามปกติ **ไม่มีปุ่มตอบ MASTER และไม่มี state machine คุม Phase**

## สิ่งที่เว็บทำ

- Host สร้างห้องและเข้าร่วมเป็นผู้เล่นคนหนึ่ง
- รองรับผู้เล่น 3-6 คน
- สุ่ม `MASTER` 1 คน
- สุ่ม `INSIDER` 1 คน
- ที่เหลือเป็น `CITIZEN`
- มีชุดคำเริ่มต้น 2,514 คำ และ Host สามารถแก้/เพิ่มคำเองได้ก่อนสร้างห้อง
- เมื่อกดสร้างห้อง ชุดคำจะถูกล็อกและซ่อนจากหน้า Host ทันที
- สุ่มคำลับ 1 คำจากชุดที่ล็อกไว้สำหรับห้องนั้น
- ส่งคำลับให้เฉพาะ `MASTER` และ `INSIDER`
- `CITIZEN` เห็นเฉพาะ Role ของตัวเองและไม่เห็นคำลับ
- กดสุ่มใหม่เพื่อเริ่มรอบใหม่ได้ทันที

## แนวคิดสำคัญ

Host **ไม่ใช่ Moderator ของเกม** และไม่จำเป็นต้องเป็น MASTER ระบบสุ่ม Host เหมือนผู้เล่นคนอื่นทุกคน

ก่อนสร้างห้อง Host สามารถดู แก้ไข และเพิ่มรายการคำได้ตามต้องการ แต่หลังสร้างห้องแล้ว UI จะซ่อนรายการคำทั้งหมด, ล้าง textarea และลบชุดที่แก้ไขออกจาก `localStorage` โดยเก็บชุดที่ล็อกไว้เฉพาะในหน่วยความจำของ session เพื่อใช้สุ่มรอบถัดไปเท่านั้น

หน้า Host อ่าน `private/<hostUid>` ของตัวเองเท่านั้น และห้อง Insider-lite มี `public/gameType = insider-lite` เพื่อให้ Firebase Rules ปิดการอ่าน `private` ทั้งห้องจาก Host ในเกมนี้ ดังนั้น Host ที่สุ่มได้ CITIZEN จะไม่เห็นคำลับของ MASTER/INSIDER

## วิธีเล่น

1. Host เปิด `index.html` ใส่ชื่อ แล้วตรวจ/เพิ่มชุดคำลับก่อนสร้างห้อง
2. Host กดสร้างห้อง — ตั้งแต่นี้ชุดคำจะถูกซ่อนและแก้ไม่ได้สำหรับห้องนี้
3. ผู้เล่นคนอื่นเปิด `player.html` หรือใช้ลิงก์จาก Host
4. ทุกคนใส่ชื่อและเข้า Room Code เดียวกัน
5. เมื่อครบ 3-6 คน Host กด **สุ่ม Role + คำลับ**
6. ทุกคนแตะดูการ์ดลับของตัวเอง
7. MASTER และ INSIDER จะเห็นคำลับเดียวกัน ส่วน CITIZEN ไม่เห็น
8. วางมือถือ/ซ่อน Role แล้วเล่นเกมด้วยการพูดคุยตามปกติ
9. จบรอบแล้ว Host กดสุ่มอีกครั้งเพื่อเริ่มรอบใหม่ โดยใช้ชุดคำที่ล็อกไว้ตอนสร้างห้อง

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
