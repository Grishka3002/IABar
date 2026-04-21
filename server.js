import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { cocktailBase } from "./src/data/cocktails.js";
import { signatureCocktailBase } from "./src/data/signature-cocktails.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const SIGNATURE_FILE = join(ROOT, "src", "data", "signature-cocktails.js");
loadEnv();
const PORT = Number(process.env.PORT || 4173);
const HF_TOKEN = process.env.HF_TOKEN || "";
const HF_CHAT_MODEL = process.env.HF_CHAT_MODEL || "Qwen/Qwen3-4B-Instruct-2507";
const runtimeSignatureCocktails = [...signatureCocktailBase];
const runtimeCocktailBase = mergeCocktailCatalog(cocktailBase, runtimeSignatureCocktails);

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

    if (req.method === "POST" && url.pathname === "/api/signature-cocktails/rate") {
      const body = await readJson(req);
      return handleSignatureCocktailRating(body, res);
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
          "В первой реплике не говори про число вопросов. Лучше скажи, что при необходимости коротко уточнишь детали и подберешь варианты.",
          "Если данных еще недостаточно и лимит вопросов не исчерпан, задай ровно один короткий уточняющий вопрос.",
          "Если информации уже достаточно или лимит в 3 вопроса достигнут, НЕ задавай больше вопросов и переходи к короткому финальному сообщению.",
          "Если пользователь пишет после уже готовой подборки, не начинай диалог заново: коротко учти новую поправку и обнови понимание вкуса/настроения.",
          "Если пользователь отвечает расплывчато, с опечаткой, односложно или непонятно, не притворяйся, что ты все понял. Вместо этого вежливо уточни именно тот пункт, который неясен.",
          "Если пользователь выбрал формат из того, что уже есть дома, ты обязан отдельно понять, какие именно ингредиенты у него есть под рукой.",
          "Если пользователь уже назвал конкретную базу вроде джина, водки, виски, рома, текилы или аперитивной основы, не задавай отдельный вопрос алкогольный это подбор или безалкогольный: это уже ясно.",
          "Если пользователь явно сказал безалкогольная база или без алкоголя, тоже не дублируй вопрос про алкогольность.",
          "Никогда не переспрашивай факт, который пользователь уже явно сообщил. Если в первом сообщении уже есть алкогольность, база, настроение, вкус или формат покупки, считай это известным и двигайся дальше.",
          "Не завершай подбор, пока не понял хотя бы: работаем ли из домашних ингредиентов или можно докупить, если дома — какие там есть ингредиенты, на какой основе хочется коктейль, алкогольный или безалкогольный режим либо достаточно ясную базу, из которой это уже следует, и хотя бы один реальный ориентир по настроению или вкусу.",
          "Формат диалога держи естественным: сначала формат вечера и ограничения, потом база, потом настроение или вкус. Не перечисляй сразу длинный опросник.",
          "После того как база уже понятна, спрашивай вкус и настроение живым барменским языком. Например, не 'какие теги вкуса?', а 'тянет в цитрус, горчинку или что-то мягкое?'.",
          "Избегай канцелярских фраз и ощущения анкеты. Каждый вопрос должен звучать как одна короткая реплика у стойки.",
          "Ответы вроде 'не', 'ну', 'да', 'как-нибудь', случайный набор букв, короткая опечатка — это не достаточная информация для финального подбора.",
          "Ответь строго JSON-объектом без markdown.",
          "Поля JSON: assistant_message, asked_question, complete, answers.",
          "answers должен быть объектом с полями stockMode, inventory, baseSpirit, alcoholic, moods, tags.",
          "stockMode: 'home', 'free' или null.",
          "inventory: массив коротких слов про имеющиеся дома ингредиенты, например ['gin','lime','tonic'] или пустой массив.",
          "baseSpirit: 'gin', 'vodka', 'whiskey', 'rum', 'tequila', 'aperitif', 'none', 'any' или null.",
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

  const effectiveAlcoholic =
    answers.alcoholic === false
      ? false
      : answers.baseSpirit === "none"
        ? false
        : answers.alcoholic === true || ["gin", "vodka", "whiskey", "rum", "tequila", "aperitif"].includes(answers.baseSpirit)
          ? true
          : null;

  const eligible = runtimeCocktailBase.filter((item) => {
    if (effectiveAlcoholic === false && item.alcoholic !== false) {
      return false;
    }

    if (effectiveAlcoholic !== false && item.alcoholic !== true) {
      return false;
    }

    if (answers.baseSpirit && !["any", null, undefined].includes(answers.baseSpirit)) {
      if (answers.baseSpirit === "none") {
        return item.baseSpirit === "none";
      }

      return item.baseSpirit === answers.baseSpirit;
    }

    return true;
  });

  const payload = {
    model: HF_CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "Ты бармен AiBar и сейчас должен собрать финальную подборку коктейлей.",
          "У тебя есть список доступных базовых коктейлей. Выбирай только из него для base рекомендаций.",
          "Если пользователь хочет собрать коктейль из того, что уже есть дома, старайся выбирать только те варианты, которые максимально близки к его набору ингредиентов.",
          "Если пользователь уже указал конкретную базу, базовые коктейли должны совпадать с этой базой.",
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
        const base = runtimeCocktailBase.find((drink) => drink.id === item.base_id);
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

async function handleSignatureCocktailRating(body, res) {
  const action = body?.action === "dislike" ? "dislike" : "like";
  const cocktail = normalizeSignatureCocktail(body?.cocktail);

  if (!cocktail) {
    return sendJson(res, 400, {
      ok: false,
      error: "Cocktail payload is invalid",
    });
  }

  if (action === "dislike") {
    return sendJson(res, 200, {
      ok: true,
      saved: false,
      message: "Signature cocktail skipped",
    });
  }

  const existing = runtimeSignatureCocktails.find(
    (item) => normalizeKey(item.name) === normalizeKey(cocktail.name)
  );

  if (existing) {
    return sendJson(res, 200, {
      ok: true,
      saved: false,
      cocktail: existing,
      message: "Cocktail already exists in the signature base",
    });
  }

  runtimeSignatureCocktails.push(cocktail);
  runtimeCocktailBase.push(cocktail);
  persistSignatureCocktails(runtimeSignatureCocktails);

  return sendJson(res, 200, {
    ok: true,
    saved: true,
    cocktail,
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

function normalizeSignatureCocktail(cocktail) {
  if (!cocktail || typeof cocktail !== "object") {
    return null;
  }

  const name = String(cocktail.name || "").trim();
  if (!name) {
    return null;
  }

  const alcoholic =
    cocktail.alcoholic === false ? false : cocktail.alcoholic === true ? true : true;
  const baseSpirit =
    typeof cocktail.baseSpirit === "string" && cocktail.baseSpirit
      ? cocktail.baseSpirit
      : inferBaseSpiritFromDrink(cocktail);

  return {
    id: cocktail.id || `signature-${slugify(name)}`,
    name,
    source: "signature-base",
    strength: cocktail.strength || inferStrengthFromDrink(cocktail),
    alcoholic,
    baseSpirit,
    abv: cocktail.abv || (alcoholic ? "12-18%" : "0%"),
    mood: normalizeStringArray(cocktail.mood, 6, alcoholic ? ["вечернее"] : ["свежее"]),
    tags: normalizeStringArray(cocktail.tags, 8, ["авторский"]),
    glass: String(cocktail.glass || "coupe").trim().toLowerCase(),
    description: String(cocktail.description || "").trim(),
    ingredients: normalizeStringArray(cocktail.ingredients, 20, []),
    method: normalizeStringArray(cocktail.method, 8, []),
  };
}

function normalizeStringArray(value, limit, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const cleaned = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);

  return cleaned.length ? cleaned : [...fallback];
}

function inferBaseSpiritFromDrink(cocktail) {
  const text = `${cocktail.name || ""} ${Array.isArray(cocktail.ingredients) ? cocktail.ingredients.join(" ") : ""}`.toLowerCase();

  if (text.includes("водк")) {
    return "vodka";
  }
  if (text.includes("джин")) {
    return "gin";
  }
  if (text.includes("виски") || text.includes("бурбон")) {
    return "whiskey";
  }
  if (text.includes("ром")) {
    return "rum";
  }
  if (text.includes("текил")) {
    return "tequila";
  }
  if (text.includes("aperol") || text.includes("аперол") || text.includes("campari") || text.includes("вермут")) {
    return "aperitif";
  }

  return cocktail.alcoholic === false ? "none" : "any";
}

function inferStrengthFromDrink(cocktail) {
  if (cocktail.alcoholic === false) {
    return "zero";
  }

  const text = `${cocktail.abv || ""}`.toLowerCase();
  if (text.includes("0")) {
    return "zero";
  }

  return "medium";
}

function persistSignatureCocktails(catalog) {
  const content = `export const signatureCocktailBase = ${JSON.stringify(catalog, null, 2)};\n`;
  writeFileSync(SIGNATURE_FILE, content, "utf-8");
}

function mergeCocktailCatalog(baseCatalog, signatures) {
  const merged = [...baseCatalog];
  const seen = new Set(baseCatalog.map((item) => normalizeKey(item.name)));

  for (const drink of signatures) {
    const key = normalizeKey(drink.name);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(drink);
    }
  }

  return merged;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9а-яё]+/gi, "-")
    .replaceAll(/^-+|-+$/g, "");
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
