const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth.middleware');
const User = require('../models/User');
const { Menu, MenuItem } = require('../models/Menu');
const Table = require('../models/Table');
const Order = require('../models/Order');

// Lấy danh sách người dùng
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo người dùng mới
router.post('/users', protect, admin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const user = new User({
      username,
      password,
      name,
      role
    });

    const savedUser = await user.save();
    res.status(201).json({
      id: savedUser._id,
      username: savedUser.username,
      name: savedUser.name,
      role: savedUser.role
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Sửa thông tin người dùng
router.put('/users/:id', protect, admin, async (req, res) => {
  try {
    const { username, name, role, password } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (username && username !== user.username) {
      const userExists = await User.findOne({ username });
      if (userExists) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      user.username = username;
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (password) user.password = password;

    const updatedUser = await user.save();
    res.json({
      id: updatedUser._id,
      username: updatedUser.username,
      name: updatedUser.name,
      role: updatedUser.role
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa người dùng
router.delete('/users/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

    await user.remove();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Thêm món mới vào Menu
router.post('/menu-items', protect, admin, async (req, res) => {
  try {
    let menu = await Menu.findOne(); // Tìm menu
    if (!menu) {
      menu = new Menu({ items: [] }); // Nếu chưa có menu, tạo mới
    }
    menu.items.push(req.body); // Thêm món mới vào mảng items
    await menu.save();
    res.status(201).json(menu.items[menu.items.length - 1]); // Trả về món vừa thêm
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Admin xem Menu
router.get('/menu-items', protect, admin, async (req, res) => {
  try {
    const menu = await Menu.findOne(); // Tìm menu
    if (!menu || menu.items.length === 0) {
      return res.status(404).json({ message: 'Menu is empty' });
    }
    res.json(menu.items); // Trả về danh sách món
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Sửa món trong Menu
router.put('/menu-items/:itemId', protect, admin, async (req, res) => {
  try {
    const menu = await Menu.findOne(); // Tìm menu
    if (!menu) {
      return res.status(404).json({ message: 'Menu not found' });
    }
    const itemIndex = menu.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found' });
    }
    menu.items[itemIndex] = { ...menu.items[itemIndex].toObject(), ...req.body }; // Cập nhật thông tin
    await menu.save();
    res.json(menu.items[itemIndex]); // Trả về món đã sửa
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Xóa món trong Menu
router.delete('/menu-items/:itemId', protect, admin, async (req, res) => {
  try {
    const menu = await Menu.findOne(); // Tìm menu
    if (!menu) {
      return res.status(404).json({ message: 'Menu not found' });
    }
    menu.items = menu.items.filter(item => item._id.toString() !== req.params.itemId); // Loại bỏ món khỏi mảng
    await menu.save();
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Get all tables
router.get('/tables', protect, admin, async (req, res) => {
  try {
    const tables = await Table.find().sort('tableNumber');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create table
router.post('/tables', protect, admin, async (req, res) => {
  try {
    const { tableNumber } = req.body;
    const tableExists = await Table.findOne({ tableNumber });
    
    if (tableExists) {
      return res.status(400).json({ message: 'Table number already exists' });
    }

    const table = new Table(req.body);
    await table.save();
    res.status(201).json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update table
router.put('/tables/:id', protect, admin, async (req, res) => {
  try {
    const { tableNumber } = req.body;
    if (tableNumber) {
      const tableExists = await Table.findOne({ 
        tableNumber, 
        _id: { $ne: req.params.id } 
      });
      if (tableExists) {
        return res.status(400).json({ message: 'Table number already exists' });
      }
    }

    const table = await Table.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    res.json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete table
router.delete('/tables/:id', protect, admin, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    
    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    if (table.status !== 'available') {
      return res.status(400).json({ message: 'Cannot delete table that is currently in use' });
    }

    await table.remove();
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update table status
router.patch('/tables/:id/status', protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    res.json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Dashboard endpoint
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    // Today's stats
    const today = new Date();
    today.setHours(0,0,0,0);

    const [dailyStats, tableStatus, userStats] = await Promise.all([
      // Sales statistics
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: today },
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

      // Table status count
      Table.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // User count by role
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      dailyStats: dailyStats[0] || { totalSales: 0, orderCount: 0 },
      tableStatus,
      userStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;