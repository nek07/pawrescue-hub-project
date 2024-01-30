const express = require('express')
const mongoose = require('mongoose')
const path = require('path')


mongoose.connect('mongodb://127.0.0.1:27017/pawrescue')


const animalSchema = new mongoose.Schema({
    name: { type: String, index: true },
    picture: { type: String, index: true },
    breed: { type: String, index: true },
    age: { type: String, index: true },
    description: { type: String, index: true }
});
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


const app = express()
app.use('/home',express.static(path.join(__dirname+"/public/index.html")))
app.use('/login',express.static(path.join(__dirname+"/public/login.html")))
app.use('/adoption',express.static(path.join(__dirname+"/public/adoption.html")))
app.use('/aboutus',express.static(path.join(__dirname+"/public/aboutus.html")))
app.use('/support',express.static(path.join(__dirname+"/public/support.html")))
app.use('/resources',express.static(path.join(__dirname+"/public/resources.html")))
app.use('/registration',express.static(path.join(__dirname+"/public/reg.html")))
app.use((req,res)=> {
    res.status(404);
    res.send('<h1>Error 404 bro</h1>')
})
app.listen(3001, ()=>{
    console.log('Server is currently running')
})

