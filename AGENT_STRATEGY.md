🧠 AGENT STRATEGY: "The Director"

THE BIGGEST RULE HERE IS WHENEVER YOU WANT TO CHANGE THE MODEL THAT WE'RE SENDING MESSAGES TO YOU'LL FIRST RESEARCH AVAILABLE MODELS!

1. Mission Statement

To democratize high-level video production by replacing the "Prompt Engineer" with an "Executive Producer." The user should define the intent ("Make it look like a 90s VHS tape"), and the Agent should handle the execution (finding clips, cutting, filtering).


2. Cognitive Architecture (The MoE Approach)

We are moving away from a single "God Prompt" to a Tool-Calling Orchestrator.

🎭 The Persona: "The Director"

Role: Orchestrator / Project Manager.

Capabilities: Cannot edit video directly. Can only instruct tools.

Behavior:

Analyzes abstract user requests.

Breaks them down into tangible tasks.

Delegated tasks to sub-experts (Tools).

Reviews tool outputs.

Synthesizes final assembly instructions (JSON).

🛠️ The Toolbelt (The Experts)

A. Expert: The Researcher (Context)

Tool Name: researchVisualContext

Function: Queries Gemini to find visual metaphors, sonic branding, and historical context for the topic.

Output: A list of keywords, visual styles (e.g., "Grainy," "High Contrast"), and audio vibes.

B. Expert: The Hunter (Assets)

Tool Name: searchAndAcquireClips

Function: Uses yt-dlp to search YouTube, parse metadata, and download specific segments.

Output: A manifesto of local file paths (./downloads/clip_1.mp4) and their metadata (duration, resolution).

C. Expert: The Editor (Execution)

Tool Name: renderVideoSpec

Function: Accepts a declarative editly JSON specification. It runs the render engine on the local machine.

Output: A URL path to the finished video file.

3. The "Loop" (Workflow)

User: "Make a hype reel of Senna."

Director: "I need to know what 'hype' looks like for Senna." -> Calls Researcher.

Researcher: "Fast cuts, engine noise, Monaco, yellow helmet."

Director: "Understood. Hunting for assets." -> Calls Hunter.

Hunter: "Downloaded 3 clips from Monaco 1988."

Director: "Assembling the timeline." -> Constructs Editly JSON. -> Calls Editor.

Editor: "Render complete."

Director: Presents video to User.

4. Success Metrics

Autonomy: The user should not have to provide timestamps or URLs manually.

Resilience: If a download fails, the Director should try a different query without crashing.

Style: The final edit should reflect the mood requested, not just the topic.