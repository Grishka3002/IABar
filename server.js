import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { cocktailBase } from "./src/data/cocktails.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
loadEnv();
const PORT = Number(process.env.PORT || 4173);
const HF_TOKEN = process.env.HF_TOKEN || "";
const HF_CHAT_MODEL = process.env.HF_CHAT_MODEL || "Qwen/Qwen3-4B-Instruct-2507";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400).end("Bad request");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        provider: "huggingface-router",
        model: HF_CHAT_MODEL,
        hasToken: Boolean(HF_TOKEN),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/signature-cocktail") {
      const body = await readJson(req);
      return handleSignatureCocktail(body, res);
    }

    if (req.method === "POST" && url.pathname === "/api/bartender-turn") {
      const body = await readJson(req);
      return handleBartenderTurn(body, res);
    }

    if (req.method === "POST" && url.pathname === "/api/recommendation-set") {
      const body = await readJson(req);
      return handleRecommendationSet(body, res);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end("Method not allowed");
      return;
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}).listen(PORT, () => {
  console.log(`AiBar server running at http://127.0.0.1:${PORT}`);
});

async function handleSignatureCocktail(body, res) {
  if (!HF_TOKEN) {
    return sendJson(res, 503, {
      ok: false,
      error: "HF_TOKEN is not configured",
    });
  }

  const answers = body?.answers || {};
  const picks = Array.isArray(body?.picks) ? body.picks : [];

  const system = [
    "Ты опытный бармен и миксолог для веб-приложения AiBar.",
    "Твоя задача: придумать один авторский коктейль под настроение пользователя.",
    "Ответь строго JSON-объектом без Markdown и без пояснений вокруг JSON.",
    "Поля JSON: name, alcoholic, abv, glass, description, tags, ingredients, method.",
    "description: 1-2 коротких предложения на русском.",
    "tags: массив коротких русских тегов.",
    "ingredients: массив ингредиентов с миллилитрами или граммами.",
    "method: массив из 3-5 коротких шагов приготовления.",
  ].join(" ");

  const user = [
    `Режим: ${answers.alcoholic === false ? "безалкогольный" : "алкогольный"}.`,
    `Настроение: ${Array.isArray(answers.moods) && answers.moods.length ? answers.moods.join(", ") : "не указано"}.`,
    `Теги вкуса: ${Array.isArray(answers.tags) && answers.tags.length ? answers.tags.join(", ") : "не указаны"}.`,
    `Базовые коктейли уже предложены: ${picks.length ? picks.map((item) => item.name).join(", ") : "нет"}.`,
    "Не повторяй названия уже предложенных базовых коктейлей.",
    "Если режим безалкогольный, alcoholic=false и abv='0%'.",
  ].join("\n");

  const payload = {
    model: HF_CHAT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    top_p: 0.8,
    max_tokens: 400,
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  if (!response.ok) {
    return sendJson(res, 502, {
      ok: false,
      error: `HF request failed with ${response.status}`,
      details: rawText,
    });
  }

  const parsed = JSON.parse(rawText);
  const content = parsed?.choices?.[0]?.message?.content;
  const cocktail = JSON.parse(content);

  return sendJson(res, 200, {
    ok: true,
    cocktail: {
      id: "signature-hf-qwen",
      source: "ai",
      name: cocktail.name,
      alcoholic: cocktail.alcoholic,
      abv: cocktail.abv,
      glass: cocktail.glass,
      description: cocktail.description,
      tags: Array.isArray(cocktail.tags) ? cocktail.tags : [],
      ingredients: Array.isArray(cocktail.ingredients) ? cocktail.ingredients : [],
      method: Array.isArray(cocktail.method) ? cocktail.method : [],
    },
  });
}

async function handleBartenderTurn(body, res) {
  if (!HF_TOKEN) {
    return sendJson(res, 503, {
      ok: false,
      error: "HF_TOKEN is not configured",
    });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const answers = body?.answers || { stockMode: null, inventory: [], alcoholic: null, moods: [], tags: [] };
  const askedQuestions = Number(body?.askedQuestions || 0);

  const payload = {
    model: HF_CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "Ты бармен AiBar. Говори по-русски, коротко, тепло и естественно, как хороший бармен вечером.",
          "Твоя задача: вести диалог о подборе коктейля.",
          "Ты можешь задать максимум 3 уточняющих вопроса за весь диалог.",
          "Если данных еще недостаточно и лимит вопросов не исчерпан, задай ровно один короткий уточняющий вопрос.",
          "Если информации уже достаточно или лимит в 3 вопроса достигнут, НЕ задавай больше вопросов и переходи к короткому финальному сообщению.",
          "Если пользователь пишет после уже готовой подборки, не начинай диалог заново: коротко учти новую поправку и обнови понимание вкуса/настроения.",
          "Если пользователь отвечает расплывчато, с опечаткой, односложно или непонятно, не притворяйся, что ты все понял. Вместо этого вежливо уточни именно тот пункт, который неясен.",
          "Если пользователь выбрал формат из того, что уже есть дома, ты обязан отдельно понять, какие именно ингредиенты у него есть под рукой.",
          "Не завершай подбор, пока не понял хотя бы: работаем ли из домашних ингредиентов или можно докупить, если дома — какие там есть ингредиенты, на какой основе хочется коктейль, алкогольный/безалкогольный режим и хотя бы один реальный ориентир по настроению или вкусу.",
          "Ответы вроде 'не', 'ну', 'да', 'как-нибудь', случайный набор букв, короткая опечатка — это не достаточная информация для финального подбора.",
          "Ответь строго JSON-объектом без markdown.",
          "Поля JSON: assistant_message, asked_question, complete, answers.",
          "answers должен быть объектом с полями stockMode, inventory, baseSpirit, alcoholic, moods, tags.",
          "stockMode: 'home', 'free' или null.",
          "inventory: массив коротких слов про имеющиеся дома ингредиенты, например ['gin','lime','tonic'] или пустой массив.",
          "baseSpirit: 'gin', 'whiskey', 'rum', 'tequila', 'aperitif', 'none', 'any' или null.",
          "alcoholic: true, false или null.",
          "moods: массив коротких русских слов.",
          "tags: массив коротких русских слов.",
          "Если задаешь вопрос, complete=false.",
          "Если завершаешь сбор информации, complete=true только когда данных действительно достаточно для 3 осмысленных коктейлей.",
          "Не упоминай JSON в assistant_message.",
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Уже задано уточняющих вопросов: ${askedQuestions}.`,
          `Текущее состояние: ${JSON.stringify(answers, null, 0)}.`,
          "Ниже история диалога:",
          JSON.stringify(messages),
        ].join("\n")
      }
    ],
    temperature: 0.7,
    top_p: 0.8,
    max_tokens: 500,
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  if (!response.ok) {
    return sendJson(res, 502, {
      ok: false,
      error: `HF request failed with ${response.status}`,
      details: rawText,
    });
  }

  const parsed = JSON.parse(rawText);
  const content = parsed?.choices?.[0]?.message?.content;
  const result = JSON.parse(content);

  return sendJson(res, 200, {
    ok: true,
    assistant_message: result.assistant_message,
    asked_question: Boolean(result.asked_question),
    complete: Boolean(result.complete),
    answers: normalizeAnswers(result.answers),
  });
}

async function handleRecommendationSet(body, res) {
  if (!HF_TOKEN) {
    return sendJson(res, 503, {
      ok: false,
      error: "HF_TOKEN is not configured",
    });
  }

  const answers = body?.answers || { alcoholic: null, moods: [], tags: [] };
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const previousRecommendations = Array.isArray(body?.previousRecommendations)
    ? body.previousRecommendations
    : [];

  const eligible = cocktailBase.filter((item) =>
    answers.alcoholic === false ? item.alcoholic === false : item.alcoholic === true
  );

  const payload = {
    model: HF_CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "Ты бармен AiBar и сейчас должен собрать финальную подборку коктейлей.",
          "У тебя есть список доступных базовых коктейлей. Выбирай только из него для base рекомендаций.",
          "Если пользователь хочет собрать коктейль из того, что уже есть дома, старайся выбирать только те варианты, которые максимально близки к его набору ингредиентов.",
          "Для алкогольного режима верни: one strong base, one lighter base, one signature cocktail.",
          "Для безалкогольного режима верни: two base zero cocktails, one signature cocktail.",
          "Не выдумывай базовые коктейли вне списка.",
          "Если пользователь дал новые уточнения после уже готовой подборки, адаптируй рекомендации, а не повторяй их механически.",
          "Ответь строго JSON-объектом без markdown.",
          "Поля JSON: summary, recommendations.",
          "recommendations — массив объектов.",
          "Для базовых коктейлей поля: slot, source='base', base_id, reason.",
          "Для авторского коктейля поля: slot, source='signature', name, reason, ingredients, method, glass, abv, alcoholic, tags, description.",
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Текущее понимание пользователя: ${JSON.stringify(answers)}.`,
          `История диалога: ${JSON.stringify(messages)}.`,
          `Прошлая подборка: ${JSON.stringify(previousRecommendations)}.`,
          `Список базовых коктейлей: ${JSON.stringify(
            eligible.map((item) => ({
              id: item.id,
              name: item.name,
              strength: item.strength,
              baseSpirit: item.baseSpirit,
              alcoholic: item.alcoholic,
              abv: item.abv,
              mood: item.mood,
              tags: item.tags,
              glass: item.glass,
              description: item.description,
              ingredients: item.ingredients,
            }))
          )}`,
        ].join("\n")
      }
    ],
    temperature: 0.6,
    top_p: 0.8,
    max_tokens: 900,
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  if (!response.ok) {
    return sendJson(res, 502, {
      ok: false,
      error: `HF request failed with ${response.status}`,
      details: rawText,
    });
  }

  const parsed = JSON.parse(rawText);
  const content = parsed?.choices?.[0]?.message?.content;
  const result = JSON.parse(content);

  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  const mapped = recommendations
    .map((item) => {
      if (item.source === "base") {
        const base = cocktailBase.find((drink) => drink.id === item.base_id);
        if (!base) {
          return null;
        }
        return {
          ...base,
          source: "base",
          selectionReason: item.reason || "",
        };
      }

      if (item.source === "signature") {
        return {
          id: "signature-hf-qwen-set",
          source: "ai",
          name: item.name,
          alcoholic: item.alcoholic ?? (answers.alcoholic !== false),
          abv: item.abv || (answers.alcoholic === false ? "0%" : "12-16%"),
          glass: item.glass || "coupe",
          description: item.description || item.reason || "",
          tags: Array.isArray(item.tags) ? item.tags : [],
          ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
          method: Array.isArray(item.method) ? item.method : [],
        };
      }

      return null;
    })
    .filter(Boolean);

  return sendJson(res, 200, {
    ok: true,
    summary: result.summary || "",
    recommendations: mapped,
  });
}

function serveStatic(pathname, res) {
  const safePath = (pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  const filePath = normalize(join(ROOT, safePath));

  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    res.writeHead(404).end("Not found");
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf-8");
  return text ? JSON.parse(text) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function normalizeAnswers(answers) {
  const normalized = answers && typeof answers === "object" ? answers : {};
  return {
    stockMode:
      normalized.stockMode === "home" ? "home" : normalized.stockMode === "free" ? "free" : null,
    inventory: Array.isArray(normalized.inventory)
      ? normalized.inventory.map((item) => String(item).toLowerCase()).slice(0, 12)
      : [],
    baseSpirit:
      typeof normalized.baseSpirit === "string" ? normalized.baseSpirit : null,
    alcoholic:
      normalized.alcoholic === true ? true : normalized.alcoholic === false ? false : null,
    moods: Array.isArray(normalized.moods)
      ? normalized.moods.map((item) => String(item).toLowerCase()).slice(0, 6)
      : [],
    tags: Array.isArray(normalized.tags)
      ? normalized.tags.map((item) => String(item).toLowerCase()).slice(0, 8)
      : [],
  };
}

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
