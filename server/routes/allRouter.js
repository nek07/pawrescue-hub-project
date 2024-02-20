const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const Animal = require('../models/animal');
const middleware = require('../middleware/authMiddleware')
const fs = require('fs')
const paypal = require("@paypal/checkout-server-sdk")
const Environment =
  process.env.NODE_ENV === "production"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment
const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
)

const storeItems = new Map([
  [1, { price: 100, name: "Learn React Today" }],
  [2, { price: 200, name: "Learn CSS Today" }],
])

router.get("/", (req, res) => {
  res.render("../public/support1", {
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
  })
})

router.post("/support1", async (req, res) => {
  const request = new paypal.orders.OrdersCreateRequest()
  const total = req.body.items.reduce((sum, item) => {
    return sum + storeItems.get(item.id).price * item.quantity
  }, 0)
  request.prefer("return=representation")
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: total,
          breakdown: {
            item_total: {
              currency_code: "USD",
              value: total,
            },
          },
        },
        items: req.body.items.map(item => {
          const storeItem = storeItems.get(item.id)
          return {
            name: storeItem.name,
            unit_amount: {
              currency_code: "USD",
              value: storeItem.price,
            },
            quantity: item.quantity,
          }
        }),
      },
    ],
  })

  try {
    const order = await paypalClient.execute(request);
    res.json({ id: order.id });
  } catch (e) {
    console.error("Error creating PayPal order:", e);
    res.status(500).json({ error: e.message });
  }})


const filePath = path.join(__dirname, '../articles1.json');
const jsonData = JSON.parse(fs.readFileSync(filePath), 'utf-8');
router.get('/adoption',middleware.requireAuth, async (req, res) => {
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
router.get('/support',middleware.requireAuth, (req, res) => {
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

module.exports = router
