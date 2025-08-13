// server.js — Node + Express + Mongoose (keeps things simple for demo)
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());

// CONFIG (use .env in production)
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/foodOrderDB";

// Mongoose models
const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  menu: [{ item: String, price: Number }]
});
const Restaurant = mongoose.model("Restaurant", restaurantSchema);

// simple sleep to simulate delay
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// serve frontend files (you'll place index.html, style.css, script.js in same folder as server)
app.use("/", express.static(path.join(__dirname, ".")));

// ========== API ==========

// Search (GET /api/search?name=...)
app.get("/api/search", async (req, res) => {
  const name = (req.query.name || "").trim();
  await sleep(600 + Math.random()*600);
  if (!name) return res.status(400).json({ error: "Restaurant name required." });
  const rest = await Restaurant.findOne({ name: { $regex: `^${name}$`, $options: "i" }});
  if (!rest) return res.status(404).json({ error: "Restaurant not found." });
  res.json(rest);
});

// Place order (POST /api/order) { restaurantName, item }
app.post("/api/order", async (req, res) => {
  await sleep(700 + Math.random()*700);
  const { restaurantName, item } = req.body || {};
  if (!restaurantName || !item) return res.status(400).json({ error: "restaurantName and item required." });
  const rest = await Restaurant.findOne({ name: { $regex: `^${restaurantName}$`, $options: "i" }});
  if (!rest) return res.status(404).json({ error: "Restaurant not found." });
  const menuItem = rest.menu.find(m => m.item.toLowerCase() === String(item).toLowerCase());
  if (!menuItem) return res.status(400).json({ error: "Item not available." });

  // create fake order id
  const orderId = "ORD-" + Math.random().toString(36).slice(2,8).toUpperCase();
  res.json({ message: "Order placed", orderId, amount: menuItem.price });
});

// Payment (POST /api/payment) { orderId, amount, forceFail? }
app.post("/api/payment", async (req, res) => {
  await sleep(800 + Math.random()*800);
  const { orderId, amount, forceFail } = req.body || {};
  if (!orderId || typeof amount !== "number") return res.status(400).json({ error: "orderId and numeric amount required." });
  const fail = forceFail ? true : (Math.random() < 0.15);
  if (fail) return res.status(402).json({ error: "Payment declined." });
  const paymentId = "PAY-" + Math.random().toString(36).slice(2,10).toUpperCase();
  res.json({ message: "Payment success", paymentId });
});

// Delivery (GET /api/delivery?orderId=...)
app.get("/api/delivery", async (req, res) => {
  await sleep(1000 + Math.random()*1000);
  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: "orderId required." });
  res.json({ message: "Delivered", deliveredAt: new Date().toISOString() });
});

// seed DB with sample restaurants if empty
async function seed(){
  const count = await Restaurant.countDocuments();
  if (count === 0){
    await Restaurant.create([
      { name: "Burger Palace", menu: [{ item: "Cheese Burger", price: 5 }, { item: "Veg Burger", price: 4 }, { item: "Fries", price: 2 }] },
      { name: "Pasta Hub", menu: [{ item: "Alfredo Pasta", price: 7 }, { item: "Pesto Pasta", price: 8 }] }
    ]);
    console.log("Seeded sample restaurants.");
  }
}

// connect and start
mongoose.connect(MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=> {
    console.log("MongoDB connected");
    seed();
    app.listen(PORT, ()=> {
      console.log("Server running on http://localhost:" + PORT);
      console.log("Open http://localhost:" + PORT + "/index.html in your browser");
    });
  }).catch(err => {
    console.error("MongoDB connection error:", err.message || err);
  });
