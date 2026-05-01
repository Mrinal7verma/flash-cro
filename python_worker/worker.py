import asyncio
from bullmq import Worker
import os
import json
from dotenv import load_dotenv
from google import genai
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from pymongo import MongoClient
import datetime as dt

# Load from .env file that we copied from Node
load_dotenv()

# We need the rediss:// protocol for TLS connect to Upstash
redis_raw = os.environ.get('REDIS_URL') or "rediss://default:gQAAAAAAAVTpAAIsijglk;4ZDE1YWI0OGFjYWZlsakjlsWQ5MWI0N3AxODcyNzM@equipped-lemming-87273.upstash.io:6379"
redis_url = redis_raw.replace(";", "%3B")
raw_mongo = os.environ.get('MONGO_URI')
if raw_mongo and "<PASSWORD>" in raw_mongo:
    mongo_uri = raw_mongo.replace('<PASSWORD>', os.environ.get('DATABASE_PASSWORD', ''))
else:
    mongo_uri = raw_mongo

gemini_key = os.environ.get('GEMINI_API_KEY')

print("="*50)
print("🐍 MAX LEVEL PYTHON AI CLUSTER BOOTING...")
print(f"Loading REDIS_URL: {'🟢 FOUND' if redis_url else '🔴 MISSING'}")
print(f"Loading MONGO_URI: {'🟢 FOUND' if mongo_uri else '🔴 MISSING'}")
print("="*50)

# Connect to MongoDB seamlessly connecting Python to the existing React history backend
mongo_client = MongoClient(mongo_uri)
db = mongo_client.get_database('test')
jobs_collection = db['jobs']

# Initialize Google's official Gemini python SDK
ai_client = genai.Client(api_key=gemini_key)

async def process_job(job, job_token):
    # Retrieve the exact data standard passed by Node.js
    data = job.data
    url = data.get('url')
    adCreative = data.get('adCreative')
    sessionId = data.get('sessionId')
    
    print(f"\n🚀 [Python Supervisor] Detected new Job {job.id} for {url} Targeting: {adCreative}")

    # ==============================================================
    # THE UPGRADE: Headless Chromium Instead of Simple HTML requests
    # ==============================================================
    print("🌐 [Playwright] Booting Headless Chromium to bypass Anti-Bot layers...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # wait_until="networkidle" means wait for all React/Vue loading text to finish!
        await page.goto(url, wait_until="networkidle") 
        raw_html = await page.content()
        await browser.close()
        print(f"✅ [Playwright] Ripped {len(raw_html)} raw bytes from the hydrated DOM.")

    # ==============================================================
    # DOM Sanitization via BeautifulSoup4
    # ==============================================================
    print("🧹 [Sanitizer] Cleaning toxic tags (scripts, huge vectors)...")
    soup = BeautifulSoup(raw_html, 'html.parser')
    for tag in soup(['script', 'style', 'svg', 'noscript', 'iframe', 'canvas']):
        tag.decompose()
        
    sanitized_html = str(soup)
    print(f"✨ [Sanitizer] Minified payload to {len(sanitized_html)} bytes.")

    # ==============================================================
    # Advanced AI Orchestration via Python
    # ==============================================================
    print("🧠 [Gemini-Flash] Commencing Generative Ad Replacements...")
    prompt = f"""
    You are an expert Conversion Rate Optimizer. 
    Analyze this HTML and rewrite the text content perfectly to target this audience: "{adCreative}".
    Ensure the HTML structure remains 100% valid.
    Return ONLY raw HTML. No markdown wrappers. Do not explain your thought process.
    HTML:
    {sanitized_html}
    """
    
    # Send the native prompt using Python SDK
    response = ai_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    
    ai_html = response.text
    if ai_html.startswith('```html'):
        ai_html = ai_html[7:]
    if ai_html.endswith('```'):
        ai_html = ai_html[:-3]
        
    print("✅ [Generative AI] Core Engine success.")

    # ==============================================================
    # Save the output exactly like Node.js used to
    # ==============================================================
    doc = {
        "jobId": "py_" + str(job.id),
        "sessionId": sessionId,
        "url": url,
        "adCreative": adCreative,
        "status": "completed",
        "htmlResult": ai_html,
        "createdAt": dt.datetime.now(dt.timezone.utc)
    }
    
    jobs_collection.insert_one(doc)
    print(f"💾 [MongoDB] Wrote results cross-platform to database.")

    # BullMQ takes this return variable as the socket.io emit payload
    print("⚡ Socket.io real-time trigger sent.")
    print("="*50)
    return {"html": ai_html}

# BullMQ Python expects a connection dict
redis_opts = {"connection": redis_url}

async def main():
    print("Initializing Queue Hook...")
    # BullMQ automatically listens to the exact same 'cro-jobs' queue Node created
    worker = Worker('cro-jobs', process_job, redis_opts)
    
    print("🟩 ONLINE. Polling Redis cluster for incoming streams.")
    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("Shutting down AI Cluster...")
        await worker.close()
    except KeyboardInterrupt:
        print("Keyboard Interrupt")
        await worker.close()

if __name__ == '__main__':
    asyncio.run(main())
