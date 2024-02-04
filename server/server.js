const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const PORT = 3001
const fs = require('fs')
const authRouter = require('./authRouter')

const app = express()

app.use(express.json())

const start = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/pawrescue')
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`)
        })
    }catch (error) {
        console.log(`Error: ${error}`)
    }
}























/*
/*
const animalSchema = new mongoose.Schema({
    name: { type: String, index: true },
    picture: { type: String, index: true },
    breed: { type: String, index: true },
    age: { type: String, index: true },
    description: { type: String, index: true }
});
const userSchema = new mongoose.Schema({
    username:{ type: String, index: true },
    email:{ type: String, index: true },
    password:{ type: String, index: true },
    cardDetails:{ type: String, index: true }
})

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

