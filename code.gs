/**
 * THE OWNER — Google Apps Script Backend v4.0
 * SETUP: Run setupAllSheets() once
 * DEPLOY: Deploy > Web App > Anyone > Deploy
 */

const SHEET = {
  MEMBERS:'Members', REGISTRATIONS:'Registrations', CLASSES:'Classes',
  BOOKINGS:'Bookings', CHECKINS:'CheckIns', FINES:'Fines',
  ADMINS:'Admins', SETTINGS:'Settings', ROOM_QR:'RoomQR',
};

// ── ENTRY POINTS ──────────────────────────────────
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function testDeploy() {
  Logger.log('✅ TheOwner GAS v4.0 — Working!');
  return { success:true, message:'GAS v4.0 working!' };
}

function handleRequest(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    if (!e) { out.setContent(JSON.stringify(err('No request'))); return out; }
    let p = {};
    if (e.postData?.contents) p = JSON.parse(e.postData.contents);
    else if (e.parameter) p = { ...e.parameter };
    out.setContent(JSON.stringify(route(p)));
  } catch(ex) {
    Logger.log('ERROR: '+ex.message);
    out.setContent(JSON.stringify(err('Server error: '+ex.message)));
  }
  return out;
}

function route(p) {
  const a = (p.action||'').trim();
  const map = {
    // Public
    registerWithSlip: ()=>registerWithSlip(p),
    lineLogin:        ()=>lineLogin(p),
    login:            ()=>loginMember(p),
    getClasses:       ()=>getClasses(),
    checkinByRoomQR:  ()=>checkinByRoomQR(p),
    getSettings:      ()=>getSettingsPublic(),
    // Member
    booking:          ()=>createBooking(p),
    cancelBooking:    ()=>cancelBooking(p),
    getMemberBookings:()=>getMemberBookings(p),
    updateProfile:    ()=>updateProfile(p),
    getMemberHistory: ()=>getMemberHistory(p),
    // Admin
    adminLogin:           ()=>adminLogin(p),
    getStats:             ()=>getStats(),
    getPendingApprovals:  ()=>getPendingApprovals(),
    approveRegistration:  ()=>approveRegistration(p),
    getMembers:           ()=>getMembers(),
    addMember:            ()=>addMemberByAdmin(p),
    updateMember:         ()=>updateMember(p),
    deleteMember:         ()=>deleteMember(p),
    searchMembers:        ()=>searchMembers(p),
    getBookings:          ()=>getBookings(p),
    updateBooking:        ()=>updateBooking(p),
    checkin:              ()=>processCheckin(p),
    getCheckins:          ()=>getCheckins(p),
    getFines:             ()=>getFines(p),
    addFine:              ()=>addFine(p),
    updateFine:           ()=>updateFine(p),
    payFine:              ()=>markFinePaid(p),
    getReports:           ()=>getReports(p),
    addAdmin:             ()=>addAdmin(p),
    getAdmins:            ()=>getAdmins(),
    deleteAdmin:          ()=>deleteAdmin(p),
    addClass:             ()=>addClass(p),
    updateClass:          ()=>updateClass(p),
    deleteClass:          ()=>deleteClass(p),
    saveClassImage:       ()=>saveClassImage(p),
    generateRoomQR:       ()=>generateRoomQR(p),
    getRoomQRs:           ()=>getRoomQRs(),
    saveSettings:         ()=>saveSettings(p),
    getSettingsAll:       ()=>getSettingsAll(),
    setupSheets:          ()=>setupAllSheets(),
    migrateClasses:       ()=>migrateClassesSheet(),
    sendClassReminders:   ()=>sendClassReminders(),
  };
  return map[a] ? map[a]() : err('Unknown action: '+a);
}

// ── SHEET HELPERS ─────────────────────────────────
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function getSheet(name) {
  let s = ss().getSheetByName(name);
  if (!s) { s = ss().insertSheet(name); initHeaders(s, name); }
  return s;
}
function rows(sheet) {
  const d = sheet.getDataRange().getValues();
  if (d.length < 2) return [];
  const h = d[0].map(x=>String(x).trim());
  return d.slice(1).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]??'');return o;});
}
function findRow(sheet, col, val) {
  const d = sheet.getDataRange().getValues();
  for (let i=1;i<d.length;i++) if(String(d[i][col])===String(val)) return i+1;
  return -1;
}
function setCell(sheet, row, colName, val) {
  const h = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const i = h.indexOf(colName);
  if (i>=0) sheet.getRange(row, i+1).setValue(val);
}
function genId(prefix) {
  return prefix+'-'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMddHHmmss')+
    Math.floor(Math.random()*100).toString().padStart(2,'0');
}
function nowISO() { return new Date().toISOString(); }
function todayStr() { return Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd'); }
function hashPw(pw) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw)
    .map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');
}
function getSetting(key) {
  const r = rows(getSheet(SHEET.SETTINGS)).find(x=>x.Key===key);
  return r ? String(r.Value) : null;
}
function ok(d)  { return {success:true,...d}; }
function err(m) { return {success:false, message:m}; }

// ── SETUP ─────────────────────────────────────────
function setupAllSheets() {
  Object.values(SHEET).forEach(n=>getSheet(n));
  return ok({message:'All sheets ready!'});
}

// Migrate: เพิ่มคอลัม ImageUrl + Description ให้ Classes sheet ที่มีอยู่แล้ว
function migrateClassesSheet() {
  const sheet = getSheet(SHEET.CLASSES);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const results = [];
  ['ImageUrl','Description'].forEach(col => {
    if (!headers.includes(col)) {
      const c = sheet.getLastColumn() + 1;
      // ย้าย CreatedAt ไปท้ายสุดโดย insert before
      sheet.insertColumnBefore(headers.indexOf('CreatedAt') >= 0 ? headers.indexOf('CreatedAt') + 1 : c);
      const insertCol = headers.indexOf('CreatedAt') >= 0 ? headers.indexOf('CreatedAt') + 1 : c;
      sheet.getRange(1, insertCol).setValue(col).setBackground('#1400FF').setFontColor('#FFF').setFontWeight('bold');
      results.push('เพิ่ม ' + col);
    } else { results.push(col + ' มีอยู่แล้ว'); }
  });
  return ok({ message: results.join(', ') });
}

function initHeaders(sheet, name) {
  const defs = {
    Members:       {cols:['ID','FirstName','LastName','Email','Phone','LineId','Password','Plan','Status','StartDate','ExpiryDate','TotalSessions','PendingFines','CreatedAt'],bg:'#1400FF'},
    Registrations: {cols:['ID','FirstName','LastName','Email','Phone','LineId','LineDisplayName','Plan','Amount','SlipUrl','Status','AdminNote','CreatedAt','ApprovedAt','MemberId'],bg:'#1400FF'},
    Classes:       {cols:['ID','Name','Day','Time','Type','MaxSeats','BookedSeats','Status','ZoomLink','ImageUrl','Description','CreatedAt'],bg:'#1400FF'},
    Bookings:      {cols:['ID','MemberID','MemberName','ClassID','ClassName','ClassDay','ClassTime','Type','Status','CheckedIn','BookedAt'],bg:'#1400FF'},
    CheckIns:      {cols:['ID','MemberID','MemberName','ClassID','ClassName','CheckInTime','Method','AdminID'],bg:'#1400FF'},
    Fines:         {cols:['ID','MemberID','MemberName','ClassID','ClassName','Date','Amount','Type','Reason','Status','PaidDate'],bg:'#EF4444'},
    Admins:        {cols:['Username','Password','Name','Role','CreatedAt'],bg:'#EF4444'},
    Settings:      {cols:['Key','Value','Description'],bg:'#10B981'},
    RoomQR:        {cols:['ID','ClassID','ClassName','QRToken','CreatedAt','ExpiresAt','Active'],bg:'#1400FF'},
  };
  const def = defs[name]; if(!def) return;
  sheet.appendRow(def.cols);
  sheet.getRange(1,1,1,def.cols.length).setFontWeight('bold').setBackground(def.bg).setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  // Seed defaults
  if (name==='Admins')   sheet.appendRow(['admin',hashPw('admin1234'),'Super Admin','super',nowISO()]);
  if (name==='Settings') {
    [['zoom_id','964 333 6086','Zoom Meeting ID'],
     ['zoom_pw','12345','Zoom Password'],
     ['bank_acc','014-7-128268','เลขบัญชีธนาคาร'],
     ['bank_owner','สุพัตรา หงษ์วิเศษ','ชื่อบัญชี'],
     ['bank_name','ธนาคารกรุงเทพ','ชื่อธนาคาร'],
     ['fine_online','20','ค่าปรับ Online'],
     ['fine_onsite','50','ค่าปรับ Onsite'],
     ['fine_hybrid','100','ค่าปรับ Hybrid'],
     ['cancel_hours','2','ยกเลิกล่วงหน้า(ชม.)'],
     ['line_token','','LINE Messaging Token'],
     ['site_url','https://the-owner-app2.vercel.app','Site URL'],
    ].forEach(r=>sheet.appendRow(r));
  }
  if (name==='Classes') {
    [['Product Growth 101','จันทร์','09:00-11:00','hybrid',12],
     ['Business Growth 101','อังคาร','19:00-21:00','online',30],
     ['Health Buddy Growth 101','พุธ','09:00-12:00','onsite',10],
     ['Digital Growth 101','พฤหัสบดี','19:00-21:00','online',50],
    ].forEach(([n,d,t,tp,s])=>sheet.appendRow([genId('CLS'),n,d,t,tp,s,0,'active','','','',nowISO()]));
  }
}

// ── AUTH MEMBER ───────────────────────────────────
function loginMember(p) {
  if(!p.email) return err('กรุณาใส่อีเมล');
  const m = rows(getSheet(SHEET.MEMBERS)).find(x=>x.Email===p.email && ['active','Active',''].includes(String(x.Status).trim().toLowerCase()));
  if(!m) return err('ไม่พบสมาชิก');
  return ok({user:sanitizeMember(m)});
}
function lineLogin(p) {
  if(!p.lineUserId) return err('ไม่มี LINE User ID');
  const m = rows(getSheet(SHEET.MEMBERS)).find(x=>x.LineId===p.lineUserId && ['active','Active',''].includes(String(x.Status).trim().toLowerCase()));
  if(!m) return {success:false, needRegister:true, displayName:p.displayName};
  return ok({user:sanitizeMember(m)});
}
function sanitizeMember(m) {
  // normalize plan to lowercase
  const plan = String(m.Plan||'trial').trim().toLowerCase();
  return {
    memberId:m.ID, firstName:m.FirstName, lastName:m.LastName,
    email:m.Email,
    phone:String(m.Phone||'').replace(/^'/,''),
    lineId:m.LineId,
    plan, // always lowercase: 'quarter' or 'trial'
    status:m.Status,
    expiry:m.ExpiryDate||'',
    sessions:Number(m.TotalSessions)||0, fines:Number(m.PendingFines)||0,
  };
}

// ── AUTH ADMIN ────────────────────────────────────
function adminLogin(p) {
  if(!p.username||!p.password) return err('กรอก Username และ Password');
  const a = rows(getSheet(SHEET.ADMINS)).find(x=>x.Username===p.username&&x.Password===hashPw(p.password));
  if(!a) return err('Username หรือ Password ไม่ถูกต้อง');
  return ok({admin:{username:a.Username, name:a.Name, role:a.Role}});
}
function addAdmin(p) {
  if(!p.username||!p.password) return err('ข้อมูลไม่ครบ');
  const sheet=getSheet(SHEET.ADMINS);
  if(rows(sheet).find(a=>a.Username===p.username)) return err('Username นี้มีอยู่แล้ว');
  sheet.appendRow([p.username,hashPw(p.password),p.name||p.username,p.role||'staff',nowISO()]);
  return ok({});
}
function getAdmins() {
  return ok({admins:rows(getSheet(SHEET.ADMINS)).map(a=>({username:a.Username,name:a.Name,role:a.Role,createdAt:a.CreatedAt}))});
}
function deleteAdmin(p) {
  if(p.username==='admin') return err('ไม่สามารถลบ super admin หลักได้');
  const sheet=getSheet(SHEET.ADMINS);
  const row=findRow(sheet,0,p.username);
  if(row<0) return err('ไม่พบ Admin');
  sheet.deleteRow(row);
  return ok({});
}

// ── REGISTER WITH SLIP ────────────────────────────
function registerWithSlip(p) {
  const req=['firstName','email','phone','plan'];
  for(const f of req) if(!p[f]) return err('กรุณากรอก: '+f);
  const regSheet=getSheet(SHEET.REGISTRATIONS);
  const dup=rows(regSheet).find(r=>r.Status==='waiting'&&(r.Email===p.email||(p.lineId&&r.LineId===p.lineId)));
  if(dup) return err('มีคำขอรอ Approve อยู่แล้ว');
  let slipUrl='';
  if(p.slipBase64) slipUrl=saveSlipToDrive(p.slipBase64, p.slipName||'slip.jpg', genId('SLIP'));
  const id=genId('REG');
  const ph=p.phone?"'"+String(p.phone).replace(/[^0-9\-]/g,''):'';
  regSheet.appendRow([id,p.firstName,p.lastName||'',p.email,ph,
    p.lineId||'',p.lineDisplayName||'',p.plan,
    p.amount||(p.plan==='quarter'?600:150),slipUrl,
    'waiting','',nowISO(),'','']);
  return ok({registrationId:id, message:'ส่งข้อมูลสำเร็จ รอ Admin Approve'});
}

function saveSlipToDrive(base64, filename, id) {
  try {
    const folder=getOrCreateFolder('TheOwner-Slips');
    const blob=Utilities.newBlob(Utilities.base64Decode(base64),'image/jpeg',id+'_'+filename);
    const file=folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/thumbnail?id='+file.getId()+'&sz=w800';
  } catch(e){ Logger.log('Drive: '+e.message); return ''; }
}
function getOrCreateFolder(name) {
  const f=DriveApp.getFoldersByName(name);
  return f.hasNext()?f.next():DriveApp.createFolder(name);
}

// อัปโหลดรูปคลาสไปยัง My Drive/Projects The Owner/Pics
function saveClassImage(p) {
  if (!p.imageBase64 || !p.imageName) return err('ไม่มีข้อมูลรูป');
  try {
    // หาโฟลเดอร์ Projects The Owner ก่อน
    let projectFolder;
    const projectFolders = DriveApp.getFoldersByName('Projects The Owner');
    if (projectFolders.hasNext()) {
      projectFolder = projectFolders.next();
    } else {
      projectFolder = DriveApp.createFolder('Projects The Owner');
    }
    // หา Pics folder ข้างใน
    let picsFolder;
    const picsFolders = projectFolder.getFoldersByName('Pics');
    if (picsFolders.hasNext()) {
      picsFolder = picsFolders.next();
    } else {
      picsFolder = projectFolder.createFolder('Pics');
    }
    // ตรวจ mime type
    const ext = String(p.imageName).split('.').pop().toLowerCase();
    const mimeMap = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp'};
    const mime = mimeMap[ext] || 'image/jpeg';
    // สร้างไฟล์
    const decoded = Utilities.base64Decode(p.imageBase64);
    const blob = Utilities.newBlob(decoded, mime, p.imageName);
    const file = picsFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';
    return ok({ url, fileId, message: 'อัปโหลดรูปสำเร็จ' });
  } catch(e) {
    Logger.log('saveClassImage error: ' + e.message);
    return err('อัปโหลดรูปไม่สำเร็จ: ' + e.message);
  }
}

// ── PENDING APPROVALS ─────────────────────────────
function getPendingApprovals() {
  return ok({pending:rows(getSheet(SHEET.REGISTRATIONS)).map(r=>({
    id:r.ID, firstName:r.FirstName, lastName:r.LastName,
    email:r.Email, phone:String(r.Phone).replace(/^'/,''),
    lineId:r.LineId, lineDisplayName:r.LineDisplayName,
    plan:r.Plan, amount:r.Amount, slipUrl:r.SlipUrl,
    status:r.Status||'waiting', adminNote:r.AdminNote,
    createdAt:r.CreatedAt, memberId:r.MemberId,
  }))});
}

function approveRegistration(p) {
  if(!p.registrationId||!p.status) return err('ข้อมูลไม่ครบ');
  const regSheet=getSheet(SHEET.REGISTRATIONS);
  const regs=rows(regSheet);
  const idx=regs.findIndex(r=>r.ID===p.registrationId);
  if(idx<0) return err('ไม่พบรายการ');
  const rowNum=idx+2;
  const reg=regs[idx];
  setCell(regSheet,rowNum,'Status',p.status);
  setCell(regSheet,rowNum,'AdminNote',p.note||'');
  setCell(regSheet,rowNum,'ApprovedAt',nowISO());
  if(p.status==='approved') {
    const memberId=generateMemberId(reg.Plan);
    setCell(regSheet,rowNum,'MemberId',memberId);
    const ph=reg.Phone?"'"+String(reg.Phone).replace(/^'/,''):reg.Phone;
    getSheet(SHEET.MEMBERS).appendRow([memberId,reg.FirstName,reg.LastName,
      reg.Email,ph,reg.LineId,'',reg.Plan,'active','','',0,0,nowISO()]);
    if(reg.LineId) sendApproveMsg(reg.LineId,reg.FirstName,memberId,reg.Plan);
    return ok({memberId, message:'Approve สำเร็จ Member ID: '+memberId});
  }
  if(p.status==='rejected') {
    if(reg.LineId) sendRejectMsg(reg.LineId,reg.FirstName,p.note||'');
    return ok({message:'Rejected แล้ว'});
  }
  return ok({});
}

function generateMemberId(plan) {
  const isQuarter = String(plan||'').trim().toLowerCase() === 'quarter';
  const prefix = isQuarter ? 'OwnP' : 'OwnT';
  let max=0;
  rows(getSheet(SHEET.MEMBERS)).forEach(m=>{
    if(String(m.ID).startsWith(prefix)){const n=parseInt(String(m.ID).replace(prefix,''),10);if(!isNaN(n)&&n>max)max=n;}
  });
  rows(getSheet(SHEET.REGISTRATIONS)).forEach(r=>{
    if(String(r.MemberId).startsWith(prefix)){const n=parseInt(String(r.MemberId).replace(prefix,''),10);if(!isNaN(n)&&n>max)max=n;}
  });
  return prefix+String(max+1).padStart(4,'0');
}

// ── MEMBERS CRUD ──────────────────────────────────
function getMembers() {
  return ok({members:rows(getSheet(SHEET.MEMBERS)).filter(m=>String(m.Status).toLowerCase()!=='deleted').map(sanitizeMember)});
}
function addMemberByAdmin(p) {
  const sheet=getSheet(SHEET.MEMBERS);
  if(rows(sheet).find(m=>m.Email===p.email)) return err('อีเมลนี้มีอยู่แล้ว');
  const id=generateMemberId(p.plan||'trial');
  const ph=p.phone?"'"+String(p.phone).replace(/[^0-9\-]/g,''):'';
  sheet.appendRow([id,p.firstName,p.lastName||'',p.email,ph,p.lineId||'','',p.plan||'trial','active','','',0,0,nowISO()]);
  return ok({memberId:id});
}
function updateMember(p) {
  const sheet=getSheet(SHEET.MEMBERS);
  const row=findRow(sheet,0,p.id);
  if(row<0) return err('ไม่พบสมาชิก');
  const fields={FirstName:p.firstName,LastName:p.lastName,Email:p.email,Phone:p.phone,Plan:p.plan,Status:p.status,ExpiryDate:p.expiryDate};
  Object.entries(fields).forEach(([k,v])=>{if(v!==undefined)setCell(sheet,row,k,v);});
  return ok({});
}
function deleteMember(p) {
  const sheet=getSheet(SHEET.MEMBERS);
  const row=findRow(sheet,0,p.id);
  if(row<0) return err('ไม่พบสมาชิก');
  setCell(sheet,row,'Status','deleted');
  return ok({});
}
function searchMembers(p) {
  const q=(p.query||'').toLowerCase();
  return ok({members:rows(getSheet(SHEET.MEMBERS))
    .filter(m=>String(m.Status).toLowerCase()!=='deleted')
    .filter(m=>[m.FirstName,m.LastName,m.Email,m.ID,m.Phone].join(' ').toLowerCase().includes(q))
    .map(m=>({id:m.ID,name:m.FirstName+' '+m.LastName,plan:m.Plan,email:m.Email}))});
}
function updateProfile(p) {
  const sheet=getSheet(SHEET.MEMBERS);
  const row=findRow(sheet,0,p.memberId);
  if(row<0) return err('ไม่พบสมาชิก');
  if(p.firstName) setCell(sheet,row,'FirstName',p.firstName);
  if(p.lastName)  setCell(sheet,row,'LastName',p.lastName);
  if(p.phone)     setCell(sheet,row,'Phone',p.phone);
  return ok({});
}

// ── CLASSES ───────────────────────────────────────
function getClasses() {
  return ok({classes:rows(getSheet(SHEET.CLASSES))
    .filter(c=>['active','Active',''].includes(String(c.Status).trim().toLowerCase()))
    .map(c=>({
      id:c.ID, name:c.Name, day:c.Day, time:c.Time, type:c.Type,
      maxSeats:Number(c.MaxSeats)||0, bookedSeats:Number(c.BookedSeats)||0,
      zoomLink:c.ZoomLink||'', zoomId:c.ZoomId||'', zoomPw:c.ZoomPw||'',
      imageUrl:c.ImageUrl||'', description:c.Description||'',
    }))});
}

// Helper to clean phone — keep digits and dashes, preserve leading 0
function cleanPhone(ph) {
  if(!ph) return '';
  const s = String(ph).replace(/^'/,''); // strip apostrophe
  return s;
}
function makeClassId(name) {
  const words = String(name).trim().split(/\s+/);
  let letters = '', nums = '';
  words.forEach(w => {
    if (/^\d/.test(w)) nums += w;
    else if (/[A-Za-z]/.test(w)) letters += w.charAt(0).toUpperCase();
  });
  const abbr = (letters + nums).slice(0, 6) || 'CLS';
  const d = Utilities.formatDate(new Date(),'Asia/Bangkok','ddMMyyyy');
  return abbr + '-' + d;
}

function addClass(p) {
  const id = makeClassId(p.name || 'CLS');
  getSheet(SHEET.CLASSES).appendRow([id,p.name,p.day,p.time,p.type||'onsite',
    p.maxSeats||10,0,'active',p.zoomLink||'',p.imageUrl||'',p.description||'',nowISO()]);
  return ok({id});
}
function updateClass(p) {
  const sheet=getSheet(SHEET.CLASSES);
  const row=findRow(sheet,0,p.id);
  if(row<0) return err('ไม่พบคลาส');
  const fields={Name:p.name,Day:p.day,Time:p.time,Type:p.type,MaxSeats:p.maxSeats,
    Status:p.status,ZoomLink:p.zoomLink,ImageUrl:p.imageUrl,Description:p.description};
  Object.entries(fields).forEach(([k,v])=>{if(v!==undefined&&v!=='')setCell(sheet,row,k,v);});
  return ok({});
}
function deleteClass(p) {
  const sheet=getSheet(SHEET.CLASSES);
  const row=findRow(sheet,0,p.id);
  if(row<0) return err('ไม่พบคลาส');
  setCell(sheet,row,'Status','deleted');
  return ok({});
}

// ── BOOKINGS ──────────────────────────────────────
function createBooking(p) {
  if(!p.memberId||!p.classId) return err('ข้อมูลไม่ครบ');
  const bookSheet=getSheet(SHEET.BOOKINGS);
  const dup=rows(bookSheet).find(b=>b.MemberID===p.memberId&&b.ClassID===p.classId&&b.Status!=='cancelled');
  if(dup) return err('คุณจองคลาสนี้แล้ว');
  const classes=rows(getSheet(SHEET.CLASSES));
  const cls=classes.find(c=>c.ID===p.classId);
  if(!cls) return err('ไม่พบคลาส');
  if(Number(cls.BookedSeats)>=Number(cls.MaxSeats)) return err('ที่นั่งเต็มแล้ว');
  // Get member name
  const mem=rows(getSheet(SHEET.MEMBERS)).find(m=>m.ID===p.memberId);
  const memName=mem?(mem.FirstName+' '+mem.LastName).trim():p.memberId;
  const id=genId('BKG');
  bookSheet.appendRow([id,p.memberId,memName,p.classId,cls.Name,cls.Day,cls.Time,cls.Type,'confirmed',false,nowISO()]);
  const classSheet=getSheet(SHEET.CLASSES);
  const classRow=findRow(classSheet,0,p.classId);
  if(classRow>0) setCell(classSheet,classRow,'BookedSeats',Number(cls.BookedSeats)+1);
  return ok({bookingId:id,className:cls.Name});
}
function cancelBooking(p) {
  const sheet=getSheet(SHEET.BOOKINGS);
  const bks=rows(sheet);
  const idx=bks.findIndex(b=>b.ID===p.bookingId);
  if(idx<0) return err('ไม่พบการจอง');
  setCell(sheet,idx+2,'Status','cancelled');
  const b=bks[idx];
  if(b.ClassID){
    const cs=getSheet(SHEET.CLASSES);
    const cr=findRow(cs,0,b.ClassID);
    if(cr>0){const cl=rows(cs).find(c=>c.ID===b.ClassID);if(cl)setCell(cs,cr,'BookedSeats',Math.max(0,Number(cl.BookedSeats)-1));}
  }
  return ok({});
}
function getBookings(p) {
  let bks = rows(getSheet(SHEET.BOOKINGS));
  if (p.memberId) bks = bks.filter(b => b.MemberID === p.memberId);
  if (p.status)   bks = bks.filter(b => b.Status   === p.status);
  // Enrich: join class name from Classes sheet
  const classes = {};
  rows(getSheet(SHEET.CLASSES)).forEach(c => { classes[c.ID] = c.Name; });
  bks = bks.map(b => {
    const realName = classes[b.ClassID] || b.ClassName || b.ClassID || '—';
    return {
      ID:b.ID, MemberID:b.MemberID, MemberName:b.MemberName,
      ClassID:b.ClassID, ClassName:realName,
      ClassDay:b.ClassDay, ClassTime:b.ClassTime,
      Type:b.Type, Status:b.Status,
      CheckedIn:b.CheckedIn, BookedAt:b.BookedAt,
    };
  });
  return ok({bookings:bks});
}
function getMemberBookings(p) {
  if(!p.memberId) return err('ไม่มี memberId');
  return ok({bookings:rows(getSheet(SHEET.BOOKINGS))
    .filter(b=>b.MemberID===p.memberId)
    .map(b=>({id:b.ID,classId:b.ClassID,className:b.ClassName,
      day:b.ClassDay,time:b.ClassTime,type:b.Type,
      status:b.Status,checkedIn:b.CheckedIn,bookedAt:b.BookedAt}))});
}
function updateBooking(p) {
  const sheet=getSheet(SHEET.BOOKINGS);
  const row=findRow(sheet,0,p.id);
  if(row<0) return err('ไม่พบการจอง');
  if(p.status) setCell(sheet,row,'Status',p.status);
  if(p.checkedIn!==undefined) setCell(sheet,row,'CheckedIn',p.checkedIn);
  return ok({});
}

// ── CHECK-IN ──────────────────────────────────────
function processCheckin(p) {
  if(!p.memberId) return err('ไม่มี Member ID');
  const memberSheet=getSheet(SHEET.MEMBERS);
  const memberData=memberSheet.getDataRange().getValues();
  const headers=memberData[0];
  const idIdx=headers.indexOf('ID');
  // Case-insensitive search
  const searchId = String(p.memberId).trim().toUpperCase();
  let memberRow=-1, member=null;
  for(let i=1;i<memberData.length;i++){
    if(String(memberData[i][idIdx]).trim().toUpperCase()===searchId){
      memberRow=i+1; member={};
      headers.forEach((h,j)=>{member[h]=memberData[i][j];});
      break;
    }
  }
  if(!member) return err('ไม่พบ Member ID: '+p.memberId);
  if(!['active','Active',''].includes(String(member.Status).trim().toLowerCase())) return err('สมาชิกถูกระงับ');
  if(member.ExpiryDate&&member.ExpiryDate!==''){
    const exp=new Date(member.ExpiryDate);
    if(!isNaN(exp)&&exp<new Date()) return err('แพ็กเกจหมดอายุ');
  }
  const bookSheet=getSheet(SHEET.BOOKINGS);
  const bookData=bookSheet.getDataRange().getValues();
  const bookHdrs=bookData[0];
  let bookingName=p.className||'Walk-in';
  for(let i=1;i<bookData.length;i++){
    if(String(bookData[i][bookHdrs.indexOf('MemberID')]).toUpperCase()===searchId&&
       String(bookData[i][bookHdrs.indexOf('Status')])  ==='confirmed'&&
       !bookData[i][bookHdrs.indexOf('CheckedIn')]){
      bookingName=String(bookData[i][bookHdrs.indexOf('ClassName')])||bookingName;
      bookSheet.getRange(i+1,bookHdrs.indexOf('CheckedIn')+1).setValue(true);
      break;
    }
  }
  getSheet(SHEET.CHECKINS).appendRow([genId('CHK'),member.ID,
    member.FirstName+' '+member.LastName,'',bookingName,new Date().toISOString(),p.method||'admin',p.adminId||'']);
  if(!member.StartDate||member.StartDate===''){
    const s=new Date(),ex=new Date();
    const isQuarter = String(member.Plan||'').trim().toLowerCase()==='quarter';
    if(isQuarter) ex.setDate(ex.getDate()+90); else ex.setDate(ex.getDate()+1);
    setCell(memberSheet,memberRow,'StartDate',Utilities.formatDate(s,'Asia/Bangkok','yyyy-MM-dd'));
    setCell(memberSheet,memberRow,'ExpiryDate',Utilities.formatDate(ex,'Asia/Bangkok','yyyy-MM-dd'));
  }
  const sessions=Number(member.TotalSessions||0)+1;
  setCell(memberSheet,memberRow,'TotalSessions',sessions);
  return ok({memberName:member.FirstName+' '+member.LastName,memberId:member.ID,
    plan:member.Plan,className:bookingName,sessions,
    checkinTime:Utilities.formatDate(new Date(),'Asia/Bangkok','HH:mm')});
}

function checkinByRoomQR(p) {
  if(!p.qrToken||!p.memberId) return err('ข้อมูลไม่ครบ');
  const qrs=rows(getSheet(SHEET.ROOM_QR));
  const qr=qrs.find(q=>q.QRToken===p.qrToken&&(q.Active===true||q.Active==='TRUE'));
  if(!qr) return err('QR Code ไม่ถูกต้อง');
  if(qr.ExpiresAt&&new Date(qr.ExpiresAt)<new Date()) return err('QR Code หมดอายุ');
  const result=processCheckin({memberId:p.memberId,classId:qr.ClassID,className:qr.ClassName,method:'room_qr'});
  if(!result.success) return result;
  const cls=rows(getSheet(SHEET.CLASSES)).find(c=>c.ID===qr.ClassID);
  const type=cls?.Type||'onsite';
  const amt={online:Number(getSetting('fine_online')||20),onsite:Number(getSetting('fine_onsite')||50),hybrid:Number(getSetting('fine_hybrid')||100)};
  addFine({memberId:p.memberId,memberName:result.memberName,classId:qr.ClassID,className:qr.ClassName,type,amount:amt[type]||50,reason:'Walk-in ไม่ได้จองล่วงหน้า'});
  return {...result, fine:amt[type]||50, fineAdded:true};
}

function getCheckins(p) {
  let ci=rows(getSheet(SHEET.CHECKINS));
  if(p.today) ci=ci.filter(c=>String(c.CheckInTime).startsWith(todayStr()));
  if(p.memberId) ci=ci.filter(c=>c.MemberID===p.memberId);
  return ok({checkins:ci});
}

function getMemberHistory(p) {
  if(!p.memberId) return err('ไม่มี memberId');
  const ci=rows(getSheet(SHEET.CHECKINS)).filter(c=>c.MemberID===p.memberId)
    .map(c=>({date:c.CheckInTime,className:c.ClassName,method:c.Method}));
  const fi=rows(getSheet(SHEET.FINES)).filter(f=>f.MemberID===p.memberId)
    .map(f=>({date:f.Date,amount:f.Amount,status:f.Status,class:f.ClassName}));
  return ok({checkins:ci,fines:fi});
}

// ── FINES ─────────────────────────────────────────
function getFines(p) {
  let fi=rows(getSheet(SHEET.FINES));
  if(p.memberId) fi=fi.filter(f=>f.MemberID===p.memberId);
  if(p.status)   fi=fi.filter(f=>f.Status===p.status);
  const total=fi.filter(f=>f.Status==='pending').reduce((s,f)=>s+Number(f.Amount||0),0);
  return ok({fines:fi, totalPending:total});
}
function addFine(p) {
  const fineMap={online:20,onsite:50,hybrid:100};
  const amount=p.amount||fineMap[p.type||'onsite']||50;
  const id=genId('FNE');
  getSheet(SHEET.FINES).appendRow([id,p.memberId,p.memberName||'',p.classId||'',p.className||'',
    todayStr(),amount,p.type||'onsite',p.reason||'',  'pending','']);
  const ms=getSheet(SHEET.MEMBERS);
  const mr=findRow(ms,0,p.memberId);
  if(mr>0){const m=rows(ms).find(x=>x.ID===p.memberId);if(m)setCell(ms,mr,'PendingFines',Number(m.PendingFines||0)+amount);}
  return ok({id,amount});
}
function updateFine(p) {
  const sheet=getSheet(SHEET.FINES);
  const row=findRow(sheet,0,p.id);
  if(row<0) return err('ไม่พบรายการ');
  if(p.amount!==undefined) setCell(sheet,row,'Amount',p.amount);
  if(p.reason!==undefined) setCell(sheet,row,'Reason',p.reason);
  if(p.status!==undefined) setCell(sheet,row,'Status',p.status);
  return ok({});
}
function markFinePaid(p) {
  const sheet=getSheet(SHEET.FINES);
  const row=findRow(sheet,0,p.fineId);
  if(row<0) return err('ไม่พบรายการ');
  setCell(sheet,row,'Status','paid');
  setCell(sheet,row,'PaidDate',todayStr());
  return ok({});
}
function autoFineNoShows() {
  rows(getSheet(SHEET.BOOKINGS)).filter(b=>b.Status==='confirmed'&&!b.CheckedIn).forEach(b=>{
    const cls=rows(getSheet(SHEET.CLASSES)).find(c=>c.ID===b.ClassID);
    addFine({memberId:b.MemberID,memberName:b.MemberName,classId:b.ClassID,className:b.ClassName,type:cls?.Type||'onsite'});
    const s=getSheet(SHEET.BOOKINGS);const r=findRow(s,0,b.ID);if(r>0)setCell(s,r,'Status','no-show');
  });
}

// ── ROOM QR ───────────────────────────────────────
function generateRoomQR(p) {
  if(!p.classId) return err('ไม่มี classId');
  const cls=rows(getSheet(SHEET.CLASSES)).find(c=>c.ID===p.classId);
  if(!cls) return err('ไม่พบคลาส');
  const qrSheet=getSheet(SHEET.ROOM_QR);
  rows(qrSheet).forEach((q,i)=>{if(q.ClassID===p.classId&&q.Active)setCell(qrSheet,i+2,'Active',false);});
  const token=Utilities.getUuid();
  const expiry=new Date(); expiry.setHours(expiry.getHours()+(Number(p.validHours)||24));
  const id=genId('QR');
  qrSheet.appendRow([id,p.classId,cls.Name,token,nowISO(),expiry.toISOString(),true]);
  const siteUrl=getSetting('site_url')||'https://the-owner-app2.vercel.app';
  return ok({id,token,qrUrl:siteUrl+'/index.html?action=roomCheckin&token='+token,className:cls.Name,expiresAt:expiry.toISOString()});
}
function getRoomQRs() {
  return ok({qrs:rows(getSheet(SHEET.ROOM_QR))
    .filter(q=>q.Active===true||q.Active==='TRUE')
    .map(q=>({id:q.ID,classId:q.ClassID,className:q.ClassName,token:q.QRToken,createdAt:q.CreatedAt,expiresAt:q.ExpiresAt}))});
}

// ── STATS ─────────────────────────────────────────
function getStats() {
  const members=rows(getSheet(SHEET.MEMBERS)).filter(m=>String(m.Status).toLowerCase()!=='deleted');
  const checkins=rows(getSheet(SHEET.CHECKINS));
  const fines=rows(getSheet(SHEET.FINES));
  const regs=rows(getSheet(SHEET.REGISTRATIONS));
  const today=todayStr();
  const todayCI=checkins.filter(c=>String(c.CheckInTime).startsWith(today));
  const pendingFines=fines.filter(f=>f.Status==='pending').reduce((s,f)=>s+Number(f.Amount||0),0);
  const pendingApprovals=regs.filter(r=>r.Status==='waiting').length;
  // Monthly data for chart
  const now=new Date();
  const monthlyData=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const m=Utilities.formatDate(d,'Asia/Bangkok','yyyy-MM');
    const newM=regs.filter(r=>String(r.CreatedAt).startsWith(m)&&r.Status==='approved').length;
    const rev=regs.filter(r=>String(r.CreatedAt).startsWith(m)&&r.Status==='approved')
      .reduce((s,r)=>s+Number(r.Amount||0),0);
    const ciCnt=checkins.filter(c=>String(c.CheckInTime).startsWith(m)).length;
    monthlyData.push({month:m,newMembers:newM,revenue:rev,checkins:ciCnt});
  }
  return ok({
    totalMembers:members.filter(m=>['active','Active',''].includes(String(m.Status).trim().toLowerCase())).length,
    quarterMembers:members.filter(m=>m.Plan==='quarter'&&['active','Active',''].includes(String(m.Status).trim().toLowerCase())).length,
    trialMembers:members.filter(m=>m.Plan==='trial'&&['active','Active',''].includes(String(m.Status).trim().toLowerCase())).length,
    todayCheckins:todayCI.length,
    pendingFines,pendingApprovals,
    monthlyData,
    recentPending:regs.filter(r=>r.Status==='waiting').slice(-5).reverse().map(r=>({
      name:r.FirstName+' '+r.LastName, plan:r.Plan,
      time:r.CreatedAt?new Date(r.CreatedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'—',
    })),
    recentCheckins:todayCI.slice(-5).reverse().map(c=>({
      name:c.MemberName, class:c.ClassName,
      time:c.CheckInTime?new Date(c.CheckInTime).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'—',
    })),
  });
}

// ── REPORTS ───────────────────────────────────────
function getReports(p) {
  const month=p.month||Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM');
  const regs=rows(getSheet(SHEET.REGISTRATIONS));
  const fines=rows(getSheet(SHEET.FINES));
  const checkins=rows(getSheet(SHEET.CHECKINS));
  const newRegs=regs.filter(r=>String(r.CreatedAt).startsWith(month)&&r.Status==='approved');
  const newQ=newRegs.filter(r=>r.Plan==='quarter').length;
  const newT=newRegs.filter(r=>r.Plan==='trial').length;
  const fineRevenue=fines.filter(f=>f.Status==='paid'&&String(f.PaidDate).startsWith(month))
    .reduce((s,f)=>s+Number(f.Amount||0),0);
  const memberRevenue=(newQ*600)+(newT*150);
  return ok({
    monthRevenue:memberRevenue+fineRevenue,
    memberRevenue, fineRevenue,
    newMembers:newRegs.length, sessions:checkins.filter(c=>String(c.CheckInTime).startsWith(month)).length,
    quarterRevenue:newQ*600, trialRevenue:newT*150,
  });
}

// ── SETTINGS ──────────────────────────────────────
function getSettingsPublic() {
  const s={};
  rows(getSheet(SHEET.SETTINGS)).forEach(r=>{
    // ไม่ส่ง sensitive keys ออกไป
    if(!['line_token'].includes(r.Key)) s[r.Key]=r.Value;
  });
  return ok({settings:s});
}
function getSettingsAll() {
  const s={};
  rows(getSheet(SHEET.SETTINGS)).forEach(r=>{s[r.Key]=r.Value;});
  return ok({settings:s});
}
function saveSettings(p) {
  if(!p.settings) return err('ไม่มีข้อมูล');
  const sheet=getSheet(SHEET.SETTINGS);
  const data=sheet.getDataRange().getValues();
  const headers=data[0];
  const ki=headers.indexOf('Key'), vi=headers.indexOf('Value');
  Object.entries(p.settings).forEach(([key,value])=>{
    let found=false;
    for(let i=1;i<data.length;i++){
      if(data[i][ki]===key){sheet.getRange(i+1,vi+1).setValue(value);found=true;break;}
    }
    if(!found) sheet.appendRow([key,value,'']);
  });
  return ok({message:'บันทึกสำเร็จ'});
}

// ── LINE MESSAGING ────────────────────────────────
function sendApproveMsg(lineUserId, firstName, memberId, plan) {
  const token=getSetting('line_token'); if(!token) return;
  const zoomId=getSetting('zoom_id')||'964 333 6086';
  const zoomPw=getSetting('zoom_pw')||'12345';
  const planLabel=plan==='quarter'?'Quarter (3 เดือน)':'Trial (รายครั้ง)';
  pushLine(lineUserId,[
    '🎉 ยินดีต้อนรับสู่ The Owner!',
    '',`สวัสดี คุณ${firstName}`,
    'การสมัครของคุณได้รับการ Approve แล้ว ✅','',
    '━━━━━━━━━━━━━━━━━━',
    `🆔 Member ID: ${memberId}`,
    `📦 แพ็กเกจ: ${planLabel}`,'',
    '🎥 Zoom Class Info:',
    `Meeting ID: ${zoomId}`,
    `Password: ${zoomPw}`,
    '━━━━━━━━━━━━━━━━━━','',
    '⚠️ อายุสมาชิกเริ่มนับตั้งแต่วัน Check-in ครั้งแรก',
    'ติดต่อ: LINE OA @theowner',
  ].join('\n'),token);
}
function sendRejectMsg(lineUserId, firstName, note) {
  const token=getSetting('line_token'); if(!token) return;
  pushLine(lineUserId,['❌ The Owner — การสมัครไม่ผ่าน','',
    `สวัสดี คุณ${firstName}`,
    'ขออภัย Slip ของคุณไม่ผ่านการตรวจสอบ',
    note?'เหตุผล: '+note:'',
    '','กรุณาติดต่อ Admin ผ่าน LINE OA @theowner'].join('\n'),token);
}

// ── CLASS REMINDER (รัน Daily Trigger 13:00) ──────
function sendClassReminders() {
  const token=getSetting('line_token'); if(!token) return {success:false,message:'ไม่มี LINE token'};
  const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const thDays=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const tomorrowDay=thDays[tomorrow.getDay()];
  const classes=rows(getSheet(SHEET.CLASSES)).filter(c=>['active','Active',''].includes(String(c.Status).trim().toLowerCase())&&c.Day===tomorrowDay);
  if(!classes.length) return ok({message:'ไม่มีคลาสพรุ่งนี้'});
  const members=rows(getSheet(SHEET.MEMBERS)).filter(m=>['active','Active',''].includes(String(m.Status).trim().toLowerCase())&&m.LineId);
  let sent=0;
  classes.forEach(cls=>{
    const zoomId=cls.ZoomLink?'(ดูใน Zoom Link)':getSetting('zoom_id')||'964 333 6086';
    const zoomPw=cls.ZoomLink?'':getSetting('zoom_pw')||'12345';
    const msg=[
      `🔔 แจ้งเตือน: มีคลาสพรุ่งนี้!`,``,
      `📚 ${cls.Name}`,
      `📅 ${tomorrowDay} เวลา ${cls.Time}`,
      `📍 ประเภท: ${cls.Type==='online'?'Online 🖥️':cls.Type==='onsite'?'Onsite 🏢':'Hybrid ⚡'}`,
      cls.Type!=='onsite'?`🎥 Zoom: ${zoomId}${zoomPw?' / '+zoomPw:''}`:'',
      ``,`อย่าลืม Check-in นะครับ 😊`,
    ].filter(Boolean).join('\n');
    members.forEach(m=>{
      try{ pushLine(m.LineId,msg,token); sent++; }catch(e){}
      Utilities.sleep(100);
    });
  });
  return ok({message:`ส่งแจ้งเตือน ${sent} คน สำหรับ ${classes.length} คลาส`});
}

function pushLine(userId, text, token) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push',{
      method:'post',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      payload:JSON.stringify({to:userId,messages:[{type:'text',text}]}),
      muteHttpExceptions:true,
    });
  } catch(e){ Logger.log('LINE: '+e.message); }
}

// ── TRIGGERS ──────────────────────────────────────
function createTriggers() {
  // ลบ trigger เก่า
  ScriptApp.getProjectTriggers().forEach(t=>ScriptApp.deleteTrigger(t));
  // แจ้งเตือนล่วงหน้า 1 วัน เวลา 13:00
  ScriptApp.newTrigger('sendClassReminders').timeBased().atHour(13).everyDays(1).create();
  // ค่าปรับ no-show ทุกคืน 23:00
  ScriptApp.newTrigger('autoFineNoShows').timeBased().atHour(23).everyDays(1).create();
  Logger.log('✅ Triggers created');
}
