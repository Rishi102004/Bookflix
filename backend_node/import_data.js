const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017/';
const DB_NAME = 'bookflix';

const DATA_DIR = path.join(__dirname, '..', 'backend', 'data'); // Read from old backend/data

async function importData() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        const db = client.db(DB_NAME);
        
        const booksCollection = db.collection('books');
        const ratingsCollection = db.collection('ratings');
        const metricsCollection = db.collection('metrics');

        // Check if data already exists to avoid re-importing during development
        const booksCount = await booksCollection.countDocuments();
        if (booksCount > 0) {
            console.log("Data already exists in MongoDB. Skipping import to save time.");
            return;
        }

        // Import Books
        const booksFile = path.join(DATA_DIR, 'books.csv');
        if (fs.existsSync(booksFile)) {
            console.log(`Importing ${booksFile}...`);
            const books = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(booksFile)
                    .pipe(csv())
                    .on('data', (data) => {
                        // convert book_id and year to numbers
                        data.book_id = parseInt(data.book_id, 10);
                        data.year = parseInt(data.year, 10);
                        books.push(data);
                    })
                    .on('end', () => resolve())
                    .on('error', reject);
            });
            await booksCollection.deleteMany({});
            await booksCollection.insertMany(books);
            console.log(`Inserted ${books.length} records into 'books' collection.`);
            await booksCollection.createIndex({ book_id: 1 });
        }

        // Import Ratings
        const ratingsFile = path.join(DATA_DIR, 'ratings.csv');
        if (fs.existsSync(ratingsFile)) {
            console.log(`Importing ${ratingsFile}...`);
            const ratings = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(ratingsFile)
                    .pipe(csv())
                    .on('data', (data) => {
                        data.book_id = parseInt(data.book_id, 10);
                        data.user_id = parseInt(data.user_id, 10);
                        data.rating = parseInt(data.rating, 10);
                        ratings.push(data);
                    })
                    .on('end', () => resolve())
                    .on('error', reject);
            });
            await ratingsCollection.deleteMany({});
            // Batch insert
            const batchSize = 50000;
            for (let i = 0; i < ratings.length; i += batchSize) {
                const batch = ratings.slice(i, i + batchSize);
                await ratingsCollection.insertMany(batch);
                console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}`);
            }
            console.log(`Inserted ${ratings.length} records into 'ratings' collection.`);
            await ratingsCollection.createIndex({ user_id: 1 });
            await ratingsCollection.createIndex({ book_id: 1 });
        }

        // Initialize Metrics
        const metricsCount = await metricsCollection.countDocuments({ id: 'global' });
        if (metricsCount === 0) {
            await metricsCollection.insertOne({
                id: 'global',
                total_recommendations_served: 0,
                total_clicks: 0,
                cache_hits: 0,
                feedback_positive: 0,
                feedback_negative: 0
            });
            console.log("Initialized metrics collection.");
        }

        console.log("Data import to MongoDB completed successfully.");
    } catch (err) {
        console.error("Error during import:", err);
    } finally {
        await client.close();
    }
}

importData();
