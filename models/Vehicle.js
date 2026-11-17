const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: ['Sedan', 'SUV', 'Microbus'] },
    dailyRate: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['available', 'maintenance'], default: 'available' },
    imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=500' }
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
