const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const Animal = require('../models/animal');
const fs = require('fs')
const {axiosInstance} = require('../service/user-service')
const getArrayData = require("../newsApiConnection");
const filePath = path.join(__dirname, '../jsonData/articles.json');
const jsonData = JSON.parse(fs.readFileSync(filePath), 'utf-8');
let arr = []
// function fillURL(jsonData){
//   for (let i = 0; i < jsonData.length; i++) {
//     const object = jsonData[i]; // Access each object
//     console.log(object)
//     if (object.urlToImage === null) {
//       object.urlToImage = 'https://awlights.com/wp-content/uploads/sites/31/2017/05/placeholder-news.jpg';
//     }
//     arr.push(object);
   
//   }
//   return arr
// }

// const jsonContent = JSON.stringify(fillURL(jsonData), null, 2); // Indent for readability
// fs.writeFileSync('articles.json', jsonContent);
/*router.get('/adoption', async (req, res) => {
    try {
        // Fetch all animals from the database
        const animals = await Animal.find();
        // Render the view and pass the animals data to it
        res.render(path.join(__dirname, '../public/adoption'), { animal: animals });
    } catch (error) {
        // Handle any errors that occur during the database operation
        console.error('Error fetching animals:', error);
        res.status(500).send('Internal Server Error');
    }
});*/
async function articles() {
  try {
    const data = await getArrayData(); // Await the promise
    const jsonContent = JSON.stringify(data, null, 2); // Indent for readability
    fs.writeFileSync('articles.json', jsonContent);
  } catch (error) {
    console.error('Error fetching articles:', error);
    throw error; // Re-throw the error for proper handling
  }
}

router.get('/resources', async (req, res) => {

    // const data = await articles();
    // console.log(data)

    res.render('../public/resources', { data:jsonData });
  
});
router.get('/home', (req, res) => {
    res.render(path.join(__dirname, '../public/index'), {});
});
router.get('/adoption', async (req, res) => {
    try {
      // Make a request using the axios instance
      const response = await axiosInstance.get('/adoption');
      res.json(response.data);
    } catch (error) {
      console.error('Error:', error.response.data);
      res.status(error.response.status).json({ message: 'Error occurred' });
    }
  });
module.exports = router
