const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('./models/User');
const Vehicle = require('./models/Vehicle');
const Booking = require('./models/Booking');

const app = express();
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/car_rental_4553';
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(mongoUri)
    .then(async () => {
        console.log('MongoDB Connected Successfully');
        const count = await Vehicle.countDocuments();
        if (count === 0) {
            await Vehicle.insertMany([
                { brand: 'Toyota', model: 'Corolla Axio', category: 'Sedan', dailyRate: 3500, imageUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=500' },
                { brand: 'Honda', model: 'Civic RS', category: 'Sedan', dailyRate: 5500, imageUrl: 'https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=500' },
                { brand: 'Toyota', model: 'Noah Hybrid', category: 'Microbus', dailyRate: 6500, imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=500' },
                { brand: 'Mitsubishi', model: 'Pajero Sport', category: 'SUV', dailyRate: 9500, imageUrl: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=500' }
            ]);
            console.log('Sample vehicles seeded');
        }
    })
    .catch(err => console.error('MongoDB Error:', err));

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'al_rayain_4553_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoUri,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
});

// Role Protection Middleware
const requireLogin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    next();
};

// 1. HOME / VEHICLE FLEET
app.get('/', async (req, res) => {
    const filter = { status: 'available' };
    if (req.query.category && ['Sedan', 'SUV', 'Microbus'].includes(req.query.category)) {
        filter.category = req.query.category;
    }
    const vehicles = await Vehicle.find(filter).sort({ createdAt: -1 });
    res.render('index', { vehicles, selectedCategory: req.query.category || '' });
});

// 2. REGISTER (First user automatically becomes Admin)
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password || password.length < 6) {
        return res.render('register', { error: 'Please fill all fields (password min 6 characters).' });
    }
    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) return res.render('register', { error: 'Email already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const isFirstUser = (await User.countDocuments()) === 0;

    await User.create({
        fullName: String(fullName),
        email: String(email),
        password: hashedPassword,
        role: isFirstUser ? 'admin' : 'user'
    });
    res.redirect('/login?registered=1');
});

// 3. LOGIN & LOGOUT
app.get('/login', (req, res) => res.render('login', { error: null, registered: req.query.registered }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (user && await bcrypt.compare(String(password), user.password)) {
        req.session.user = { id: user._id, fullName: user.fullName, role: user.role };
        return res.redirect(user.role === 'admin' ? '/admin' : '/');
    }
    res.render('login', { error: 'Wrong email or password.', registered: false });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// 4. BOOKING & PRICE CALCULATION
app.get('/book/:id', requireLogin, async (req, res) => {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle || vehicle.status !== 'available') return res.redirect('/');
    res.render('book', { vehicle, error: null });
});

app.post('/book/:id', requireLogin, async (req, res) => {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.redirect('/');

    const start = new Date(req.body.startDate);
    const end = new Date(req.body.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start) || isNaN(end) || start < today || end < start) {
        return res.render('book', { vehicle, error: 'Return date must be on or after pickup date.' });
    }

    const overlap = await Booking.findOne({
        vehicle: vehicle._id,
        status: 'approved',
        startDate: { $lte: end },
        endDate: { $gte: start }
    });

    if (overlap) {
        return res.render('book', { vehicle, error: 'Car is already booked for these dates.' });
    }

    const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const totalPrice = totalDays * vehicle.dailyRate;

    await Booking.create({
        user: req.session.user.id,
        vehicle: vehicle._id,
        startDate: start,
        endDate: end,
        totalDays,
        totalPrice
    });

    res.redirect('/my-bookings?booked=1');
});

// 5. USER BOOKING HISTORY
app.get('/my-bookings', requireLogin, async (req, res) => {
    const bookings = await Booking.find({ user: req.session.user.id })
        .populate('vehicle')
        .sort({ createdAt: -1 });
    res.render('my-bookings', { bookings, booked: req.query.booked });
});

app.post('/bookings/:id/cancel', requireLogin, async (req, res) => {
    await Booking.findOneAndUpdate(
        { _id: req.params.id, user: req.session.user.id, status: 'pending' },
        { status: 'cancelled' }
    );
    res.redirect('/my-bookings');
});

// 6. ADMIN DASHBOARD
app.get('/admin', requireAdmin, async (req, res) => {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });
    const bookings = await Booking.find()
        .populate('user', 'fullName email')
        .populate('vehicle', 'brand model')
        .sort({ createdAt: -1 });
    res.render('admin', { vehicles, bookings });
});

app.post('/admin/vehicles', requireAdmin, async (req, res) => {
    const { brand, model, category, dailyRate, imageUrl } = req.body;
    await Vehicle.create({
        brand,
        model,
        category,
        dailyRate: Number(dailyRate),
        imageUrl: imageUrl || undefined
    });
    res.redirect('/admin');
});

app.post('/admin/vehicles/:id/toggle', requireAdmin, async (req, res) => {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle) {
        vehicle.status = vehicle.status === 'available' ? 'maintenance' : 'available';
        await vehicle.save();
    }
    res.redirect('/admin');
});

app.post('/admin/vehicles/:id/delete', requireAdmin, async (req, res) => {
    await Vehicle.findByIdAndDelete(req.params.id);
    await Booking.deleteMany({ vehicle: req.params.id });
    res.redirect('/admin');
});

app.post('/admin/bookings/:id/status', requireAdmin, async (req, res) => {
    if (['approved', 'rejected'].includes(req.body.status)) {
        await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status });
    }
    res.redirect('/admin');
});

if (require.main === module) {
    app.listen(port, () => console.log(`Open http://localhost:${port} in your browser`));
}

module.exports = app;
