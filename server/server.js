const express = require('express')
const mongoose = require('mongoose')

const app = express()

mongoose.connect('mongodb://127.0.0.1:27017/crud')

const laptopSchema = new mongoose.Schema({
    model: { type: String, index: true },
    price: { type: Number, index: true }
});
const laptopModel = mongoose.model("laptops",laptopSchema)

app.get('/', (req,res) => {
 /* laptopModel.insertMany([{model:"acer nitro 3",price:481000},{model:"macbook air 14",price:900000}]).then(
        function(laptops){res.json(laptops)}).catch(function(err){console.log(err)})*/
        laptopModel.deleteOne({model:"macbook air 14"}).then(
            function(laptops){res.json(laptops)}).catch(function(err){console.log(err)})})

app.listen(3001, ()=>{
    console.log('Server is currently running')
})

