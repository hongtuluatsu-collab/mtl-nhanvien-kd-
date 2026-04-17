/**
 * word_hop_dong.js — MTL Hợp Đồng Dịch Vụ Pháp Lý v1
 * Format: Giống hệt word_bao_gia.js (Navy/Gold, same section headers)
 * Nội dung: 8 Điều khoản theo mẫu Lê Đức Dược
 *
 * Usage: node agents/word_hop_dong.js input.json output.docx
 *
 * Input JSON fields:
 *   so_hop_dong, ten_than_chu, cmnd, dia_chi, sdt, email,
 *   loai_vu, pham_vi, tong_phi_raw, tong_phi_fmt,
 *   phuong_thuc_tt, thoi_han, ngay_lap, noi_dung
 */

"use strict";
const fs   = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  ShadingType, VerticalAlign, ImageRun,
} = require("docx");

const [,, JSON_PATH, DOCX_PATH] = process.argv;
if (!JSON_PATH || !DOCX_PATH) { console.error("Usage: node word_hop_dong.js input.json output.docx"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
const {
  so_hop_dong    = "MTL/HĐDV/0001",
  ten_than_chu   = "Quý Khách Hàng",
  cmnd           = "",
  dia_chi        = "",
  sdt            = "",
  email          = "",
  loai_vu        = "Dịch vụ pháp lý",
  loai_dich_vu   = "Trọn gói",
  pham_vi        = "",
  tong_phi_raw   = 0,
  phuong_thuc_tt = "50% khi ký — 50% khi hoàn thành",
  thoi_han       = "Đến khi hoàn thành vụ việc",
  ngay_lap       = new Date().toLocaleDateString("vi-VN"),
  noi_dung       = "",
} = D;

// ── COLORS (giống word_bao_gia.js) ──────────────────────
const NAVY  = "1B4A7A";
const NAVY2 = "163D66";
const GOLD  = "B8973A";
const GOLD2 = "CDB060";
const SLATE = "64748B";
const BG1   = "F8FAFC";
const BG2   = "EBF2FA";
const BG3   = "FAF5E8";
const WHITE = "FFFFFF";
const FONT  = "Times New Roman";
const SZ = { xs:13,sm:14,sm2:15,md:16,md2:17,lg:19,xl:21,xxl:26,hero:30 };
const PW = 9360;

// ── UTILS ───────────────────────────────────────────────
const vnd = n => Math.round(parseInt(String(n).replace(/\D/g,""))||0)
  .toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");

function calcFee(raw) {
  const total = Math.round(parseInt(String(raw).replace(/\D/g,""))||0);
  const vat   = Math.round(total / 13.5);  // 8% VAT
  return { base:total-vat, vat, total };
}

function chu(n) {
  if (!n) return "Không đồng";
  const ty=Math.floor(n/1e9),tr=Math.floor((n%1e9)/1e6),ng=Math.floor((n%1e6)/1e3),dv=n%1e3;
  let s="";
  if(ty)s+=ty+" tỷ ";if(tr)s+=tr+" triệu ";if(ng)s+=ng+" nghìn ";if(dv)s+=dv;
  s=(s.trim()||"không")+" đồng";
  return s[0].toUpperCase()+s.slice(1);
}

// Parse pham_vi / noi_dung thành list items
function parseItems(text) {
  if (!text) return [];
  return text.split("\n").map(l=>l.trim()).filter(Boolean)
    .map(l=>l.replace(/^[-–•]\s*/,"").trim()).filter(Boolean);
}

// Parse payment milestones từ phuong_thuc_tt
function parseMilestones(total, pttt) {
  const t = (pttt||"").toLowerCase();
  if (t.includes("100%") || t.includes("toàn bộ") || t.includes("một lần")) {
    return [{ n:"1", mile:"Ký hợp đồng dịch vụ",
      trigger:"Ngay sau khi ký Hợp đồng Dịch vụ Pháp lý.", amt:total, pct:"100%" }];
  }
  if (t.includes("70") || t.includes("30")) {
    const p1=Math.round(total*0.7);
    return [
      { n:"1", mile:"Ký hợp đồng", trigger:"Ngay sau khi ký Hợp đồng Dịch vụ Pháp lý.", amt:p1, pct:"70%" },
      { n:"2", mile:"Hoàn tất vụ việc", trigger:"Sau khi hoàn tất và bàn giao kết quả.", amt:total-p1, pct:"30%" },
    ];
  }
  // Mặc định 50/50
  const p1=Math.round(total*0.5);
  return [
    { n:"1", mile:"Ký hợp đồng", trigger:"Ngay sau khi ký Hợp đồng Dịch vụ Pháp lý.", amt:p1, pct:"50%" },
    { n:"2", mile:"Hoàn tất vụ việc", trigger:"Sau khi hoàn tất và bàn giao kết quả.", amt:total-p1, pct:"50%" },
  ];
}

function loadImg(names) {
  const dirs=["data/mau",path.join(__dirname,"../data/mau")];
  for(const d of dirs) for(const n of names){
    const p=path.join(d,n);
    if(fs.existsSync(p)){const ext=path.extname(n).slice(1).toLowerCase();return{buf:fs.readFileSync(p),type:ext==="jpg"?"jpg":"png"};}
  }
  return null;
}

// ── BORDERS ─────────────────────────────────────────────
const B_NONE={top:{style:BorderStyle.NONE,size:0,color:WHITE},bottom:{style:BorderStyle.NONE,size:0,color:WHITE},left:{style:BorderStyle.NONE,size:0,color:WHITE},right:{style:BorderStyle.NONE,size:0,color:WHITE}};
const TB_NONE={top:{style:BorderStyle.NONE,size:0},bottom:{style:BorderStyle.NONE,size:0},left:{style:BorderStyle.NONE,size:0},right:{style:BorderStyle.NONE,size:0},insideH:{style:BorderStyle.NONE,size:0},insideV:{style:BorderStyle.NONE,size:0}};
const B_CELL={top:{style:BorderStyle.SINGLE,size:3,color:"DDE5EF"},bottom:{style:BorderStyle.SINGLE,size:3,color:"DDE5EF"},left:{style:BorderStyle.SINGLE,size:3,color:"DDE5EF"},right:{style:BorderStyle.SINGLE,size:3,color:"DDE5EF"}};
const B_GOLD_BTM={top:{style:BorderStyle.NONE,size:0,color:WHITE},bottom:{style:BorderStyle.THICK,size:12,color:GOLD},left:{style:BorderStyle.NONE,size:0,color:WHITE},right:{style:BorderStyle.NONE,size:0,color:WHITE}};
const M={top:80,bottom:80,left:120,right:120};
const ML={top:100,bottom:100,left:140,right:140};

// ── ELEMENT BUILDERS ────────────────────────────────────
const R=(text,{bold=false,size=SZ.md,color=SLATE,italic=false}={})=>
  new TextRun({text,font:FONT,size,bold,color,italics:italic});

const P=(children,{align=AlignmentType.JUSTIFIED,before=60,after=60,indent=0,line=340}={})=>
  new Paragraph({
    children:Array.isArray(children)?children:[children],
    alignment:align,spacing:{before,after,line},
    indent:indent?{left:indent}:undefined,
  });

const GAP=(n=1)=>Array.from({length:n},()=>
  new Paragraph({children:[new TextRun({text:"",font:FONT,size:SZ.md})],spacing:{before:0,after:0}}));

const CELL=(children,{w,bg,borders=B_CELL,vAlign=VerticalAlign.CENTER,margins=M}={})=>
  new TableCell({
    children:Array.isArray(children)?children:[children],
    width:w?{size:w,type:WidthType.DXA}:undefined,
    shading:bg?{type:ShadingType.CLEAR,color:bg,fill:bg}:undefined,
    verticalAlign:vAlign,margins,borders,
  });

// Section header — giống hoàn toàn word_bao_gia.js
const SECT=(vi,en)=>new Table({
  width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
  rows:[new TableRow({children:[
    CELL([P([R(vi+"  ",{bold:true,size:SZ.md,color:WHITE}),R("—  "+en,{size:SZ.sm2,color:"8FAEC8",italic:true})],
           {align:AlignmentType.LEFT,before:80,after:80})],
      {w:PW,bg:NAVY,borders:B_NONE,margins:{top:60,bottom:60,left:180,right:180}}),
  ]})],
  borders:TB_NONE,
});

// Điều khoản title (trong body)
const DIEU=(num,title)=>P([
  R(num+". ",{bold:true,size:SZ.lg,color:NAVY}),
  R(title.toUpperCase(),{bold:true,size:SZ.lg,color:NAVY}),
],{before:160,after:60,align:AlignmentType.LEFT});

// Sub-heading trong điều khoản
const SUB=(text)=>P([R(text,{bold:true,size:SZ.md,color:NAVY})],{before:80,after:30});

// Bullet
const BUL=(text,{bold=false,color=SLATE}={})=>
  P([R("–  ",{size:SZ.md,color:GOLD}),R(text,{size:SZ.md,color,bold})],
    {before:30,after:30,indent:240});

// Căn cứ
const CANCU=(text)=>P([R("–  ",{size:SZ.md,color:GOLD}),R(text,{size:SZ.md,color:SLATE,italic:true})],
  {before:20,after:20,indent:180});

// ────────────────────────────────────────────────────────
// T0: HEADER
// ────────────────────────────────────────────────────────
function t0_header(){
  const logo=loadImg(["LOGO.jpg","LOGO.png","logo.jpg","logo.png"]);
  const wL=Math.round(PW*0.50),wR=PW-wL;
  const leftCh=[];
  if(logo){
    leftCh.push(new Paragraph({children:[new ImageRun({data:logo.buf,type:logo.type,transformation:{width:160,height:54}})],spacing:{before:80,after:60}}));
  }else{
    leftCh.push(P([R("MINHTU LAW CO., LTD",{bold:true,size:SZ.xl,color:NAVY})],{before:80,after:10,align:AlignmentType.LEFT}));
    leftCh.push(P([R("Công ty Luật TNHH Minh Tú",{size:SZ.md,color:NAVY,italic:true})],{before:0,after:10,align:AlignmentType.LEFT}));
  }
  leftCh.push(P([R("Our Experience Is Your Success",{size:SZ.sm,color:GOLD})],{before:0,after:80,align:AlignmentType.LEFT}));

  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      CELL(leftCh,{w:wL,borders:B_GOLD_BTM,margins:{top:80,bottom:80,left:0,right:100}}),
      CELL([
        P([R("HỢP ĐỒNG DỊCH VỤ PHÁP LÝ",{bold:true,size:SZ.hero,color:NAVY})],{align:AlignmentType.RIGHT,before:80,after:8}),
        P([R("Legal Service Agreement",{size:SZ.sm2,color:GOLD})],{align:AlignmentType.RIGHT,before:0,after:14}),
        P([R(`Số: ${so_hop_dong}`,{bold:true,size:SZ.md,color:NAVY})],{align:AlignmentType.RIGHT,before:0,after:6}),
        P([R(`Ngày: ${ngay_lap}`,{size:SZ.sm,color:SLATE})],{align:AlignmentType.RIGHT,before:0,after:80}),
      ],{w:wR,borders:B_GOLD_BTM,margins:{top:80,bottom:80,left:100,right:0}}),
    ]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T1: CONFIDENTIAL
// ────────────────────────────────────────────────────────
function t1_confidential(){
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
    rows:[new TableRow({children:[
      CELL(P([R("✦   RIÊNG TƯ & BẢO MẬT  ·  PRIVATE & CONFIDENTIAL  ✦",{bold:true,size:SZ.sm,color:WHITE})],
             {align:AlignmentType.CENTER,before:80,after:80}),
        {w:PW,bg:NAVY,borders:B_NONE,margins:{top:60,bottom:60,left:120,right:120}}),
    ]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T2: STAT BOXES — 4 ô (Bên B / Dịch vụ / Số HĐ / Phí)
// ────────────────────────────────────────────────────────
function t2_statBoxes(F){
  const w0=Math.floor(PW/4),wL=PW-w0*3;
  const BX={style:BorderStyle.SINGLE,size:3,color:"DDE5EF"};
  const BOX_B={top:BX,bottom:BX,left:BX,right:BX};
  function box(label,val,sub,w,hi=false){
    const bg=hi?BG2:BG1;
    return CELL([
      P([R(label,{bold:true,size:SZ.xs,color:GOLD})],{before:100,after:14,align:AlignmentType.LEFT}),
      P([R(val,{bold:true,size:hi?SZ.xl:SZ.lg,color:NAVY})],{before:0,after:sub?8:100,align:AlignmentType.LEFT}),
      ...(sub?[P([R(sub,{size:SZ.xs,color:SLATE})],{before:0,after:100,align:AlignmentType.LEFT})]:[]),
    ],{w,bg,borders:BOX_B,margins:ML});
  }
  const kh=ten_than_chu.length>18?ten_than_chu.slice(0,17)+"…":ten_than_chu;
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[w0,w0,w0,wL],
    rows:[new TableRow({children:[
      box("BÊN B / PARTY B",kh,sdt||cmnd||"",w0),
      box("DỊCH VỤ",loai_vu.slice(0,22),"",w0),
      box("SỐ HỢP ĐỒNG",so_hop_dong.slice(0,20),"",w0),
      box("TỔNG PHÍ","₫ "+vnd(F.total),"Đã bao gồm VAT (8%)",wL,true),
    ]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T3: THÔNG TIN CÁC BÊN (full-width 2-col)
// ────────────────────────────────────────────────────────
function t3_parties(){
  const wL=Math.round(PW/2),wR=PW-wL;
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      // BÊN A
      CELL([
        P([R("BÊN A — BÊN CUNG CẤP DỊCH VỤ",{bold:true,size:SZ.md,color:WHITE})],
          {align:AlignmentType.CENTER,before:60,after:60}),
      ],{w:wL,bg:NAVY,borders:B_NONE,margins:{top:60,bottom:60,left:120,right:60}}),
      // BÊN B
      CELL([
        P([R("BÊN B — BÊN SỬ DỤNG DỊCH VỤ",{bold:true,size:SZ.md,color:WHITE})],
          {align:AlignmentType.CENTER,before:60,after:60}),
      ],{w:wR,bg:NAVY2,borders:B_NONE,margins:{top:60,bottom:60,left:60,right:120}}),
    ]})],
    borders:TB_NONE,
  });
}

function t3b_partiesDetail(){
  const wL=Math.round(PW/2),wR=PW-wL;

  const benA=[
    P([R("CÔNG TY LUẬT TNHH MINH TÚ",{bold:true,size:SZ.lg,color:NAVY})],{before:100,after:10,align:AlignmentType.LEFT}),
    P([R("Số GPĐKHĐ: ",{bold:true,size:SZ.md,color:SLATE}),R("41.02.4764/TP/ĐKHĐ",{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT}),
    P([R("MST: ",{bold:true,size:SZ.md,color:SLATE}),R("0318941023",{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT}),
    P([R("Địa chỉ: ",{bold:true,size:SZ.md,color:SLATE}),R("4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3, TP.HCM",{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT}),
    P([R("ĐT: ",{bold:true,size:SZ.md,color:SLATE}),R("1900 0031  |  Email: votu@luatminhtu.vn",{size:SZ.md,color:SLATE})],{before:0,after:10,align:AlignmentType.LEFT}),
    P([R("Đại diện: ",{bold:true,size:SZ.md,color:NAVY}),R("Ông Võ Hồng Tú",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:4,align:AlignmentType.LEFT}),
    P([R("Chức vụ: Giám đốc / Luật sư điều hành",{size:SZ.md,color:SLATE,italic:true})],{before:0,after:100,align:AlignmentType.LEFT}),
  ];

  const benB=[
    P([R(ten_than_chu.toUpperCase(),{bold:true,size:SZ.lg,color:NAVY})],{before:100,after:10,align:AlignmentType.LEFT}),
    P([R("CCCD/MST: ",{bold:true,size:SZ.md,color:SLATE}),R(cmnd||"___________________________",{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT}),
    P([R("Địa chỉ: ",{bold:true,size:SZ.md,color:SLATE}),R(dia_chi||"___________________________",{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT}),
    P([R("SĐT: ",{bold:true,size:SZ.md,color:SLATE}),R(sdt||"___________________________",{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT}),
    ...(email?[P([R("Email: ",{bold:true,size:SZ.md,color:SLATE}),R(email,{size:SZ.md,color:SLATE})],{before:0,after:6,align:AlignmentType.LEFT})]:[]),
    P([R("Đại diện: ",{bold:true,size:SZ.md,color:NAVY}),R(ten_than_chu,{bold:true,size:SZ.md,color:NAVY})],{before:10,after:4,align:AlignmentType.LEFT}),
    P([R("Là bên sử dụng dịch vụ pháp lý",{size:SZ.md,color:SLATE,italic:true})],{before:0,after:100,align:AlignmentType.LEFT}),
  ];

  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      CELL(benA,{w:wL,bg:BG1,borders:B_CELL,vAlign:VerticalAlign.TOP}),
      CELL(benB,{w:wR,bg:BG2,borders:B_CELL,vAlign:VerticalAlign.TOP}),
    ]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T4: CĂN CỨ PHÁP LÝ
// ────────────────────────────────────────────────────────
function t4_canCu(){
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
    rows:[new TableRow({children:[
      CELL([
        P([R("CĂN CỨ PHÁP LÝ",{bold:true,size:SZ.md,color:NAVY})],{before:80,after:30,align:AlignmentType.LEFT}),
        CANCU("Căn cứ Hiến pháp nước Cộng hòa Xã hội Chủ nghĩa Việt Nam năm 2013;"),
        CANCU("Căn cứ Bộ luật Dân sự nước CHXHCNVN năm 2015;"),
        CANCU("Căn cứ Luật Luật sư năm 2006, sửa đổi bổ sung năm 2012;"),
        CANCU("Căn cứ nhu cầu và thỏa thuận của các Bên."),
        P([R("Hai bên thống nhất ký kết Hợp đồng Dịch vụ Pháp lý này với các điều khoản sau:",{size:SZ.md,color:SLATE,italic:true})],{before:30,after:80,align:AlignmentType.JUSTIFIED}),
      ],{w:PW,bg:BG3,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:100,bottom:100,left:200,right:200}}),
    ]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T5: NỘI DUNG 8 ĐIỀU KHOẢN
// ────────────────────────────────────────────────────────
function t5_articles(F){
  const scope_items = parseItems(pham_vi||noi_dung).slice(0,10);
  const milestones  = parseMilestones(F.total, phuong_thuc_tt);

  // ── ĐIỀU 2: Bảng phí + lịch thanh toán ──────────────
  const W0=Math.round(PW*0.50),W1=Math.round(PW*0.22),W2=Math.round(PW*0.14),W3=PW-W0-W1-W2;

  const feeHdr=new TableRow({children:[
    CELL(P([R("Hạng mục",{bold:true,size:SZ.md,color:WHITE})]),{w:W0,bg:NAVY,borders:B_NONE}),
    CELL(P([R("Số tiền (VNĐ)",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.RIGHT}),{w:W1,bg:NAVY,borders:B_NONE}),
    CELL(P([R("Thuế",{bold:true,size:SZ.md,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W2,bg:NAVY,borders:B_NONE}),
    CELL(P([R("Note",{bold:true,size:SZ.md,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W3,bg:NAVY,borders:B_NONE}),
  ]});
  const feeR1=new TableRow({children:[
    CELL(P([R("Phí dịch vụ pháp lý chuyên nghiệp",{size:SZ.lg,color:SLATE})]),{w:W0,bg:BG1,borders:B_CELL}),
    CELL(P([R(vnd(F.base),{size:SZ.lg,color:SLATE})],{align:AlignmentType.RIGHT}),{w:W1,bg:BG1,borders:B_CELL}),
    CELL(P([R("+8%",{size:SZ.md,color:SLATE})],{align:AlignmentType.CENTER}),{w:W2,bg:BG1,borders:B_CELL}),
    CELL(P([R("Incl.",{size:SZ.sm,color:SLATE})],{align:AlignmentType.CENTER}),{w:W3,bg:BG1,borders:B_CELL}),
  ]});
  const feeR2=new TableRow({children:[
    CELL(P([R("Thuế Giá trị Gia tăng — VAT (8%)",{size:SZ.lg,color:SLATE})]),{w:W0,bg:WHITE,borders:B_CELL}),
    CELL(P([R(vnd(F.vat),{size:SZ.lg,color:SLATE})],{align:AlignmentType.RIGHT}),{w:W1,bg:WHITE,borders:B_CELL}),
    CELL(P([R("—",{size:SZ.md,color:SLATE})],{align:AlignmentType.CENTER}),{w:W2,bg:WHITE,borders:B_CELL}),
    CELL(P([R("Stat.",{size:SZ.sm,color:SLATE})],{align:AlignmentType.CENTER}),{w:W3,bg:WHITE,borders:B_CELL}),
  ]});
  const feeTot=new TableRow({children:[
    CELL(P([R("TỔNG PHÍ DỊCH VỤ (ĐÃ BAO GỒM VAT)",{bold:true,size:SZ.md,color:WHITE})]),{w:W0,bg:NAVY,borders:B_NONE}),
    CELL(P([R(vnd(F.total)+" ₫",{bold:true,size:SZ.xl,color:GOLD2})],{align:AlignmentType.RIGHT}),{w:W1,bg:NAVY,borders:B_NONE}),
    CELL(P([R("",{})],{align:AlignmentType.CENTER}),{w:W2,bg:NAVY,borders:B_NONE}),
    CELL(P([R("FINAL",{bold:true,size:SZ.sm,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W3,bg:NAVY,borders:B_NONE}),
  ]});
  const feeTable=new Table({width:{size:PW,type:WidthType.DXA},columnWidths:[W0,W1,W2,W3],rows:[feeHdr,feeR1,feeR2,feeTot],borders:TB_NONE});

  // ── Bảng lịch thanh toán ─────────────────────────────
  const PM0=360,PM1=1440,PM2=Math.round(PW*0.36),PM3=Math.round(PW*0.18),PM4=PW-PM0-PM1-PM2-PM3;
  const pmHdr=new TableRow({children:[
    CELL(P([R("#",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER}),{w:PM0,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("Milestone",{bold:true,size:SZ.md,color:WHITE})]),{w:PM1,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("Điều kiện thanh toán / Trigger",{bold:true,size:SZ.md,color:WHITE})]),{w:PM2,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("Số tiền (₫)",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER}),{w:PM3,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("%",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER}),{w:PM4,bg:NAVY2,borders:B_NONE}),
  ]});
  const pmRows=milestones.map((m,i)=>{
    const bg=i===0?BG1:BG2;
    return new TableRow({children:[
      CELL(P([R(m.n,{bold:true,size:SZ.lg,color:NAVY})],{align:AlignmentType.CENTER}),{w:PM0,bg,borders:B_CELL}),
      CELL(P([R(m.mile,{bold:true,size:SZ.lg,color:NAVY})]),{w:PM1,bg,borders:B_CELL}),
      CELL(P([R(m.trigger,{size:SZ.md,color:SLATE})]),{w:PM2,bg,borders:B_CELL}),
      CELL(P([R(vnd(m.amt),{bold:true,size:SZ.lg,color:NAVY})],{align:AlignmentType.RIGHT}),{w:PM3,bg,borders:B_CELL}),
      CELL(P([R(m.pct,{bold:true,size:SZ.lg,color:GOLD})],{align:AlignmentType.CENTER}),{w:PM4,bg,borders:B_CELL}),
    ]});
  });
  const pmTable=new Table({width:{size:PW,type:WidthType.DXA},columnWidths:[PM0,PM1,PM2,PM3,PM4],rows:[pmHdr,...pmRows],borders:TB_NONE});

  // ── ĐIỀU 3 & 4: Bảng 2 cột quyền & nghĩa vụ ─────────
  const wH=Math.round(PW/2);
  const dutyTable=new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wH,PW-wH],
    rows:[
      // Header
      new TableRow({children:[
        CELL(P([R("BÊN A — Nghĩa vụ",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER,before:60,after:60}),{w:wH,bg:NAVY,borders:B_NONE}),
        CELL(P([R("BÊN A — Quyền",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER,before:60,after:60}),{w:PW-wH,bg:NAVY2,borders:B_NONE}),
      ]}),
      // Content Bên A
      new TableRow({children:[
        CELL([
          BUL("Thực hiện công việc đúng chất lượng, khối lượng và thời hạn cam kết."),
          BUL("Không chuyển giao công việc cho bên thứ ba khi chưa được Bên B đồng ý bằng văn bản."),
          BUL("Thông báo và xin ý kiến Bên B trước khi ban hành tài liệu cần phê duyệt."),
          BUL("Bảo mật toàn bộ thông tin của Bên B trong và sau khi thực hiện hợp đồng."),
          BUL("Bàn giao tài liệu, hồ sơ sau khi hoàn tất công việc."),
          BUL("Bồi thường nếu làm mất, hư hỏng tài sản hoặc để lộ thông tin mật của Bên B."),
        ],{w:wH,bg:BG1,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:80,bottom:80,left:120,right:80}}),
        CELL([
          BUL("Yêu cầu Bên B cung cấp thông tin, tài liệu phục vụ công việc."),
          BUL("Nhận đầy đủ thù lao theo thỏa thuận tại Điều 2."),
          BUL("Yêu cầu Bên B phối hợp khi cần có mặt hoặc ý kiến trực tiếp."),
          BUL("Đơn phương chấm dứt hợp đồng và yêu cầu bồi thường nếu Bên B vi phạm nghiêm trọng."),
        ],{w:PW-wH,bg:BG2,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:80,bottom:80,left:80,right:120}}),
      ]}),
      // Header Bên B
      new TableRow({children:[
        CELL(P([R("BÊN B — Nghĩa vụ",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER,before:60,after:60}),{w:wH,bg:NAVY,borders:B_NONE}),
        CELL(P([R("BÊN B — Quyền",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER,before:60,after:60}),{w:PW-wH,bg:NAVY2,borders:B_NONE}),
      ]}),
      // Content Bên B
      new TableRow({children:[
        CELL([
          BUL("Cung cấp đầy đủ thông tin, tài liệu và phương tiện cần thiết cho Bên A."),
          BUL("Thanh toán đầy đủ và đúng hạn phí dịch vụ theo thỏa thuận."),
          BUL("Đảm bảo tính chính xác, trung thực của tài liệu cung cấp."),
          BUL("Bồi thường thiệt hại nếu đơn phương chấm dứt hợp đồng không có lý do chính đáng."),
        ],{w:wH,bg:BG1,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:80,bottom:80,left:120,right:80}}),
        CELL([
          BUL("Được Bên A tư vấn pháp lý, soạn thảo văn bản và cập nhật tiến độ công việc."),
          BUL("Đơn phương chấm dứt hợp đồng và yêu cầu bồi thường nếu Bên A vi phạm nghiêm trọng."),
          BUL("Hưởng các quyền lợi khác theo quy định pháp luật Việt Nam."),
        ],{w:PW-wH,bg:BG2,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:80,bottom:80,left:80,right:120}}),
      ]}),
    ],
    borders:TB_NONE,
  });

  // Nội dung các điều khoản còn lại (5–8)
  const clauses=[
    DIEU("Điều 1","Đối tượng của Hợp đồng"),
    P([R("Bên B đồng ý chọn Bên A là đơn vị tư vấn pháp lý và thực hiện các dịch vụ sau:",{size:SZ.md,color:SLATE})],{before:0,after:30}),
    ...(scope_items.length
      ? scope_items.map(s=>BUL(s))
      : [BUL(loai_vu)]),

    DIEU("Điều 2","Phí dịch vụ và phương thức thanh toán"),
    P([
      R("Mức phí dịch vụ là ",{size:SZ.md,color:SLATE}),
      R(vnd(F.total)+" VNĐ ("+chu(F.total)+")",{bold:true,size:SZ.md,color:NAVY}),
      R(", đã bao gồm VAT và các chi phí đi lại, lưu trú.",{size:SZ.md,color:SLATE}),
    ],{before:0,after:20}),
    feeTable,
    ...GAP(1),
    P([R("Lịch thanh toán:",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:20}),
    pmTable,
    P([
      R("* Lưu ý: ",{bold:true,size:SZ.sm2,color:GOLD}),
      R("Trường hợp không thực hiện được công việc ở đợt nào, Bên A hoàn tiền lại cho Bên B đợt đó, sau khi trừ chi phí thực tế đã phát sinh.",{size:SZ.sm2,color:SLATE,italic:true}),
    ],{before:30,after:60}),
    P([R("Bên B thanh toán bằng tiền mặt hoặc chuyển khoản:",{size:SZ.md,color:SLATE})],{before:0,after:10}),
    BUL("Tên TK: CTY LUAT TNHH MINH TU  |  STK: 5150056789"),
    BUL("Ngân hàng MB Bank (TMCP Quân Đội) — Chi nhánh Phú Nhuận, TP.HCM"),
    P([R("Sau 03 ngày làm việc kể từ khi nhận đủ phí, Bên A xuất hóa đơn VAT theo quy định.",{size:SZ.md,color:SLATE,italic:true})],{before:10,after:60}),

    DIEU("Điều 3","Quyền và nghĩa vụ của Bên A"),
    DIEU("Điều 4","Quyền và nghĩa vụ của Bên B"),
    dutyTable,

    DIEU("Điều 5","Thời hạn"),
    P([R(`Thời hạn thực hiện hợp đồng: `,{size:SZ.md,color:SLATE}),R(thoi_han,{bold:true,size:SZ.md,color:NAVY}),R(". Trong trường hợp kéo dài, hai bên thỏa thuận bằng phụ lục hợp đồng.",{size:SZ.md,color:SLATE})],{before:0,after:60}),

    DIEU("Điều 6","Hiệu lực"),
    P([R("Hợp đồng có hiệu lực kể từ ngày các bên ký tên xác nhận bên dưới, và kết thúc khi:",{size:SZ.md,color:SLATE})],{before:0,after:20}),
    BUL("Đã hết thời hạn tại Điều 5 và các Bên đồng ý chấm dứt Hợp đồng;"),
    BUL("Khi công việc được hoàn thành theo Điều 1;"),
    BUL("Một trong các Bên đơn phương chấm dứt Hợp đồng theo thỏa thuận hoặc theo pháp luật."),
    P([R("Ngoài các trường hợp nêu trên, Hợp đồng không thể hủy ngang.",{size:SZ.md,color:SLATE,italic:true})],{before:10,after:60}),

    DIEU("Điều 7","Giải quyết tranh chấp"),
    P([R("Khi phát sinh tranh chấp, các Bên ưu tiên thương lượng, hòa giải. Nếu hòa giải không thành, một Bên có quyền khởi kiện ra Tòa án nhân dân có thẩm quyền tại TP. Hồ Chí Minh để giải quyết theo pháp luật Việt Nam.",{size:SZ.md,color:SLATE})],{before:0,after:60}),

    DIEU("Điều 8","Cam kết chung"),
    P([R("Trước khi ký Hợp đồng này, các Bên đã tìm hiểu kỹ về tư cách, thẩm quyền, năng lực của nhau. Các Bên ký Hợp đồng trong trạng thái hoàn toàn tự nguyện, tự do ý chí, không bị ép buộc.",{size:SZ.md,color:SLATE})],{before:0,after:20}),
    P([R("Hợp đồng được lập tại 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3, TP.HCM, thành 02 bản chính tiếng Việt có giá trị pháp lý như nhau, mỗi Bên giữ 01 bản.",{size:SZ.md,color:SLATE})],{before:0,after:60}),
  ];

  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
    rows:[new TableRow({children:[
      CELL(clauses,{w:PW,bg:WHITE,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:120,bottom:120,left:200,right:200}}),
    ]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T6: BANKING
// ────────────────────────────────────────────────────────
function t6_banking(F){
  const qr=loadImg(["QR_CTY_LMT.jpg","QR_CTY_LMT.png","QR.jpg","QR.png"]);
  const wL=Math.round(PW*0.60),wR=PW-wL;
  const hdrRow=new TableRow({children:[
    new TableCell({
      children:[P([R("BANKING DETAILS  /  THÔNG TIN THANH TOÁN",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.LEFT,before:80,after:80})],
      columnSpan:2,shading:{type:ShadingType.CLEAR,color:NAVY,fill:NAVY},
      borders:B_NONE,margins:{top:60,bottom:60,left:180,right:180},
    }),
  ]});
  const leftCh=[
    P([R("Tên tài khoản:",{bold:true,size:SZ.md,color:NAVY})],{before:80,after:8,align:AlignmentType.LEFT}),
    P([R("CTY LUAT TNHH MINH TU",{bold:true,size:SZ.lg,color:NAVY})],{before:0,after:14,align:AlignmentType.LEFT}),
    P([R("Số tài khoản:",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:8,align:AlignmentType.LEFT}),
    P([R("5150056789",{bold:true,size:SZ.xxl,color:NAVY})],{before:0,after:14,align:AlignmentType.LEFT}),
    P([R("Ngân hàng: MB Bank (TMCP Quân Đội)",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:4,align:AlignmentType.LEFT}),
    P([R("Chi nhánh Phú Nhuận, TP.HCM",{size:SZ.md,color:SLATE})],{before:0,after:14,align:AlignmentType.LEFT}),
    P([R("Nội dung CK: ",{bold:true,size:SZ.md,color:NAVY}),R(`[Họ tên]  —  Phí DV  —  ${so_hop_dong}`,{size:SZ.md,color:SLATE})],{before:0,after:14,align:AlignmentType.LEFT}),
    P([R("Tổng phí: ",{bold:true,size:SZ.md,color:NAVY}),R("₫ "+vnd(F.total),{bold:true,size:SZ.lg,color:GOLD})],{before:0,after:80,align:AlignmentType.LEFT}),
  ];
  const rightCh=[P([R("Quét mã QR để thanh toán:",{bold:true,size:SZ.md,color:NAVY})],{align:AlignmentType.CENTER,before:80,after:14})];
  if(qr){
    rightCh.push(new Paragraph({children:[new ImageRun({data:qr.buf,type:qr.type,transformation:{width:120,height:120}})],alignment:AlignmentType.CENTER,spacing:{before:40,after:40}}));
  }else{
    rightCh.push(P([R("[QR Code MB Bank]",{size:SZ.sm,color:"AAAAAA",italic:true})],{align:AlignmentType.CENTER,before:60,after:60}));
  }
  rightCh.push(
    P([R("VietQR  ·  MB Bank",{bold:true,size:SZ.sm2,color:NAVY})],{align:AlignmentType.CENTER,before:14,after:4}),
    P([R("STK: 5150056789",{size:SZ.md,color:SLATE})],{align:AlignmentType.CENTER,before:0,after:80}),
  );
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[hdrRow,new TableRow({children:[CELL(leftCh,{w:wL,bg:BG3,borders:B_CELL}),CELL(rightCh,{w:wR,bg:BG1,borders:B_CELL})]})],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T7: KÝ KẾT 2 BÊN
// ────────────────────────────────────────────────────────
function t7_signing(){
  const wH=Math.round(PW/2);
  const sigBox=(party,name,role,extra=[])=>[
    P([R(`Đại diện ${party}`,{bold:true,size:SZ.md,color:NAVY})],{before:100,after:20,align:AlignmentType.CENTER}),
    P([R("(đánh dấu ✔ vào ô vuông, điền ngày, ký và ghi rõ họ tên)",{size:SZ.xs,color:SLATE,italic:true})],{before:0,after:16,align:AlignmentType.CENTER}),
    P([R("☐  Tôi đã đọc và đồng ý toàn bộ nội dung Hợp đồng.",{size:SZ.md,color:SLATE})],{before:0,after:20,indent:60}),
    ...extra,
    P([R("Ngày: ______ / ______ / __________",{size:SZ.md,color:SLATE})],{before:20,after:80,align:AlignmentType.CENTER}),
    ...Array.from({length:4},()=>P([R("",{})],{before:0,after:0})),  // space for signature
    P([R(name,{bold:true,size:SZ.lg,color:NAVY})],{before:0,after:4,align:AlignmentType.CENTER}),
    P([R(role,{size:SZ.md,color:SLATE,italic:true})],{before:0,after:100,align:AlignmentType.CENTER}),
  ];

  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wH,PW-wH],
    rows:[
      new TableRow({children:[
        CELL(P([R("THAY MẶT VÀ ĐẠI DIỆN BÊN A",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER,before:60,after:60}),{w:wH,bg:NAVY,borders:B_NONE}),
        CELL(P([R("THAY MẶT VÀ ĐẠI DIỆN BÊN B",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER,before:60,after:60}),{w:PW-wH,bg:NAVY2,borders:B_NONE}),
      ]}),
      new TableRow({children:[
        CELL(sigBox("Bên A","VÕ HỒNG TÚ","Giám đốc / Luật sư điều hành"),{w:wH,bg:BG1,borders:B_CELL,vAlign:VerticalAlign.TOP}),
        CELL(sigBox("Bên B",ten_than_chu.toUpperCase(),"Bên sử dụng dịch vụ"),{w:PW-wH,bg:BG2,borders:B_CELL,vAlign:VerticalAlign.TOP}),
      ]}),
    ],
    borders:TB_NONE,
  });
}

// ────────────────────────────────────────────────────────
// T8: FOOTER
// ────────────────────────────────────────────────────────
function t8_footer(){
  const wL=Math.round(PW*0.82),wR=PW-wL;
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      CELL(P([R(`© ${new Date().getFullYear()} Minhtu Law Co., Ltd  ·  GPĐKHĐ: 41.02.4764/TP/ĐKHĐ  ·  MST: 0318941023  ·  luatminhtu.vn`,{size:SZ.xs,color:"AABCCC"})],
             {align:AlignmentType.LEFT,before:80,after:80}),
        {w:wL,bg:NAVY,borders:B_NONE,margins:{top:60,bottom:60,left:180,right:100}}),
      CELL(P([R(so_hop_dong,{bold:true,size:SZ.xs,color:NAVY})],{align:AlignmentType.CENTER,before:80,after:80}),
        {w:wR,bg:GOLD,borders:B_NONE}),
    ]})],
    borders:TB_NONE,
  });
}

// ── BUILD ────────────────────────────────────────────────
async function build(){
  const F=calcFee(tong_phi_raw);

  const children=[
    t0_header(),            ...GAP(1),
    t1_confidential(),      ...GAP(1),
    t2_statBoxes(F),        ...GAP(1),
    SECT("Thông tin các Bên","Parties Information"),
    t3_parties(),
    t3b_partiesDetail(),    ...GAP(1),
    SECT("Căn cứ Pháp lý","Legal Basis"),
    t4_canCu(),             ...GAP(1),
    SECT("Nội dung Hợp đồng","Agreement Terms"),
    t5_articles(F),         ...GAP(1),
    t6_banking(F),          ...GAP(1),
    SECT("Ký kết Hợp đồng","Signatures"),
    t7_signing(),           ...GAP(1),
    t8_footer(),
  ];

  const doc=new Document({
    styles:{default:{document:{run:{font:FONT,size:SZ.md}}}},
    sections:[{
      properties:{page:{margin:{top:720,bottom:720,left:720,right:720}}},
      children,
    }],
  });

  fs.writeFileSync(DOCX_PATH,await Packer.toBuffer(doc));
  console.log("OK:"+DOCX_PATH);
}

build().catch(e=>{console.error("ERR:"+e.message);process.exit(1);});
