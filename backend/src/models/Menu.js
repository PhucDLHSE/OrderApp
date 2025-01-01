const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: {
    type: String,
    enum: ['food', 'drink', 'dessert'],
    required: true
  },
  description: String,
  available: { type: Boolean, default: true }
}, { timestamps: true });


const MenuItem = mongoose.model('MenuItem', menuItemSchema);

const Menu = mongoose.model('Menu', {
  items: [menuItemSchema]
});

module.exports = { Menu, MenuItem };