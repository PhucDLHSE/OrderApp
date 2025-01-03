const express = require('express');
const router = express.Router();
const { protect, staff } = require('../middleware/auth.middleware');
const Table = require('../models/Table');
const { Menu, MenuItem } = require('../models/Menu');
const Order = require('../models/Order');
const PDFDocument = require('pdfkit');
const createInvoice = require('../utils/createInvoice');

// @route   GET api/staff/orders
// @desc    Get all active orders
// @access  Staff only

// 1. LẤY TẤT CẢ BÀN
router.get('/tables', protect, staff, async (req, res) => {
  try {
    const tables = await Table.find().sort('tableNumber');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. LẤY DANH SÁCH BÀN CÒN TRỐNG
router.get('/tables/available', protect, staff, async (req, res) => {
  try {
    const tables = await Table.find({ status: 'available' }).sort('tableNumber');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. LẤY THÔNG TIN BÀN THEO ID
router.get('/tables/:id', protect, staff, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. CẬP NHẬT TRẠNG THÁI BÀN KHI CÓ KHÁCH ĐẾN
router.patch('/tables/:id/occupy', protect, staff, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    
    if (!table) {
      return res.status(404).json({ message: 'Không tìm thấy bàn' });
    }
    
    if (table.status !== 'available') {
      return res.status(400).json({ message: 'Bàn không còn trống' });
    }

    table.status = 'occupied';
    await table.save();
    res.json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 5. GIẢI PHÓNG BÀN KHI KHÁCH ĐÃ THANH TOÁN
router.patch('/tables/:id/release', protect, staff, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    
    if (!table) {
      return res.status(404).json({ message: 'Không tìm thấy bàn' });
    }
    
    if (table.status !== 'occupied') {
      return res.status(400).json({ message: 'Bàn không ở trạng thái occupied' });
    }

    table.status = 'available';
    await table.save();
    res.json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 5. LẤY DANH SÁCH ORDER CỦA BÀN
router.get('/tables/:tableId/orders', protect, staff, async (req, res) => {
  try {
    const orders = await Order.find({ 
      table: req.params.tableId,
      paymentStatus: 'unpaid',  
      status: 'active'  
    })
    .populate('staff', '_id name')
    .sort('-createdAt');

    res.json(orders);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 1. LẤY MENU
router.get('/menu', protect, staff, async (req, res) => {
  try {
    const menu = await Menu.findOne()
    .populate('items.category', 'name');
    res.json(menu.items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. TẠO ORDER MỚI 
router.post('/orders', protect, staff, async (req, res) => {
  try {
    const { tableId, items } = req.body;
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({ message: 'Không tìm thấy bàn' });
    }
    const menu = await Menu.findOne();
    let totalAmount = 0;
    
    const orderItems = items.map(item => {
      const menuItem = menu.items.id(item.menuItemId);
      if (!menuItem) throw new Error('Món không có trong menu');

      totalAmount += menuItem.price * item.quantity;
      return {
        menuItem: menuItem._id,
        itemName: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        notes: item.notes || ''
      };
    });

    const order = new Order({
      table: tableId,
      staff: req.user._id,
      items: orderItems,
      totalAmount,
      status: 'active',
      paymentStatus: 'unpaid'
    });

    await order.save();

    if (table.status === 'available') {
      table.status = 'occupied';
      await table.save();
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. THÊM MÓN VÀO ORDER
router.post('/orders/:orderNumber/add-items', protect, staff, async (req, res) => {
  try {
    const { items } = req.body;
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    if (order.status !== 'active') {
      return res.status(400).json({ message: 'Không thể thêm món vào order không active' });
    }

    const menu = await Menu.findOne();
    let additionalAmount = 0;

    const newItems = items.map(item => {
      const menuItem = menu.items.id(item.menuItemId);
      if (!menuItem) throw new Error('Món không có trong menu');

      additionalAmount += menuItem.price * item.quantity;
      return {
        menuItem: menuItem._id,
        itemName: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        notes: item.notes || '',
        status: 'preparing' 
      };
    });

    order.items.push(...newItems);
    order.totalAmount += additionalAmount;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4.  XEM TẤT CẢ ORDER (CÓ THỂ LỌC THEO TRẠNG THÁI VÀ TRẠNG THÁI THANH TOÁN)
router.get('/orders-list', protect, staff, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(filter)
      .populate('table', 'tableNumber capacity status')
      .populate('staff', '_id name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    const stats = {
      total,
      active: await Order.countDocuments({ status: 'active' }),
      completed: await Order.countDocuments({ status: 'completed' }),
      paid: await Order.countDocuments({ paymentStatus: 'paid' }),
      unpaid: await Order.countDocuments({ paymentStatus: 'unpaid' })
    };

    res.json({
      orders,
      stats,
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: error.message });
  }
});

// 5.  XEM TẤT CẢ ORDER ĐÃ THANH TOÁN
router.get('/orders/paid', protect, staff, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    let filter = {
      paymentStatus: 'paid',
      status: 'completed'
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(filter)
      .populate('table', 'tableNumber capacity status')
      .populate('staff', '_id name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    const revenue = await Order.aggregate([
      { $match: filter },
      { 
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedOrders = orders.map(order => ({
      orderNumber: order.orderNumber,
      table: {
        tableNumber: order.table?.tableNumber,
        capacity: order.table?.capacity
      },
      staff: {
        _id: order.staff?._id,
        name: order.staff?.name
      },
      items: order.items.map(item => ({
        itemName: item.itemName,
        price: item.price,
        quantity: item.quantity
      })),
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt
    }));

    res.json({
      orders: formattedOrders,
      stats: {
        totalOrders: total,
        totalRevenue: revenue[0]?.total || 0,
        averageOrderValue: revenue[0] ? revenue[0].total / revenue[0].count : 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
        total
      },
      filter: {
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('Error fetching paid orders:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách orders đã thanh toán',
      error: error.message 
    });
  }
});

// 6. XEM CHI TIẾT ORDER THEO ORDER NUMBER
router.get('/orders/:orderNumber', protect, staff, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('table')
      .populate('staff', 'name');
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    const orderObject = {
      ...order.toObject(),
      items: order.items.map(item => ({
        itemName: item.itemName,
        price: item.price,
        quantity: item.quantity,
        status: item.status,
        notes: item.notes
      }))
    };

    res.json(orderObject);
  } catch (error) {
    res.status(400).json({ message: error.message }); 
  }
});

// 7. HỦY ORDER
router.post('/orders/:orderNumber/cancel', protect, staff, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    if (order.status !== 'active') {
      return res.status(400).json({ message: 'Chỉ có thể hủy order đang active' });
    }

    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledBy = req.user._id;
    await order.save();

    const activeOrders = await Order.find({
      table: order.table,
      status: 'active'
    });

    if (activeOrders.length === 0) {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
    }

    res.json({
      message: 'Hủy order thành công',
      order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 1. THANH TOÁN TẤT CẢ ORDER CỦA BÀN
router.post('/tables/:tableId/payment', protect, staff, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    
    const unpaidOrders = await Order.find({
      table: req.params.tableId,
      paymentStatus: 'unpaid',
      status: 'active'
    });

    await Promise.all(unpaidOrders.map(order => {
      order.paymentStatus = 'paid';
      order.paymentMethod = paymentMethod;
      order.status = 'completed';
      return order.save();
    }));

    await Table.findByIdAndUpdate(req.params.tableId, { 
      status: 'available'
    });

    res.json({ message: 'Thanh toán thành công' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 2. THANH TOÁN RIÊNG BIỆT THEO ORDER NUMBER
router.post('/orders/:orderNumber/payment', protect, staff, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order đã được thanh toán' });
    }

    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.status = 'completed';
    await order.save();

    const pendingOrders = await Order.find({
      table: order.table,
      paymentStatus: 'unpaid',
      status: 'active'
    });

    if (pendingOrders.length === 0) {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
    }

    const paidOrder = await Order.findById(order._id)
      .populate('table')
      .populate('staff', '_id name');

    res.json(paidOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. TẠO HÓA ĐƠN PDF
router.get('/orders/:orderNumber/invoice', protect, staff, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('table')
      .populate('staff', 'name');

    if (!order) {
      return res.status(404).json({ message: 'Làm gì có order này!' });
    }

    // Set response headers trước khi pipe
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename=invoice-${order.orderNumber}.pdf`);

    // Xử lý pipe error
    const doc = new PDFDocument();
    doc.on('error', (err) => {
      console.error('PDFDocument error:', err);
      if (!res.headersSent) {
        res.status(500).send('Error generating PDF');
      }
    });

    // Pipe stream
    const stream = doc.pipe(res);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
    });

    // Generate PDF
    createInvoice(order, doc);
    
    // End document sau khi tạo xong
    doc.end();

  } catch (error) {
    console.error('Route error:', error);
    if (!res.headersSent) {
      res.status(400).json({ message: error.message });
    }
  }
});

module.exports = router;