const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Middleware to protect admin dashboard routes
const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const admin = await Admin.findById(decoded.id).select('-passwordHash');
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
      }

      req.admin = admin; // Attach admin details to req.admin
      return next();
    } catch (error) {
      console.error('Admin auth error:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

module.exports = {
  protectAdmin
};
