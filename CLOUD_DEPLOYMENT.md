# Production Cloud Deployment Guide (Zero Localhost)

This project is fully decoupled from localhost and designed to run entirely on managed cloud platforms.

---

## 1. Cloud Architecture Overview

```
                      +-----------------------------+
                      |   Vercel / Netlify (Cloud)   |
                      |   Frontend (React / Vite)   |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
+-----------------------------+             +-------------------------------+
|     Render / Fly.io (Cloud) |             |    Streamlit Community Cloud  |
|       Backend (Express)     |             |      or Render (Web Service)  |
|                             |             |      P3 RAG Assistant App     |
+--------------+--------------+             +---------------+---------------+
               |                                            |
               v                                            v
+-----------------------------+             +-------------------------------+
|     MongoDB Atlas (Cloud)   |             |   Qdrant Cloud (Vector DB)    |
|       Database Cluster      |             |   Voyage AI (Embeddings)      |
+-----------------------------+             |   Claude / Gemini (LLMs)      |
                                            +-------------------------------+
```

---

## 2. Deploying P3 (RAG Assistant) to Streamlit Community Cloud (100% Free)

1. **Push your repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: scalable cloud RAG pipeline with Claude & Gemini"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Deploy on Streamlit Community Cloud**:
   - Go to [share.streamlit.io](https://share.streamlit.io/) and log in with GitHub.
   - Click **"New app"**.
   - Select your repository.
   - **Main file path**: `P3/app.py`
   - Click **"Advanced settings..."** -> **Secrets** and paste:
     ```toml
     GEMINI_API_KEY = "your-gemini-api-key"
     GEMINI_MODEL = "gemini-2.5-flash"
     ANTHROPIC_API_KEY = "your-claude-api-key"
     ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
     VOYAGE_API_KEY = "your-voyage-api-key"
     VOYAGE_EMBEDDING_MODEL = "voyage-4-lite"
     QDRANT_URL = "your-qdrant-cluster-url"
     QDRANT_API_KEY = "your-qdrant-api-key"
     ```
   - Click **Deploy**! Your RAG Assistant is now live on a global HTTPS URL.

---

## 3. Deploying Backend API to Render

1. Log into [Render.com](https://render.com).
2. Connect your GitHub repository using the `render.yaml` blueprint included in this project, or click **New Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `MONGODB_URI`: `mongodb+srv://CC3:12345678910@cluster0.ksmw2pd.mongodb.net/studentDB?retryWrites=true&w=majority`
     - `FRONTEND_URL`: `https://your-frontend.vercel.app` (or `*` for initial testing)

---

## 4. Deploying Frontend to Vercel

1. Log into [Vercel](https://vercel.com).
2. Import your GitHub repository:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Environment Variables**:
     - `VITE_API_URL`: Your Render backend URL (e.g. `https://campus-desk-api.onrender.com`)
3. Click **Deploy**.

---

## 5. Scalability Architecture of This RAG Pipeline

This architecture achieves enterprise scale through five core pillars:

1. **Decoupled Stateless Inference & Storage**:
   - The app containers (Streamlit / Render) hold zero persistent vectors or file state.
   - Vector indexing and vector search run natively inside **Qdrant Cloud** (distributed HNSW indexing, cloud sharding).

2. **Dual-Model LLM Switching (Claude + Gemini)**:
   - Dynamic provider selection between **Anthropic Claude 3.5 Sonnet** (for complex legal/regulation reasoning and structured answers) and **Google Gemini 2.5 Flash** (for high-throughput, low-latency requests).

3. **High-Density Vector Space**:
   - Powered by **Voyage AI** (`voyage-4-lite`) with separate query and document embedding spaces, reducing false positives in semantic retrieval.

4. **Batch Upsert & Scalable Deduplication**:
   - Deterministic SHA-256 chunk hashing prevents duplicate indexing across multi-worker deployments.

