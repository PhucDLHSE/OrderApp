const express = require('express');
const router = express.Router();
const { protect, barista } = require('../middleware/auth.middleware');
const Order = require('../models/Order');

// @route   GET api/barista/orders
// @desc    Get all active orders
// @access  Barista only

// 1. LẤY TẤT CẢ CÁC ORDER ĐANG ACTIVE
router.get('/orders', protect, barista, async (req, res) => {
  try {
    const pendingOrders = await Order.find({
      status: 'active',
      'items.status': { $in: ['pending', 'preparing'] }
    })
    .populate('table', 'tableNumber')
    .populate('staff', 'name')
    .sort('createdAt');

    res.json(pendingOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. CẬP NHẬT TRẠNG THÁI MÓN (preparing -> ready)
router.patch('/orders/:orderNumber/items/:itemId/status', protect, barista, async (req, res) => {
  try {
    const { status } = req.body;

    if (status !== 'ready') {
      return res.status(400).json({ 
        message: 'Trạng thái không hợp lệ. Chỉ có thể chuyển sang ready' 
      });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    const item = order.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Không tìm thấy món trong order' });
    }

    item.status = status;
    item.modifiedBy = req.user._id;
    await order.save();

    res.json({
      orderNumber: order.orderNumber,
      item: {
        id: item._id,
        name: item.itemName,
        status: item.status,
        modifiedBy: req.user.name
      }
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. XEM CHI TIẾT ORDER
router.get('/orders/:orderNumber', protect, barista, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('table', 'tableNumber')
      .populate('staff', 'name');
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy order' });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. LỌC ORDER THEO TRẠNG THÁI
router.get('/orders/filter/:status', protect, barista, async (req, res) => {
  try {
    const validStatuses = ['preparing', 'ready'];
    if (!validStatuses.includes(req.params.status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const orders = await Order.find({
      status: 'active'
    })
    .populate('table', 'tableNumber')
    .populate('staff', 'name')
    .sort('createdAt');

    const filteredOrders = orders.map(order => ({
      ...order.toObject(),
      items: order.items.filter(item => item.status === req.params.status)
    }))
    .filter(order => order.items.length > 0);

    res.json(filteredOrders);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
// 5. XEM ORDERS ĐÃ HOÀN THÀNH TRONG NGÀY
router.get('/orders/completed', protect, barista, async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    queryDate.setHours(0, 0, 0, 0);
    const endDate = new Date(queryDate);
    endDate.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      'items.status': 'ready',
      createdAt: {
        $gte: queryDate,
        $lte: endDate
      }
    })
    .populate('table', 'tableNumber')
    .populate('staff', 'name')
    .sort('-createdAt');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;