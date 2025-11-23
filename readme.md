The Director: AI Video Orchestrator

🎬 Project Overview

"The Director" is a local-first, autonomous agentic workflow designed to produce high-quality video edits programmatically. It utilizes a Mixture of Experts (MoE) architecture, where a central "Director" agent orchestrates specialized tools for research, asset acquisition, and non-linear editing.

⚡ Tech Stack

Framework: Next.js 14+ (App Router)

AI Core: Vercel AI SDK (ai)

Model Provider: Google Gemini 1.5 Flash (via @ai-sdk/google)

Video Engine: editly (Declarative FFmpeg wrapper)

Downloads: yt-dlp (System binary required)

🛠️ Prerequisites

Before running the agent, ensure your host machine has the "Engines" installed:

Node.js 18+

FFmpeg (Must be in your System PATH)

Verify: Type ffmpeg -version in terminal.

yt-dlp (Must be in your System PATH)

Verify: Type yt-dlp --version in terminal.

Install: pip install yt-dlp or use a binary.

Python 3.x (Required for yt-dlp)

🚀 Getting Started

Install Dependencies:

npm install


Environment Setup:
Create a .env.local file in the root:

GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here


Run the Director:

npm run dev


Access the Director Console at http://localhost:3000.

📂 Architecture

/app: Next.js App Router (Frontend UI).

/app/api/chat: The Director's brain (Orchestration logic).

/src/tools: The "Hands" of the agent (Researcher, Downloader, Editor).

/downloads: Temporary holding area for raw assets.

/public/renders: Final output destination.