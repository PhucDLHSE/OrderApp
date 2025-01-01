const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['food', 'drink', 'dessert'],
    required: true
  },
  available: {
    type: Boolean,
    default: true
  },
  image: String,
  description: String
}, {
  timestamps: true
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;