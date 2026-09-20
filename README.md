# Cognora

> **AI-Native Visual Learning Environment**  
> Concepts taught through evolving, verified visual states on an infinite whiteboard.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/) [![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue.svg)](https://www.typescriptlang.org/) [![React](https://img.shields.io/badge/react-19.0.0-61dafb.svg)](https://react.dev/) [![Excalidraw](https://img.shields.io/badge/powered%20by-Excalidraw-orange.svg)](https://excalidraw.com/) [![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

---

## What is Cognora?

Most learning tools teach dynamic concepts using static walls of text or pre-rendered videos that cannot be questioned, inspected, or branched. When you get stuck on a tricky step in an algorithm or system process, text chat provides paragraphs of text, but cannot show you _what changed_ visually.

**Cognora changes this.** It is an AI-native visual tutor built on top of [Excalidraw](https://excalidraw.com). Instead of generating markdown responses alone, Cognora compiles your question into an **authoritative semantic world**, tracks step-by-step state transformations, and renders them onto an interactive canvas.

```
Learner Question / Spoken Prompt
               │
               ▼
   [ Multimodal Intent Engine ]
               │
               ▼
       [ Teacher Brain ]  ◄──── Learner State (Confidence, Confusion, Pace)
               │
               ▼
   [ Authoritative Semantic World ]  ◄──── Invariant & Correctness Verification
               │
               ▼
       [ Teaching Moments ]  (1-to-1 Step Synchronization)
               │
               ▼
   [ Visual Composition & Layout ]  (Relationship-Aware, Topology-Preserving)
               │
               ▼
      [ Excalidraw Canvas ]  ◄──── Interactive Whiteboard (The HERO)
               ▲
               │
   ┌───────────┴───────────┐
   ▼                       ▼
[ Contextual Inspector ]   [ Voice 3.0 / ORB ]
(Analyze, Explain, Code)   (Chatterbox TTS + WebGL Orb)
```

---

## Why Cognora?

- **Meaning Before Pixels**: Large language models often hallucinate coordinates, collapse tree nodes, or cross graph edges. In Cognora, AI reasons about _meaning and transformations_, while deterministic layout engines compute geometry, and correctness engines verify invariants.
- **Local, Deterministic Detours**: When you ask _"Wait, why did that value update?"_, Cognora evaluates the causal chain directly from the active teaching moment. It answers locally in **0ms** without regenerating the lesson or resetting canvas state.
- **Isolated What-If Exploration**: Ask _"What if edge C→D had weight 1 instead of 8?"_ Cognora forks an isolated counterfactual branch, computes the ripple effect, and allows you to explore the alternative scenario before returning seamlessly to your main lesson.
- **Zero Machine ID Leakage**: Compiler and internal IDs (such as `dijkstra-graph-C` or `dist-table-before`) are automatically sanitized into clean, human-friendly terms (`Node C`, `Distance Table`) in both text and voice.

---

## Key Features

### Current (Fully Implemented)

- **Interactive Teaching Canvas**: High-performance Excalidraw infinite whiteboard with custom semantic styling for data structures and system components.
- **Authoritative World Model**: Maintains an immutable timeline of verified semantic states. Excalidraw coordinates never dictate semantic truth.
- **Teacher Brain**: Domain-independent pedagogical intelligence that adapts to learner signals (confusion, hesitation, pace requests) and smoothly shifts strategies (`SIMPLIFY` $\rightarrow$ `DEMONSTRATE` $\rightarrow$ `COMPARE`).
- **Counterfactual "What-If" Engine**: Fork lessons into isolated branches to test alternative parameters, weights, and values without corrupting main lesson progress.
- **Visual Lesson Playback**: Scrub, play, pause, speed up, slow down, and step through teaching moments with automatic viewport focus and entity highlights.
- **Contextual Inspector**: Multi-tab panel providing deep conceptual breakdowns:
  - **Analyze**: Formal step-by-step state diffs, added/modified/deleted entities, and metrics.
  - **Explain**: Pedagogical rationale behind the active step.
  - **Code**: Live multi-language code synchronization highlighting the exact executing line.
  - **Practice**: Interactive challenges and comprehension verification.
- **Cognora ORB**: Interactive WebGL liquid-glass floating orb providing visual feedback across multi-modal states (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `PAUSED`, `INTERRUPTED`).
- **Voice 3.0 Narration System**: Local neural text-to-speech integration powered by Chatterbox-Turbo with non-blocking graceful visual fallback.
- **Universal Command System**: Over 30 deterministic `/` slash commands to instantly create structures (`/array`, `/graph`, `/heap`, `/avl`), apply transformations (`/insert`, `/rotate`, `/pop`), or trigger algorithms (`/sort`, `/search`, `/traverse`).

### In Development / Experimental

- **Real-Time Freehand Sketch Recognition**: Interpreting hand-drawn diagrams into structured semantic graphs.
- **Collaborative Multi-Learner Sessions**: Shared real-time visual classrooms synchronized across sockets.

---

## System Architecture

Cognora enforces a strict **4-layer architectural separation**:

```
Layer 1: Semantic World
  ├── Authoritative entity graph (nodes, values, pointers, weights)
  ├── Transformation history & causal chains
  └── Invariant checks & correctness verification

Layer 2: Teaching Moments
  ├── Atomic pedagogical steps (stepIndex 1-to-1 synchronized with worldVersion)
  ├── Semantic focus targets & step rationales
  └── Local follow-up resolution (WHY, HOW, WHAT)

Layer 3: Visual Composition & Layout
  ├── Relationship-aware placement (BFS flow layout, tree balancing)
  ├── Visual primitive factories (ArrayCell, TreeNode, CircleNode, QueueItem)
  └── Callout placement & collision deflection

Layer 4: Interactive Canvas (Excalidraw)
  ├── Whiteboard rendering & smooth element transitions
  ├── Scene reconciliation (purges temporary pointers on final step)
  └── Direct user manipulation, sketching, and annotation
```

### Why This Separation Matters

1. **AI Cannot Corrupt Layout**: The AI determines _what_ changes; mathematical layout algorithms compute _where_ elements sit. This eliminates overlapping nodes, mangled arrays, and broken pointers.
2. **State Invariance**: If a voice service or external API hangs, the authoritative semantic timeline continues uninterrupted.
3. **Instant Navigation**: Scrubbing backward or forward across a 15-step Dijkstra process requires zero API roundtrips because the full semantic history is retained in memory.

---

## Technology Stack

| Layer | Technologies |
| --- | --- |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript 5.9](https://www.typescriptlang.org/), [Vite 5](https://vitejs.dev/) |
| **Canvas Engine** | [@excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) |
| **State & Reactive Store** | [Jotai](https://jotai.org/), Custom Subscribable Authoritative World Store |
| **AI Teaching Intelligence** | [NVIDIA NIM](https://build.nvidia.com/) (`nvidia/nemotron-3-ultra-550b-a55b`), Fallback: OpenRouter / Local Mock |
| **Visual Styling** | Vanilla CSS/SCSS, Glassmorphism, Custom WebGL Shaders (Three.js) |
| **Voice & Speech** | [Chatterbox-Turbo](https://github.com/) (FastAPI / PyTorch), Web Speech API Fallback |
| **Monorepo & Package Management** | Yarn Workspaces (v1.22.x) |
| **Testing & Quality** | [Vitest 3](https://vitest.dev/), JSDOM, Vitest Canvas Mock, ESLint, Prettier |

---

## Requirements

### Core Requirements

- **Operating System**: Windows 10/11, macOS, or Linux
- **Node.js**: `Node.js >= 18.0.0` (v20+ recommended)
- **Package Manager**: `yarn >= 1.22.22` (preferred; project uses Yarn workspaces)

### Optional Services

- **NVIDIA API Key**: Required for full AI-generated dynamic lessons via Nemotron 3 Ultra. Without a key, Cognora operates using deterministic local teaching and mock responses.
- **Python 3.10+ (For Local Neural Voice)**: Only needed if running the local Chatterbox-Turbo TTS voice microservice.

---

## Download and Installation

### Option 1: Clone with Git (Recommended)

```bash
git clone https://github.com/Venkatesh-Karthik/dsa.git
cd dsa
```

### Option 2: Download ZIP

1. Open [https://github.com/Venkatesh-Karthik/dsa](https://github.com/Venkatesh-Karthik/dsa) in your browser.
2. Click the green **Code** button and select **Download ZIP**.
3. Extract the ZIP archive onto your computer.
4. Open your terminal in the extracted `dsa-main` directory.

### Install Dependencies

Run the workspace installation from the repository root:

```bash
yarn install
```

> [!NOTE] This command installs all dependencies across the monorepo, including `codenora-app` and core workspace packages (`@excalidraw/excalidraw`, `@excalidraw/element`, `@excalidraw/common`).

---

## Environment Variables

Cognora includes a pre-configured `.env.example` file in the root directory.

### 1. Create your `.env` file

**On Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**On Linux / macOS:**

```bash
cp .env.example .env
```

### 2. Configure Settings

Open `.env` in your editor:

```env
# ========================================================
# Cognora AI Teaching Provider Configuration
# ========================================================

# Primary Provider: NVIDIA Nemotron 3 Ultra
# Get your API key from NVIDIA Build: https://build.nvidia.com/
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Routing & Token Budget
COGNORA_PRIMARY_PROVIDER=nvidia
COGNORA_FALLBACK_PROVIDER=openrouter
COGNORA_MAX_TOKENS=3500

# Optional Fallback Provider: OpenRouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=z-ai/glm-5.3-flash
OPENROUTER_MAX_TOKENS=3500

# Optional Local Voice Microservice (default port: 5005)
COGNORA_VOICE_SERVICE_URL=http://127.0.0.1:5005
```

> [!CAUTION] > **Security Notice**: Never commit your `.env` file or expose your `NVIDIA_API_KEY` in public repositories. All API keys are consumed strictly server-side by the Vite backend plugin and are never bundled into client-side JavaScript.

---

## NVIDIA Nemotron Setup

Cognora's primary AI teaching brain is powered by **NVIDIA Nemotron-3-Ultra-550B**:

1. Visit [NVIDIA Build](https://build.nvidia.com/).
2. Search for `nvidia/nemotron-3-ultra-550b-a55b` (or browse Generative Models).
3. Generate an API Key (starts with `nvapi-`).
4. Paste the key into `.env` as `NVIDIA_API_KEY`.

---

## Running Cognora

### Start the Development Server

From the repository root:

```bash
yarn start
```

The Vite development server will compile the packages and launch the application:

```
  VITE v5.0.12  ready in 1200 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Open **`http://localhost:3000`** in your browser to start using Cognora.

---

## Optional: Running the Voice Service

Cognora includes an optional local neural text-to-speech service powered by **Chatterbox-Turbo**. It runs locally on port 5005 and requires zero external cloud keys.

### 1. Set up Python Virtual Environment (One-Time)

From the repository root:

```bash
cd cognora-voice
python -m venv .venv
```

Activate the virtual environment and install dependencies:

**On Windows:**

```powershell
.\.venv\Scripts\pip install -r requirements.txt
```

**On Linux / macOS:**

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Launch the Voice Service

**On Windows (PowerShell):**

```powershell
.\cognora-voice\start_voice_service.ps1
```

**Or directly with Python:**

```bash
cd cognora-voice
python server.py
```

The service will start on `http://127.0.0.1:5005`. Cognora will automatically detect the voice service on startup and stream spoken teaching narrations in real-time.

> [!TIP] If the voice service is offline, Cognora automatically runs in **calm visual-only mode**. No errors or blocking dialogs will appear.

---

## First Run Walkthrough

Once Cognora is running in your browser:

1. **Ask a Teaching Question**: In the bottom pill composer dock, type:
   ```
   Explain how Dijkstra's algorithm works on a 5-node graph step by step
   ```
   and press <kbd>Enter</kbd>.
2. **Watch the Lesson Compile**: Cognora constructs the 5-node graph, initializes distance tables, and stages the priority queue.
3. **Control Lesson Playback**:
   - Click **Play** on the bottom timeline to watch the steps unfold.
   - Click **Next** (<kbd>→</kbd>) or **Previous** (<kbd>←</kbd>) to step through transformations manually.
   - Adjust the speed multiplier (`0.75x`, `1.0x`, `1.25x`).
4. **Ask Contextual Follow-Ups**:
   - _"Why did you pick node C next instead of node B?"_ $\rightarrow$ Cognora resolves the causal reason without resetting the whiteboard.
   - _"Can you compare the old state and new state together?"_ $\rightarrow$ A temporary before/after comparison detour appears.
   - _"What if edge C→D had weight 1 instead of 8?"_ $\rightarrow$ An isolated counterfactual branch explores the scenario.
   - _"Return to lesson"_ $\rightarrow$ Restores the original lesson timeline.
5. **Inspect the Details**: Open the **Inspector Panel** on the right to view active metrics, code highlights, and invariant proofs.

---

## Example Prompts to Try

- **Graph Algorithms**: `"Show Dijkstra's shortest path algorithm on graph A->B(4), A->C(2), B->C(1), B->D(5), C->D(8), C->E(10), D->E(2)"`
- **Tree Balancing**: `"Explain AVL tree insertion for values 30, 20, 10 and show the right rotation"`
- **Searching & Arrays**: `"Demonstrate binary search on array [2, 5, 8, 12, 16, 23, 38, 56] looking for 23"`
- **Linear Data Structures**: `"Demonstrate singly linked list deletion of node 20 from list 10 -> 20 -> 30"`
- **Heaps & Priority Queues**: `"Show min-heap sift down operations when inserting [15, 10, 20, 8, 25]"`

---

## Built-In Commands

In addition to natural language, Cognora provides a comprehensive set of deterministic slash commands in the composer dock:

### Structure Creation

| Command | Description | Example |
| --- | --- | --- |
| `/array <items>` | Creates an indexed array | `/array [4, 8, 15, 16, 23, 42]` |
| `/linked-list <items>` | Creates a linked list with NULL termination | `/linked-list [10, 20, 30]` |
| `/stack <items>` | Creates a LIFO stack container | `/stack [10, 20, 30]` |
| `/queue <items>` | Creates a FIFO queue with Front/Rear indicators | `/queue [10, 20, 30]` |
| `/tree <items>` | Creates a Binary Search Tree (BST) | `/tree [50, 30, 70, 20, 40]` |
| `/avl <items>` | Creates an AVL tree with rotation tracking | `/avl [30, 20, 10]` |
| `/heap <type> <items>` | Creates a Min or Max Binary Heap | `/heap min [15, 10, 20, 8, 25]` |
| `/graph <edges>` | Creates a weighted or unweighted graph | `/graph A-B:4 A-C:2 B-D:5 C-D:8` |
| `/matrix <rows> <cols>` | Creates a 2D matrix / dynamic programming table | `/matrix 3 3` |

### Transformations & Mutations

| Command | Description | Example |
| --- | --- | --- |
| `/insert <val>` | Inserts value into active structure | `/insert 25` |
| `/delete <val>` | Deletes target value | `/delete 20` |
| `/push <val>` | Pushes value onto active stack | `/push 40` |
| `/pop` | Pops element from stack or root from heap | `/pop` |
| `/rotate <left\|right>` | Performs tree rotation | `/rotate right` |
| `/reverse` | Reverses elements in array or linked list | `/reverse` |
| `/edge <src> <tgt> <wt>` | Creates or updates a graph edge | `/edge C D 1` |

### Teaching, Inspection & Playback

| Command | Description |
| --- | --- |
| `/teach` | Invokes NVIDIA AI intelligence to explain current visual state |
| `/explain` or `/why` | Opens causal step explanation in the Inspector |
| `/trace` | Opens step-by-step transformation diff in the Inspector |
| `/play` / `/pause` | Toggles lesson playback |
| `/next` / `/prev` | Steps forward or backward through teaching moments |
| `/speed <val>` | Sets playback speed (e.g. `/speed 1.25`) |
| `/dev` or `/debug` | Toggles developer mode and advanced diagnostic overlays |

---

## Project Structure

```
codenora-monorepo/
├── package.json               # Root monorepo workspace configuration & scripts
├── vitest.config.mts          # Test configuration with JSDOM and canvas mocks
├── .env.example               # Example environment variable configuration
│
├── codenora-app/              # Main Cognora Application
│   ├── index.html             # Application entry HTML
│   ├── vite.config.mts        # Vite configuration & AI backend plugin
│   ├── package.json           # App dependencies & run scripts
│   │
│   ├── components/            # UI Components & Layouts
│   │   ├── AITeachingAgent.tsx       # Main teaching workspace controller
│   │   ├── CognoraHeader.tsx         # Top bar (branding, tools, actions)
│   │   ├── CognoraTimeline.tsx       # Bottom lesson playback controls
│   │   ├── CognoraAIComposer.tsx     # Floating command / chat input dock
│   │   ├── CognoraContextualPanel.tsx# Right Inspector (Analyze/Explain/Code/Practice)
│   │   └── CognoraOrb/               # Interactive 3D WebGL floating orb
│   │
│   ├── ai/                    # Core AI & Visual Intelligence System
│   │   ├── authoritative-model.ts    # Authoritative semantic domain model
│   │   ├── conceptual-journey-optimizer.ts # Step un-collapsing & lesson planning
│   │   ├── counterfactual-engine.ts  # Counterfactual "What-If" branch evaluator
│   │   ├── layout-engine.ts          # Topology-aware graph & tree layout
│   │   ├── lesson-playback-controller.ts # Local playback coordinator
│   │   ├── scene-reconciler.ts       # Canvas state reconciliation & cleanup
│   │   ├── teaching-moment.ts        # Atomic teaching moment models
│   │   ├── universal-engine.ts       # Domain compilation & planning engine
│   │   │
│   │   ├── backend/                  # Server-side AI & Provider Routers
│   │   │   ├── server-handler.ts     # HTTP request handlers (/api/ai/teach)
│   │   │   ├── nemotron-provider.ts  # NVIDIA Nemotron client
│   │   │   └── vite-plugin.ts        # Vite connect middleware plugin
│   │   │
│   │   ├── commands/                 # Slash command registry & executor
│   │   ├── intelligence/             # TeacherBrain, StudentState, WorldModel
│   │   ├── visual-primitives/        # Primitive shape builders (Array, Tree, Graph)
│   │   ├── visual-reasoning/         # Spatial layout & text sanitizers
│   │   └── voice/                    # Voice queue, preprocessor, speech director
│   │
│   └── tests/                 # Test suites (Architecture, Brain, Voice, Playback)
│
├── cognora-voice/             # Python Local TTS Microservice
│   ├── server.py              # FastAPI TTS server (Chatterbox-Turbo)
│   ├── requirements.txt       # Python dependencies (torch, torchaudio, fastapi)
│   └── start_voice_service.ps1# Windows startup script
│
└── packages/                  # Excalidraw Core Monorepo Packages
    ├── common/                # Shared utilities & constants
    ├── element/               # Element primitives, text measurement & geometry
    └── excalidraw/            # Core Excalidraw canvas component
```

---

## Development

### Useful Commands

```bash
# Start development server on http://localhost:3000
yarn start

# Run all TypeScript typechecks
yarn test:typecheck

# Run linter across all packages
yarn lint

# Run code auto-formatting
yarn fix
```

---

## Testing

Cognora uses [Vitest](https://vitest.dev/) for high-speed unit, integration, and architectural verification.

### Run All Cognora Core Suites

```bash
yarn --cwd ./codenora-app vitest run tests/cognora-teaching-architecture.test.ts tests/teacher-brain.test.ts tests/authoritative-world-orchestration.test.ts tests/voice-queue.test.ts tests/lesson-playback-orchestration.test.ts
```

### Run Full Test Suite

```bash
yarn test
```

### Run Tests in UI Mode

```bash
yarn test:ui
```

---

## Production Build

To create an optimized production build:

```bash
yarn build
```

This builds all internal Excalidraw packages and produces a production bundle in `codenora-app/build/`.

To preview the production build locally:

```bash
yarn start:production
```

This serves the production bundle on **`http://localhost:5001`**.

---

## Troubleshooting

### 1. `yarn install` fails or encounters node-gyp errors

- Ensure you are running **Node.js 18 or higher** (`node -v`).
- Use **Yarn Classic (v1.22.x)** rather than npm directly to ensure workspace package dependencies link correctly.
- Clean your installation if necessary:
  ```bash
  yarn clean-install
  ```

### 2. "Chatterbox service is not reachable" or Voice is silent

- The local voice microservice is optional. If you haven't started it, Cognora will automatically run in visual-only mode.
- To enable local voice, ensure Python 3.10+ is installed, follow the setup in [Running the Voice Service](#optional-running-the-voice-service), and execute:
  ```powershell
  .\cognora-voice\start_voice_service.ps1
  ```
- Verify the voice health endpoint returns `200 OK` at `http://127.0.0.1:5005/health`.

### 3. NVIDIA API errors or 401 Unauthorized

- Verify that your `.env` file exists in the project root and contains a valid key:
  ```env
  NVIDIA_API_KEY=nvapi-your-real-key-here
  ```
- Make sure there are no trailing spaces or quotes around the key.
- Restart the dev server (`yarn start`) after editing `.env`.

### 4. Port 3000 is already in use

- Specify a custom port in your `.env`:
  ```env
  VITE_APP_PORT=3001
  ```
  or launch with `PORT=3001 yarn start`.

---

## Security

- **No Secrets in Bundles**: API keys (`NVIDIA_API_KEY`, `OPENROUTER_API_KEY`) are exclusively read on the server side via Vite's backend middleware. They are **never** prefixed with `VITE_` and are **never** transmitted to the browser bundle.
- **Payload Size Limits**: Incoming API request payloads are capped at 1MB to prevent memory exhaustion attacks.
- **Sanitized Outputs**: All user and model outputs pass through strict HTML and token sanitizers before rendering on canvas or text labels.

---

## Contributing

Contributions are welcome!

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Make your improvements following the 4-layer architecture.
3. Verify your changes pass all tests and type checks:
   ```bash
   yarn test:typecheck
   yarn test
   yarn lint
   ```
4. Commit using conventional commit format and submit a Pull Request.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

- **[Excalidraw](https://github.com/excalidraw/excalidraw)**: Built upon the Excalidraw virtual whiteboard platform.
- **[NVIDIA NIM](https://build.nvidia.com/)**: Powered by NVIDIA Nemotron-3-Ultra-550B models for dynamic concept intelligence.
- **[Chatterbox-Turbo](https://github.com/)**: Local neural TTS architecture for real-time speech synthesis.
