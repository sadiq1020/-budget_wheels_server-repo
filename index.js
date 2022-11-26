const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e3n1sso.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        //  -------------------------------- collections ---------------------------------
        const productsCollection = client.db('budgetWheels').collection('products');
        const categoriesCollection = client.db('budgetWheels').collection('categories');
        const usersCollection = client.db('budgetWheels').collection('users');
        const bookingsCollection = client.db('budgetWheels').collection('bookings');
        const advertisedCollection = client.db('budgetWheels').collection('advertised');
        //-------------------------------------------------------------------------------


        // --------------------------------- categories ---------------------------------
        // get all three categories
        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result);
        });

        // get products by category
        app.get('/categoryProducts', async (req, res) => {
            const name = req.query.name;
            const query = { categoryName: name };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });
        // ---------------------------------------------------------------------------------


        //---------------------------------- booking -----------------------------------
        // save booking info to db
        app.post('/bookings', async (req, res) => {
            const booking = req.body;

            // first checking, if the product is already booked
            const query = {
                buyerName: booking.buyerName,
                email: booking.email,
                brand: booking.brand,
                series: booking.series
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `${booking.brand} ${booking.series} is already booked`
                return res.send({ acknowledged: false, message })
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        // get my bookings 
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result);
        })
        //-------------------------------------------------------------------------------


        // --------------------------------- sellers ------------------------------------
        // add new product by seller 
        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })

        // get all products added by seller
        app.get('/myproducts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })

        // delete a product by seller
        app.delete('/myproducts/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        })
        // -------------------------------------------------------------------------------

        // -------------------------------- advertised --------------------------------------
        // save advertised items to db
        app.post('/advertise', async (req, res) => {
            const advertisedProduct = req.body;
            const result = await advertisedCollection.insertOne(advertisedProduct);
            res.send(result);
        })

        // get all advertised items to show in home page
        app.get('/advertise', async (req, res) => {
            const query = {};
            const result = await advertisedCollection.find(query).toArray();
            res.send(result);
        })

        // get single seller's advertised products
        app.get('/advertise', async (req, res) => {
            const email = req.query.email;
            const query = {
                email: email
            }
            const result = await advertisedCollection.find(query).toArray();
            res.send(result);
        })

        // delete advertised items (not used)
        app.delete('/advertise/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await advertisedCollection.deleteOne(filter);
            res.send(result);
        })
        // ----------------------------------------------------------------------------------


        // --------------------------------- Users ---------------------------------------
        // save all users info in db 
        app.post('/users', async (req, res) => {
            const user = req.body;

            // check if the google login user exist in db
            const query = {
                email: user.email
            }
            const alreadySaved = await usersCollection.findOne(query);
            if (alreadySaved) {
                return res.send({ acknowledged: false })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // get all buyers
        app.get('/users/buyers', async (req, res) => {
            const query = {
                role: 'Buyer'
            }
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // delete buyer
        app.delete('/users/buyers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })
        // -------------------------------------------------------------------------------

    }
    finally {

    }
}
run().catch(console.log())




// -----------------------------------------------
app.get('/', async (req, res) => {
    res.send('Budget wheels server is running')
})

app.listen(port, () => console.log(`Budget wheel running on port: ${port}`))
// -----------------------------------------------