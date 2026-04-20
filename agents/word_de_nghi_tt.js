/**
 * word_de_nghi_tt.js — Đề Nghị Thanh Toán MTL
 * Design: Navy/Gold MTL brand — bổ sung tính VAT 8%
 * Usage: node word_de_nghi_tt.js input.json output.docx
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
if (!inputPath || !outputPath) { console.error("Usage: node word_de_nghi_tt.js input.json output.docx"); process.exit(1); }
const d = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

const fmtNum = (n) => String(parseInt(String(n).replace(/\D/g,""))||0).replace(/\B(?=(\d{3})+(?!\d))/g,".");

const soThanhChu = (n) => {
  const dvDon=["","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"];
  const dvChuc=["","mười","hai mươi","ba mươi","bốn mươi","năm mươi","sáu mươi","bảy mươi","tám mươi","chín mươi"];
  function doc3(x){const tram=Math.floor(x/100),chuc=Math.floor((x%100)/10),don=x%10;let s="";
    if(tram>0)s+=dvDon[tram]+" trăm ";if(chuc>1)s+=dvChuc[chuc]+" ";else if(chuc===1)s+="mười ";else if(tram>0&&don>0)s+="lẻ ";
    if(don>0){if(chuc>1&&don===1)s+="mốt";else if(chuc>0&&don===5)s+="lăm";else s+=dvDon[don];}return s.trim();}
  const num=parseInt(String(n).replace(/\D/g,""))||0;if(!num)return "không đồng";
  const ty=Math.floor(num/1e9),tr=Math.floor((num%1e9)/1e6),ng=Math.floor((num%1e6)/1e3),don=num%1e3;
  let r="";if(ty>0)r+=doc3(ty)+" tỷ ";if(tr>0)r+=doc3(tr)+" triệu ";if(ng>0)r+=doc3(ng)+" nghìn ";if(don>0)r+=doc3(don);
  r=r.trim();return r.charAt(0).toUpperCase()+r.slice(1)+" đồng chẵn";
};

const LOGO_PATH=path.join(__dirname,"..","data","mau","LOGO.jpg");
const QR_PATH  =path.join(__dirname,"..","data","mau","QR_CTY_LMT.jpg");
const logoData =fs.existsSync(LOGO_PATH)?fs.readFileSync(LOGO_PATH):null;
const qrData   =fs.existsSync(QR_PATH)  ?fs.readFileSync(QR_PATH)  :null;

// ── Data ─────────────────────────────────────────────────────────
const maDNTT     = d.ma_de_nghi      || ("DNTT-"+new Date().toISOString().slice(0,7).replace("-","")+"-001");
const ngayLap    = d.ngay_lap        || new Date().toLocaleDateString("vi-VN");
const tenKH      = d.ten_than_chu    || "";
const diaChiKH   = d.dia_chi        || "";
const sdtKH      = d.sdt            || "";
const soHD       = d.so_hop_dong    || "";
const hanTT      = d.han_thanh_toan || "03 ngày làm việc kể từ ngày nhận đề nghị";
const ghiChu     = d.ghi_chu        || "";

// items (nhiều đợt)
const items = Array.isArray(d.items) && d.items.length > 0 ? d.items
  : [{stt:1, noi_dung: d.noi_dung_tt||"Phí dịch vụ pháp lý theo hợp đồng", so_tien_raw: d.tong_phi_raw||0, dot_tt:"Đợt 1"}];
items.forEach((it,i)=>{it.stt=it.stt||i+1;});

// Tính VAT
const vatRate     = parseFloat(d.vat_rate||8);
const tongChuaVAT = items.reduce((s,it)=>s+(parseInt(String(it.so_tien_raw).replace(/\D/g,""))||0),0);
const vatSoTien   = Math.round(tongChuaVAT * vatRate / 100);
const tongCoVAT   = tongChuaVAT + vatSoTien;

const noBorder ={style:BorderStyle.NONE,size:0,color:WHITE};
const thinB=(c="CCCCCC")=>({style:BorderStyle.SINGLE,size:4,color:c});
const shade=(c)=>({type:ShadingType.SOLID,color:c,fill:c});

const R=(text,o={})=>new TextRun({text,font:"Times New Roman",size:o.size||24,bold:o.bold||false,italics:o.italic||false,color:o.color||BLACK});
const P=(ch,o={})=>new Paragraph({children:Array.isArray(ch)?ch:[ch],alignment:o.align||AlignmentType.JUSTIFIED,
  spacing:{after:o.after!==undefined?o.after:120,before:o.before||0,line:o.line||276},
  indent:o.indent?{left:convertInchesToTwip(o.indent)}:undefined});
const blank=(a=80)=>P([R("")],{after:a});

// ── STRIPE ───────────────────────────────────────────────────────
const makeStripe=()=>new Table({width:{size:100,type:WidthType.PERCENTAGE},
  rows:[new TableRow({children:[
    new TableCell({width:{size:70,type:WidthType.PERCENTAGE},shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("")],{after:40})]}),
    new TableCell({width:{size:30,type:WidthType.PERCENTAGE},shading:shade(GOLD),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("")],{after:40})]}),
  ]})],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

// ── HEADER ───────────────────────────────────────────────────────
const makeHeader=()=>{
  const logoCell=new TableCell({width:{size:55,type:WidthType.PERCENTAGE},
    borders:{top:noBorder,bottom:{style:BorderStyle.SINGLE,size:6,color:GOLD},left:noBorder,right:noBorder},verticalAlign:VerticalAlign.CENTER,
    children:logoData?[new Paragraph({children:[new ImageRun({data:logoData,transformation:{width:160,height:55}})],spacing:{after:60}})]
      :[P([R("LUẬT MINH TÚ",{bold:true,color:NAVY,size:28})],{after:40})]});
  const infoCell=new TableCell({width:{size:45,type:WidthType.PERCENTAGE},
    borders:{top:noBorder,bottom:{style:BorderStyle.SINGLE,size:6,color:GOLD},left:noBorder,right:noBorder},verticalAlign:VerticalAlign.CENTER,
    children:[
      P([R("ĐỀ NGHỊ THANH TOÁN",{bold:true,color:NAVY,size:28})],{align:AlignmentType.RIGHT,after:50}),
      P([R("Số: "+maDNTT,{bold:true,color:GOLD,size:22})],{align:AlignmentType.RIGHT,after:40}),
      P([R("Ngày: "+ngayLap,{size:20,color:GRAY})],{align:AlignmentType.RIGHT,after:40}),
    ]});
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[logoCell,infoCell]})],
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});
};

// ── BANNER ───────────────────────────────────────────────────────
const makeBanner=()=>new Table({width:{size:100,type:WidthType.PERCENTAGE},
  rows:[new TableRow({children:[new TableCell({shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
    children:[P([R("ĐỀ NGHỊ THANH TOÁN  ",{bold:true,color:WHITE,size:24}),R("•  BẢO MẬT  •  MINHTU LAW CO., LTD",{color:GOLD,size:20})],
      {align:AlignmentType.CENTER,after:100,before:100})]})]})]  ,
  borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

// ── STAT BOXES ───────────────────────────────────────────────────
const makeStatBox=(label,value,bg=LIGHT)=>new TableCell({width:{size:25,type:WidthType.PERCENTAGE},shading:shade(bg),
  borders:{top:noBorder,bottom:{style:BorderStyle.SINGLE,size:8,color:GOLD},left:noBorder,right:{style:BorderStyle.SINGLE,size:4,color:WHITE}},
  children:[
    P([R(label,{size:16,color:GRAY})],{align:AlignmentType.CENTER,after:30,before:100}),
    P([R(value,{size:20,color:NAVY,bold:true})],{align:AlignmentType.CENTER,after:100}),
  ]});
const makeStatBoxes=()=>new Table({width:{size:100,type:WidthType.PERCENTAGE},
  rows:[new TableRow({children:[
    makeStatBox("KÍNH GỬI",       tenKH.length>20?tenKH.slice(0,20)+"…":tenKH||"—"),
    makeStatBox("SỐ HỢP ĐỒNG",   soHD||"—"),
    makeStatBox("HẠN THANH TOÁN",hanTT.length>22?hanTT.slice(0,22)+"…":hanTT),
    makeStatBox("TỔNG THANH TOÁN",fmtNum(tongCoVAT)+" đ","FFF8EC"),
  ]})],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

// ── THÔNG TIN KHÁCH HÀNG ─────────────────────────────────────────
const makeKhachHang=()=>[
  ["Kính gửi",tenKH],["Địa chỉ",diaChiKH||"—"],
  ["Điện thoại",sdtKH||"—"],["Căn cứ HĐ số",soHD||"(theo hợp đồng đã ký)"],
  ["Hạn thanh toán",hanTT],
].map(([k,v])=>P([R(k+": ",{bold:true,color:NAVY,size:22}),R(v,{size:22})],{after:80}));

// ── BẢNG CHI TIẾT + VAT ──────────────────────────────────────────
const makeItemTable=()=>{
  const hdrRow=new TableRow({tableHeader:true,children:[
    new TableCell({width:{size:6,type:WidthType.PERCENTAGE},shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("STT",{bold:true,color:WHITE,size:20})],{align:AlignmentType.CENTER,after:80,before:80})]}),
    new TableCell({width:{size:46,type:WidthType.PERCENTAGE},shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("NỘI DUNG THANH TOÁN",{bold:true,color:WHITE,size:20})],{after:80,before:80})]}),
    new TableCell({width:{size:14,type:WidthType.PERCENTAGE},shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("ĐỢT",{bold:true,color:WHITE,size:20})],{align:AlignmentType.CENTER,after:80,before:80})]}),
    new TableCell({width:{size:34,type:WidthType.PERCENTAGE},shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[P([R("SỐ TIỀN (VNĐ)",{bold:true,color:WHITE,size:20})],{align:AlignmentType.RIGHT,after:80,before:80})]}),
  ]});

  const dataRows=items.map((it,idx)=>{
    const bg=idx%2===0?LIGHT:WHITE;
    const st=parseInt(String(it.so_tien_raw).replace(/\D/g,""))||0;
    return new TableRow({children:[
      new TableCell({shading:shade(bg),borders:{top:noBorder,bottom:thinB(),left:noBorder,right:noBorder},children:[P([R(String(it.stt),{size:22})],{align:AlignmentType.CENTER,after:80,before:80})]}),
      new TableCell({shading:shade(bg),borders:{top:noBorder,bottom:thinB(),left:noBorder,right:noBorder},children:[P([R(it.noi_dung||"",{size:22})],{after:80,before:80})]}),
      new TableCell({shading:shade(bg),borders:{top:noBorder,bottom:thinB(),left:noBorder,right:noBorder},children:[P([R(it.dot_tt||"Đợt 1",{size:22})],{align:AlignmentType.CENTER,after:80,before:80})]}),
      new TableCell({shading:shade(bg),borders:{top:noBorder,bottom:thinB(),left:noBorder,right:noBorder},children:[P([R(fmtNum(st),{size:22,bold:true,color:NAVY})],{align:AlignmentType.RIGHT,after:80,before:80})]}),
    ]});
  });

  // Subtotal row (chưa VAT)
  const subRow=new TableRow({children:[
    new TableCell({columnSpan:3,shading:shade(LIGHT),borders:{top:noBorder,bottom:thinB(GOLD),left:noBorder,right:noBorder},
      children:[P([R("Cộng phí dịch vụ (chưa VAT)",{bold:true,color:NAVY,size:21})],{align:AlignmentType.RIGHT,after:80,before:80})]}),
    new TableCell({shading:shade(LIGHT),borders:{top:noBorder,bottom:thinB(GOLD),left:noBorder,right:noBorder},
      children:[P([R(fmtNum(tongChuaVAT),{bold:true,size:22,color:NAVY})],{align:AlignmentType.RIGHT,after:80,before:80})]}),
  ]});

  // VAT row
  const vatRow=new TableRow({children:[
    new TableCell({columnSpan:3,shading:shade(WARM),borders:{top:noBorder,bottom:thinB(GOLD),left:noBorder,right:noBorder},
      children:[P([R(`Thuế VAT ${vatRate}%`,{bold:true,color:GRAY,size:21})],{align:AlignmentType.RIGHT,after:80,before:80})]}),
    new TableCell({shading:shade(WARM),borders:{top:noBorder,bottom:thinB(GOLD),left:noBorder,right:noBorder},
      children:[P([R(fmtNum(vatSoTien),{size:22,color:GRAY})],{align:AlignmentType.RIGHT,after:80,before:80})]}),
  ]});

  // Total row
  const totRow=new TableRow({children:[
    new TableCell({columnSpan:3,shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
      children:[P([R("TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN (ĐÃ BAO GỒM VAT)",{bold:true,color:WHITE,size:21})],{align:AlignmentType.RIGHT,after:100,before:100})]}),
    new TableCell({shading:shade(GOLD),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
      children:[P([R(fmtNum(tongCoVAT),{bold:true,color:WHITE,size:24})],{align:AlignmentType.RIGHT,after:100,before:100})]}),
  ]});

  return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[hdrRow,...dataRows,subRow,vatRow,totRow],
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});
};

// ── SỐ TIỀN BẰNG CHỮ ─────────────────────────────────────────────
const makeBangChu=()=>P([R("Bằng chữ: ",{bold:true,color:NAVY,size:22}),R(soThanhChu(tongCoVAT)+".",{italic:true,size:22})],{after:120});

// ── BANKING + QR ──────────────────────────────────────────────────
const makePayment=()=>{
  const bankCell=new TableCell({width:{size:65,type:WidthType.PERCENTAGE},shading:shade(LIGHT),
    borders:{top:noBorder,bottom:noBorder,left:{style:BorderStyle.SINGLE,size:10,color:GOLD},right:noBorder},
    children:[
      P([R("THÔNG TIN CHUYỂN KHOẢN",{bold:true,color:NAVY,size:22})],{after:80,before:100}),
      P([R("Tên tài khoản: ",{bold:true,size:21}),R("CTY LUAT TNHH MINH TU",{size:21})],{after:60}),
      P([R("Số tài khoản:  ",{bold:true,size:21,color:NAVY}),R("5150056789",{bold:true,size:24,color:NAVY})],{after:60}),
      P([R("Ngân hàng:     ",{bold:true,size:21}),R("MB Bank (TMCP Quân Đội) — CN Phú Nhuận",{size:21})],{after:60}),
      P([R("Nội dung CK:   ",{bold:true,size:21}),R((tenKH||"[Tên KH]")+" thanh toan "+maDNTT,{size:21,italic:true})],{after:100}),
    ]});
  const qrCell=new TableCell({width:{size:35,type:WidthType.PERCENTAGE},
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},verticalAlign:VerticalAlign.CENTER,
    children:qrData
      ?[new Paragraph({children:[new ImageRun({data:qrData,transformation:{width:100,height:100}})],alignment:AlignmentType.CENTER,spacing:{after:60,before:60}}),
        P([R("QR Chuyển khoản MB Bank",{size:18,color:GRAY})],{align:AlignmentType.CENTER,after:60})]
      :[P([R("QR MB Bank",{size:18,color:GRAY})],{align:AlignmentType.CENTER})]});
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[bankCell,qrCell]})],
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});
};

// ── GHI CHÚ ──────────────────────────────────────────────────────
const makeGhiChu=()=>ghiChu?[P([R("Ghi chú: ",{bold:true,color:NAVY,size:21}),R(ghiChu,{size:21,italic:true})],{after:100})]:[];

// ── CHỮ KÝ ───────────────────────────────────────────────────────
const makeSignature=()=>{
  const khCell=new TableCell({width:{size:50,type:WidthType.PERCENTAGE},borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
    children:[
      P([R("BÊN NHẬN (KHÁCH HÀNG)",{bold:true,color:NAVY,size:22})],{align:AlignmentType.CENTER,after:60}),
      P([R("☐ Đã xác nhận nội dung & số tiền trên",{size:20,color:GRAY})],{align:AlignmentType.CENTER,after:200}),
      P([R("Ký và ghi rõ họ tên",{size:20,italic:true,color:GRAY})],{align:AlignmentType.CENTER,after:400}),
      P([R("_________________________",{color:NAVY})],{align:AlignmentType.CENTER,after:60}),
      P([R(tenKH,{bold:true,size:20})],{align:AlignmentType.CENTER,after:60}),
    ]});
  const mtlCell=new TableCell({width:{size:50,type:WidthType.PERCENTAGE},borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
    children:[
      P([R("THAY MẶT MINHTU LAW CO., LTD",{bold:true,color:NAVY,size:22})],{align:AlignmentType.CENTER,after:60}),
      P([R("Giám đốc / Luật sư",{size:20,italic:true,color:GRAY})],{align:AlignmentType.CENTER,after:200}),
      P([R("Ký, đóng dấu",{size:20,italic:true,color:GRAY})],{align:AlignmentType.CENTER,after:400}),
      P([R("_________________________",{color:NAVY})],{align:AlignmentType.CENTER,after:60}),
      P([R("VÕ HỒNG TÚ",{bold:true,size:20,color:NAVY})],{align:AlignmentType.CENTER,after:60}),
    ]});
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[khCell,mtlCell]})],
    borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});
};

// ── FOOTER BAR ────────────────────────────────────────────────────
const makeFooterBar=()=>new Table({width:{size:100,type:WidthType.PERCENTAGE},
  rows:[new TableRow({children:[new TableCell({shading:shade(NAVY),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
    children:[P([R("Luật Minh Tú  •  4/9 Đường số 3, CX Đô Thành, P. Bàn Cờ, TP.HCM  •  1900 0031  •  luatminhtu.vn",{color:WHITE,size:18})],
      {align:AlignmentType.CENTER,after:80,before:80})]})]})]  ,
  borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideH:noBorder,insideV:noBorder}});

// ── BUILD ─────────────────────────────────────────────────────────
async function build(){
  const doc=new Document({numbering:{config:[]},sections:[{
    properties:{page:{margin:{top:convertInchesToTwip(0.6),bottom:convertInchesToTwip(0.6),left:convertInchesToTwip(0.9),right:convertInchesToTwip(0.8)}}},
    footers:{default:new Footer({children:[P([
      R("Số ĐN: "+maDNTT+"  •  Ngày: "+ngayLap+"  •  Bảo mật  •  Trang ",{size:16,color:GRAY}),
      new TextRun({children:[PageNumber.CURRENT],size:16,color:GRAY,font:"Times New Roman"}),
      R(" / ",{size:16,color:GRAY}),
      new TextRun({children:[PageNumber.TOTAL_PAGES],size:16,color:GRAY,font:"Times New Roman"}),
    ],{align:AlignmentType.CENTER})]})},
    children:[
      makeStripe(), blank(100),
      makeHeader(), blank(140),
      makeBanner(), blank(140),
      makeStatBoxes(), blank(160),
      P([R("THÔNG TIN KHÁCH HÀNG / ĐỐI TÁC:",{bold:true,color:NAVY,size:24})],{after:100}),
      ...makeKhachHang(), blank(80),
      P([R("CHI TIẾT ĐỀ NGHỊ THANH TOÁN:",{bold:true,color:NAVY,size:24})],{after:100}),
      makeItemTable(), blank(80),
      makeBangChu(), blank(80),
      P([R("HÌNH THỨC & THÔNG TIN THANH TOÁN:",{bold:true,color:NAVY,size:24})],{after:100}),
      makePayment(), blank(80),
      ...makeGhiChu(), blank(120),
      makeSignature(), blank(120),
      makeFooterBar(),
    ]
  }]});
  fs.writeFileSync(outputPath,await Packer.toBuffer(doc));
  console.log("OK:"+outputPath);
}
build().catch(e=>{console.error(e);process.exit(1);});
