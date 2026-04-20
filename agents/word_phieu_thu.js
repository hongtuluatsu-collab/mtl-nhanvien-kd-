/**
 * word_phieu_thu.js — Phiếu Thu MTL
 * Design: Navy/Gold MTL brand — bổ sung 5 chữ ký, Nợ/Có, 2 liên, "Đã nhận đủ"
 * Usage: node word_phieu_thu.js input.json output.docx
 */
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType,
  ImageRun, Footer, PageNumber, VerticalAlign, convertInchesToTwip
} = require("docx");
const fs = require("fs"), path = require("path");

const NAVY="1B4A7A", GOLD="B8973A", WHITE="FFFFFF", LIGHT="EEF3F9",
      GRAY="666666", BLACK="1A1A1A", WARM="FFF8EC";

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) { console.error("Usage: node word_phieu_thu.js input.json output.docx"); process.exit(1); }
const d = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

const fmtNum=(n)=>String(parseInt(String(n).replace(/\D/g,""))||0).replace(/\B(?=(\d{3})+(?!\d))/g,".");

const soThanhChu=(n)=>{
  const dvDon=["","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"];
  const dvChuc=["","mười","hai mươi","ba mươi","bốn mươi","năm mươi","sáu mươi","bảy mươi","tám mươi","chín mươi"];
  function doc3(x){const tram=Math.floor(x/100),chuc=Math.floor((x%100)/10),don=x%10;let s="";
    if(tram>0)s+=dvDon[tram]+" trăm ";if(chuc>1)s+=dvChuc[chuc]+" ";else if(chuc===1)s+="mười ";else if(tram>0&&don>0)s+="lẻ ";
    if(don>0){if(chuc>1&&don===1)s+="mốt";else if(chuc>0&&don===5)s+="lăm";else s+=dvDon[don];}return s.trim();}
  const num=parseInt(String(n).replace(/\D/g,""))||0;if(!num)return "Không đồng";
  const ty=Math.floor(num/1e9),tr=Math.floor((num%1e9)/1e6),ng=Math.floor((num%1e6)/1e3),don=num%1e3;
  let r="";if(ty>0)r+=doc3(ty)+" tỷ ";if(tr>0)r+=doc3(tr)+" triệu ";if(ng>0)r+=doc3(ng)+" nghìn ";if(don>0)r+=doc3(don);
  r=r.trim();return r.charAt(0).toUpperCase()+r.slice(1)+" đồng chẵn";
};

const LOGO_PATH=path.join(__dirname,"..","data","mau","LOGO.jpg");
const QR_PATH  =path.join(__dirname,"..","data","mau","QR_CTY_LMT.jpg");
const logoData =fs.existsSync(LOGO_PATH)?fs.readFileSync(LOGO_PATH):null;
const qrData   =fs.existsSync(QR_PATH)  ?fs.readFileSync(QR_PATH)  :null;

// ── Data ─────────────────────────────────────────────────────────
const maPT        = d.ma_phieu_thu   || ("PT-"+new Date().toISOString().slice(0,7).replace("-","")+"-001");
const soPhieu     = d.so_phieu       || maPT;
const ngayThu     = d.ngay_thu       || new Date().toLocaleDateString("vi-VN");
const nguoiNop    = d.nguoi_nop      || d.ten_than_chu || "";
const diaChiNop   = d.dia_chi        || "";
const sdtNop      = d.sdt            || "";
const soTienRaw   = parseInt(String(d.so_tien_raw||0).replace(/\D/g,""))||0;
const noiDungThu  = d.noi_dung_thu   || d.ly_do || "Phí dịch vụ pháp lý";
const hinhThucTT  = d.hinh_thuc_tt   || "Chuyển khoản";
const soHD        = d.so_hop_dong    || "";
const maDNTT      = d.ma_de_nghi     || "";
const nguoiThu    = d.nguoi_thu      || "Võ Hồng Tú";
const nguoiLap    = d.nguoi_lap      || "Trần Thị Thương";
const thuQuy      = d.thu_quy        || "Trần Thị Hồng";
const keToanTruong= d.ke_toan_truong || "";
const tkNo        = d.tk_no          || "1111";
const tkCo        = d.tk_co          || "131";
const quyenSo     = d.quyen_so       || "";
const ghiChu      = d.ghi_chu        || "";

const noBorder={style:BorderStyle.NONE,size:0,color:WHITE};
const thinB=(c="CCCCCC")=>({style:BorderStyle.SINGLE,size:4,color:c});
const shade=(c)=>({type:ShadingType.SOLID,color:c,fill:c});
const R=(text,o={})=>new TextRun({text,font:"Times New Roman",size:o.size||24,bold:o.bold||false,italics:o.italic||false,color:o.color||BLACK});
const P=(ch,o={})=>new Paragraph({children:Array.isArray(ch)?ch:[ch],alignment:o.align||AlignmentType.JUSTIFIED,
  spacing:{after:o.after!==undefined?o.after:120,before:o.before||0,line:o.line||276},
  indent:o.indent?{left:convertInchesToTwip(o.indent)}:undefined});
const blank=(a=80)=>P([R("")],{after:a});

// ══════════════════════════════════════════════════════════════════
// HÀM TẠO 1 LIÊN PHIẾU THU (gọi 2 lần)
// ══════════════════════════════════════════════════════════════════
const makeLien = () => {
  // ── STRIPE ─────────────────────────────────────────────────────
  const stripe=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[
      new TableCell({width:{size:70,type:WidthType.PERCENTAGE},shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("")],{after:36})]}),
      new TableCell({width:{size:30,type:WidthType.PERCENTAGE},shading:shade(GOLD),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("")],{after:36})]}),
    ]})],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── HEADER ─────────────────────────────────────────────────────
  const logoCell=new TableCell({width:{size:55,type:WidthType.PERCENTAGE},
    borders:{top:noBorder,bottom:{style:BorderStyle.SINGLE,size:6,color:GOLD},left:noBorder,right:noBorder},verticalAlign:VerticalAlign.CENTER,
    children:logoData?[new Paragraph({children:[new ImageRun({data:logoData,transformation:{width:140,height:48}})],spacing:{after:50}})]
      :[P([R("LUẬT MINH TÚ",{bold:true,color:NAVY,size:26})],{after:40})]});

  // Góc phải: tiêu đề + mã phiếu + Nợ/Có
  const infoCell=new TableCell({width:{size:45,type:WidthType.PERCENTAGE},
    borders:{top:noBorder,bottom:{style:BorderStyle.SINGLE,size:6,color:GOLD},left:noBorder,right:noBorder},verticalAlign:VerticalAlign.CENTER,
    children:[
      P([R("PHIẾU THU",{bold:true,color:NAVY,size:30})],{align:AlignmentType.RIGHT,after:40}),
      P([R("Số: "+soPhieu,{bold:true,color:GOLD,size:22})],{align:AlignmentType.RIGHT,after:30}),
      P([R("Ngày thu: "+ngayThu,{size:20,color:GRAY})],{align:AlignmentType.RIGHT,after:30}),
      // Nợ / Có nhỏ góc phải
      new Table({width:{size:50,type:WidthType.PERCENTAGE},
        rows:[
          new TableRow({children:[
            new TableCell({borders:{top:thinB(GOLD),bottom:thinB(),left:thinB(GOLD),right:noBorder},
              children:[P([R("Nợ: ",{size:18,bold:true,color:NAVY}),R(tkNo,{size:18,bold:true})],{after:30,before:30})]}),
            new TableCell({borders:{top:thinB(GOLD),bottom:thinB(),left:thinB(),right:thinB(GOLD)},
              children:[P([R("Có: ",{size:18,bold:true,color:NAVY}),R(tkCo,{size:18,bold:true})],{after:30,before:30})]}),
          ]}),
        ],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}}),
    ]});

  const header=new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[logoCell,infoCell]})],
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── BANNER ─────────────────────────────────────────────────────
  const banner=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[new TableCell({shading:shade(GOLD),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
      children:[P([R("✔  XÁC NHẬN ĐÃ NHẬN TIỀN  •  PHIẾU THU HỢP LỆ  •  MINHTU LAW CO., LTD",{bold:true,color:WHITE,size:20})],
        {align:AlignmentType.CENTER,after:90,before:90})]})]})]  ,
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── SỐ TIỀN BIG BOX ────────────────────────────────────────────
  const moneyBox=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[
      new TableCell({width:{size:60,type:WidthType.PERCENTAGE},shading:shade(NAVY),
        borders:{top:noBorder,bottom:noBorder,left:noBorder,right:{style:BorderStyle.SINGLE,size:8,color:GOLD}},
        children:[
          P([R("SỐ TIỀN ĐÃ THU",{bold:true,color:GOLD,size:18})],{align:AlignmentType.CENTER,after:30,before:100}),
          P([R(fmtNum(soTienRaw)+" đ",{bold:true,color:WHITE,size:36})],{align:AlignmentType.CENTER,after:30}),
          P([R(soThanhChu(soTienRaw),{italic:true,color:LIGHT,size:18})],{align:AlignmentType.CENTER,after:100}),
        ]}),
      new TableCell({width:{size:40,type:WidthType.PERCENTAGE},shading:shade(LIGHT),
        borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
        children:[
          P([R("Hình thức thanh toán",{size:17,color:GRAY})],{align:AlignmentType.CENTER,after:30,before:100}),
          P([R(hinhThucTT,{bold:true,color:NAVY,size:24})],{align:AlignmentType.CENTER,after:30}),
          P([R("Ngày thu: "+ngayThu,{size:20})],{align:AlignmentType.CENTER,after:100}),
        ]}),
    ]})],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── BẢNG THÔNG TIN CHI TIẾT ─────────────────────────────────────
  const fieldRow=(label,value,bg=WHITE)=>new TableRow({children:[
    new TableCell({width:{size:30,type:WidthType.PERCENTAGE},shading:shade(LIGHT),
      borders:{top:noBorder,bottom:thinB(),left:noBorder,right:noBorder},
      children:[P([R(label,{bold:true,color:NAVY,size:21})],{after:70,before:70})]}),
    new TableCell({width:{size:70,type:WidthType.PERCENTAGE},shading:shade(bg),
      borders:{top:noBorder,bottom:thinB(),left:noBorder,right:noBorder},
      children:[P([R(value||"—",{size:22})],{after:70,before:70})]}),
  ]});

  const detailTable=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[
      fieldRow("Người nộp tiền", nguoiNop,   WHITE),
      fieldRow("Địa chỉ",        diaChiNop,  LIGHT),
      fieldRow("Điện thoại",     sdtNop,     WHITE),
      fieldRow("Nội dung thu",   noiDungThu, LIGHT),
      fieldRow("Căn cứ",         soHD||(maDNTT?"ĐNTT: "+maDNTT:"Theo thỏa thuận"), WHITE),
      ...(ghiChu?[fieldRow("Ghi chú", ghiChu, LIGHT)]:[]),
    ],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── CHUYỂN KHOẢN (nếu không phải tiền mặt) ───────────────────
  const isCK = !hinhThucTT.toLowerCase().includes("tiền mặt");
  const ckSection = isCK ? [
    blank(80),
    new Table({width:{size:100,type:WidthType.PERCENTAGE},
      rows:[new TableRow({children:[
        new TableCell({width:{size:65,type:WidthType.PERCENTAGE},shading:shade(LIGHT),
          borders:{top:noBorder,bottom:noBorder,left:{style:BorderStyle.SINGLE,size:10,color:GOLD},right:noBorder},
          children:[
            P([R("ĐÃ NHẬN QUA CHUYỂN KHOẢN:",{bold:true,color:NAVY,size:21})],{after:70,before:90}),
            P([R("Tên TK: ",{bold:true,size:20}),R("CTY LUAT TNHH MINH TU",{size:20})],{after:50}),
            P([R("STK:    ",{bold:true,size:20,color:NAVY}),R("5150056789",{bold:true,size:23,color:NAVY})],{after:50}),
            P([R("NH:     ",{bold:true,size:20}),R("MB Bank — CN Phú Nhuận",{size:20})],{after:90}),
          ]}),
        new TableCell({width:{size:35,type:WidthType.PERCENTAGE},borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},verticalAlign:VerticalAlign.CENTER,
          children:qrData
            ?[new Paragraph({children:[new ImageRun({data:qrData,transformation:{width:80,height:80}})],alignment:AlignmentType.CENTER,spacing:{after:30,before:30}}),
              P([R("QR MB Bank",{size:16,color:GRAY})],{align:AlignmentType.CENTER})]
            :[P([R("QR MB Bank",{size:16,color:GRAY})],{align:AlignmentType.CENTER})]}),
      ]})],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}})
  ] : [];

  // ── 5 CHỮ KÝ (chuẩn Mẫu 01-TT) ──────────────────────────────
  const makeSigCell=(title,name)=>new TableCell({width:{size:20,type:WidthType.PERCENTAGE},
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
    children:[
      P([R(title,{bold:true,size:19,color:NAVY})],{align:AlignmentType.CENTER,after:20}),
      P([R("(Ký, họ tên)",{italic:true,size:17,color:GRAY})],{align:AlignmentType.CENTER,after:260}),
      P([R(name||"",{bold:true,size:19})],{align:AlignmentType.CENTER,after:0}),
    ]});

  const sigTable=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[
      makeSigCell("Giám đốc\nđiều hành",  nguoiThu),
      makeSigCell("Kế toán\ntrưởng",      keToanTruong),
      makeSigCell("Người\nnộp tiền",      nguoiNop),
      makeSigCell("Người\nlập phiếu",     nguoiLap),
      makeSigCell("Thủ quỹ",             thuQuy),
    ]})],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── ĐÃ NHẬN ĐỦ ────────────────────────────────────────────────
  const daNhan=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[new TableCell({
      shading:shade(WARM),
      borders:{top:{style:BorderStyle.SINGLE,size:6,color:GOLD},bottom:{style:BorderStyle.SINGLE,size:6,color:GOLD},left:{style:BorderStyle.SINGLE,size:6,color:GOLD},right:{style:BorderStyle.SINGLE,size:6,color:GOLD}},
      children:[P([
        R("Đã nhận đủ số tiền (viết bằng chữ): ",{bold:true,size:21,color:NAVY}),
        R(soThanhChu(soTienRaw),{italic:true,size:21}),
      ],{after:80,before:80})]})]})]  ,
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  // ── FOOTER BAR ────────────────────────────────────────────────
  const footerBar=new Table({width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({children:[new TableCell({shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
      children:[P([R("GPĐKHĐ: 41.02.4764/TP/ĐKHĐ  •  MST: 0318941023  •  luatminhtu.vn  •  1900 0031",{color:WHITE,size:17})],
        {align:AlignmentType.CENTER,after:70,before:70})]})]})]  ,
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

  return [
    stripe, blank(80),
    header, blank(120),
    banner, blank(120),
    moneyBox, blank(140),
    P([R("THÔNG TIN CHI TIẾT:",{bold:true,color:NAVY,size:22})],{after:80}),
    detailTable,
    ...ckSection,
    blank(120),
    sigTable,
    blank(100),
    daNhan,
    blank(80),
    footerBar,
  ];
};

// ── ĐƯỜNG KẺ PHÂN CÁCH 2 LIÊN ────────────────────────────────────
const makeDivider=()=>new Table({width:{size:100,type:WidthType.PERCENTAGE},
  rows:[new TableRow({children:[new TableCell({
    borders:{top:{style:BorderStyle.DASHED,size:8,color:GRAY},bottom:noBorder,left:noBorder,right:noBorder},
    children:[P([R("- - - - - - - - - - - - - - Liên 2: Giao người nộp tiền - - - - - - - - - - - - - -",{size:17,color:GRAY,italic:true})],
      {align:AlignmentType.CENTER,after:0})]})]})]  ,
  borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

// ── BUILD ─────────────────────────────────────────────────────────
async function build(){
  const doc=new Document({numbering:{config:[]},sections:[{
    properties:{page:{margin:{top:convertInchesToTwip(0.5),bottom:convertInchesToTwip(0.5),left:convertInchesToTwip(0.9),right:convertInchesToTwip(0.8)}}},
    footers:{default:new Footer({children:[P([R("PT: "+maPT+"  •  Ngày: "+ngayThu,{size:16,color:GRAY})],{align:AlignmentType.CENTER,after:0})]})},
    children:[
      P([R("Liên 1 (Lưu)",{bold:true,size:17,italic:true,color:GRAY})],{after:60}),
      ...makeLien(),
      blank(100),
      makeDivider(),
      blank(100),
      ...makeLien(),
    ]
  }]});
  fs.writeFileSync(outputPath,await Packer.toBuffer(doc));
  console.log("OK:"+outputPath);
}
build().catch(e=>{console.error(e);process.exit(1);});
