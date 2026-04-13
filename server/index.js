const express = require('express');
const cors = require('cors');
const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

require('dotenv').config(); // Check server/.env
require('dotenv').config({ path: path.resolve(__dirname, '../worker/.env') }); // Absolute path check

console.log("Checking MONGO_URI injection: ", process.env.MONGO_URI ? "Found!" : "Missing!");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// MongoDB Connection
if (process.env.MONGO_URI && process.env.DATABASE_PASSWORD) {
    const DB = process.env.MONGO_URI.replace(
        '<PASSWORD>',
        process.env.DATABASE_PASSWORD
    );

    mongoose.connect(DB, {})
        .then(() => console.log('🟢 MongoDB Connected'))
        .catch(err => console.error('MongoDB Connection Error:', err));
} else if (process.env.MONGO_URI) {
    // Fallback if they put the password directly in MONGO_URI
    mongoose.connect(process.env.MONGO_URI, {})
        .then(() => console.log('🟢 MongoDB Connected'))
        .catch(err => console.error('MongoDB Connection Error:', err));
} else {
    console.log('🟡 No MONGO_URI provided in .env');
}

const JobSchema = new mongoose.Schema({
    jobId: String,
    url: String,
    adCreative: String,
    status: String,
    htmlResult: String,
    createdAt: { type: Date, default: Date.now }
});
const JobModel = mongoose.model('Job', JobSchema);

// Redis Connection
const connection = process.env.REDIS_URL 
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ maxRetriesPerRequest: null });

// BullMQ
const croQueue = new Queue('cro-jobs', { connection });
const queueEvents = new QueueEvents('cro-jobs', { connection });

const PORT = 5001;

// RATE LIMITER MIDDLEWARE (5 reqs / 5 minutes)
const rateLimiter = async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const key = `ratelimit:${ip}`;
    try {
        const current = await connection.incr(key);
        if (current === 1) {
            await connection.expire(key, 300); // 5 minutes expiration
        }
        if (current > 5) {
            console.log(`🛑 Rate limit blocked IP: ${ip}`);
            return res.status(429).json({ error: "Rate limit exceeded (5 requests per 5 minutes). Slow down!" });
        }
        next();
    } catch (err) {
        next(); // fail open if redis errors
    }
};

io.on('connection', (socket) => {
    console.log(`📡 Socket client connected: ${socket.id}`);
});

// Socket.io QueueEvents listeners
queueEvents.on('completed', async ({ jobId }) => {
    console.log(`✅ Job ${jobId} Completed! Broadcasting via WebSockets & Updaing Mongo`);
    try {
        const job = await croQueue.getJob(jobId);
        if (job) {
            const result = job.returnvalue;
            const cacheKey = `cro-cache:${job.data.url}:${job.data.adCreative}`;

            // 1. Redis Caching
            await connection.set(cacheKey, JSON.stringify(result), 'EX', 86400); // 24h caching

            // 2. MongoDB update
            if (process.env.MONGO_URI) {
                await JobModel.findOneAndUpdate(
                    { jobId: jobId },
                    { status: 'completed', htmlResult: result.html },
                    { upsert: true }
                );
            }

            // 3. Socket broadcast push
            io.emit('job-completed', { id: jobId, result });
        }
    } catch (e) { console.error("Error processing completion event", e) }
});

queueEvents.on('active', ({ jobId }) => {
    io.emit('job-active', { id: jobId });
});

// Main Endpoint with RateLimiter Middleware
app.post('/api/personalize', rateLimiter, async (req, res) => {
    const { url, adCreative } = req.body;

    if (!url) return res.status(400).json({ error: "URL is required" });

    console.log(`\n📥 Received request to personalize: ${url}`);

    // CACHING LAYER
    const cacheKey = `cro-cache:${url}:${adCreative}`;
    const cachedData = await connection.get(cacheKey);

    if (cachedData) {
        console.log(`⚡ CACHE HIT! Returning instant result for ${url}`);
        const parsedCache = JSON.parse(cachedData);
        const cachedJobId = `cached-${Date.now()}`;

        if (process.env.MONGO_URI) {
            await JobModel.create({ jobId: cachedJobId, url, adCreative, status: 'completed', htmlResult: parsedCache.html });
        }

        return res.json({
            message: "Served from Cache",
            jobId: cachedJobId,
            status: "completed",
            cachedResult: parsedCache
        });
    }

    // Add to Queue
    const job = await croQueue.add('process-landing-page', {
        url: url,
        adCreative: adCreative || "No ad provided yet"
    });

    if (process.env.MONGO_URI) {
        await JobModel.create({ jobId: job.id, url, adCreative, status: 'waiting' });
    }

    console.log(`🎫 Job sent to Worker! ID: ${job.id}`);
    res.json({ message: "Job added to queue", jobId: job.id, status: "processing" });
});

app.get('/api/jobs/:id', async (req, res) => {
    try {
        if (req.params.id.startsWith('cached-')) return res.json({ id: req.params.id, state: 'completed' });
        const job = await croQueue.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: "Job not found" });
        const state = await job.getState();
        res.json({ id: job.id, state: state, result: state === 'completed' ? job.returnvalue : null });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.get('/api/history', async (req, res) => {
    try {
        if (!process.env.MONGO_URI) return res.json([]);
        const jobs = await JobModel.find().sort({ createdAt: -1 }).limit(50);
        res.json(jobs);
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

server.listen(PORT, () => {
    console.log(`🚀 Advanced Dispatch Server is running on port ${PORT}`);
});

// Run Worker Side-by-Side to bypass Render paid requirement
require('./worker.js');