const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
 menuItem: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'MenuItem',
   required: true
 },
 itemName: String, // Tên món ăn
 price: Number, // Giá khi order
 quantity: {
   type: Number,
   required: true,
   min: 1
 },
 status: {
   type: String,
   enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
   default: 'pending'
 },
 notes: String,
 modifiedBy: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User'
 }
});

const orderSchema = new mongoose.Schema({
 orderNumber: {
   type: String,
   unique: true
 },
 table: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'Table',
   required: true
 },
 staff: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User',
   required: true
 },
 items: [orderItemSchema],
 totalAmount: {
   type: Number,
   required: true
 },
 status: {
   type: String,
   enum: ['active', 'completed', 'cancelled'],
   default: 'active'
 },
 paymentStatus: {
   type: String,
   enum: ['unpaid', 'paid', 'refunded'],
   default: 'unpaid'
 },
 paymentMethod: {
   type: String,
   enum: ['cash', 'card', 'transfer']
 },
 note: String,
 cancelReason: String,
 cancelledBy: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User'
 }
}, {
 timestamps: true
});

// Tạo order number tự động trước khi lưu
orderSchema.pre('save', async function(next) {
 if (!this.orderNumber) {
   const count = await mongoose.model('Order').countDocuments();
   this.orderNumber = `OD${String(count + 1).padStart(6, '0')}`;
 }
 next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;