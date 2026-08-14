# Spyfall Connected

เกม social deduction แบบหลายเครื่อง สร้างต่อจากแนวคิดของ Repo Insider โดยใช้ Firebase Realtime Database + Anonymous Authentication และเพิ่ม timer, accusation vote และ Spy location guess

## Flow

1. Host เปิด `spyfall/index.html`, ใส่ชื่อและเลือกเวลารอบ
2. Host สร้างห้องและส่งลิงก์ `spyfall/player.html?room=XXXXXX`
3. ผู้เล่นอย่างน้อย 3 คนเข้าห้อง
4. Host กด **เริ่มรอบ**
5. ระบบสุ่ม Spy 1 คน
6. ผู้เล่นทั่วไปเห็นสถานที่เดียวกัน + บทบาทเฉพาะของตัวเอง
7. Spy เห็นเพียงว่าเป็น Spy และไม่รู้สถานที่
8. ทุกคนถาม/ตอบกันบนโต๊ะจนกว่าจะกล่าวหา หรือหมดเวลา
9. Host เลือกผู้ต้องสงสัยแล้วเปิดโหวตยืนยันแบบลับ ผู้ถูกกล่าวหาไม่มีสิทธิ์โหวต
10. ถ้าผู้มีสิทธิ์ทุกคนโหวต `ใช่` ข้อกล่าวหาผ่าน
    - ถ้าผู้ต้องสงสัยคือ Spy → ฝ่ายผู้เล่นชนะ
    - ถ้ากล่าวหาผิดคน → Spy ชนะ
11. ถ้าคะแนนไม่เป็นเอกฉันท์ เกมกลับไปเล่นต่อ
12. Spy สามารถเดาสถานที่จากเครื่องตัวเองได้หนึ่งครั้ง
    - เดาถูก → Spy ชนะ
    - เดาผิด → ฝ่ายผู้เล่นชนะ
13. หมดเวลา → Spy ชนะ

## Privacy model

- `public` เก็บ phase, timer และข้อมูลที่ทุกคนเห็นได้
- `private/<uid>` เก็บ role/location ของผู้เล่น และอ่านได้เฉพาะ uid นั้นในห้อง Spyfall
- `hostSecret` เก็บ `spyUid` + location เพื่อให้ Host engine resolve ผลหลัง refresh และอ่านได้เฉพาะ Host
- `spyVotes` เป็น immutable ต่อ accusation และผู้ถูกกล่าวหาเขียนคะแนนไม่ได้
- `spyGuess` เขียนได้เฉพาะผู้เล่นที่ `private/<uid>/isSpy == true`, เฉพาะระหว่าง `playing`, และเขียนได้ครั้งเดียว

### ข้อจำกัดด้าน anti-cheat

แอปนี้เป็น client-only GitHub Pages + Firebase โดย Host browser เป็นผู้สุ่มและเขียน secret state ดังนั้น UI จะไม่แสดงความลับที่ Host ไม่ควรรู้ แต่ Host ที่ตั้งใจ inspect DevTools/Firebase traffic ยังสามารถเข้าถึงข้อมูลที่ Host engine ต้องใช้ได้ การทำ Host-as-player แบบ cheat-resistant จริงต้องย้ายการสุ่ม/resolve secret ไป trusted backend เช่น Cloud Functions

## Location deck

`game-core.js` มี location deck ต้นฉบับ 24 สถานที่ พร้อมบทบาทย่อย 8 แบบต่อสถานที่ เพื่อหลีกเลี่ยงการผูก implementation กับชุดการ์ดทางการของเกมอื่น สามารถเพิ่ม/แก้ได้โดยเพิ่ม object ใน `LOCATIONS`

## Firebase Rules

Branch นี้แก้ root `firebase.rules.json` แบบ backward-compatible กับ Insider เดิม และเพิ่มกฎสำหรับ:

- `gameType = spyfall`
- private-per-user reads
- `hostSecret`
- immutable `spyVotes`
- Spy-only `spyGuess`

หลัง merge ต้องนำ `firebase.rules.json` ไป Publish ใน Firebase Console ด้วย เพราะการแก้ไฟล์ใน GitHub ไม่ได้อัปเดต Realtime Database Rules อัตโนมัติ

## Deploy

เมื่อ merge เข้า branch ที่ GitHub Pages deploy อยู่:

- Host: `/spyfall/`
- Player: `/spyfall/player.html`

ไฟล์ใช้ `../firebase-config.js` จึงใช้ Firebase project เดียวกับ Insider ได้
