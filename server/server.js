const express = require('express')

const cookieParser = require('cookie-parser')
const authRouter = require('./routes/authRouter')
const router = require('./routes/allRouter')
const cors = require('cors')
const mongoose = require('mongoose')
const path = require('path')
const app = express()
app.set('view engine', 'ejs');
app.set('views', __dirname);

const PORT = process.env.PORT || 3001


// Middleware
app.use(express.json())
app.use(cookieParser())
app.use(cors())
app.get('/', (req, res) => {
    res.render(path.join(__dirname, '/public/index'), {});
});

  
// Routes
app.use('/auth', authRouter)
app.use('/pets', router)

// Create an instance of axios


function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, 'secret');
        return decoded.user;
    } catch (err) {
        return false;
    }
}

// Мидлвара для проверки авторизации
function requireAuth(req, res, next) {
    const token = req.headers.set-Cookie;
    const user = verifyToken(token);
    if (user) {
        req.user = user;
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}
app.get('/private', requireAuth, (req, res) => {
    res.json({ message: 'hello bro' });
});
const start = async () => {
    try {
        // await mongoose.connect('mongodb+srv://ataytoleuov:220439@abylaidb.3jyfmar.mongodb.net/pawrescue');
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
        });
    } catch (error) {
        console.log(`Error connecting to MongoDB: ${error}`);
    }
};

start()

module.exports = app;













