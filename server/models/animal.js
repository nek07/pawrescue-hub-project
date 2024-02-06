const {Schema,model} = require('mongoose')


const animalSchema = new mongoose.Schema({
    name: { type: String, index: true },
    picture: { type: String, index: true },
    breed: { type: String, index: true },
    age: { type: String, index: true },
    description: { type: String, index: true }
});

const Animal = mongoose.model('Animal', animalSchema);

module.exports = Role;
