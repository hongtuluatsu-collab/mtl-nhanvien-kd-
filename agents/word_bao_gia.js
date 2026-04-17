/**
 * word_bao_gia.js — MTL Fee Proposal v4
 * Thêm 6 nhóm điều khoản từ mẫu Sơn EXO:
 *  - Thời hạn thực hiện
 *  - Cam kết liên lạc
 *  - Trách nhiệm bổ sung của Khách hàng
 *  - Miễn trừ trách nhiệm
 *  - Yêu cầu tài liệu
 *  - Xác nhận & Ký kết (có ô checkbox)
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
if (!JSON_PATH || !DOCX_PATH) { console.error("Usage: node word_bao_gia.js input.json output.docx"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
const {
  ma_bao_gia   = "BG-2026-0001",
  ten_than_chu = "Quý Khách Hàng",
  dia_chi      = "",
  sdt          = "",
  email        = "",
  ten_du_an    = "",
  loai_dich_vu = "Trọn gói",
  loai_vu      = "Dịch vụ pháp lý",
  mo_ta_ngan   = "",
  tong_phi_raw = 0,
  ngay_lap     = new Date().toLocaleDateString("vi-VN"),
  noi_dung     = "",
} = D;

// ── COLORS ──────────────────────────────────────────────
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
const SZ = { xs:13, sm:14, sm2:15, md:16, md2:17, lg:19, xl:21, xxl:26, hero:30 };
const PW = 9360;

// ── UTILS ───────────────────────────────────────────────
const vnd = n => Math.round(parseInt(String(n).replace(/\D/g,""))||0)
  .toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");

function calcFee(raw) {
  const total = Math.round(parseInt(String(raw).replace(/\D/g,""))||0);
  const vat   = Math.round(total / 13.5);  // 8% VAT: vat = total * 0.08/1.08
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

function parseScope(text) {
  const items=[];
  const re=/(\d{2})\.\s+([^\n]+)\n?([\s\S]*?)(?=\d{2}\.|[IVX]+\.|$)/g;
  let m;
  while((m=re.exec(text))!==null){
    const title=m[2].trim(), desc=m[3].replace(/^\s+/gm,"").trim().split("\n")[0]||"";
    if(title)items.push({num:m[1],title,desc});
  }
  if(!items.length)
    text.split("\n").map(l=>l.trim()).filter(Boolean).slice(0,6)
      .forEach((l,i)=>items.push({num:String(i+1).padStart(2,"0"),title:l,desc:""}));
  return items.slice(0,8);
}

function loadImg(names){
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

const P=(children,{align=AlignmentType.LEFT,before=50,after=50,indent=0,line=320}={})=>
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

const SECT=(vi,en)=>new Table({
  width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
  rows:[new TableRow({children:[
    CELL([P([R(vi+"  ",{bold:true,size:SZ.md,color:WHITE}),R("—  "+en,{size:SZ.sm2,color:"8FAEC8",italic:true})],
           {align:AlignmentType.LEFT,before:80,after:80})],
      {w:PW,bg:NAVY,borders:B_NONE,margins:{top:60,bottom:60,left:180,right:180}}),
  ]})],
  borders:TB_NONE,
});

// Bullet point trong điều khoản
const BULLET=(text,{bold=false,color=SLATE}={})=>
  P([R("–  ",{size:SZ.md,color:GOLD}), R(text,{size:SZ.md,color,bold})],
    {before:30,after:30,indent:240});

// ────────────────────────────────────────────────────────
// TABLES
// ────────────────────────────────────────────────────────

function t0_header(){
  const logo=loadImg(["LOGO.jpg","LOGO.png","logo.jpg","logo.png"]);
  const wL=Math.round(PW*0.50),wR=PW-wL;
  const leftCh=[];
  if(logo){
    leftCh.push(new Paragraph({children:[new ImageRun({data:logo.buf,type:logo.type,transformation:{width:160,height:54}})],spacing:{before:80,after:60}}));
  }else{
    leftCh.push(P([R("MINHTU LAW CO., LTD",{bold:true,size:SZ.xl,color:NAVY})],{before:80,after:10}));
    leftCh.push(P([R("Công ty Luật TNHH Minh Tú",{size:SZ.md,color:NAVY,italic:true})],{before:0,after:10}));
  }
  leftCh.push(P([R("Our Experience Is Your Success",{size:SZ.sm,color:GOLD})],{before:0,after:80}));
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      CELL(leftCh,{w:wL,borders:B_GOLD_BTM,margins:{top:80,bottom:80,left:0,right:100}}),
      CELL([
        P([R("FEE PROPOSAL",{bold:true,size:SZ.xs,color:SLATE})],{align:AlignmentType.RIGHT,before:80,after:10}),
        P([R("Thư Báo Phí Dịch Vụ",{bold:true,size:SZ.hero,color:NAVY})],{align:AlignmentType.RIGHT,before:0,after:8}),
        P([R("Service Fee Letter",{size:SZ.sm2,color:GOLD})],{align:AlignmentType.RIGHT,before:0,after:14}),
        P([R(`No: ${ma_bao_gia}  ·  ${ngay_lap}`,{size:SZ.sm,color:SLATE})],{align:AlignmentType.RIGHT,before:0,after:6}),
        P([R("Hiệu lực: 30 ngày từ ngày phát hành",{size:SZ.xs,color:SLATE})],{align:AlignmentType.RIGHT,before:0,after:80}),
      ],{w:wR,borders:B_GOLD_BTM,margins:{top:80,bottom:80,left:100,right:0}}),
    ]})],
    borders:TB_NONE,
  });
}

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

function t2_statBoxes(F){
  const w0=Math.floor(PW/4),wL=PW-w0*3;
  const BX={style:BorderStyle.SINGLE,size:3,color:"DDE5EF"};
  const BOX_B={top:BX,bottom:BX,left:BX,right:BX};
  function box(label,val,sub,w,hi=false){
    const bg=hi?BG2:BG1;
    return CELL([
      P([R(label,{bold:true,size:SZ.xs,color:GOLD})],{before:100,after:14}),
      P([R(val,{bold:true,size:hi?SZ.xl:SZ.lg,color:NAVY})],{before:0,after:sub?8:100}),
      ...(sub?[P([R(sub,{size:SZ.xs,color:SLATE})],{before:0,after:100})]:[]),
    ],{w,bg,borders:BOX_B,margins:ML});
  }
  const kh=ten_than_chu.length>20?ten_than_chu.slice(0,19)+"…":ten_than_chu;
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[w0,w0,w0,wL],
    rows:[new TableRow({children:[
      box("KHÁCH HÀNG",kh,sdt||email||"",w0),
      box("DỰ ÁN",(ten_du_an||loai_vu).slice(0,24),"",w0),
      box("DỊCH VỤ",loai_dich_vu.slice(0,20),"",w0),
      box("TỔNG PHÍ","₫ "+vnd(F.total),"Đã bao gồm VAT (8%)",wL,true),
    ]})],
    borders:TB_NONE,
  });
}

function t3_scope(items){
  const W0=400,W1=PW-W0;
  const rows=items.map((it,i)=>{
    const bg=i%2===0?WHITE:BG1;
    return new TableRow({children:[
      CELL(P([R(it.num,{bold:true,size:SZ.lg,color:NAVY})],{align:AlignmentType.CENTER}),{w:W0,bg,borders:B_CELL}),
      CELL([
        P([R(it.title,{bold:true,size:SZ.lg,color:NAVY})],{before:80,after:6}),
        ...(it.desc?[P([R(it.desc,{size:SZ.md,color:SLATE})],{before:0,after:80})]:[]),
      ],{w:W1,bg,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:80,bottom:80,left:140,right:120}}),
    ]});
  });
  return new Table({width:{size:PW,type:WidthType.DXA},columnWidths:[W0,W1],rows,borders:TB_NONE});
}

function t4_fee(F){
  const W0=Math.round(PW*0.52),W1=Math.round(PW*0.24),W2=Math.round(PW*0.12),W3=PW-W0-W1-W2;
  const hdr=new TableRow({children:[
    CELL(P([R("Hạng mục dịch vụ",{bold:true,size:SZ.md,color:WHITE})]),{w:W0,bg:NAVY,borders:B_NONE}),
    CELL(P([R("Số tiền (VNĐ)",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.RIGHT}),{w:W1,bg:NAVY,borders:B_NONE}),
    CELL(P([R("Thuế",{bold:true,size:SZ.md,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W2,bg:NAVY,borders:B_NONE}),
    CELL(P([R("Note",{bold:true,size:SZ.md,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W3,bg:NAVY,borders:B_NONE}),
  ]});
  const r1=new TableRow({children:[
    CELL(P([R("Phí dịch vụ pháp lý chuyên nghiệp",{size:SZ.lg,color:SLATE})]),{w:W0,bg:BG1,borders:B_CELL}),
    CELL(P([R(vnd(F.base),{size:SZ.lg,color:SLATE})],{align:AlignmentType.RIGHT}),{w:W1,bg:BG1,borders:B_CELL}),
    CELL(P([R("+8%",{size:SZ.md,color:SLATE})],{align:AlignmentType.CENTER}),{w:W2,bg:BG1,borders:B_CELL}),
    CELL(P([R("Incl.",{size:SZ.sm,color:SLATE})],{align:AlignmentType.CENTER}),{w:W3,bg:BG1,borders:B_CELL}),
  ]});
  const r2=new TableRow({children:[
    CELL(P([R("Thuế Giá trị Gia tăng — VAT (8%)",{size:SZ.lg,color:SLATE})]),{w:W0,bg:WHITE,borders:B_CELL}),
    CELL(P([R(vnd(F.vat),{size:SZ.lg,color:SLATE})],{align:AlignmentType.RIGHT}),{w:W1,bg:WHITE,borders:B_CELL}),
    CELL(P([R("—",{size:SZ.md,color:SLATE})],{align:AlignmentType.CENTER}),{w:W2,bg:WHITE,borders:B_CELL}),
    CELL(P([R("Stat.",{size:SZ.sm,color:SLATE})],{align:AlignmentType.CENTER}),{w:W3,bg:WHITE,borders:B_CELL}),
  ]});
  const rT=new TableRow({children:[
    CELL(P([R("TỔNG PHÍ DỊCH VỤ (ĐÃ BAO GỒM VAT)",{bold:true,size:SZ.md,color:WHITE})]),{w:W0,bg:NAVY,borders:B_NONE}),
    CELL(P([R(vnd(F.total)+" ₫",{bold:true,size:SZ.xl,color:GOLD2})],{align:AlignmentType.RIGHT}),{w:W1,bg:NAVY,borders:B_NONE}),
    CELL(P([R("",{size:SZ.md,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W2,bg:NAVY,borders:B_NONE}),
    CELL(P([R("FINAL",{bold:true,size:SZ.sm,color:GOLD2})],{align:AlignmentType.CENTER}),{w:W3,bg:NAVY,borders:B_NONE}),
  ]});
  return new Table({width:{size:PW,type:WidthType.DXA},columnWidths:[W0,W1,W2,W3],rows:[hdr,r1,r2,rT],borders:TB_NONE});
}

function t5_payment(total){
  const p1=Math.round(total*0.7),p2=total-p1;
  const rows_d=[
    {n:"1",mile:"Ký hợp đồng dịch vụ",trigger:`Khi ký kết Hợp đồng Dịch vụ Pháp lý giữa Minhtu Law Co., Ltd và ${ten_than_chu}.`,amt:p1,pct:"70%"},
    {n:"2",mile:"Hoàn tất vụ việc",trigger:`Sau khi hoàn tất vụ việc và bàn giao Báo cáo Hoàn thành cho ${ten_than_chu}.`,amt:p2,pct:"30%"},
  ];
  const W0=360,W1=1440,W2=Math.round(PW*0.38),W3=Math.round(PW*0.20),W4=PW-W0-W1-W2-W3;
  const hdr=new TableRow({children:[
    CELL(P([R("#",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER}),{w:W0,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("Milestone",{bold:true,size:SZ.md,color:WHITE})]),{w:W1,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("Điều kiện thanh toán / Trigger",{bold:true,size:SZ.md,color:WHITE})]),{w:W2,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("Số tiền (₫)",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER}),{w:W3,bg:NAVY2,borders:B_NONE}),
    CELL(P([R("%",{bold:true,size:SZ.md,color:WHITE})],{align:AlignmentType.CENTER}),{w:W4,bg:NAVY2,borders:B_NONE}),
  ]});
  const dRows=rows_d.map((row,i)=>{
    const bg=i===0?BG1:BG2;
    return new TableRow({children:[
      CELL(P([R(row.n,{bold:true,size:SZ.lg,color:NAVY})],{align:AlignmentType.CENTER}),{w:W0,bg,borders:B_CELL}),
      CELL(P([R(row.mile,{bold:true,size:SZ.lg,color:NAVY})]),{w:W1,bg,borders:B_CELL}),
      CELL(P([R(row.trigger,{size:SZ.md,color:SLATE})]),{w:W2,bg,borders:B_CELL}),
      CELL(P([R(vnd(row.amt),{bold:true,size:SZ.lg,color:NAVY})],{align:AlignmentType.RIGHT}),{w:W3,bg,borders:B_CELL}),
      CELL(P([R(row.pct,{bold:true,size:SZ.lg,color:GOLD})],{align:AlignmentType.CENTER}),{w:W4,bg,borders:B_CELL}),
    ]});
  });
  return new Table({width:{size:PW,type:WidthType.DXA},columnWidths:[W0,W1,W2,W3,W4],rows:[hdr,...dRows],borders:TB_NONE});
}

// ── MỚI: ĐIỀU KIỆN & ĐIỀU KHOẢN (từ mẫu Sơn EXO) ────────
function t_terms(){
  // Mỗi nhóm: tiêu đề Gold + danh sách bullet
  function termGroup(title, bullets){
    return [
      P([R(title,{bold:true,size:SZ.md,color:NAVY})],{before:120,after:40}),
      ...bullets.map(b=>BULLET(b)),
    ];
  }

  const thoi_han = termGroup("1. Thời hạn thực hiện",[
    "Thời hạn thực hiện tối đa là 24 (hai mươi bốn) tháng, tính từ ngày Quý Khách hàng ký Hợp đồng và tạm ứng phí dịch vụ.",
    "Phí dịch vụ nêu trên đã bao gồm thuế VAT và chi phí đi lại, lưu trú; chưa bao gồm án phí, lệ phí nộp cho cơ quan Nhà nước theo luật định.",
  ]);

  const lien_lac = termGroup("2. Cam kết liên lạc",[
    "Luật Minh Tú sẽ thường xuyên thông báo tiến độ công việc và xin ý kiến Quý Khách hàng trước các quyết định quan trọng.",
    "Quý Khách hàng có trách nhiệm hồi âm kịp thời các thư từ, điện thoại và hình thức liên lạc thương mại điện tử khác.",
    "Việc duy trì liên lạc thường xuyên là điều kiện tiên quyết để đảm bảo chất lượng dịch vụ.",
  ]);

  const trach_nhiem = termGroup("3. Trách nhiệm bổ sung của Khách hàng",[
    "Cung cấp đầy đủ thông tin, tài liệu liên quan theo yêu cầu của Luật Minh Tú, dưới bất kỳ phương thức hay hình thức nào.",
    "Nghiêm túc cân nhắc ý kiến tư vấn của Luật Minh Tú trước khi quyết định các vấn đề quan trọng.",
    "Kịp thời thông báo cho Luật Minh Tú về bất kỳ diễn biến hoặc thông tin mới có liên quan đến vụ việc.",
    "Hỗ trợ Luật Minh Tú theo các hình thức khác khi được yêu cầu, nhằm đảm bảo chất lượng dịch vụ.",
  ]);

  const mien_tru = termGroup("4. Miễn trừ trách nhiệm",[
    "Quý Khách hàng không còn muốn tiếp tục công việc mà không có lý do chính đáng.",
    "Thông tin hoặc tài liệu Quý Khách hàng cung cấp không chính xác hoặc sai lệch.",
    "Quý Khách hàng không đáp ứng được các yêu cầu luật định để thực hiện công việc.",
    "Thay đổi chính sách, pháp luật của Nhà nước tại thời điểm thực hiện dịch vụ.",
    "Trách nhiệm bồi thường của Luật Minh Tú trong mọi trường hợp không vượt quá tổng số phí dịch vụ Khách hàng đã thanh toán. Thời hiệu khởi kiện là 02 (hai) năm kể từ khi phát sinh nguyên nhân tranh chấp.",
  ]);

  const tai_lieu = termGroup("5. Yêu cầu tài liệu",[
    "Danh sách tài liệu cần thiết sẽ được cung cấp tùy từng thời điểm, phù hợp với tiến độ thực hiện dịch vụ.",
    "Quý Khách hàng đảm bảo tính chính xác, hợp pháp của toàn bộ tài liệu cung cấp cho Luật Minh Tú.",
    "Tài liệu gốc sẽ được hoàn trả sau khi công việc kết thúc; bản sao được lưu trữ bảo mật theo quy định.",
  ]);

  const all_content = [...thoi_han, ...lien_lac, ...trach_nhiem, ...mien_tru, ...tai_lieu];

  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
    rows:[new TableRow({children:[
      CELL(all_content,{
        w:PW,bg:BG1,borders:B_CELL,
        vAlign:VerticalAlign.TOP,
        margins:{top:120,bottom:120,left:200,right:200},
      }),
    ]})],
    borders:TB_NONE,
  });
}

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
    P([R("Tên tài khoản:",{bold:true,size:SZ.md,color:NAVY})],{before:80,after:8}),
    P([R("CTY LUAT TNHH MINH TU",{bold:true,size:SZ.lg,color:NAVY})],{before:0,after:14}),
    P([R("Số tài khoản:",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:8}),
    P([R("5150056789",{bold:true,size:SZ.xxl,color:NAVY})],{before:0,after:14}),
    P([R("Ngân hàng:",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:6}),
    P([R("MB Bank (TMCP Quân Đội)",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:4}),
    P([R("Chi nhánh Phú Nhuận, TP.HCM",{size:SZ.md,color:SLATE})],{before:0,after:14}),
    P([R("Nội dung CK: ",{bold:true,size:SZ.md,color:NAVY}),R(`[Họ tên]  —  Phí DV  —  ${ten_du_an||loai_vu}  —  ${ma_bao_gia}`,{size:SZ.md,color:SLATE})],{before:0,after:14}),
    P([R("Tổng chuyển khoản: ",{bold:true,size:SZ.md,color:NAVY}),R("₫ "+vnd(F.total),{bold:true,size:SZ.lg,color:GOLD})],{before:0,after:80}),
  ];
  const rightCh=[
    P([R("Quét mã QR để thanh toán:",{bold:true,size:SZ.md,color:NAVY})],{align:AlignmentType.CENTER,before:80,after:14}),
  ];
  if(qr){
    rightCh.push(new Paragraph({children:[new ImageRun({data:qr.buf,type:qr.type,transformation:{width:120,height:120}})],alignment:AlignmentType.CENTER,spacing:{before:40,after:40}}));
  }else{
    rightCh.push(P([R("[QR Code MB Bank]",{size:SZ.sm,color:"AAAAAA",italic:true})],{align:AlignmentType.CENTER,before:60,after:60}));
  }
  rightCh.push(
    P([R("VietQR  ·  MB Bank",{bold:true,size:SZ.sm2,color:NAVY})],{align:AlignmentType.CENTER,before:14,after:4}),
    P([R("STK: 5150056789",{size:SZ.md,color:SLATE})],{align:AlignmentType.CENTER,before:0,after:80}),
  );
  const contentRow=new TableRow({children:[
    CELL(leftCh,{w:wL,bg:BG3,borders:B_CELL}),
    CELL(rightCh,{w:wR,bg:BG1,borders:B_CELL}),
  ]});
  return new Table({width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],rows:[hdrRow,contentRow],borders:TB_NONE});
}

// ── MỚI: XÁC NHẬN & KÝ KẾT (có checkbox) ────────────────
function t7_signOff(){
  const wL=Math.round(PW*0.54),wR=PW-wL;

  // Ô xác nhận với checkbox
  const checkBox=[
    P([R("Xác nhận & Chấp thuận",{bold:true,size:SZ.md,color:NAVY})],{before:100,after:20}),
    P([R("☐  Tôi đã đọc, hiểu và đồng ý toàn bộ nội dung Thư Báo Phí này.",{size:SZ.md,color:SLATE})],{before:0,after:20,indent:60}),
    P([R("☐  Tôi ủy quyền cho Luật Minh Tú tiến hành các thủ tục pháp lý theo phạm vi đã thỏa thuận.",{size:SZ.md,color:SLATE})],{before:0,after:40,indent:60}),
    P([R("Ngày: ______ / ______ / __________",{size:SZ.md,color:SLATE})],{before:0,after:20}),
    P([R("Chữ ký: _______________________   Họ tên: _______________________",{size:SZ.md,color:SLATE})],{before:0,after:10}),
    P([R("Chức vụ: _______________________",{size:SZ.md,color:SLATE})],{before:0,after:100}),
  ];

  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      // LEFT: LS Võ Hồng Tú
      CELL([
        P([R("Kính trân trọng,",{size:SZ.lg,color:SLATE})],{before:100,after:50}),
        P([R("VÕ HỒNG TÚ",{bold:true,size:SZ.xxl,color:NAVY})],{before:0,after:14}),
        P([R("CEO & Managing Partner",{size:SZ.md,color:SLATE})],{before:0,after:8}),
        P([R("Minhtu Law Co., Ltd",{bold:true,size:SZ.lg,color:NAVY})],{before:0,after:8}),
        P([R("LLM  ·  Real Estate & Dispute Resolution  ·  17 Years",{size:SZ.sm,color:SLATE})],{before:0,after:14}),
        P([R("T: 0967.837.868   E: votu@luatminhtu.vn",{size:SZ.md,color:NAVY})],{before:0,after:100}),
      ],{w:wL,bg:BG1,borders:B_CELL}),
      // RIGHT: Validity + Checkbox
      CELL([
        P([R("Hiệu lực Báo giá",{bold:true,size:SZ.sm,color:NAVY})],{before:100,after:8}),
        P([R("30 ngày từ ngày "+ngay_lap,{size:SZ.md,color:SLATE})],{before:0,after:20}),
        P([R("Tính Bảo mật",{bold:true,size:SZ.sm,color:NAVY})],{before:0,after:8}),
        P([R(`Tài liệu RIÊNG TƯ & BẢO MẬT, soạn riêng cho ${ten_than_chu}.`,{size:SZ.md,color:SLATE})],{before:0,after:100}),
      ],{w:wR,bg:BG2,borders:B_CELL}),
    ]})],
    borders:TB_NONE,
  });
}

// Bảng xác nhận riêng (full-width checkbox) ──────────────
function t8_confirm(){
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[PW],
    rows:[new TableRow({children:[
      CELL([
        P([R("XÁC NHẬN CỦA KHÁCH HÀNG",{bold:true,size:SZ.md,color:NAVY})],{before:100,after:30}),
        P([R(`Tôi, _____________________________________ , xác nhận đồng ý và chấp thuận sử dụng dịch vụ của Công ty Luật TNHH Minh Tú theo các điều kiện và điều khoản nêu trên.`,{size:SZ.md,color:SLATE})],{before:0,after:30}),
        P([R("☐  Tôi đã đọc và đồng ý.",{bold:true,size:SZ.md,color:NAVY})],{before:0,after:30,indent:60}),
        P([R("Ngày: ______ / ______ / __________",{size:SZ.md,color:SLATE})],{before:0,after:20}),
        P([R("Chữ ký: _______________________   Họ tên: _______________________   Chức vụ: _______________",{size:SZ.md,color:SLATE})],{before:0,after:100}),
      ],{w:PW,bg:BG3,borders:B_CELL,vAlign:VerticalAlign.TOP,margins:{top:120,bottom:120,left:200,right:200}}),
    ]})],
    borders:TB_NONE,
  });
}

function t9_footer(){
  const wL=Math.round(PW*0.82),wR=PW-wL;
  return new Table({
    width:{size:PW,type:WidthType.DXA},columnWidths:[wL,wR],
    rows:[new TableRow({children:[
      CELL(P([R(`© ${new Date().getFullYear()} Minhtu Law Co., Ltd  ·  TP. Hồ Chí Minh  ·  Strictly Private & Confidential`,{size:SZ.xs,color:"AABCCC"})],
             {align:AlignmentType.LEFT,before:80,after:80}),
        {w:wL,bg:NAVY,borders:B_NONE,margins:{top:60,bottom:60,left:180,right:100}}),
      CELL(P([R(ma_bao_gia,{bold:true,size:SZ.xs,color:NAVY})],{align:AlignmentType.CENTER,before:80,after:80}),
        {w:wR,bg:GOLD,borders:B_NONE}),
    ]})],
    borders:TB_NONE,
  });
}

// ── BUILD ────────────────────────────────────────────────
async function build(){
  const F=calcFee(tong_phi_raw);
  const scope=parseScope(noi_dung);
  if(!scope.length) scope.push({num:"01",title:loai_vu,desc:mo_ta_ngan||"Dịch vụ pháp lý toàn diện."});

  const children=[
    t0_header(),                                          ...GAP(1),
    t1_confidential(),                                    ...GAP(1),
    t2_statBoxes(F),                                      ...GAP(1),
    SECT("Phạm vi Dịch vụ Pháp lý","Scope of Legal Services"),
    t3_scope(scope),                                      ...GAP(1),
    SECT("Biểu Phí Dịch vụ","Professional Fee Schedule"),
    t4_fee(F),
    P([R("Bằng chữ: ",{bold:true,size:SZ.md,color:NAVY}),
       R(chu(F.total),{size:SZ.md,color:SLATE,italic:true})],{before:80,after:80}),
                                                          ...GAP(1),
    SECT("Lịch Thanh toán","Payment Schedule"),
    t5_payment(F.total),                                  ...GAP(1),
    SECT("Điều kiện & Điều khoản","Terms & Conditions"),
    t_terms(),                                            ...GAP(1),
    t6_banking(F),                                        ...GAP(1),
    SECT("Xác nhận & Ký kết","Sign-off"),
    t7_signOff(),                                         ...GAP(1),
    t8_confirm(),                                         ...GAP(1),
    t9_footer(),
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
