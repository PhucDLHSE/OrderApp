const express = require('express');
const router = express.Router();
const { protect, staff } = require('../middleware/auth.middleware');
const Table = require('../models/Table');
const Order = require('../models/Order');
const MenuItem = require('../models/Menu');

// @route   GET api/staff/tables
// @desc    Get all tables
// @access  Staff only
router.get('/tables', protect, staff, async (req, res) => {
  try {
    const tables = await Table.find({});
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/staff/menu
// @desc    Get all menu items
// @access  Staff only
router.get('/menu', protect, staff, async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ available: true });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/staff/orders
// @desc    Create new order
// @access  Staff only
router.post('/orders', protect, staff, async (req, res) => {
  try {
    const { tableId, items } = req.body;

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = await Promise.all(items.map(async (item) => {
      const menuItem = await MenuItem.findById(item.menuItemId);
      totalAmount += menuItem.price * item.quantity;
      return {
        menuItem: menuItem._id,
        quantity: item.quantity,
        notes: item.notes
      };
    }));

    const order = new Order({
      table: tableId,
      staff: req.user._id,
      items: orderItems,
      totalAmount
    });

    // Update table status
    await Table.findByIdAndUpdate(tableId, { status: 'occupied' });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   POST api/staff/orders/:orderId/payment
// @desc    Process payment for order
// @access  Staff only
router.post('/orders/:orderId/payment', protect, staff, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.status = 'completed';

    // Free up the table
    await Table.findByIdAndUpdate(order.table, { status: 'available' });

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;