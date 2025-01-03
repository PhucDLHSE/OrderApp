const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth.middleware');
const User = require('../models/User');
const { Menu, MenuItem } = require('../models/Menu');
const Table = require('../models/Table');
const Order = require('../models/Order');
const Category = require('../models/Category');

// QUẢN LÝ TÀI KHOẢN
// 1. TẠO TÀI KHOẢN MỚI
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

// 2. LẤY DANH SÁCH TÀI KHOẢN
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. SỬA TÀI KHOẢN
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

// 4. XÓA TÀI KHOẢN
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

// QUẢN LÝ CATEGORY
// 1. THÊM CATEGORY MỚI
router.post('/categories', protect, admin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
      return res.status(400).json({ message: 'Category đã tồn tại' });
    }

    const category = new Category({
      name,
      description
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 2. LẤY DANH SÁCH CATEGORY
router.get('/categories', protect, admin, async (req, res) => {
  try {
    const categories = await Category.find().sort('name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. CẬP NHẬT CATEGORY
router.put('/categories/:id', protect, admin, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category không tồn tại' });
    }

    res.json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. XÓA CATEGORY
router.delete('/categories/:id', protect, admin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category không tồn tại' });
    }

    // Kiểm tra xem có menu items nào đang dùng category này không
    const menu = await Menu.findOne();
    const menuItemsWithCategory = menu.items.filter(
      item => item.category && item.category.toString() === req.params.id
    );

    if (menuItemsWithCategory.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa category đang được sử dụng trong menu' 
      });
    }

    // Sử dụng findByIdAndDelete thay vì remove
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xóa category thành công' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(400).json({ message: error.message });
  }
});


//QUẢN LÝ MENU
// 1. THÊM MÓN MỚI VÀO MENU
router.post('/menu-items', protect, admin, async (req, res) => {
  try {
    const { categoryId, ...itemData } = req.body;
    
    // Kiểm tra category có tồn tại không
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category không tồn tại' });
    }

    let menu = await Menu.findOne();
    if (!menu) {
      menu = new Menu({ items: [] });
    }

    // Thêm reference đến category
    menu.items.push({
      ...itemData,
      category: categoryId
    });

    await menu.save();
    res.status(201).json(menu.items[menu.items.length - 1]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 2. XEM MENU
router.get('/menu-items', protect, admin, async (req, res) => {
  try {
    const menu = await Menu.findOne()
      .populate('items.category', 'name');
    
    if (!menu || !menu.items.length) {
      return res.json([]);
    }

    res.json(menu.items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. SỬA MÓN TRONG MENU
router.put('/menu-items/:itemId', protect, admin, async (req, res) => {
  try {
    const { categoryId, name, price, description, available } = req.body;
    const menu = await Menu.findOne();

    if (!menu) {
      return res.status(404).json({ message: 'Menu không tồn tại' });
    }

    // Find item index
    const itemIndex = menu.items.findIndex(
      item => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Món không tồn tại' });
    }

    // Check duplicate name if name is being updated
    if (name && name !== menu.items[itemIndex].name) {
      const duplicateName = menu.items.some(
        item => item.name === name && item._id.toString() !== req.params.itemId
      );
      if (duplicateName) {
        return res.status(400).json({ message: 'Tên món này đã tồn tại' });
      }
    }

    // Validate category if being updated
    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(400).json({ message: 'Category không hợp lệ' });
      }
    }

    // Update item
    menu.items[itemIndex] = {
      ...menu.items[itemIndex].toObject(),
      name: name || menu.items[itemIndex].name,
      price: price || menu.items[itemIndex].price,
      category: categoryId || menu.items[itemIndex].category,
      description: description || menu.items[itemIndex].description,
      available: available !== undefined ? available : menu.items[itemIndex].available
    };

    await menu.save();
    await menu.populate('items.category', 'name');

    res.json(menu.items[itemIndex]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. XÓA MÓN TRONG MENU
router.delete('/menu-items/:itemId', protect, admin, async (req, res) => {
  try {
    const menu = await Menu.findOne();
    
    if (!menu) {
      return res.status(404).json({ message: 'Menu không tồn tại' });
    }

    // Check if item exists
    const itemExists = menu.items.find(
      item => item._id.toString() === req.params.itemId
    );
    if (!itemExists) {
      return res.status(404).json({ message: 'Món không tồn tại' });
    }

    // Check if item is in any active orders
    const activeOrders = await Order.find({
      'items.menuItem': req.params.itemId,
      status: 'active'
    });

    if (activeOrders.length > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa món đang có trong đơn hàng active' 
      });
    }

    // Remove item
    menu.items = menu.items.filter(
      item => item._id.toString() !== req.params.itemId
    );
    
    await menu.save();
    res.json({ message: 'Xóa món thành công' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 5. TẠM NGƯNG PHỤC VỤ MÓN
router.patch('/menu-items/:itemId/available', protect, admin, async (req, res) => {
  try {
    const menu = await Menu.findOne();
    const item = menu.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: 'Món không tồn tại' });
    }

    item.available = !item.available;
    await menu.save();

    // Trả về thông tin rõ ràng hơn
    res.json({
      id: item._id,
      name: item.name,
      available: item.available,
      message: item.available ? 'Món đã có thể order' : 'Món tạm thời hết'
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


//QUẢN LÝ BÀN
// 1. THÊM BÀN
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

// 2. DANH SÁCH BÀN
router.get('/tables', protect, admin, async (req, res) => {
  try {
    const tables = await Table.find().sort('tableNumber');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. CHỈNH SỬA THÔNG TIN BÀN
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

// 4. XÓA BÀN
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

// 5. CẬP NHẬT TRẠNG THÁI BÀN
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

// THỐNG KÊ CHI TIẾT
router.get('/dashboard/stats', protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const startDateTime = startDate ? new Date(startDate) : new Date();
    const endDateTime = endDate ? new Date(endDate) : new Date();
    endDateTime.setHours(23, 59, 59, 999);

    // 1. Thống kê doanh thu
    const revenueStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateTime, $lte: endDateTime },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 2. Top món bán chạy
    const popularItems = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateTime, $lte: endDateTime },
          status: 'completed'
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemName",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // 3. Thống kê theo nhân viên
    const staffStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateTime, $lte: endDateTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: "$staff",
          name: { $first: "$staffName" },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" }
        }
      }
    ]);

    await Order.populate(staffStats, {
      path: '_id',
      select: 'name'
    });

    res.json({
      revenueStats,
      popularItems,
      staffStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;