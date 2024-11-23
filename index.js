const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken")
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors({
    origin: ["http://localhost:5173","https://gadgetboom-d81aa.web.app"],
    optionsSuccessStatus: 200,
}));
app.use(express.json());


// token verification
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: "No Token" });
    }

    const token = authorization.split(" ")[1];
    if (!token) {
        return res.status(401).send({ message: "No Token" });
    }

    jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
        if (err) {
            console.error("JWT Error:", err.message);
            return res.status(403).send({ message: "Invalid Token" });
        }
        req.decoded = decoded;
        next();
    });
};



// verify seller
const verifySeller = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user?.role !== "seller") {
        return res.send({ message: "Forbidden access" });
    }
    next();
};


// verify admin
const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user?.role !== "admin") {
        return res.send({ message: "Forbidden access" });
    }
    next();
};

// MongoDB
const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lggq9by.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const userCollection = client.db("GadgetBoom").collection("users")
const productCollection = client.db("GadgetBoom").collection("products")


const dbConnect = async () => {
    try {
        // await client.connect();
        console.log("Successfully connected to MongoDB");


        // get user 
        app.get("/user/:email", async (req, res) => {
            const query = { email: req.params.email }
            const user = await userCollection.findOne(query)
            res.send(user)
        })

        // get all user for admin
        app.get("/all-users", async (req, res) => {
            const user = await userCollection.find().toArray()
            res.send(user)
        })

        // delete user by admin 
        app.delete('/user-delete/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })



        // Update user by admin
        app.put("/user-update/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };


                const updateDoc = {
                    $set: {
                        role: "seller",
                    },
                };

                const result = await userCollection.updateOne(query, updateDoc);

                if (result.modifiedCount === 1) {
                    res.send({ message: "User role updated successfully", result });
                } else {
                    res.status(404).send({ message: "User not found or already updated" });
                }
            } catch (error) {

                res.status(500).send({ message: "Server error", error: error.message });
            }
        });


        // insert user 
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: "User already exists" });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // add product by seller
        app.post("/add-products", verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        // Single Products Details 
        app.get('/ProductDetails/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.findOne(query)
            res.send(result);
        })

        // view own added product by seller
        app.get('/myProducts/:email', verifyJWT, verifySeller, async (req, res) => {
            const sellerEmail = req.decoded.email;
            const email = req.params.email;

            if (sellerEmail !== email) {

                return res.status(403).send({ message: "Forbidden Access" });
            }

            try {
                const query = { sellerEmail: email };
                const products = await productCollection.find(query).toArray();

                res.send(products);
            } catch (error) {

                res.status(500).send({ message: "Internal Server Error", error: error.message });
            }
        });


        //update product by seller
        app.put("/productUpdate/:id", async (req, res) => {
            const query = { _id: new ObjectId(req.params.id) }
            const data = {
                $set: {
                    title: req.body.title,
                    brand: req.body.brand,
                    price: req.body.price,
                    stock: req.body.stock,
                    category: req.body.category,
                    description: req.body.description,
                    imageURL: req.body.imageURL,
                }
            }
            const result = await productCollection.updateOne(query, data)
            res.send(result)
        })

        app.get('/mySingleProduct/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.findOne(query)
            res.send(result);
        })



        // delete product by seller 
        app.delete('/myProduct/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.deleteOne(query)
            res.send(result)
        })


        // all product view in products page
        app.get("/all-products", async (req, res) => {
            const { title, sort, category, brand } = req.query

            const query = {}

            if (title) {
                query.title = { $regex: title, $options: "i" }
            }
            if (category) {
                query.category = { $regex: category, $options: "i" }
            }
            if (brand) {
                query.brand = brand
            }

            const sortOption = sort === 'asc' ? 1 : -1;

            const products = await productCollection.find(query).sort({ price: sortOption }).toArray()
            const totalProducts = await productCollection.countDocuments(query)

            // const productsInfo = await productCollection.find({}, { projection: { category: 1, brand: 1 } }).toArray()
            const categories = [...new Set(products.map((product) => product.category))]
            const brands = [...new Set(products.map((product) => product.brand))]

            res.json({ products, brands, categories, totalProducts })
        })


        // Get products for featured
        app.get("/products", async (req, res) => {
            try {
                const products = await productCollection.find().limit(6).toArray();
                res.send(products);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch products" });
            }
        });


        //product add to wishlist by user
        app.patch("/wishlist/add", async (req, res) => {
            const { userEmail, productId } = req.body;

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $addToSet: { wishlist: new ObjectId(String(productId)) } }
            );
            res.send(result);
        });

        //get data from wishlist by user
        app.get("/wishlist/:userId", verifyJWT, async (req, res) => {
            const userId = req.params.userId;

            const user = await userCollection.findOne({
                _id: new ObjectId(String(userId)),
            });

            if (!user) {
                return res.send({ message: "User not found" });
            }

            const wishlist = await productCollection
                .find({ _id: { $in: user.wishlist || [] } })
                .toArray();

            res.send(wishlist);
        });


        //product remove from wishlist by user
        app.patch("/wishlist/remove", async (req, res) => {
            const { userEmail, productId } = req.body;

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $pull: { wishlist: new ObjectId(String(productId)) } }
            );
            res.send(result);
        });

        //product add to cartlist by user
        app.patch("/cartlist/add", async (req, res) => {
            const { userEmail, productId } = req.body;

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $addToSet: { cartlist: new ObjectId(String(productId)) } }
            );
            res.send(result);
        });

        //get data from wishlist by user
        app.get("/cartlist/:userId", verifyJWT, async (req, res) => {
            const userId = req.params.userId;

            const user = await userCollection.findOne({
                _id: new ObjectId(String(userId)),
            });

            if (!user) {
                return res.send({ message: "User not found" });
            }

            const cartlist = await productCollection
                .find({ _id: { $in: user.cartlist || [] } })
                .toArray();

            res.send(cartlist);
        });

        //product remove from cartlist by user
        app.patch("/cartlist/remove", async (req, res) => {
            const { userEmail, productId } = req.body;

            const result = await userCollection.updateOne(
                { email: userEmail },
                { $pull: { cartlist: new ObjectId(String(productId)) } }
            );
            res.send(result);
        });





    } catch (error) {
        console.log("Error connecting to MongoDB", error.message);
    }
};
dbConnect();

// API
app.get("/", (req, res) => {
    res.send("Server is running");
});


//jwt
app.post('/authentication', async (req, res) => {
    const userEmail = req.body
    const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, { expiresIn: '10d' })
    res.send({ token })
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});