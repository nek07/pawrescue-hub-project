const {Schema,model} = require('mongoose')


const animalSchema = new Schema({
    name: { type: String, index: true },
    picture: { type: String, index: true },
    breed: { type: String, index: true },
    age: { type: String, index: true },
    city:{ type: String, index: true },
    description: { type: String, index: true }
});

const Animal = model('Animal', animalSchema);

module.exports = Animal;
