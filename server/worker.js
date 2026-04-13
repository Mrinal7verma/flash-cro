const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const connection = process.env.REDIS_URL 
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ maxRetriesPerRequest: null });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const worker = new Worker('cro-jobs', async (job) => {
    console.log(`\n🚨 JOB START | ID: ${job.id}`);
    const { url, adCreative } = job.data;

    try {
        // 1. SCRAPE
        const { data: html } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        const $ = cheerio.load(html);
        const oldHero = $('h1').first().text().trim();

        // 2. AI BRAIN (The "PM" Requirement)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `You are a Conversion Rate Optimization (CRO) expert. 
        Original Landing Page Heading: "${oldHero}"
        User's Ad Content/Goal: "${adCreative}"
        
        Task: Rewrite the heading to perfectly match the ad while making it more persuasive. 
        Respond with ONLY the new heading text. No quotes, no explanation.`;

        const result = await model.generateContent(prompt);
        const newHero = result.response.text();

        console.log(`✨ AI Transformation:`);
        console.log(`   From: ${oldHero}`);
        console.log(`   To:   ${newHero}`);

        // 3. MODIFY & FINISH
        const targetH1 = $('h1').first();
        targetH1.text(newHero);
        // Fix for advanced sites (like Stripe) that use pseudo-elements for gradients/shadows
        targetH1.removeAttr('data-text');
        targetH1.removeAttr('data-content');

        // Crucial: Remove all script tags! 
        // Modern websites use frameworks like React/Next.js. If we leave the scripts in, 
        // the original Javascript will run in the browser, realize the HTML was modified, 
        // and try to "hydrate" or fix the page, causing overlapping text and bugs!
        $('script').remove();

        // Inject base tag so relative links/images work
        try {
            const originUrl = new URL(url).origin;
            // Prepend base to head if exists, else to root
            if ($('head').length) {
                $('head').prepend(`<base href="${originUrl}">`);
            } else {
                $('html').prepend(`<head><base href="${originUrl}"></head>`);
            }
        } catch (err) {
            console.error("Failed to parse base URL", err);
        }

        const fullHtml = $.html();
        return { success: true, newHeading: newHero, html: fullHtml };

    } catch (error) {
        console.error("Worker Error:", error.message);
        throw error;
    }
}, { connection });

console.log('👷 Worker is online with Gemini integration...');