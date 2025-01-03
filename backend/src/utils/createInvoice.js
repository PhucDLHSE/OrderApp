const PDFDocument = require('pdfkit');
const path = require('path');

const createInvoice = (order, doc) => {
  // Font config
  const fontPath = path.join(__dirname, '../../font/timesbd.ttf'); 
  try {
    doc.registerFont('Times New Roman', fontPath);
    doc.font('Times New Roman'); 
  } catch (error) {
    console.error('Font error:', error);
    doc.font('Helvetica'); 
  }

  // Header
  doc.fontSize(20).text('Tiệm cà phê Hồi Đó', { align: 'center' });
  doc.fontSize(13).text('Hotline: 0794992133', { align: 'center' });
  doc.moveDown();

  // Order info
  doc.fontSize(14);
  doc.text(`Bàn: ${order.table.tableNumber}`);
  doc.text(`Mã đơn hàng: ${order.orderNumber}`);
  doc.text(`Nhân viên: ${order.staff.name}`);
  doc.text(`Thời gian: ${new Date(order.createdAt).toLocaleString('vi-VN')}`);
  doc.moveDown();

  // Table structure
  const tableTop = 200;
  const columnPositions = {
    stt: 50,
    name: 100,
    price: 300,
    quantity: 380,
    total: 450,
  };

  // Table header
  doc.fontSize(13)
    .text('STT', columnPositions.stt, tableTop)
    .text('Tên sản phẩm', columnPositions.name, tableTop)
    .text('Giá', columnPositions.price, tableTop)
    .text('Số lượng', columnPositions.quantity, tableTop)
    .text('Thành tiền', columnPositions.total, tableTop);

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  // Items
  let position = tableTop + 30;
  order.items.forEach((item, i) => {
    doc.text(i + 1, columnPositions.stt, position)
       .text(item.itemName, columnPositions.name, position)
       .text(formatMoney(item.price), columnPositions.price, position)
       .text(item.quantity.toString(), columnPositions.quantity, position)
       .text(formatMoney(item.price * item.quantity), columnPositions.total, position);
    position += 30;
  });

  // Total
  const totalPosition = position + 20;
  doc.moveTo(50, totalPosition).lineTo(550, totalPosition).stroke();

  doc.fontSize(17)
     .text('Tổng cộng:', 350, totalPosition + 15)
     .text(`${formatMoney(order.totalAmount)} VND`, 450, totalPosition + 15);

  // Footer
  doc.fontSize(15)
     .moveDown(1) 
     .text('Xin cảm ơn quý khách!', { align: 'center' });

  const wifiPass = 'Pass WiFi: 12345678'; 
  const pageWidth = doc.page.width;
  const textWidth = doc.widthOfString(wifiPass);
  const xPosition = (pageWidth - textWidth) / 2;

  doc.moveDown(0.5) 
     .fontSize(12)
     .text(wifiPass, xPosition);
};

const formatMoney = (amount) => {
  return amount.toLocaleString('vi-VN');
};

module.exports = createInvoice;
