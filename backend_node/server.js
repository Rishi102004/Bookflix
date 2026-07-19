const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const natural = require('natural');

const app = express();
const PORT = 8000;
const MONGO_URI = 'mongodb://localhost:27017/';
const DB_NAME = 'bookflix';

app.use(cors());
app.use(express.json());

let db;
MongoClient.connect(MONGO_URI)
    .then(client => {
        db = client.db(DB_NAME);
        console.log("Connected to MongoDB");
    })
    .catch(err => console.error("MongoDB connection error:", err));

const getBookDetails = async (book_id) => {
    return await db.collection('books').findOne({ book_id: parseInt(book_id) }, { projection: { _id: 0 } });
};

const logInteraction = async (action) => {
    const validActions = ["click", "recommend", "cache_hit", "feedback_positive", "feedback_negative"];
    if (validActions.includes(action)) {
        const field = action === "click" ? "total_clicks"
            : action === "recommend" ? "total_recommendations_served"
            : action === "cache_hit" ? "cache_hits"
            : action === "feedback_positive" ? "feedback_positive"
            : "feedback_negative";
        
        await db.collection('metrics').updateOne(
            { id: "global" },
            { $inc: { [field]: 1 } },
            { upsert: true }
        );
    }
};

app.get('/api/users', async (req, res) => {
    try {
        const topUsers = await db.collection('ratings').aggregate([
            { $group: { _id: "$user_id", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();
        res.json(topUsers.map(u => u._id));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users/:user_id/history', async (req, res) => {
    try {
        const userId = parseInt(req.params.user_id);
        const userRatings = await db.collection('ratings').find({ user_id: userId, rating: { $gte: 7 } })
            .sort({ rating: -1 }).limit(20).toArray();
        
        const history = [];
        for (let r of userRatings) {
            const book = await getBookDetails(r.book_id);
            if (book) history.push({ book_id: r.book_id, rating: r.rating, book_details: book });
        }
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 5;
        const regex = new RegExp(q, 'i');
        const books = await db.collection('books').find({
            $or: [{ title: regex }, { author: regex }, { genre: regex }]
        }).limit(limit).project({ _id: 0 }).toArray();
        res.json(books);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { type } = req.query;
    if (type === "positive") await logInteraction("feedback_positive");
    else if (type === "negative") await logInteraction("feedback_negative");
    res.json({ status: "ok" });
});

app.get('/api/admin/metrics', async (req, res) => {
    try {
        const metrics = await db.collection('metrics').findOne({ id: "global" }) || {
            total_recommendations_served: 0,
            total_clicks: 0,
            cache_hits: 0,
            feedback_positive: 0,
            feedback_negative: 0
        };
        
        let ctr = 0;
        if (metrics.total_recommendations_served > 0) {
            ctr = (metrics.total_clicks / metrics.total_recommendations_served) * 100;
        }
        
        let precision = 0;
        const total_feedback = metrics.feedback_positive + metrics.feedback_negative;
        if (total_feedback > 0) {
            precision = (metrics.feedback_positive / total_feedback) * 100;
        }
        
        res.json({
            ctr_percent: parseFloat(ctr.toFixed(2)),
            precision_percent: parseFloat(precision.toFixed(2)),
            raw_stats: metrics
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/interactions/click', async (req, res) => {
    await logInteraction("click");
    res.json({ status: "ok" });
});

// NEW: Rate a book
app.post('/api/rate', async (req, res) => {
    try {
        const { user_id, book_id, rating } = req.body;
        if (!user_id || !book_id || rating == null) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        await db.collection('ratings').updateOne(
            { user_id: parseInt(user_id), book_id: parseInt(book_id) },
            { $set: { rating: parseInt(rating) } },
            { upsert: true }
        );
        res.json({ status: "ok" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// NEW: Watchlist
app.post('/api/watchlist', async (req, res) => {
    try {
        const { user_id, book_id, action } = req.body;
        if (!user_id || !book_id || !action) return res.status(400).json({ error: "Missing fields" });
        
        if (action === "add") {
            await db.collection('watchlist').updateOne(
                { user_id: parseInt(user_id), book_id: parseInt(book_id) },
                { $set: { added_at: new Date() } },
                { upsert: true }
            );
        } else if (action === "remove") {
            await db.collection('watchlist').deleteOne({ user_id: parseInt(user_id), book_id: parseInt(book_id) });
        }
        res.json({ status: "ok" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/watchlist/:user_id', async (req, res) => {
    try {
        const items = await db.collection('watchlist').find({ user_id: parseInt(req.params.user_id) }).sort({ added_at: -1 }).toArray();
        const history = [];
        for (let item of items) {
            const book = await getBookDetails(item.book_id);
            if (book) history.push({ book_id: item.book_id, book_details: book });
        }
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Upgraded Recommendation Engine
app.post('/api/recommend', async (req, res) => {
    try {
        await logInteraction("recommend");
        const { book_id, user_id, preferred_genres, limit = 10 } = req.body;
        
        let recommendations = [];

        if (user_id && !book_id) {
            const userLiked = await db.collection('ratings').find({ user_id: parseInt(user_id), rating: { $gte: 7 } }).toArray();
            const likedBookIds = userLiked.map(r => r.book_id);
            
            if (likedBookIds.length > 0) {
                const similarUsers = await db.collection('ratings').aggregate([
                    { $match: { book_id: { $in: likedBookIds }, rating: { $gte: 7 }, user_id: { $ne: parseInt(user_id) } } },
                    { $group: { _id: "$user_id", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]).toArray();
                
                const simUserIds = similarUsers.map(u => u._id);
                
                if (simUserIds.length > 0) {
                    const recPool = await db.collection('ratings').aggregate([
                        { $match: { user_id: { $in: simUserIds }, rating: { $gte: 8 }, book_id: { $nin: likedBookIds } } },
                        { $group: { _id: "$book_id", score: { $sum: 1 } } },
                        { $sort: { score: -1 } },
                        { $limit: limit }
                    ]).toArray();
                    
                    for (let r of recPool) {
                        const book = await getBookDetails(r._id);
                        if (book) {
                            recommendations.push({
                                book_id: r._id,
                                confidence_score: Math.min(1.0, r.score * 0.2),
                                explanation: "A user with a similar reading profile highly rated this.",
                                book_details: book
                            });
                        }
                    }
                }
            }
        } 
        else if (book_id) {
            // TF-IDF Content-Based Matching using 'natural'
            const book = await getBookDetails(book_id);
            if (book) {
                const candidates = await db.collection('books').find({
                    genre: book.genre,
                    book_id: { $ne: parseInt(book_id) }
                }).limit(500).toArray();

                const TfIdf = natural.TfIdf;
                const tfidf = new TfIdf();
                
                const targetText = `${book.author} ${book.genre} ${book.title}`;
                const targetTokens = new natural.WordTokenizer().tokenize(targetText.toLowerCase());
                
                candidates.forEach(c => {
                    tfidf.addDocument(`${c.author} ${c.genre} ${c.title}`);
                });

                const scores = [];
                candidates.forEach((c, index) => {
                    let score = 0;
                    tfidf.tfidfs(targetTokens, function(i, measure) {
                        if (i === index) score += measure; // addDocument index matches candidate array index
                    });
                    scores.push({ book: c, score });
                });

                scores.sort((a, b) => b.score - a.score);
                const topMatches = scores.slice(0, limit);
                
                for (let match of topMatches) {
                    if (match.score > 0) {
                        recommendations.push({
                            book_id: match.book.book_id,
                            confidence_score: Math.min(1.0, match.score / 5),
                            explanation: "Shares strong thematic and author similarities.",
                            book_details: match.book
                        });
                    }
                }
            }
        }
        else if (!book_id && preferred_genres && preferred_genres.length > 0) {
            const genreBooks = await db.collection('books').find({ genre: { $in: preferred_genres } }).limit(limit).toArray();
            for (let b of genreBooks) {
                recommendations.push({
                    book_id: b.book_id,
                    confidence_score: 1.0,
                    explanation: "Popular book in your preferred genres.",
                    book_details: b
                });
            }
        } else {
            return res.status(400).json({ detail: "Must provide book_id or preferred_genres" });
        }

        res.json({ recommendations });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/books', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const books = await db.collection('books').find().limit(limit).project({ _id: 0 }).toArray();
        res.json(books);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/books/:book_id', async (req, res) => {
    try {
        const details = await getBookDetails(req.params.book_id);
        if (!details) return res.status(404).json({ detail: "Book not found" });
        res.json(details);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Node.js BookFlix backend running on port ${PORT}`);
});
