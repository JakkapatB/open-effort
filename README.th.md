<p align="center">
  <img src="docs/images/icon.png" width="96" alt="open-effort">
</p>

<h1 align="center">open-effort</h1>

<p align="center">
  ให้ Claude คิดหนักเท่าที่งานต้องการ ไม่มากไป ไม่น้อยไป<br>
  mod ของ Claude Code ที่ปรับ effort ให้พอดีกับงาน และเปลี่ยนไปใช้โมเดลที่เก่งกว่าเฉพาะตอนจำเป็น
</p>

<p align="center">
  <a href="README.md">English</a> · <b>ภาษาไทย</b>
</p>

<p align="center">
  <img src="docs/images/band.png" width="760" alt="แถบเหนือช่องพิมพ์: สิ่งที่ Haiku อ่าน, effort ที่ไต่ขึ้นเป็น high บน Opus 5.5 และ sub-agent 3 ตัวที่กำลังทำงาน">
</p>

## ทำอะไรได้

- 🎯 **effort พอดีกับงาน:** Haiku อ่านงานใหม่แต่ละครั้ง แผนชัดเริ่มที่ `low` งานยากเริ่มที่ `xhigh`
- 📈 **ไต่ขึ้นเมื่องานติด:** check ไม่ผ่าน 3 ครั้งติด effort จะขึ้นทีละขั้น จนไป Fable 5.1 แล้วถามคุณ
- 🧠 **เลือกโมเดล โดยถามคุณก่อน:** งานที่ต้องใช้โมเดลที่เก่งกว่า จะถามคุณครั้งเดียวก่อนเปลี่ยน
- 🗺️ **ใช้ Main Flow ของ Matt Pocock ได้:** ตั้งแต่ grill ถึง retro แต่ละขั้นและแต่ละ ticket มี effort ของตัวเอง
- 👀 **บอกเหตุผลให้เห็น:** มีแถบเหนือช่องพิมพ์ และ pane ที่มีสวิตช์ ธีมสี และประวัติ

## ติดตั้ง

**แอป desktop:** **+** ข้างช่องพิมพ์ → **Plugins** → **Add marketplace** → `JakkapatB/open-effort` → **Add plugin**

**terminal:**

```
/plugin install open-effort --marketplace JakkapatB/open-effort
```

ไม่ต้องตั้งค่าอะไร ติดตั้งเสร็จแถบขึ้นทันที

## ทำงานยังไง

<p align="center">
  <img src="docs/images/flow-th.png" width="760" alt="คุณพิมพ์งาน, Haiku อ่านงาน, Claude ถามเรื่องงานใหญ่หรือโมเดลที่เก่งกว่า, Claude ทำงานที่ effort เริ่มต้น และ check ไม่ผ่าน 3 ครั้งติดจะไต่ขึ้นหนึ่งขั้น">
</p>

### บันได effort

<p align="center">
  <img src="docs/images/ladder-th.png" width="640" alt="low, medium, high, xhigh แล้ว Fable 5.1 ที่ high, xhigh, max แล้ว Claude ถามคุณ">
</p>

check ผ่านเมื่อไหร่ effort กลับไปที่เดิม

<p align="center">
  <img src="docs/images/states-th.png" width="760" alt="แถบในแต่ละสถานะ: ได้คะแนน, check ไม่ผ่าน, ไต่ขึ้น, Fable 5.1 และหยุดที่สุดบันได">
</p>

### effort เริ่มต้น

| Haiku อ่านได้ว่า | effort |
|---|---|
| แผนชัด (เปลี่ยนชื่อ, ทำตามแบบที่รู้อยู่แล้ว) | `low` |
| รู้เป้าหมาย แต่ต้องคิดวิธี | `medium` |
| แผนยังไม่ชัด | `high` |
| ยากพิเศษ (concurrency, ย้ายข้อมูล) | `xhigh` |
| เสี่ยง หรือ Haiku ไม่แน่ใจ | อย่างน้อย `medium` |

mod ไม่เลือก `max` เอง

### Main Flow ของ Matt Pocock

<p align="center">
  <img src="docs/images/main-flow.png" width="760" alt="เส้น Main Flow ที่ stage implement กำลังทำ ticket 03 ที่ high">
</p>

| stage | grill | spec | tickets | implement | review | retro |
|---|---|---|---|---|---|---|
| effort | `high` | `high` | `medium` | `high` | `xhigh` | `medium` |

- flow ใช้ **Opus 5.5** เป็นค่าเริ่มต้น เปลี่ยนเป็น **Fable 5.1** หรือ **โมเดลของ session** ได้ใน pane
- แต่ละ ticket มี `Model:` และ `Effort:` ของตัวเอง sub-agent ที่ทำ ticket ใช้ทั้งสองค่า
- ต้องติดตั้ง [skill ของ Matt Pocock](https://github.com/mattpocock/skills) pane จะบอกว่าขาดตัวไหน

## pane

เปิดด้วย `/open-effort` หรือกด **≡** บนแถบ

<p align="center">
  <img src="docs/images/history.png" width="520" alt="กราฟประวัติ: effort ที่แต่ละ turn เริ่มและไต่ขึ้นไป และจำนวน turn แยกตามโมเดลกับ effort">
</p>

- **เปิดหรือปิด** ในโปรเจกต์นี้ (`/open-effort on|off` ได้ผลเหมือนกัน)
- **Main Flow:** เปิดหรือปิด และเลือกโมเดล
- **ภาษา:** อัตโนมัติ, ไทย หรือ English
- **ธีมสี:** Claude, มะนาว, ฟ้า หรือชมพู
- **ประวัติ:** 500 turn ล่าสุดของโปรเจกต์

<p align="center">
  <img src="docs/images/themes.png" width="640" alt="4 ธีม: Claude, Lime, Ocean และ Rose">
</p>

<details>
<summary><b>รายละเอียดเพิ่มเติม</b></summary>

### หนึ่งงาน หนึ่งโมเดล

งานหนึ่งใช้โมเดลเดียวตั้งแต่ต้นจนจบ เพื่อให้ prompt cache ไม่เสีย โมเดลเปลี่ยนเฉพาะตอนคุณตกลงใช้โมเดลที่เก่งกว่าตอนเริ่มงาน, ตอนเข้า Main Flow หรือตอนไต่เกิน `xhigh` ไป Fable 5.1 และไม่ลดลงเอง

### โมเดลกับ effort

โมเดลรุ่นปัจจุบันรองรับ effort ครบ 5 ระดับ Opus และ Sonnet 4.6 ไม่มี `xhigh`, Opus 4.5 สูงสุดที่ `high` ส่วน Sonnet 4.5 และ Haiku 4.5 ไม่รองรับ effort ระดับที่โมเดลไม่รองรับจะใช้ระดับรองลงมาแทน

### อะไรนับเป็น check

test, typecheck, build และ lint (JavaScript/TypeScript, Python, Go, Rust, test runner ของ Node, make) นับเฉพาะเมื่อผลของ check คือผลของทั้งคำสั่ง ไม่นับเมื่อต่อด้วย `;` หรือ `||`, ส่งต่อผ่าน `|` โดยไม่มี `set -o pipefail` หรือรันเบื้องหลัง

### sub-agent

| sub-agent | โมเดล · effort |
|---|---|
| Explore | Haiku · `low` |
| Plan | โมเดลของ session · `high` |
| general-purpose | โมเดลของ session · effort เท่างานหลัก |
| แบบที่คุณสร้างเอง | ไม่แตะ |

### ข้อมูลและความเป็นส่วนตัว

- ทุกอย่างเก็บใน plugin store ของ Claude Code ในเครื่องคุณ
- ประวัติไม่เก็บข้อความที่คุณพิมพ์ เก็บแค่เวลา, effort, ผลการอ่าน, จำนวนครั้ง และชื่อโมเดล
- mod ไม่เรียกเครือข่ายเอง เรียกโมเดลอย่างเดียวคือให้ Haiku อ่านงานใหม่ (พร้อมท้ายข้อความล่าสุดของ Claude เมื่อมีงานค้าง) หรืออ่าน ticket ที่ไม่มีบรรทัด `Model:` และ `Effort:` ผ่าน Claude Code
- อ่านไฟล์เฉพาะ ticket (`<feature>/issues/NN-*.md`) ใน stage implement และไม่เขียนไฟล์ใดๆ
- เพิ่มข้อความถึง Claude ในบทสนทนา และลงทะเบียน tool 3 ตัว คือ `stage`, `model` และ `report`

### ข้อจำกัด

- API ของ mod ยังใหม่ใน Claude Code และอาจเปลี่ยนได้
- เปลี่ยนโมเดลของงาน ทำให้ prompt cache ของงานนั้นเริ่มใหม่
- ถ้า Haiku อ่านช้า คะแนนจะมาระหว่าง turn request แรกๆ จึงใช้ effort ของ session
- ข้อความที่ส่งถึง Claude เป็นคำแนะนำ mod ไม่ได้บังคับ

</details>

<details>
<summary><b>สำหรับนักพัฒนา</b></summary>

```bash
claude plugin test .
claude plugin validate .
```

ดูตารางโครงสร้างโค้ดได้ใน [README ภาษาอังกฤษ](README.md) พัฒนาและทดสอบบน Claude Code 2.1.308

</details>

## เครดิต

Main Flow และ skill เป็นของ [Matt Pocock](https://github.com/mattpocock/skills) (MIT) open-effort ไม่ได้เกี่ยวข้องกับ Matt Pocock หรือ Anthropic

## ไลเซนส์

[MIT](LICENSE)
