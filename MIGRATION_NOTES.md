# Migration Notes — Simplified Insider

เวอร์ชันนี้ลดระบบจาก implementation แรกให้ตรงกับการเล่นจริงมากขึ้น

## ตัดออก

- ปุ่ม MASTER: ใช่ / ไม่ใช่ / ไม่รู้ / ถูกต้อง
- ระบบเลือกชื่อคนที่ทายถูก
- Timer / Phase 1-6 state machine
- Discussion control
- Phase 5 / Phase 6 online voting
- Tie-break logic
- client → Host command queue
- `actions/*`
- `votes/*`

## เหลือไว้

```text
Create room
   ↓
Players join
   ↓
Host presses “สุ่ม Role + คำลับ”
   ↓
MASTER  ── sees role + secret word
INSIDER ── sees role + secret word
CITIZEN ── sees role only
   ↓
Everyone plays/talks/votes offline
   ↓
Host randomizes next round
```

## Privacy change

Implementation แรกให้ Host subscribe `private` ทั้งห้องเพื่อคุม state machine เมื่อ MASTER เป็นคนอื่น

เวอร์ชันนี้ไม่จำเป็นแล้ว:

- Host subscribe เฉพาะ `private/<hostUid>`
- Player subscribe เฉพาะ `private/<uid>`
- Firebase Rules อนุญาต `.read` private เฉพาะเจ้าของ uid
- Host ยัง `.write` private ของทุกคนเพื่อแจก Role/คำลับได้

ผลคือใครก็สามารถสุ่มได้ MASTER โดยไม่ต้องโยนปุ่ม/คำสั่งกลับมาที่ Host
