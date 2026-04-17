const SETTINGS_KEY = "aibar-settings";

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);

  if (!raw) {
    return {
      apiKey: "",
      model: "gpt-4.1-mini"
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      apiKey: "",
      model: "gpt-4.1-mini"
    };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function createSignatureCocktail({ answers, picks, settings }) {
  if (!settings.apiKey) {
    const backendCocktail = await requestBackend({ answers, picks });
    if (backendCocktail) {
      return backendCocktail;
    }
    return buildLocalSignature(answers);
  }

  try {
    return await requestOpenAI({ answers, picks, settings });
  } catch {
    return buildLocalSignature(answers);
  }
}

export async function getBartenderTurn({ messages, answers, askedQuestions }) {
  try {
    const response = await fetch("/api/bartender-turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, answers, askedQuestions }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export async function getRecommendationSet({ messages, answers, previousRecommendations }) {
  try {
    const response = await fetch("/api/recommendation-set", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, answers, previousRecommendations }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

async function requestOpenAI({ answers, picks, settings }) {
  const prompt = {
    role: "user",
    content: [
      "Ты бармен-миксолог. Ответь только JSON-объектом.",
      "Нужно придумать 1 авторский коктейль под предпочтения гостя.",
      "Верни поля: name, strength, alcoholic, abv, glass, description, tags (array), ingredients (array), method (array).",
      "Описание максимум 2 предложения, естественным русским языком.",
      `Алкогольный режим: ${answers.alcoholic === false ? "безалкогольный" : "алкогольный"}.`,
      `Настроения: ${answers.moods.join(", ") || "не указаны"}.`,
      `Теги вкуса: ${answers.tags.join(", ") || "не указаны"}.`,
      `Уже подобранные базовые коктейли: ${picks.map((item) => item.name).join(", ")}.`
    ].join("\n")
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4.1-mini",
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ты опытный бармен. Думаешь как сомелье и миксолог, но отвечаешь только валидным JSON без Markdown."
        },
        prompt
      ]
    })
  });

  if (!response.ok) {
    throw new Error("AI request failed");
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);

  return {
    id: "signature-ai",
    source: "ai",
    name: parsed.name,
    strength: parsed.strength || (answers.alcoholic === false ? "zero" : "signature"),
    alcoholic: parsed.alcoholic ?? answers.alcoholic !== false,
    abv: parsed.abv || (answers.alcoholic === false ? "0%" : "12-16%"),
    glass: parsed.glass || "coupe",
    description: parsed.description,
    tags: parsed.tags || [],
    ingredients: parsed.ingredients || [],
    method: parsed.method || []
  };
}

async function requestBackend({ answers, picks }) {
  try {
    const response = await fetch("/api/signature-cocktail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers, picks }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.cocktail || null;
  } catch {
    return null;
  }
}

function buildLocalSignature(answers) {
  const isAlcoholic = answers.alcoholic !== false;
  const primeMood = answers.moods[0] || (isAlcoholic ? "вечернее" : "свежее");
  const primeTag = answers.tags[0] || (isAlcoholic ? "цитрусовый" : "освежающий");

  if (!isAlcoholic) {
    return {
      id: "signature-local-zero",
      source: "ai",
      name: "Velvet Mood Cooler",
      strength: "zero",
      alcoholic: false,
      abv: "0%",
      glass: "highball",
      description: `Безалкогольный авторский микс под настроение "${primeMood}" с акцентом на "${primeTag}". Легкий, чистый и собранный вкус, чтобы поддержать вайб без перегруза.`,
      tags: [primeMood, primeTag, "авторский", "безалкогольный"],
      ingredients: ["60 мл виноградного кордиала", "80 мл охлажденного белого чая", "60 мл цитрусового тоника", "120 г льда"],
      method: [
        "Наполни высокий бокал льдом.",
        "Влей виноградный кордиал и охлажденный белый чай.",
        "Долей цитрусовый тоник и аккуратно перемешай.",
        "Подай сразу, чтобы сохранить свежесть и тонкие пузырьки."
      ]
    };
  }

  return {
    id: "signature-local-alc",
    source: "ai",
    name: "Afterglow No. 7",
    strength: "signature",
    alcoholic: true,
    abv: "14-17%",
    glass: "coupe",
    description: `Авторский коктейль под настроение "${primeMood}" с ведущим тегом "${primeTag}". Вкус получается взрослым, собранным и чуть кинематографичным.`,
    tags: [primeMood, primeTag, "авторский", "бармен рекомендует"],
    ingredients: ["35 мл джина", "20 мл цитрусового вермута", "10 мл медового кордиала", "2 дэш биттера", "120 г льда"],
    method: [
      "Охлади coupe или небольшой stem-бокал.",
      "Смешай в смесительном стакане джин, вермут, медовый кордиал и биттер со льдом.",
      "Перемешивай 15-20 секунд до мягкого охлаждения.",
      "Процеди в бокал и подай без лишнего шума, как вечерний авторский номер."
    ]
  };
}
