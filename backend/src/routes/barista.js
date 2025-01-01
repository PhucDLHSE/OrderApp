const express = require('express');
const router = express.Router();
const { protect, barista } = require('../middleware/auth.middleware');
const Order = require('../models/Order');

// @route   GET api/barista/orders
// @desc    Get all active orders
// @access  Barista only
router.get('/orders', protect, barista, async (req, res) => {
  try {
    const orders = await Order.find({
      status: 'active',
      'items.status': { $in: ['pending', 'preparing'] }
    })
    .populate('table')
    .populate('items.menuItem')
    .sort({ createdAt: 1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH api/barista/orders/:orderId/items/:itemId
// @desc    Update item status in order
// @access  Barista only
router.patch('/orders/:orderId/items/:itemId', protect, barista, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderItem = order.items.id(req.params.itemId);
    if (!orderItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    orderItem.status = status;
    await order.save();
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;