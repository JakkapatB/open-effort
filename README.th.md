<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/icon.png" width="96" alt="open-effort">
</p>

<h1 align="center">open-effort</h1>

<p align="center">
  ให้ Claude ใช้ effort ให้เหมาะกับงาน ไม่ต้องคอยปรับเอง<br>
  mod สำหรับ Claude Code ที่เลือก effort ให้ตามงาน และเปลี่ยนไปใช้โมเดลที่เก่งกว่าเมื่อจำเป็นเท่านั้น
</p>

<p align="center">
  <a href="README.md">English</a> · <b>ภาษาไทย</b>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/band.png" width="760" alt="แถบเหนือช่องแชท แสดงผลที่ Haiku ประเมิน, effort ที่เพิ่มเป็น high บน Opus 5.5 และ sub-agent 3 ตัวที่กำลังทำงาน">
</p>

## ฟีเจอร์

- 🎯 **เลือก effort ให้อัตโนมัติ:** Haiku จะดูงานที่คุณสั่งก่อน งานง่ายใช้ `low` งานยากใช้ `xhigh`
- 📈 **งานติดก็เพิ่ม effort ให้เอง:** ถ้า test หรือ lint ไม่ผ่านติดกัน 3 ครั้ง จะเพิ่ม effort ขึ้นทีละระดับ ถ้าเพิ่มจนสุดแล้วยังไม่ผ่าน Claude จะถามคุณก่อนว่าจะเปลี่ยนไปใช้โมเดลที่เก่งกว่าหนึ่งขั้นไหม (Sonnet → Opus → Fable 5.1) และจะเปลี่ยนก็ต่อเมื่อคุณตกลง ถ้าถึงขั้นสุดท้ายแล้วยังไม่ผ่าน Claude จะหยุดทำ แล้วถามคุณว่าจะเอายังไงต่อ
- 🧠 **ถามก่อนเปลี่ยนโมเดล:** ถ้างานควรใช้โมเดลที่เก่งกว่าที่ใช้อยู่ Claude จะถามคุณก่อนว่าจะเปลี่ยนไหม
- 🗺️ **รองรับ Main Flow ของ Matt Pocock:** ตั้งแต่ grill จนถึง retro แต่ละขั้นตอนและแต่ละ ticket ใช้ effort ที่ต่างกันได้
- 👀 **เห็นตลอดว่าใช้อะไรอยู่:** แถบเหนือช่องแชทบอกว่าตอนนี้ใช้ effort และโมเดลอะไร เพราะอะไร ส่วน pane ด้านข้างไว้เปิดปิด เปลี่ยนธีม และดูประวัติ

## ผลที่วัดได้จริง

ทดสอบบน Opus 5.5 ที่ effort `high` ด้วยงานชุดเดียวกัน เปิดและปิด mod (โปรเจกต์ร้านค้าตัวอย่าง รวม 61 session)

| | ปิด mod | เปิด mod |
|---|---|---|
| ค่าใช้จ่าย งานเขียนโค้ด 5 งาน รันซ้ำ 2 รอบ | $5.65 | $5.00 (**−11%**) |
| ค่าใช้จ่าย งานชุดเดิมในรอบก่อนหน้า | $3.96 | $3.79 (**−4%**) |
| งานที่ผ่านการตรวจ | ผ่านครบ | ผ่านครบ |
| ค่าใช้จ่ายของ sub-agent แบบ Explore | $0.41 (Opus, `high`) | $0.09 (Haiku, `low`, **−78%**) |
| Main Flow: effort ของแต่ละขั้นตอนและแต่ละ ticket | — | ตรงตามที่กำหนดทุกขั้นตอนและทุก ticket |

แต่ละงานรันแค่ 1–2 ครั้ง ตัวเลขค่าใช้จ่ายจึงแกว่งได้ในแต่ละรอบ ส่วนการเพิ่ม effort ตอนงานติดยังวัดไม่ได้ เพราะทุกงานผ่านตั้งแต่ครั้งแรก
ทั้งตอนเปิดและปิด mod ค่าใช้จ่ายคำนวณจากจำนวน token ตามราคาปกติ

## ติดตั้ง

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/install-th.png" width="820" alt="ติดตั้งได้ 3 วิธี: คำสั่งเดียวใน shell, พิมพ์ /plugin ใน Claude Code ใน terminal หรือในแอป desktop ไปที่ Settings, Customize, Plugins, + Add, Add marketplace ใส่ JakkapatB/open-effort กด Sync แล้วไปที่แท็บ Discover กด Add to this computer และ Install for me">
</p>

เลือกวิธีใดวิธีหนึ่ง:

### 1. ใน shell

คำสั่งเดียว ต้องมีคำสั่ง `claude` (Claude Code แบบ command line) ใน shell ก่อน ถ้าติดตั้งแค่แอป desktop จะไม่มีคำสั่งนี้ ให้ใช้วิธีที่ 3 แทน

```bash
claude plugin marketplace add JakkapatB/open-effort && claude plugin install open-effort@open-effort
```

### 2. พิมพ์ในช่องแชทของ Claude Code ใน terminal

```
/plugin install open-effort --marketplace JakkapatB/open-effort
```

### 3. ในแอป desktop

1. **Settings** → **Customize** → **Plugins**
2. **+ Add** → **Add marketplace**
3. ใส่ `JakkapatB/open-effort` แล้วกด **Sync**
4. ไปที่แท็บ **Discover** หา **Open effort**
5. กด **Add to this computer** ▾ → **Install for me** เพื่อให้ใช้ได้ทุกโปรเจกต์

ในแอป desktop การพิมพ์ `/plugin install …` จะค้นหาแค่ใน plugin directory ของ Anthropic ซึ่งไม่มี open-effort

ไม่ต้องตั้งค่าเพิ่ม เปิด session ใหม่แล้วแถบจะขึ้นเหนือช่องแชทเอง

### อัปเดตให้เป็นรุ่นล่าสุด

Claude Code อัปเดต plugin ให้เองเฉพาะที่มาจาก marketplace ของ Anthropic และในแอป desktop ปิดการอัปเดตอัตโนมัติไว้ทุก marketplace open-effort จึงบอกคุณเอง: วันละครั้งจะเช็คว่ามีเวอร์ชันใหม่ไหม ถ้ามี ปุ่ม **≡** บนแถบจะขึ้นเป็น **≡ ●** และบนสุดของ pane จะมีปุ่ม **อัปเดตเลย** ซึ่งเรียกการอัปเดตของ Claude Code เอง เสร็จแล้วกด **Reload เลย** เพื่อใช้เวอร์ชันใหม่ใน session นี้ หรือเปิด session ใหม่ก็ได้ ถ้าเครื่องไหนอัปเดตจาก pane ไม่ได้ pane จะแสดงคำสั่งให้รันเองแทน หัวข้อ **อัปเดต** ใน pane มีปุ่ม **เช็คตอนนี้** และสวิตช์เปิดปิดการเช็ควันละครั้ง

**หรือเปิดอัปเดตอัตโนมัติของ Claude Code เอง (ทำครั้งเดียว ใช้ได้เฉพาะ terminal):** ใน Claude Code ใน terminal พิมพ์ `/plugin` เปิดแท็บ **Marketplaces** เลือก **open-effort** แล้วเลือก **Enable auto-update** หรือเพิ่มส่วนนี้ลงใน `~/.claude/settings.json` (ถ้ามี `extraKnownMarketplaces` อยู่แล้ว ให้ใส่ไว้ข้างในนั้น)

```json
"extraKnownMarketplaces": {
  "open-effort": {
    "source": { "source": "github", "repo": "JakkapatB/open-effort" },
    "autoUpdate": true
  }
}
```

หลังจากนั้น พอเปิด session ไปได้สักครู่ Claude Code จะดึงเวอร์ชันใหม่มาให้ถ้ามี และ session ถัดไปจะใช้เวอร์ชันนั้น

**หรืออัปเดตเอง:**

- **pane:** หัวข้อ **อัปเดต** → **เช็คตอนนี้** แล้วกด **อัปเดตเลย**
- **แอป desktop:** **Settings** → **Customize** → **Plugins** → **Open effort** → **Update** ถ้าปุ่มเป็นสีเทากดไม่ได้ ให้ใช้คำสั่งใน shell ด้านล่าง
- **shell:**

  ```bash
  claude plugin marketplace update open-effort && claude plugin update open-effort@open-effort
  ```

จากนั้นเปิด session ใหม่ ดูว่าแต่ละเวอร์ชันเปลี่ยนอะไรได้ที่ [CHANGELOG](CHANGELOG.md) และหน้า [Releases](https://github.com/JakkapatB/open-effort/releases) ถ้าอยากรู้ทันทีที่มีเวอร์ชันใหม่ ให้กด **Watch** → **Custom** → **Releases** บน GitHub

## ลองใช้

ลองพิมพ์คำสั่งเหล่านี้ในโปรเจกต์ของคุณ แล้วดูแถบเหนือช่องแชท Haiku ประเมินทุกครั้งใหม่ ผลที่ได้จึงอาจต่างจากตารางนี้ได้เล็กน้อย

| คุณพิมพ์ | แถบแสดง |
|---|---|
| `Rename getUser to fetchUser everywhere` | **Haiku อ่านแล้ว · แผนชัด** → **Effort `low`** |
| `Add a discount code field to checkout and check it on the server` | **รู้เป้าหมาย** → **Effort `medium`** |
| `Two orders can both take the last item in stock. Find the race and fix it` | **ยากพิเศษ** → **Effort `xhigh`** |
| `Add gift cards: a balance, an expiry date, paying part of an order, with tests` | Claude จะถามก่อนว่าจะทำผ่าน Main Flow ไหม (ต้องติดตั้ง skill ของ Matt Pocock ไว้) ถ้าตอบว่าใช่ แถบจะแสดงขั้นตอน **grill → spec → tickets → implement → review → retro** และแต่ละขั้นตอนใช้ effort ของตัวเอง |

เมื่อ test ไม่ผ่าน การ์ด effort จะขึ้นว่า **check ไม่ผ่าน 1/3** แล้วเป็น **2/3** พอไม่ผ่านครั้งที่ 3 ติดกัน effort จะเพิ่มขึ้นหนึ่งระดับ และการ์ดจะบอกว่าเพิ่มมาจากระดับไหน (**↑ จาก low**) พอ test ผ่าน effort จะกลับไปที่ระดับเดิม

## หลักการทำงาน

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/flow-th.png" width="900" alt="ภาพรวมทั้งหมด: ข้อความที่ต่องานเดิมใช้งานเดิมต่อ ส่วนงานใหม่ Haiku จะดูแล้วเลือก effort เริ่มต้น Claude ถามเรื่องโมเดลและ flow ก่อน (Main Flow ของ Matt หรือ flow ของโปรเจกต์จาก .claude/open-effort.json) แล้วเริ่มทำงาน test ผ่านกลับไป effort เริ่มต้น ไม่ผ่านติดกัน 3 ครั้งเพิ่มขึ้นหนึ่งระดับ เกิน xhigh Claude ถามก่อนเปลี่ยนไปใช้โมเดลที่เก่งกว่าหนึ่งขั้น (ขั้นสุดท้ายคือ Fable 5.1) และถ้ายังไม่ผ่านที่ max Claude หยุดทำแล้วถามคุณ พร้อม stage ของ flow (ค่าเริ่มต้นเป็นของ Matt), ticket, sub-agent และประวัติ">
</p>

### ลำดับการเพิ่ม effort

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/ladder-th.png" width="820" alt="low, medium, high, xhigh บนโมเดลของงาน แล้วถ้าคุณตกลง จะเปลี่ยนไปใช้โมเดลที่เก่งกว่าหนึ่งขั้นที่ high (Sonnet 5.5, Opus 5.5, Fable 5.1) บน Fable 5.1 ใช้ high, xhigh, max ถ้ายังไม่ผ่านอีก Claude จะหยุดทำ แล้วถามคุณ">
</p>

พอ test ผ่าน effort จะกลับไปที่ระดับเริ่มต้นของงานนั้น

ถ้า effort ขึ้นไปถึงระดับสูงสุดของโมเดลแล้ว งานจะไม่เปลี่ยนโมเดลเอง Claude จะหยุดแล้วถามคุณก่อนว่าจะเปลี่ยนไปใช้โมเดลที่เก่งกว่าหนึ่งขั้นไหม ซึ่งแพงกว่า ถ้าตอบตกลง งานจะย้ายไปใช้โมเดลนั้นที่ `high` จนจบงาน แล้วไต่ต่อจากตรงนั้น ถ้าไม่ตกลง จะใช้โมเดลเดิมต่อ และถ้า test ไม่ผ่านอีก 3 ครั้ง Claude จะหยุดทำ ส่วน sub-agent ที่ทำ ticket ถามคุณไม่ได้ จึงไต่ขึ้นได้ไม่เกิน Opus 5.5

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/states-th.png" width="760" alt="หน้าตาของแถบในแต่ละสถานะ: เลือก effort เริ่มต้น, test ไม่ผ่าน, เพิ่ม effort, เปลี่ยนไป Fable 5.1 และ Claude หยุดทำแล้วถามคุณ">
</p>

### effort เริ่มต้น

| Haiku ประเมินว่า | effort |
|---|---|
| รู้ชัดว่าต้องทำอะไรและทำยังไง (เช่น เปลี่ยนชื่อ, ทำตามแบบที่มีอยู่แล้ว) | `low` |
| รู้เป้าหมาย แต่ต้องคิดวิธีทำ | `medium` |
| ยังไม่รู้ชัดว่าจะทำยังไง | `high` |
| ยากเป็นพิเศษ (เช่น concurrency, ย้ายข้อมูล) | `xhigh` |
| มีความเสี่ยง หรือ Haiku ไม่มั่นใจ | ไม่ต่ำกว่า `medium` |

mod จะไม่เลือก `max` ให้เอง

### Main Flow ของ Matt Pocock

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/main-flow.png" width="760" alt="Main Flow อยู่ที่ขั้นตอน implement กำลังทำ ticket 03 ด้วย effort high">
</p>

| ขั้นตอน | grill | spec | tickets | implement | review | retro |
|---|---|---|---|---|---|---|
| effort | `high` | `high` | `medium` | `high` | `xhigh` | `medium` |

- Main Flow จะเริ่มเมื่อคุณเลือกตอนที่ Claude ถาม หรือเมื่อคุณพิมพ์คำสั่งของขั้นตอนนั้นเองเท่านั้น และจะจบเมื่อ Claude บอกว่าเสร็จแล้ว, เมื่อคุณปิด Main Flow หรือเมื่อคุณสั่งงานใหม่หลังขั้นตอน retro
- Claude จะย้ายไปขั้นตอนถัดไปด้วย tool `stage` ถ้า Claude ใช้ skill ของขั้นตอนอื่นเอง (เช่น รีวิวงานตัวเองระหว่าง implement) จะแค่ยก effort ขึ้น ไม่ย้ายขั้นตอน
- ถ้าเลือกทำตรงๆ งานก็ยังได้คุณภาพเท่ากัน เมื่อ Claude ใช้ skill ของ flow กับงานนั้น (เช่น code-review, tdd) effort จะไม่ต่ำกว่าระดับของขั้นตอนนั้น และถ้า Main Flow เปิดอยู่ งานจะเปลี่ยนไปใช้โมเดลของ Main Flow ไปจนจบงาน แถบจะแสดงว่า "skill ของ Matt · ทำตรงๆ"
- ถ้าคุณปฏิเสธ Main Flow หรือโมเดลที่เก่งกว่า จะไม่ถามซ้ำจนจบ session สำหรับงานที่ไม่ใหญ่กว่าเดิม หรือโมเดลที่ไม่เก่งกว่าเดิม
- ใน flow ถ้าไต่ขึ้นไปใช้โมเดลที่เก่งกว่า (รวมถึง Fable 5.1) จะใช้โมเดลนั้นจนจบ stage หรือ ticket นั้น
- Main Flow ใช้ **Opus 5.5** เป็นค่าเริ่มต้น เปลี่ยนเป็น **Fable 5.1** หรือใช้ **โมเดลเดียวกับ session** ได้ใน pane
- แต่ละ ticket กำหนด `Model:` และ `Effort:` ของตัวเองได้ ถ้าส่ง ticket ให้ sub-agent ทำ sub-agent จะใช้โมเดลและ effort ตามที่ ticket ระบุ
- ต้องติดตั้ง [skill ของ Matt Pocock](https://github.com/mattpocock/skills) ก่อน ถ้ายังไม่ครบ pane จะบอกว่าขาดตัวไหน

#### flow ของคุณเอง

แต่ละโปรเจกต์ใช้ flow ของตัวเองแทนของ Matt ได้ โดยเขียนไว้ใน `.claude/open-effort.json` ที่ root ของโปรเจกต์ หรือพิมพ์ `/open-effort flow` แล้ว Claude จะถามคุณเรื่อง flow และเขียนไฟล์ให้เมื่อคุณตกลง

```json
{
  "name": "Team flow",
  "stages": [
    { "name": "plan",   "skills": ["my-plan"],          "effort": "high" },
    { "name": "tasks",  "skills": ["my-tasks"],         "effort": "medium" },
    { "name": "build",  "skills": ["my-build", "tdd"],  "effort": "high" },
    { "name": "review", "skills": ["my-review"],        "effort": "xhigh" }
  ],
  "tickets": { "write": "tasks", "work": "build", "files": "docs/tasks/*.md" }
}
```

- **หนึ่งโปรเจกต์ หนึ่ง flow:** ถ้าไม่มีไฟล์ โปรเจกต์จะใช้ Main Flow ของ Matt Pocock ถ้ามีไฟล์ จะใช้ flow ในไฟล์แทน commit ไฟล์นี้ขึ้น Git แล้วคนในทีมจะได้ flow เดียวกัน
- **stage:** มี 2 ถึง 10 stage เรียงตามลำดับ ชื่อ stage ใช้ตัวเล็ก ตัวเลข หรือขีดกลาง ไม่เกิน 16 ตัวอักษร แต่ละ stage ระบุ skill ที่ใช้ ตามชื่อที่ขึ้นในรายการ skill ของ Claude Code (`my-skill` หรือ `plugin:my-skill` ถ้าต้องการเฉพาะของ plugin นั้น) และ effort ที่เริ่มต้น คือ `low`, `medium`, `high` หรือ `xhigh` skill หนึ่งตัวอยู่ได้ stage เดียว
- **ticket ไม่ใส่ก็ได้:** ถ้าใส่ ให้บอกว่า stage ไหนเขียน ticket, stage ไหนที่อยู่หลังกว่าเป็นคนทำ ticket และ glob ของไฟล์ ticket ซึ่งชื่อไฟล์ต้องขึ้นต้นด้วยเลข (`01-login.md`) จากนั้น ticket จะทำงานเหมือนใน Main Flow คือมี `Model:` และ `Effort:` อยู่บนสุดของแต่ละไฟล์
- **ทำงานเหมือน Main Flow:** ถ้างานใหญ่ Claude จะถามคุณก่อน หรือคุณพิมพ์คำสั่งของ stage เองก็ได้ Claude จะทำทีละ stage ตามลำดับ โดยใช้ skill ของแต่ละ stage ส่วนโมเดลของ flow ยังเลือกใน pane และใช้สวิตช์เดิม
- **ในไฟล์มีแต่ค่าตั้ง** ไม่มีคำสั่งให้ Claude
- **แก้ไฟล์แล้วมีผลตั้งแต่งานใหม่ถัดไป** flow ที่กำลังทำอยู่จะใช้ไฟล์เดิมจนจบ
- **ถ้าไฟล์ผิด** หรือมี stage ที่ไม่ได้ติดตั้ง skill ของ stage นั้นเลยสักตัว flow จะปิดอยู่ (skill ใน stage เดียวกันใช้แทนกันได้ มีตัวเดียวก็พอ) และ pane จะบอกว่าผิดตรงไหน ส่วนอื่นทำงานตามปกติ

#### sub-agent ใน Main Flow

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/sub-agents-th.png" width="820" alt="แต่ละขั้นตอนของ Main Flow เรียก sub-agent อะไร และแต่ละตัวได้โมเดลกับ effort มาจากไหน: implement ส่ง ticket ให้ sub-agent ทำตาม Model และ Effort ของ ticket, code-review ใช้ผู้รีวิว 2 ตัวที่ xhigh บนโมเดลของ Main Flow, นอกนั้น Explore ใช้ Haiku ที่ low, Plan ใช้โมเดลของงานที่ high, general-purpose ใช้โมเดลของงานกับ effort ของขั้นตอนนั้น และแบบที่คุณสร้างเองไม่ปรับ">
</p>

effort ของ sub-agent แบบ general-purpose จะเท่ากับ effort ของขั้นตอนที่มันทำงานอยู่ เช่น ผู้รีวิวของ code-review ใช้ `xhigh` เพราะขั้นตอน review ใช้ `xhigh`

ส่วนโมเดล sub-agent แบบ Plan และ general-purpose จะใช้โมเดลเดียวกับงาน ถ้าอยู่ใน Main Flow ก็จะใช้โมเดลของ Main Flow (ค่าเริ่มต้นคือ Opus 5.5) แม้ session จะเป็น Sonnet ส่วน Explore ใช้ Haiku เสมอ และ sub-agent ที่ได้รับ ticket จะใช้โมเดลตามที่ ticket ระบุ sub-agent ตัวใหม่จะเริ่มที่ระดับเริ่มต้นของงาน ไม่ใช่ระดับที่งานหลักไต่ขึ้นไปแล้ว

## โมเดลไหน effort ไหน ใช้ตอนไหน

| โมเดล | ใช้ตอนไหน |
|---|---|
| **โมเดลของ session** (ที่คุณเลือกด้วย `/model`) | ใช้กับทุกอย่าง ยกเว้นกรณีในแถวด้านล่าง |
| **โมเดลที่เก่งกว่า ตามที่ Haiku แนะนำ** | ใช้ทั้งงาน เฉพาะเมื่อคุณตอบตกลงตอนที่ Claude ถามก่อนเริ่มงาน |
| **Opus 5.5** | ใช้ตลอด Main Flow (เปลี่ยนได้ใน pane) และงานที่ทำตรงๆ หลังจาก Claude ใช้ skill ของ flow กับงานนั้น ถ้า session ใช้โมเดลที่เก่งกว่าอยู่แล้วจะใช้โมเดลเดิม |
| **โมเดลที่เก่งกว่าหนึ่งขั้น** (Sonnet → Opus → Fable 5.1) | เมื่อ test ไม่ผ่านซ้ำที่ effort สูงสุดของโมเดลที่ใช้อยู่ และคุณตอบตกลงตอนที่ Claude ถาม ใช้ไปจนจบงาน (ใน flow คือจนจบ stage หรือ ticket นั้น) |
| **Fable 5.1** | ขั้นถัดจาก Opus เมื่อคุณตอบตกลง, เมื่อคุณเลือกให้ Main Flow ใช้ และ ticket ที่ระบุ `Model: fable` |
| **Haiku** | ใช้ประเมินงานใหม่ทุกครั้ง และประเมิน ticket ที่ไม่ได้ระบุ `Model:` กับ `Effort:`, ใช้กับ sub-agent แบบ Explore และ ticket ที่ระบุ `Model: haiku` |
| **`Model:` ของ ticket** | ใช้กับ sub-agent ที่ได้รับ ticket นั้น ถ้า Claude ทำ ticket เอง จะใช้โมเดลของงานเหมือนเดิม |

| effort | ใช้ตอนไหน |
|---|---|
| `low` | รู้ชัดว่าต้องทำอะไรและทำยังไง, sub-agent แบบ Explore และตอนที่ Haiku ประเมินงาน |
| `medium` | รู้เป้าหมาย แต่ต้องคิดวิธีทำ, งานที่มีความเสี่ยงหรือ Haiku ไม่มั่นใจจะไม่ต่ำกว่านี้ และขั้นตอน tickets กับ retro |
| `high` | ยังไม่รู้ชัดว่าจะทำยังไง, ขั้นตอน grill, spec และ implement, sub-agent แบบ Plan และระดับแรกเมื่อไต่ขึ้นไปใช้โมเดลที่เก่งกว่า |
| `xhigh` | งานที่ยากเป็นพิเศษ, ขั้นตอน review และเป็นระดับสูงสุดที่ sub-agent เพิ่มขึ้นไปได้ (ถ้า sub-agent ทำ ticket อยู่ จะเปลี่ยนโมเดลขึ้นหนึ่งขั้นต่อ ได้ไม่เกิน Opus 5.5) |
| `max` | ใช้กับ Fable 5.1 หลังจาก `high` และ `xhigh` บน Fable 5.1 แล้วยังไม่ผ่าน, ใช้แทน `xhigh` กับ sub-agent บนโมเดลที่ไม่มี `xhigh` (Opus หรือ Sonnet 4.6) หรือเมื่อคุณตั้ง session เป็น `max` เอง mod จะไม่เลือก `max` ตั้งแต่เริ่มงาน |

ถ้า test ไม่ผ่านติดกัน 3 ครั้ง effort จะเพิ่มขึ้นหนึ่งระดับ พอ test ผ่าน effort จะกลับไปที่ระดับเริ่มต้นของงานนั้น ส่วน `Effort:` ของ ticket จะใช้แทน effort ของขั้นตอนนั้น เฉพาะตอนทำ ticket นั้น

## Pane

เปิดด้วยคำสั่ง `/open-effort` หรือกดปุ่ม **≡** บนแถบ

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/history.png" width="520" alt="กราฟประวัติ แสดง effort ตอนเริ่มและตอนที่เพิ่มขึ้นของแต่ละ turn และจำนวน turn แยกตามโมเดลกับ effort">
</p>

- **เปิด/ปิด** สำหรับโปรเจกต์นี้ (หรือพิมพ์ `/open-effort on` / `off`)
- **Flow:** บอกว่าโปรเจกต์ใช้ flow ไหน (Main Flow ของ Matt หรือไฟล์ของโปรเจกต์เอง) เปิด/ปิด และเลือกโมเดลที่จะใช้
- **ภาษา:** อัตโนมัติ, ไทย หรือ English
- **ธีมสี:** Claude, มะนาว, ฟ้า หรือ ชมพู
- **ประวัติ:** 500 turn ล่าสุดของโปรเจกต์

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/themes.png" width="640" alt="ธีมสี 4 แบบ: Claude, มะนาว, ฟ้า และ ชมพู">
</p>

<details>
<summary><b>รายละเอียดเพิ่มเติม</b></summary>

### งานหนึ่งใช้โมเดลเดียว

งานหนึ่งจะใช้โมเดลเดิมตั้งแต่ต้นจนจบ เพื่อไม่ให้ prompt cache หาย โมเดลจะเปลี่ยนแค่ 4 กรณี คือ คุณตกลงเปลี่ยนตอนเริ่มงาน, ตอนเริ่ม Main Flow, ตอนที่ Claude ใช้ skill ของ flow กับงานที่ทำตรงๆ และตอนที่ test ไม่ผ่านซ้ำที่ effort สูงสุดแล้วคุณตกลงให้เปลี่ยนไปใช้โมเดลที่เก่งกว่าหนึ่งขั้น และจะไม่เปลี่ยนไปใช้โมเดลที่ด้อยกว่าเอง ส่วนโมเดลที่เก่งกว่าที่เสนอไว้ จะเปลี่ยนได้ก็ต่อเมื่อ Claude ถามคุณแล้วเท่านั้น

### โมเดลกับ effort

โมเดลรุ่นปัจจุบันรองรับ effort ครบทั้ง 5 ระดับ ส่วน Opus และ Sonnet 4.6 ไม่มี `xhigh`, Opus 4.5 สูงสุดแค่ `high` และ Sonnet 4.5 กับ Haiku 4.5 ไม่รองรับ effort เลย ถ้าโมเดลไม่รองรับระดับไหน จะใช้ระดับที่ต่ำกว่าถัดลงมาแทน ถ้าโมเดลไม่รองรับ effort เลย จะไม่เพิ่ม effort ตอน test ไม่ผ่าน แต่ถ้างานย้ายไปใช้โมเดลอื่น (โมเดลของ Main Flow หรือโมเดลที่คุณตกลงเปลี่ยน) ก็ยังย้ายตามปกติ

### คำสั่งแบบไหนที่นับ

นับ test, typecheck, build และ lint (JavaScript/TypeScript, Python, Go, Rust, test ของ Node และ make) โดยนับเฉพาะเมื่อคำสั่งนั้นเป็นตัวตัดสินว่าทั้งบรรทัดผ่านหรือไม่ผ่าน คืออยู่ท้ายสุด หรือต่อด้วย `&&` เท่านั้น ถ้ามี `;` หรือ `||` ต่อท้าย, ส่งต่อด้วย `|` โดยไม่ได้ตั้ง `set -o pipefail`, มี `!` นำหน้า หรือรันเป็น background จะไม่นับ และถ้า test ไม่ผ่านครั้งแรกหลังจาก Claude เขียน test (ขั้น red ของ TDD) ก็จะไม่นับ

### ข้อมูลและความเป็นส่วนตัว

- ข้อมูลทั้งหมดเก็บไว้ในเครื่องคุณ ใน plugin store ของ Claude Code
- ประวัติไม่ได้เก็บข้อความที่คุณพิมพ์ เก็บแค่เวลา, effort, ผลประเมิน, จำนวนครั้ง และชื่อโมเดล
- **การเช็คอัปเดต:** วันละครั้งต่อเครื่อง และทุกครั้งที่คุณกด **เช็คตอนนี้** mod จะอ่านเลขเวอร์ชันล่าสุด โดยส่งคำขอ HTTPS หนึ่งครั้งผ่าน Claude Code ไปดึงไฟล์ `.claude-plugin/plugin.json` ของโปรเจกต์นี้จาก raw.githubusercontent.com ในคำขอไม่มีข้อมูลของคุณหรืองานของคุณ GitHub เห็นคำขอนี้เหมือนการเปิดหน้าเว็บทั่วไป ปิดการเช็ควันละครั้งได้ที่หัวข้อ **อัปเดต** ใน pane ส่วน **อัปเดตเลย** จะรันการอัปเดต plugin ของ Claude Code เอง (`claude plugin marketplace update open-effort` แล้ว `claude plugin update open-effort@open-effort`) และ **Reload เลย** จะรัน `/reload-plugins` ทั้งสองอย่างทำงานเฉพาะเมื่อคุณกดเท่านั้น
- **ส่งอะไรออกไป และส่งไปที่ไหน:** นอกจากการเช็คอัปเดต mod ไม่ได้ติดต่อ server ใดๆ เอง ส่งข้อความไปที่เดียวคือโมเดล Haiku ของ Claude ผ่านช่องทางเรียกโมเดลของ Claude Code เอง (`$.model.complete`) ด้วยบัญชีของคุณ เหมือน request อื่นๆ ของ Claude Code สิ่งที่ส่งมี
  - ข้อความงานใหม่ที่คุณพิมพ์ และ 800 ตัวอักษรท้ายสุดของข้อความล่าสุดของ Claude ตอนที่มีงานค้างอยู่ เพื่อประเมินว่างานยากแค่ไหน
  - เนื้อหาไฟล์ ticket ที่ไม่ได้ระบุ `Model:` และ `Effort:` เพื่อประเมินแบบเดียวกัน
- **ข้อความแนะนำถึง Claude:** mod เพิ่มข้อความสั้นๆ ให้ Claude ในแชท (`$.session.append` และ context แนบกับ prompt ของคุณ) เช่น ให้ถามคุณเรื่องโมเดลที่เก่งกว่าหรือ flow, วิธีเขียนโมเดลและ effort ใน ticket และเมื่อไรควรหยุดถามคุณ ข้อความเหล่านี้ส่งไปถึง Claude พร้อมบทสนทนา เหมือนข้อความของคุณ ส่วนคำสั่ง `/open-effort flow` จะส่ง prompt ของตัวเองหนึ่งข้อความให้ Claude (`$.prompt.submit`) เพื่อให้ช่วยเขียนไฟล์ flow โดยในข้อความมีชื่อ skill และคำสั่งที่คุณติดตั้งไว้
- อ่านไฟล์ 2 แบบ คือไฟล์ flow ของโปรเจกต์ (`.claude/open-effort.json`) ถ้ามี และไฟล์ ticket ใน stage ที่ทำ ticket (`<feature>/issues/NN-*.md` ใน Main Flow หรือที่ที่ไฟล์ flow ของคุณระบุ) mod ไม่เขียนไฟล์ใดๆ เอง ส่วน `/open-effort flow` ให้ Claude เป็นคนเขียนไฟล์ flow เมื่อคุณตกลง เหมือนที่ Claude เขียนไฟล์อื่นๆ
- เพิ่ม tool ของตัวเอง 3 ตัว คือ `stage`, `model` และ `report` และคำสั่ง `/open-effort`

### แต่ละ hook ทำอะไร

| Hook | ทำอะไร | เปลี่ยนอะไร |
|---|---|---|
| `turn.step` | ตั้ง effort ของ request ที่ส่งไปโมเดลแต่ละครั้ง และเปลี่ยนโมเดลเมื่องานย้ายไปใช้โมเดลอื่น | `effort` และ `model` ของ request |
| `tool.call` ที่ `Agent` | ตั้งโมเดลและ effort ของ sub-agent ตามประเภท หรือตาม ticket ที่ส่งให้ | `model` และ `effort` ของการเรียก เฉพาะเมื่อการเรียกไม่ได้ระบุเอง |
| `prompt.submit` | อ่านไฟล์ flow ของโปรเจกต์ทุกครั้งที่เริ่มงานใหม่ ให้ Haiku ประเมินงานใหม่ และแนบข้อความแนะนำเมื่อมีเรื่องต้องถามคุณ | แนบ context ไปกับ prompt โดยไม่แก้ข้อความที่คุณพิมพ์ |
| `tool.call` ที่ `Bash` | นับ test, lint, build และ typecheck ว่าผ่านหรือไม่ผ่าน | ไม่เปลี่ยนอะไร |
| `tool.call` ที่ `Read`, `Skill`, `Edit`, `Write` | สังเกตว่ามีการใช้ skill ของขั้นตอนไหน อ่าน ticket ไหน หรือเขียน test | ไม่เปลี่ยนอะไร |
| `tool.call` ที่ `mcp__open-effort__stage`, `__model`, `__report` | ตอบ tool 3 ตัวของ mod เอง | เป็น tool ของ mod เอง |
| `turn.start`, `turn.complete`, `session.start`, `session.end` | ติดตาม sub-agent ที่ทำงานอยู่ บันทึกประวัติของแต่ละ turn โหลดสวิตช์ของโปรเจกต์ และตอนเปิด session เช็คอัปเดตวันละครั้ง | ไม่เปลี่ยนอะไร |
| `command.run` ที่ `open-effort` | ตอบคำสั่ง `/open-effort` ของ mod เอง: เปิด pane, เปิดปิด mod หรือถ้าพิมพ์ `flow` จะส่ง prompt ให้ Claude ช่วยเขียนไฟล์ flow | เป็นคำสั่งของ mod เอง ส่วน `flow` จะเริ่ม turn ใหม่ของตัวเอง |
| `ui.render` | วาดแถบเหนือช่องแชทและ pane | เพิ่มแถบและ pane |

**คำสั่งอื่น:** เมื่อคุณกดชื่อ sub-agent บนแถบ mod จะเรียก `$.ui.view` เพื่อสลับหน้าจอของ Claude Code ไปแสดง transcript ของ sub-agent ตัวนั้น เหมือนกดจากรายการ task ของ Claude Code เอง คำสั่งนี้ไม่ได้ส่งข้อมูลออกไปไหน ส่วนในแอป desktop ไม่มีหน้าจอแบบนี้ ชื่อ sub-agent จึงเป็นข้อความธรรมดา และไม่มีการเรียกคำสั่งนี้

**plugin อื่นที่เกี่ยวข้อง:** Main Flow มาจาก plugin `mattpocock-skills` ของ Matt Pocock mod ดูรายการคำสั่งที่ติดตั้งไว้ว่ามี plugin นี้หรือไม่ และปรับ effort เมื่อ Claude ใช้ skill ของ plugin นี้ โดยไม่ได้เรียกโค้ดของ plugin นั้นเลย

### ข้อจำกัด

- API สำหรับ mod ของ Claude Code ยังใหม่อยู่ อาจมีการเปลี่ยนแปลง
- ถ้าเปลี่ยนโมเดลของงาน prompt cache ของงานนั้นจะต้องเริ่มใหม่
- ถ้า Haiku ตอบช้า ระหว่างรอ request จะใช้ effort ของ session บนโมเดลของงานไปก่อน
- คำสั่ง slash ที่พิมพ์ข้อความต่อท้าย (เช่น `/fix-typo the title`) จะนับเป็นงานใหม่ ส่วนคำสั่งที่ไม่มีข้อความต่อท้ายจะใช้งานเดิมต่อ
- session ที่ resume กลับมาจะเริ่มโดยไม่มีงานค้าง แต่ flow จะกลับมาเมื่อ Claude เรียก stage ของขั้นตอนที่ทำค้างไว้
- `/open-effort flow` จะส่ง prompt ให้ Claude หลังคำสั่งทำงานเสร็จครู่หนึ่ง เป็น turn ใหม่ของตัวเอง
- ถ้า Haiku ประเมินข้อความไม่ได้ (หมดเวลาหรือเกิดข้อผิดพลาด) ข้อความนั้นจะเริ่มเป็นงานใหม่ที่ effort ของ session แม้ว่าจะเป็นการตอบคำถามของ Claude ก็ตาม
- `Model:` และ `Effort:` ของ ticket ใช้ได้กับ ticket ที่เป็นไฟล์ในเครื่อง (`<feature>/issues/NN-*.md` หรือที่ที่ไฟล์ flow ของคุณระบุ) เท่านั้น ถ้าเก็บ ticket ไว้ใน GitHub หรือ Linear จะไม่มีผล
- ใน stage ที่ทำ ticket (implement ใน Main Flow) ทุกครั้งที่ Claude อ่านไฟล์ ticket mod จะถือว่า Claude กำลังจะทำ ticket นั้น และเปลี่ยน effort ตาม ticket
- ข้อความที่ mod ส่งให้ Claude เป็นแค่คำแนะนำ Claude อาจไม่ทำตามทุกครั้ง
- แอป desktop เปิด sub-agent จากแถบไม่ได้ แถบจึงแสดงรายชื่อ sub-agent เป็นข้อความธรรมดา ไม่ใช่ปุ่ม

</details>

<details>
<summary><b>สำหรับนักพัฒนา</b></summary>

```bash
claude plugin test .
claude plugin validate .
```

โครงสร้างโค้ดดูได้ที่ [README ภาษาอังกฤษ](README.md) พัฒนาและทดสอบบน Claude Code 2.1.308

</details>

## เครดิต

Main Flow และ skill เป็นผลงานของ [Matt Pocock](https://github.com/mattpocock/skills) (MIT) โปรเจกต์นี้ไม่ได้เกี่ยวข้องกับ Matt Pocock หรือ Anthropic

## License

[MIT](LICENSE)
