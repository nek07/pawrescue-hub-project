const express = require('express')
const mongoose = require('mongoose')
const path = require('path')


mongoose.connect('mongodb://127.0.0.1:27017/pawrescue')

const laptopSchema = new mongoose.Schema({
    model: { type: String, index: true },
    price: { type: Number, index: true }
});
const laptopModel = mongoose.model("laptops",laptopSchema)

app.get('/', (req,res) => {
 laptopModel.insertMany([{model:"acer nitro 3",price:481000},{model:"macbook air 14",price:900000}]).then(
        function(laptops){res.json(laptops)}).catch(function(err){console.log(err)})
        laptopModel.deleteOne({model:"macbook air 14"}).then(
            function(laptops){res.json(laptops)}).catch(function(err){console.log(err)})})*/
const app = express()
app.use('/home',express.static(path.join(__dirname+"/public/index.html")))
app.use('/registration',express.static(path.join(__dirname+"/public/reg.html")))
app.use('/adoption',express.static(path.join(__dirname+"/public/products.html")))
app.use('/aboutus',express.static(path.join(__dirname+"/public/contact.html")))
app.use((req,res)=> {
    res.status(404);
    res.send('<h1>Error 404 bro</h1>')
})
app.listen(3001, ()=>{
    console.log('Server is currently running')
})

