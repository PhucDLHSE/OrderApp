const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const {protect} = require('../middleware/auth.middleware');

// @route   POST api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Đăng nhập với tên người dùng:', username);

    const user = await User.findOne({ username });
    console.log('Tìm thấy người dùng:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('Không tìm thấy người dùng');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    console.log('Checking password...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Mật khẩu đúng:', isMatch ? 'Yes' : 'No');

    if (!isMatch) {
      console.log('Sai mật khẩu');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    console.log('Token:', user._id);
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('Đăng nhập thành công');
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ĐỔI MẬT KHẨU
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// CẬP NHẬT THÔNG TIN CÁ NHÂN
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    await user.save();

    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;