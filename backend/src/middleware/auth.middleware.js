const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } else {
      res.status(401).json({ message: 'Token không hợp lệ' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Yêu cầu quyền Admin' });
  }
};

const staff = (req, res, next) => {
  if (req.user && req.user.role === 'staff') {
    next();
  } else {
    res.status(401).json({ message: 'Chỉ có staff mới có quyền truy cập' });
  }
};

const barista = (req, res, next) => {
  if (req.user && req.user.role === 'barista') {
    next();
  } else {
    res.status(401).json({ message: 'Chỉ có barista mới có quyền truy cập' });
  }
};

module.exports = { protect, admin, staff, barista };