const express = require('express')
const axios = require('axios')
const cookieParser = require('cookie-parser')
const authRouter = require('./routes/authRouter')
const router = require('./routes/allRouter')
const cors = require('cors')
const mongoose = require('mongoose')

const PORT = process.env.PORT || 3001
const app = express()

// Middleware
app.use(express.json())
app.use(cookieParser())
app.use(cors())

  
// Routes
app.use('/auth', authRouter)
app.use('/pets', router)

// Create an instance of axios

// Example route using axios instance

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
        await mongoose.connect('mongodb://127.0.0.1:27017/pawrescue');
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
        });
    } catch (error) {
        console.log(`Error connecting to MongoDB: ${error}`);
    }
};

start()























/*
/*


const animalModel = mongoose.model("animals", animalSchema);
const animalNameToFind = "Persian";

const query = animalModel.findOne({ breed: animalNameToFind });

query.exec().then(foundAnimal => {
    if (foundAnimal) {
        console.log("Found Animal:", foundAnimal);
    } else {
        console.log("Animal not found");
    }
}).catch(err => {
    console.error("Error finding document:", err);
});
*/
// ... (Previous code)
/*
const api_key = '47bd84681a0a48f580e552a1397e1dfc';
var url = 'https://newsapi.org/v2/everything?' +
          'q=a&' +
          'from=2024-01-29&' +
          'sortBy=popularity&' +
          'apiKey=' + api_key;

let articles = []; // Move the declaration here

fetch(url)
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        // Check if data.articles is defined
        if (data.articles) {
            articles = data.articles;

            // Move the Express app initialization here
            const jsonData1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'animals.json'), 'utf-8'));
            const app = express();

            app.set('view engine', 'ejs');
            app.set('views', __dirname);

            app.get('/adoption', (req, res) => {
                res.render('public/adoption', { animal: jsonData1 });
            });

            app.get('/recources', (req, res) => {
                res.render('public/recources', { article: articles });
            });

            app.use('/home', express.static(path.join(__dirname, '/public/index.html')));
            // ... (Other static routes)

            app.use('/registration', express.static(path.join(__dirname, '/public/reg.html')));

            app.use((req, res) => {
                res.status(404);
                res.send('<h1>Error 404 bro</h1>');
            });

            app.listen(3001, () => {
                console.log('Server is currently running');
            });
        } else {
            console.error('No articles found in the response.');
        }
    })
    .catch(function(error) {
        // Handle errors here
        console.error('Error fetching data:', error);
    });
*/

