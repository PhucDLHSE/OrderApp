const express = require('express');
const router = express.Router();
const { protect, staff } = require('../middleware/auth.middleware');
const Table = require('../models/Table');
const { Menu, MenuItem } = require('../models/Menu');
const Order = require('../models/Order');

// LẤY TẤT CẢ BÀN
router.get('/tables', protect, staff, async (req, res) => {
  try {
    const tables = await Table.find().sort('tableNumber');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LẤY DANH SÁCH BÀN CÒN TRỐNG
router.get('/tables/available', protect, staff, async (req, res) => {
  try {
    const tables = await Table.find({ status: 'available' }).sort('tableNumber');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LẤY THÔNG TIN BÀN THEO ID
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

// CẬP NHẬT TRẠNG THÁI BÀN KHI CÓ KHÁCH ĐẾN
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

// GIẢI PHÓNG BÀN KHI KHÁCH ĐÃ THANH TOÁN
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

// LẤY DANH SÁCH ORDER CỦA BÀN
router.get('/tables/:tableId/orders', protect, staff, async (req, res) => {
  try {
    const orders = await Order.find({ 
      table: req.params.tableId,
      paymentStatus: 'unpaid',  // Chỉ lấy các order chưa thanh toán
      status: 'active'  // Và đang active
    })
    .populate('staff', '_id name')
    .sort('-createdAt');

    res.json(orders);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// LẤY MENU
router.get('/menu', protect, staff, async (req, res) => {
  try {
    const menu = await Menu.findOne();
    res.json(menu.items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// TẠO ORDER MỚI 
router.post('/orders', protect, staff, async (req, res) => {
  try {
    const { tableId, items } = req.body;
    
    // Kiểm tra bàn tồn tại
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({ message: 'Không tìm thấy bàn' });
    }

    // Không cần kiểm tra bàn đã có người hay chưa
    // Vì 1 bàn có thể có nhiều order

    const menu = await Menu.findOne();
    let totalAmount = 0;
    
    // Xử lý nhiều món trong 1 order
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

    // Tự động cập nhật trạng thái bàn thành 'occupied' khi có order đầu tiên
    if (table.status === 'available') {
      table.status = 'occupied';
      await table.save();
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// XEM TẤT CẢ ORDER (CÓ THỂ LỌC THEO TRẠNG THÁI VÀ TRẠNG THÁI THANH TOÁN)
router.get('/orders-list', protect, staff, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;

    // Xây dựng filter
    let filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Query orders với pagination
    const orders = await Order.find(filter)
      .populate('table', 'tableNumber capacity status')
      .populate('staff', '_id name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Đếm tổng số orders
    const total = await Order.countDocuments(filter);

    // Thống kê
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

// XEM TẤT CẢ ORDER ĐÃ THANH TOÁN
router.get('/orders/paid', protect, staff, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    // Xây dựng filter
    let filter = {
      paymentStatus: 'paid',
      status: 'completed'
    };

    // Thêm filter theo thời gian nếu có
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

    // Query orders với populate
    const orders = await Order.find(filter)
      .populate('table', 'tableNumber capacity status')
      .populate('staff', '_id name')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Đếm tổng số orders
    const total = await Order.countDocuments(filter);

    // Tính tổng doanh thu trong khoảng thời gian
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

    // Format lại dữ liệu trả về
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

// XEM CHI TIẾT ORDER THEO ORDER NUMBER
router.get('/orders/:orderNumber', protect, staff, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('table')
      .populate('staff', 'name');
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    // Chuyển order sang object và lọc lại thông tin
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

// THANH TOÁN TẤT CẢ ORDER CỦA BÀN
router.post('/tables/:tableId/payment', protect, staff, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    
    // Lấy tất cả order chưa thanh toán của bàn
    const unpaidOrders = await Order.find({
      table: req.params.tableId,
      paymentStatus: 'unpaid',
      status: 'active'
    });

    // Thanh toán tất cả order
    await Promise.all(unpaidOrders.map(order => {
      order.paymentStatus = 'paid';
      order.paymentMethod = paymentMethod;
      order.status = 'completed';
      return order.save();
    }));

    // Giải phóng bàn
    await Table.findByIdAndUpdate(req.params.tableId, { 
      status: 'available'
    });

    res.json({ message: 'Thanh toán thành công' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// THANH TOÁN RIÊNG BIỆT THEO ORDER NUMBER
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

    // Cập nhật trạng thái order
    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.status = 'completed';
    await order.save();

    // Kiểm tra xem bàn còn order nào chưa thanh toán không
    const pendingOrders = await Order.find({
      table: order.table,
      paymentStatus: 'unpaid',
      status: 'active'
    });

    // Nếu không còn order nào chưa thanh toán, giải phóng bàn
    if (pendingOrders.length === 0) {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
    }

    // Trả về thông tin order đã thanh toán
    const paidOrder = await Order.findById(order._id)
      .populate('table')
      .populate('staff', '_id name');

    res.json(paidOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



module.exports = router;