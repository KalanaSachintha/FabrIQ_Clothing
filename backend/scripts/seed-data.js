/**
 * Database Seeding Script - Historical Orders
 * Used to populate the database with past sales data for testing the Forecasting Engine.
 */
const mongoose = require('mongoose');
const Order = require('../Model/orderModel');
const Product = require('../Model/ProductModel');

// Database URI - using the one from app.js
const MONGO_URI = 'mongodb+srv://rexxyaloconar_db_user:fU8NxUjFVUWAZNBs@fabriq.kmjnhhn.mongodb.net/FabrIQ';

const seedData = async () => {
    try {
        console.log('🔗 Connecting to MongoDB for seeding...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected.');

        // 1. Fetch existing products
        let products = await Product.find();
        
        // 2. If no products exist, create some samples first
        if (products.length === 0) {
            console.log('⚠️ No products found. Creating 3 sample items...');
            const sampleProducts = [
                {
                    name: "Casual Slim Fit Shirt",
                    price: 2400,
                    description: "High quality cotton shirt",
                    imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c",
                    category: "Shirts",
                    brand: "FabrIQ",
                    inStock: true,
                    stockAmount: 100
                },
                {
                    name: "Denim Straight Jeans",
                    price: 4500,
                    description: "Classic blue denim",
                    imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d",
                    category: "Pants",
                    brand: "FabrIQ",
                    inStock: true,
                    stockAmount: 85
                },
                {
                    name: "Black Leather Jacket",
                    price: 8900,
                    description: "Premium leather outwear",
                    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5",
                    category: "Waitwear",
                    brand: "FabrIQ",
                    inStock: true,
                    stockAmount: 40
                }
            ];
            products = await Product.insertMany(sampleProducts);
            console.log('✅ Sample products created.');
        }

        console.log(`📊 Generating historical orders for ${products.length} products over 90 days...`);

        const orders = [];
        const now = new Date();
        const userId = new mongoose.Types.ObjectId(); // Static mock userId for all seed orders

        // Iterate through last 90 days
        for (let day = 0; day < 90; day++) {
            const orderDate = new Date();
            orderDate.setDate(now.getDate() - day);
            
            // Introduce a trend: Sales generally increase as we get closer to "today"
            // Also add a weekend boost (Friday, Saturday, Sunday)
            const isWeekend = orderDate.getDay() === 0 || orderDate.getDay() === 5 || orderDate.getDay() === 6;
            const trendProgress = (90 - day) / 90; // 0 (90 days ago) to 1 (today)
            
            // Base orders: weekend gets more, and we add a growth trend
            const maxPossibleOrders = isWeekend ? 8 : 4;
            const dailyOrders = Math.floor(Math.random() * (maxPossibleOrders + (trendProgress * 4)));
            
            for (let i = 0; i < dailyOrders; i++) {
                // Randomize time of day
                orderDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

                // Pick 1-2 random products for this order
                const numItems = Math.floor(Math.random() * 2) + 1;
                const items = [];
                let totalAmount = 0;

                for (let j = 0; j < numItems; j++) {
                    const product = products[Math.floor(Math.random() * products.length)];
                    // Quantity also slightly trends upwards
                    const quantity = Math.floor(Math.random() * (3 + Math.floor(trendProgress * 3))) + 1;
                    
                    items.push({
                        productId: product._id,
                        productName: product.name,
                        quantity: quantity,
                        price: product.price,
                        color: "Standard",
                        size: "M"
                    });
                    totalAmount += (product.price * quantity);
                }

                orders.push({
                    userId: userId,
                    contact: "0770000000",
                    paymentMethod: "Cash on Delivery",
                    items: items,
                    totalAmount: totalAmount,
                    status: "Delivered",
                    createdAt: new Date(orderDate),
                    updatedAt: new Date(orderDate)
                });
            }
        }

        // 3. Insert into Database
        console.log(`🚀 Inserting ${orders.length} historical records into the 'orders' collection...`);
        await Order.insertMany(orders);

        console.log('✨ Database seeding complete! You can now test the Forecasting Dashboard.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
};

seedData();
