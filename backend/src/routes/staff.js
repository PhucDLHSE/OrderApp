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
      totalAmount
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}); 

// XEM CHI TIẾT ORDER
router.get('/orders/:orderNumber', protect, staff, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('table')
      .populate('items.menuItem');
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }
 
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message }); 
  }
 });

// CẬP NHẬT ORDER
router.patch('/orders/:id', protect, staff, async (req, res) => {
  try {
    const { items } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Không thể sửa order đã thanh toán' });
    }

    // Tính lại tổng tiền
    const menu = await Menu.findOne();
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const menuItem = menu.items.id(item.menuItemId);
      if (!menuItem) {
        throw new Error('Món không có trong menu');
      }
      totalAmount += menuItem.price * item.quantity;
      return {
        menuItem: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes || '',
        status: 'pending'
      };
    });

    order.items = orderItems;
    order.totalAmount = totalAmount;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// THANH TOÁN ORDER
router.post('/orders/:id/payment', protect, staff, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);

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

    // Giải phóng bàn
    await Table.findByIdAndUpdate(order.table, { status: 'available' });

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


module.exports = router;