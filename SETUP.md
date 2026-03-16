# 🏆 THE OWNER — Setup Guide (Updated)
**i am because we are**

---

## ✅ สิ่งที่ทำเสร็จแล้ว

| รายการ | สถานะ |
|---|---|
| GitHub: OadyTT/the-owner-app2 | ✅ |
| Vercel: the-owner-app2.vercel.app | ✅ |
| Google Sheet: TheOwner-Database | ✅ |
| Apps Script: TheOwner-App v3.0 | ✅ code.gs ใหม่วางแล้ว |
| LINE LIFF: TheOwnerLiff | ✅ LIFF ID: 2009199519-UViGDRf7 |
| LINE Messaging API: The Owner @pao8507i | ✅ Token ใส่ใน Sheet แล้ว |

---

## ⚠️ ยังต้องทำ (เรียงตามลำดับ)

### STEP 1 — Deploy GAS Version ใหม่

1. เปิด [script.google.com](https://script.google.com) → **TheOwner-App**
2. **Ctrl+A → Delete** → วางโค้ด code.gs ใหม่ → **Ctrl+S**
3. Dropdown เปลี่ยนเป็น **`testDeploy`** → กด **▶ Run**
4. ต้องขึ้น `✅ TheOwner GAS v3.0 — Working!`
5. **Deploy → Manage deployments → ✏️ Edit → New version → Deploy**
6. **Copy Web App URL**

---

### STEP 2 — ใส่ค่าจริงใน index.html

เปิด `D:\the-owner-app2\index.html` → **Ctrl+H**

```
Find:    YOUR_GOOGLE_APPS_SCRIPT_URL_HERE
Replace: [Web App URL จาก STEP 1]
```
```
Find:    YOUR_LIFF_ID_HERE
Replace: 2009199519-UViGDRf7
```

→ **Replace All → Save**

---

### STEP 3 — ใส่ค่าจริงใน admin.html

เปิด `D:\the-owner-app2\admin.html` → **Ctrl+H**

```
Find:    YOUR_GOOGLE_APPS_SCRIPT_URL_HERE
Replace: [Web App URL จาก STEP 1]
```
```
Find:    YOUR_GOOGLE_SHEET_ID_HERE
Replace: [Sheet ID จาก URL ของ Google Sheet]
```

> หา Sheet ID ใน URL:
> `https://docs.google.com/spreadsheets/d/` **`← ID อยู่ตรงนี้`** `/edit`

→ **Replace All → Save**

---

### STEP 4 — เปิด Use Webhook ใน LINE

1. [developers.line.biz](https://developers.line.biz) → **The Owner** → **Messaging API**
2. **Use webhook → Toggle ON** ✅

---

### STEP 5 — Push ขึ้น GitHub

```cmd
cd D:\the-owner-app2
git add .
git commit -m "fix: connect real GAS URL and LIFF ID"
git push origin main
```

---

### STEP 6 — ทดสอบ

1. เปิด `https://the-owner-app2.vercel.app/index.html`
2. กด **สมัครเรียนเลย** → กรอกข้อมูล + แนบ Slip → ส่ง
3. เปิด Google Sheet → Sheet **Registrations** → ต้องมีข้อมูลขึ้น ✅
4. เปิด `https://the-owner-app2.vercel.app/admin.html` → Login
5. เมนู **Approve Slip** → ต้องเห็นรายการ ✅

---

## 🔑 ข้อมูลสำคัญทั้งหมด

### LINE LIFF (TheOwnerLiff)
```
LIFF ID:   2009199519-UViGDRf7
LIFF URL:  https://liff.line.me/2009199519-UViGDRf7
Endpoint:  https://the-owner-app2.vercel.app/index.html
Scopes:    openid, profile
```

### LINE Messaging API (The Owner)
```
Bot ID:    @pao8507i
Token:     ใส่ใน Google Sheet > Settings > line_token แล้ว ✅
```

### Admin
```
URL:       https://the-owner-app2.vercel.app/admin.html
Username:  admin
Password:  admin1234
```

### Zoom Default
```
Meeting ID: 964 333 6086
Password:   12345
```

### ธนาคาร
```
Bangkok Bank — PromptPay
เลขบัญชี:  089-xxx-2626
ชื่อบัญชี: นาง สุพัตรา หงษ์วิเศษ
```

---

## ❌ Error ที่เห็น — ไม่ต้องกังวล

```
TypeError: Cannot read properties of undefined (reading 'firstName')
registerWithSlip @ Code.gs:352
```

**สาเหตุ:** กด Run `registerWithSlip` โดยตรงใน Apps Script
โดยไม่มีข้อมูล HTTP ส่งเข้ามา — ปกติมาก ไม่ใช่ bug

**ทดสอบที่ถูกต้อง:** รัน `testDeploy` แทน

---

## 🔄 Flow การทำงาน

```
สมาชิกเปิด index.html → สมัคร + Slip
    ↓
GAS registerWithSlip → บันทึกลง Registrations Sheet
    ↓
Admin เปิด admin.html → Approve Slip
    ↓
GAS สร้าง OwnP0001 / OwnT0001 → บันทึกลง Members Sheet
    ↓
ส่ง LINE Message → Member ID + Zoom Info
```

---

## 🚀 Push ไฟล์ครั้งต่อไป

```cmd
cd D:\the-owner-app2
git add .
git commit -m "update"
git push origin main
```
