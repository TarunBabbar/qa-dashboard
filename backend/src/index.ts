import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from "openai";
import projectsRouter from './projects';
import testRunsRouter from './testRuns';

// Load environment variables early
dotenv.config();

// OpenAI Router for streaming responses
const aiRouter = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const aiModel = process.env.OPENAI_MODEL!;

aiRouter.post("/agent-brief", async (req, res) => {
  const { prompt } = req.body ?? {};
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await openai.chat.completions.create({
    model: aiModel,
    stream: true,
    messages: [
      { role: "system", content:
        "You are a brisk, friendly test-planner. Acknowledge the request, restate it crisply, list the plan in bullets, set expectations. Keep it short, use emojis sparingly (✅, 🔧, ⏱️), no code." },
      { role: "user", content: prompt }
    ],
  });

  for await (const part of stream) {
    const token = part.choices?.[0]?.delta?.content ?? "";
    if (token) res.write(`data:${token}\n\n`);
  }
  res.write("data:[DONE]\n\n");
  res.end();
});

// OpenAI runtime loader (single instance)
let openaiClient: any;

function initOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    openaiClient = undefined;
    return;
  }
  try {
    const openaiModule = require('openai');
    if (openaiModule?.Configuration && openaiModule?.OpenAIApi) {
      const Configuration = openaiModule.Configuration;
      const OpenAIApi = openaiModule.OpenAIApi;
      const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
      openaiClient = new OpenAIApi(configuration);
    } else if (openaiModule?.OpenAI) {
      const OpenAI = openaiModule.OpenAI;
      openaiClient = new OpenAI(process.env.OPENAI_API_KEY);
    } else {
      openaiClient = undefined;
    }
  } catch {
    openaiClient = undefined;
  }
}
initOpenAIClient();

// Express App Setup
const app = express();
const host = process.env.HOST || '0.0.0.0';

app.use(express.json());
app.use(cors());
app.options('*', cors());

// Mount routers
app.use("/api/ai", aiRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/runs", testRunsRouter);

// Health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Code Generation endpoint
app.post('/api/ai/generate-code', async (req: Request, res: Response) => {
  const { projectId, tool, language, prompt } = req.body as any;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not configured in environment' });
  }

  let generatedCode = '';
  try {
    if (!openaiClient) {
      initOpenAIClient();
      if (!openaiClient) {
        throw new Error('OpenAI client not initialized');
      }
    }
    const model = process.env.OPENAI_MODEL;

const systemPrompt = `
You are a senior software engineer and test automation architect. 
When given a user scenario, generate a complete, ready-to-run automation project 
based on the selected Programming Language and Tool. 
Only generate code using supported combinations defined in the mapping (FRAMEWORK_TO_LANGUAGES_AND_TOOLS). 
Never invent unsupported combinations.

## Project Design Principles
- Always enforce **SOLID principles** and **clean architecture**.
- For **UI Testing**, strictly apply **Page Object Model (POM)** with one class per page/component.
- For **API, Unit, BDD, Integration, Performance, Security**, apply relevant design patterns 
  (Factory, Strategy, Builder, Dependency Injection, etc.).
- Code must be **readable, maintainable, and scalable**.

## Folder & File Placement (MANDATORY)
- UI page or route classes → 'src/pages/...'
- Automated test specs → 'src/tests/...'
- Support code (page objects, fixtures, utilities) → 'src/helpers', 'src/utils', or 'src/lib'
- Tool configs → project root
- Dependency/build manifests → project root (MANDATORY, see below)

## Dependency/Manifest Files (MUST be included for every project)
Always generate the correct dependency/manifest file for the chosen language:
Every generated project MUST include the correct dependency/manifest file for the chosen language/tool:

- **JavaScript/TypeScript (Node.js)** → 'package.json' + 'package-lock.json' or 'yarn.lock'
- **Python** → 'requirements.txt' (with pinned versions) or 'pyproject.toml'
- **Java** → 'pom.xml' (Maven) or 'build.gradle' (Gradle)
- **C# / .NET (including SpecFlow)** → '*.csproj' file with all required <PackageReference> entries
- **Ruby** → 'Gemfile' (+ Gemfile.lock optional)
- **Go** → 'go.mod' + 'go.sum'
- **PHP** → 'composer.json' + 'composer.lock'

⚠️ These manifest files are **mandatory**. They must appear in the output JSON.

## File & Config Conventions
(keep all the naming + config rules from your previous version…)

## Output Rules
- Return only a **single JSON array** of objects:
  [
    { "path": "relative/path/to/file.ext", "content": "<file contents>" }
  ]
- Escape newlines properly in JSON strings.
- ALWAYS include:
  1. The manifest/dependency file(s) first (package.json, requirements.txt, pom.xml, .csproj, etc.)
  2. Then tool config files (playwright.config.ts, pytest.ini, jest.config.js, etc.)
  3. Then code files (page objects, test specs, helpers).
- Add a **README.md** with step-by-step setup and execution instructions.

## Expectations
- Code must **compile and run without errors** immediately after installing dependencies.
- Tests must be directly executable via standard commands (npm test, pytest, mvn test, dotnet test, etc.).
- Follow naming conventions & standard patterns for the chosen tool.
`;

   const userPrompt = `
Project: ${projectId}
Language: ${language}
Tool: ${tool}
Scenario: ${prompt ?? ''}

Requirements:
- Generate a complete runnable project following SOLID principles.
- For UI automation → use Page Object Model (POM).
- Follow the folder structure and conventions from the system message.
- Use only the allowed combination of Language + Tool (from the mapping).
- Include ALL required files:
  1. Dependency/manifest file(s) (package.json, requirements.txt, pom.xml, .csproj, Gemfile, go.mod, composer.json, etc.)
  2. Tool configs (playwright.config.ts, pytest.ini, jest.config.js, etc.)
  3. Source files (page objects, tests, helpers, utilities).
- Output MUST be a single JSON array of objects:
  [
    { "path": "relative/path/to/file.ext", "content": "<file contents>" }
  ]
- Escape newlines properly in JSON.
- IMPORTANT: Do not include explanations, markdown fences, or extra text. 
Return only the raw JSON array.
`;

    // Support both OpenAIApi (createChatCompletion) and the newer OpenAI client (chat.completions.create)
    let content = '';
    if (typeof openaiClient.createChatCompletion === 'function') {
      const response = await openaiClient.createChatCompletion({
        model: process.env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      content = (response as any)?.data?.choices?.[0]?.message?.content ?? '';
    } else if (openaiClient?.chat && typeof openaiClient.chat.completions.create === 'function') {
      const response = await openaiClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      content = (response as any)?.choices?.[0]?.message?.content ?? '';
    } else {
      throw new Error('Unsupported OpenAI client');
    }

    generatedCode = (content || `[]`).trim();
  } catch (err) {
    const message = (err as Error).message;
    console.error('AI generation error', err);
    generatedCode = `// AI generation error: ${message}`;
    res.status(500).json({ projectId, tool, language, generatedCode, promptUsed: prompt, error: message });
    return;
  }

  res.json({ projectId, tool, language, generatedCode, promptUsed: prompt });
});

// AI Apply and Revert endpoints
app.post('/api/ai/apply-code', async (req: Request, res: Response) => {
  const { projectId, files, message } = req.body as any;
  
  if (!projectId || !Array.isArray(files)) {
    return res.status(400).json({ error: 'projectId and files[] required' });
  }

  try {
    // Import the apply function from projects module
    const { applyCodeToProject } = await import('./projects');
    const result = await applyCodeToProject(projectId, files, message);
    res.json(result);
  } catch (err) {
    const errorMsg = (err as Error).message;
    if (errorMsg === 'Project not found') {
      return res.status(404).json({ error: errorMsg });
    }
    console.error('Apply code error:', err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/ai/revert', async (req: Request, res: Response) => {
  const { revertId } = req.body as any;
  
  if (!revertId) {
    return res.status(400).json({ error: 'revertId required' });
  }

  try {
    // Import the revert function from projects module
    const { revertCodeChanges } = await import('./projects');
    const result = await revertCodeChanges(revertId);
    res.json(result);
  } catch (err) {
    const errorMsg = (err as Error).message;
    if (errorMsg === 'Revert record not found' || errorMsg === 'Project not found') {
      return res.status(404).json({ error: errorMsg });
    }
    console.error('Revert code error:', err);
    res.status(500).json({ error: errorMsg });
  }
});
app.post('/api/ai/ask', async (req: Request, res: Response) => {
  const { projectId, prompt, preferCode } = req.body as any;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not configured in environment' });
  }

  try {
    if (!openaiClient) {
      initOpenAIClient();
      if (!openaiClient) throw new Error('OpenAI client not initialized');
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const systemPrompt = `You are a helpful software engineer and technical explainer. When asked a question, produce a clear, concise explanation. If the user requests code samples or the question implies code is required, return a small, focused code snippet and label it clearly. Keep answers readable and avoid extra prose.`;
    const userPrompt = `Question: ${prompt ?? ''}\nProject: ${projectId ?? 'none'}\nReturn code if the user requests it or if it is needed to answer. Otherwise, return a clear textual explanation.`;

    let answer = '';
    if (typeof openaiClient.createChatCompletion === 'function') {
      const response = await openaiClient.createChatCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      answer = (response as any)?.data?.choices?.[0]?.message?.content ?? '';
    } else if (openaiClient?.chat && typeof openaiClient.chat.completions.create === 'function') {
      const response = await openaiClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      answer = (response as any)?.choices?.[0]?.message?.content ?? '';
    } else {
      throw new Error('Unsupported OpenAI client');
    }

    res.json({ answer });
  } catch (err) {
    console.error('AI ask error', err);
    res.status(500).json({ error: (err as Error).message || String(err) });
  }
});

// 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

const port: number = Number(process.env.PORT) || 3000;

// Startup cleanup: remove orphaned test runs
async function performStartupCleanup() {
  try {
    const { projectData } = await import('./projects');
    const { cleanupOrphanedRuns } = await import('./testRuns');
    
    const existingProjectIds = projectData.projects.map(p => p.id);
    cleanupOrphanedRuns(existingProjectIds);
  } catch (error) {
    console.error('Error during startup cleanup:', error);
  }
}

app.listen(port, host, async () => {
  console.log(`Backend server listening at http://${host}:${port}`);
  await performStartupCleanup();
});
