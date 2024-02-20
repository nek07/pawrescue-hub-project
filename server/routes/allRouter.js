const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const Animal = require('../models/animal');
const requireAuth = require('../middleware/authMiddleware')
const fs = require('fs')


const filePath = path.join(__dirname, '../articles1.json');
const jsonData = JSON.parse(fs.readFileSync(filePath), 'utf-8');
router.get('/adoption', async (req, res) => {
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
});

router.get('/resources', async (req, res) => {

    // const data = await articles();
    // console.log(data)

    res.render('../public/resources', { data:jsonData });
  
});
router.get('/home', (req, res) => {
    res.render(path.join(__dirname, '../public/index'), {});
});
router.get('/support',requireAuth.requireAuth, (req, res) => {
  res.render(path.join(__dirname, '../public/support'), {});
});
router.post('/support', (req, res) => {
  const { amount, nonprofit_id, funds_collected } = req.body

  fetch('https://api.getchange.io/api/v1/donations', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(public_key + ":" + secret_key).toString('base64'),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      amount: amount,
      nonprofit_id: "n_dZWs9lvVIn3wfIXsTbxAAk2z",
      funds_collected: false
    })
  })
    .then(response => response.json())
    .then(data => res.status(200).json(data))
    .catch(error => res.status(500).json(error))
})

router.get('/aboutus', (req, res) => {
  res.render(path.join(__dirname, '../public/aboutus'), {});
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
