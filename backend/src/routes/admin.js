const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth.middleware');
const User = require('../models/User');
const MenuItem = require('../models/Menu');
const Table = require('../models/Table');
const Order = require('../models/Order');

// User Management
router.post('/users', protect, admin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    const user = new User({
      username,
      password,
      name,
      role
    });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Menu Management
router.post('/menu', protect, admin, async (req, res) => {
  try {
    const menuItem = new MenuItem(req.body);
    await menuItem.save();
    res.status(201).json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/menu/:id', protect, admin, async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Table Management
router.post('/tables', protect, admin, async (req, res) => {
  try {
    const table = new Table(req.body);
    await table.save();
    res.status(201).json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Dashboard Data
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dailyStats, totalUsers, totalTables, popularItems] = await Promise.all([
      // Daily sales statistics
      Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: today },
            status: 'completed',
            paymentStatus: 'paid'
          }
        },
        { 
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 }
          }
        }
      ]),
      // Total users count
      User.countDocuments(),
      // Total tables count
      Table.countDocuments(),
      // Popular items
      Order.aggregate([
        { $unwind: '$items' },
        { 
          $group: {
            _id: '$items.menuItem',
            totalOrdered: { $sum: '$items.quantity' }
          }
        },
        { $sort: { totalOrdered: -1 } },
        { $limit: 5 }
      ])
    ]);

    res.json({
      dailyStats: dailyStats[0] || { totalSales: 0, orderCount: 0 },
      totalUsers,
      totalTables,
      popularItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;