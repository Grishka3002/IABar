import { cocktailBase } from "../data/cocktails.js";

const clarifyingQuestions = [
  "Для начала уточню формат: подбираем из того, что уже есть дома, или можно ориентироваться свободно и при необходимости докупить ингредиенты?",
  "Тогда расскажи, что у тебя уже есть под рукой: алкоголь, цитрус, содовая, сиропы, мята, лед.",
  "На какой основе хочется коктейль: джин, виски, ром, текила, аперитивная база или без жесткой привязки?",
  "Скажи, это должен быть алкогольный или безалкогольный подбор?",
  "Какое настроение ты хочешь поймать: спокойное, уютное, праздничное, легкое, яркое?",
  "Есть ли вкусы или акценты, которые хочется почувствовать: цитрус, мята, ягоды, сладость, сухость, горчинка?"
];

const phraseGroups = {
  alcoholic: ["алкоголь", "алкогольный", "с алкоголем", "покрепче", "boozy"],
  nonAlcoholic: ["безалкоголь", "без алкоголя", "0%", "трезв", "не пью", "zero"],
  lightPreference: [
    "не крепкое",
    "некрепкое",
    "полегче",
    "легкое",
    "легкий",
    "расслабляющее",
    "расслабляющий",
    "усталое",
    "устал",
    "мягкое",
    "мягкий"
  ],
  strongPreference: ["крепкое", "покрепче", "поярче", "сильнее"],
};

const baseSpiritMap = [
  { patterns: ["джин", "gin"], value: "gin" },
  { patterns: ["виски", "бурбон", "whiskey", "whisky"], value: "whiskey" },
  { patterns: ["ром", "rum"], value: "rum" },
  { patterns: ["текила", "tequila"], value: "tequila" },
  { patterns: ["аперитив", "aperol", "aperitif", "апероль", "кампари"], value: "aperitif" },
  { patterns: ["без разницы", "неважно", "любая", "любое", "без привязки"], value: "any" },
  { patterns: ["без алкоголя", "безалкоголь"], value: "none" },
];

const moodMap = [
  { patterns: ["спокойное", "спокойный", "спокойно", "тихий"], value: "спокойное" },
  { patterns: ["уютное", "уют", "домашнее"], value: "уютное" },
  { patterns: ["праздничное", "праздник", "веселый", "весёлый"], value: "праздничное" },
  { patterns: ["легкое", "легкий", "воздушное"], value: "легкое" },
  { patterns: ["яркое", "яркий", "сочное"], value: "яркое" },
  { patterns: ["романтичное", "романтичный"], value: "романтичное" },
  { patterns: ["энергичное", "энергичный", "бодрое", "бодрый"], value: "энергичное" },
  { patterns: ["вечернее", "вечерний"], value: "вечернее" },
  { patterns: ["теплое", "теплый"], value: "теплое" },
  { patterns: ["свежее", "свежий"], value: "свежее" },
  { patterns: ["собранное", "собранный"], value: "собранное" },
  { patterns: ["игривое", "игривый"], value: "игривое" },
  { patterns: ["расслабляющее", "расслабленный", "усталое", "устал"], value: "спокойное" },
];

const tagMap = [
  { patterns: ["цитрус", "цитрусовое", "цитрусовый", "апельсин", "грейпфрут", "лимон", "лайм"], value: "цитрусовый" },
  { patterns: ["мята", "мятный"], value: "мята" },
  { patterns: ["горький", "горчинка"], value: "горький" },
  { patterns: ["сладкий", "сладость"], value: "сладкий" },
  { patterns: ["ягодный", "ягоды", "малина", "вишня"], value: "ягодный" },
  { patterns: ["освежающий", "освежить", "свежесть"], value: "освежающий" },
  { patterns: ["пряный", "пряность"], value: "пряный" },
  { patterns: ["виски"], value: "виски" },
  { patterns: ["аперитив"], value: "аперитив" },
  { patterns: ["лайм"], value: "лайм" },
  { patterns: ["грейпфрут"], value: "грейпфрут" },
  { patterns: ["игристый", "пузырьки"], value: "игристый" },
  { patterns: ["травяной", "травы"], value: "травяной" },
  { patterns: ["сухой", "посуше"], value: "сухой" },
  { patterns: ["тоник"], value: "тоник" },
  { patterns: ["ваниль", "ванильный"], value: "сладкий" },
];

const inventoryMap = [
  { patterns: ["джин", "gin"], value: "gin", aliases: ["джин"] },
  { patterns: ["виски", "бурбон", "whiskey", "whisky"], value: "whiskey", aliases: ["виски", "бурбон"] },
  { patterns: ["ром", "rum"], value: "rum", aliases: ["ром"] },
  { patterns: ["текила", "tequila"], value: "tequila", aliases: ["текила"] },
  { patterns: ["апероль", "aperol"], value: "aperol", aliases: ["aperol", "апероль"] },
  { patterns: ["кампари", "campari"], value: "campari", aliases: ["кампари"] },
  { patterns: ["вермут", "vermouth"], value: "vermouth", aliases: ["вермут"] },
  { patterns: ["лимон", "lemon"], value: "lemon", aliases: ["лимон", "лимонный сок"] },
  { patterns: ["лайм", "lime"], value: "lime", aliases: ["лайм", "сок лайма"] },
  { patterns: ["апельсин", "orange"], value: "orange", aliases: ["апельсин", "апельсиновый сок"] },
  { patterns: ["грейпфрут", "grapefruit"], value: "grapefruit", aliases: ["грейпфрут", "грейпфрутовый сок"] },
  { patterns: ["мята", "mint"], value: "mint", aliases: ["мята"] },
  { patterns: ["тоник", "tonic"], value: "tonic", aliases: ["тоник"] },
  { patterns: ["содовая", "soda"], value: "soda", aliases: ["содовая", "газированная вода"] },
  { patterns: ["игрист", "prosecco", "sparkling"], value: "sparkling", aliases: ["игристое", "просекко"] },
  { patterns: ["сироп", "simple syrup"], value: "syrup", aliases: ["сироп", "сахарный сироп"] },
  { patterns: ["сахар", "sugar"], value: "sugar", aliases: ["сахар"] },
  { patterns: ["гренадин", "grenadine"], value: "grenadine", aliases: ["гренадин"] },
  { patterns: ["ягод", "berry"], value: "berries", aliases: ["ягоды", "ягодное пюре"] },
  { patterns: ["имбир", "ginger"], value: "ginger", aliases: ["имбирный эль", "имбирь"] },
  { patterns: ["чай", "tea"], value: "tea", aliases: ["чай"] },
  { patterns: ["лед", "лёд", "ice"], value: "ice", aliases: ["лед"] },
  { patterns: ["биттер", "angostura"], value: "bitters", aliases: ["биттер", "ангостура"] },
  { patterns: ["белок", "egg white"], value: "eggwhite", aliases: ["белок"] },
];

const homeInventoryReplies = [
  "Есть джин, лимон и тоник",
  "Есть виски, лимон и сироп",
  "Есть ром, лайм, мята и содовая",
  "Есть игристое и апероль",
  "Лучше подскажи сам, что искать",
];

export function createInitialState() {
  return {
    messages: [
      {
        role: "bot",
        text:
          "Я твой бармен. Для начала скажи: подбираем из того, что уже есть дома, или можно советовать свободно, как будто ингредиенты можно докупить?"
      }
    ],
    answers: {
      stockMode: null,
      inventory: [],
      baseSpirit: null,
      alcoholic: null,
      moods: [],
      tags: [],
      intensity: null,
    },
    askedQuestions: 0,
    isComplete: false,
    lastRecommendations: []
  };
}

export function addUserMessage(state, text) {
  state.messages.push({ role: "user", text });
}

export function mergeExtractedPreferences(answers, text) {
  const nextAnswers = {
    stockMode: answers.stockMode ?? null,
    inventory: [...(answers.inventory || [])],
    baseSpirit: answers.baseSpirit ?? null,
    alcoholic: answers.alcoholic,
    moods: [...(answers.moods || [])],
    tags: [...(answers.tags || [])],
    intensity: answers.intensity ?? null,
  };
  extractPreferences(nextAnswers, text);
  return nextAnswers;
}

export function nextBartenderTurn(state, userText) {
  extractPreferences(state.answers, userText);

  const missing = getMissingSlots(state.answers);
  const shouldAsk = missing.length > 0 && state.askedQuestions < 3;

  if (!state.isComplete && shouldAsk) {
    state.messages.push({
      role: "bot",
      text: buildProbeQuestion(state.answers)
    });
    state.askedQuestions += 1;
    return state;
  }

  state.isComplete = true;
  state.messages.push({
    role: "bot",
    text: buildSummary(state.answers)
  });
  return state;
}

export function buildRecommendations(answers) {
  const alcoholic = answers.alcoholic !== false;
  const candidates = cocktailBase.filter((drink) => drink.alcoholic === alcoholic);
  const scored = candidates
    .map((drink) => ({
      drink,
      score: scoreDrink(drink, answers)
    }))
    .sort((left, right) => right.score - left.score);

  if (!alcoholic) {
    return takeUnique(scored, 2).map((item) => ({
      ...item.drink,
      source: "base"
    }));
  }

  const strongCandidate =
    answers.intensity === "light"
      ? scored.find((item) => item.drink.strength === "medium")
      : scored.find((item) => item.drink.strength === "strong");
  const lighterCandidate = scored.find((item) => item.drink.strength === "medium");
  const fallback = takeUnique(scored, 3).map((item) => item.drink);
  const chosen = [];

  if (strongCandidate?.drink) {
    chosen.push(strongCandidate.drink);
  }

  if (lighterCandidate?.drink && !chosen.some((item) => item.id === lighterCandidate.drink.id)) {
    chosen.push(lighterCandidate.drink);
  }

  for (const item of fallback) {
    if (!chosen.some((drink) => drink.id === item.id) && chosen.length < 2) {
      chosen.push(item);
    }
  }

  return chosen.map((drink) => ({
    ...drink,
    source: "base"
  }));
}

export function hasEnoughInfo(answers) {
  const hasStockMode = answers.stockMode !== null;
  const hasInventory = answers.stockMode !== "home" || (answers.inventory || []).length > 0;
  const hasBaseSpirit = answers.baseSpirit !== null;
  const hasAlcoholChoice = answers.alcoholic !== null;
  const hasMood = Array.isArray(answers.moods) && answers.moods.length > 0;
  const hasTaste = Array.isArray(answers.tags) && answers.tags.length > 0;
  return hasStockMode && hasInventory && hasBaseSpirit && hasAlcoholChoice && (hasMood || hasTaste);
}

export function buildProbeQuestion(answers) {
  if (answers.stockMode === null) {
    return clarifyingQuestions[0];
  }

  if (answers.stockMode === "home" && !(answers.inventory || []).length) {
    return "Тогда скажи, что именно уже есть дома. Достаточно коротко: например, джин, лимон, тоник, мята или виски, лед, сироп.";
  }

  if (answers.baseSpirit === null) {
    return clarifyingQuestions[2];
  }

  if (answers.alcoholic === null) {
    return clarifyingQuestions[3];
  }

  if (!answers.moods.length && !answers.tags.length) {
    return "Пока вайб слишком размытый. Подскажи хотя бы одно: настроение или вкус, например уютное, свежее, цитрусовое, мягкое?";
  }

  if (!answers.moods.length) {
    return "По вкусу уже понятнее. А настроение какое: спокойное, уютное, яркое, праздничное?";
  }

  if (!answers.tags.length) {
    return "Настроение поймал. Теперь дай вкусовой ориентир: цитрус, мята, ягоды, сладость, сухость или горчинка?";
  }

  return "Дай еще один короткий ориентир по вкусу или настроению, чтобы я не промахнулся с подборкой.";
}

export function getQuickReplies(answers) {
  if (answers.stockMode === null) {
    return [
      "Из того, что есть дома",
      "Можно докупить",
    ];
  }

  if (answers.stockMode === "home" && !(answers.inventory || []).length) {
    return homeInventoryReplies;
  }

  if (answers.baseSpirit === null) {
    return ["Джин", "Виски", "Ром", "Текила", "Аперитивная", "Без привязки"];
  }

  if (answers.alcoholic === null) {
    return ["Алкогольный", "Безалкогольный"];
  }

  if (!answers.moods.length) {
    return ["Спокойное", "Уютное", "Праздничное", "Легкое", "Яркое"];
  }

  if (!answers.tags.length) {
    return ["Цитрус", "Мята", "Ягоды", "Сладость", "Сухость", "Горчинка"];
  }

  return [];
}

function buildSummary(answers) {
  const mode = answers.alcoholic === false ? "безалкогольный" : "алкогольный";
  const stockText =
    answers.stockMode === "home"
      ? `с оглядкой на то, что уже есть дома${answers.inventory.length ? `: ${formatInventory(answers.inventory)}` : ""}`
      : "без ограничения по наличию ингредиентов";
  const baseText =
    answers.baseSpirit === "any"
      ? "без жесткой привязки к базе"
      : answers.baseSpirit === "none"
        ? "без спиртовой базы"
        : `с опорой на ${translateBaseSpirit(answers.baseSpirit)}`;
  const moodText = answers.moods.length ? answers.moods.join(", ") : "свободный по настроению";
  const tagText = answers.tags.length ? answers.tags.join(", ") : "без жестких ограничений по вкусу";
  return `Понял. Делаю ${mode} подбор ${stockText}, ${baseText}: настроение ${moodText}, а по вкусам ориентируюсь на ${tagText}. Сейчас соберу новую тройку.`;
}

function getMissingSlots(answers) {
  const missing = [];

  if (answers.stockMode === null) {
    missing.push("stockMode");
  }

  if (answers.stockMode === "home" && !(answers.inventory || []).length) {
    missing.push("inventory");
  }

  if (answers.baseSpirit === null) {
    missing.push("baseSpirit");
  }

  if (answers.alcoholic === null) {
    missing.push("alcoholic");
  }

  if (answers.moods.length === 0 && answers.tags.length === 0) {
    missing.push("moodOrTaste");
  }

  return missing;
}

function extractPreferences(answers, text) {
  const normalized = normalizeText(text);

  if (answers.stockMode === null) {
    if (
      matchesAny(normalized, [
        "что есть",
        "из того что есть",
        "из того, что есть",
        "дома есть",
        "из наличия",
        "без магазина",
        "не хочу в магазин",
        "из домашних ингредиентов",
        "из домашнего"
      ])
    ) {
      answers.stockMode = "home";
    } else if (
      matchesAny(normalized, [
        "докупим",
        "докупить",
        "куплю",
        "можно в магазин",
        "зайду в магазин",
        "без ограничений",
        "что угодно",
        "свободно",
        "можно свободно"
      ])
    ) {
      answers.stockMode = "free";
    }
  }

  const inventory = extractInventory(normalized);
  if (inventory.length) {
    answers.inventory = dedupeList([...(answers.inventory || []), ...inventory]);
  }

  if (answers.baseSpirit === null) {
    for (const entry of baseSpiritMap) {
      if (matchesAny(normalized, entry.patterns)) {
        answers.baseSpirit = entry.value;
        break;
      }
    }
  }

  if (answers.alcoholic === null) {
    if (matchesAny(normalized, phraseGroups.nonAlcoholic)) {
      answers.alcoholic = false;
    } else if (matchesAny(normalized, phraseGroups.alcoholic)) {
      answers.alcoholic = true;
    }
  }

  if (matchesAny(normalized, phraseGroups.lightPreference)) {
    answers.intensity = "light";
    answers.moods = dedupeList([...(answers.moods || []), "легкое", "спокойное"]);
  } else if (matchesAny(normalized, phraseGroups.strongPreference)) {
    answers.intensity = "strong";
  }

  for (const entry of moodMap) {
    if (matchesAny(normalized, entry.patterns)) {
      answers.moods = dedupeList([...(answers.moods || []), entry.value]);
    }
  }

  for (const entry of tagMap) {
    if (matchesAny(normalized, entry.patterns)) {
      answers.tags = dedupeList([...(answers.tags || []), entry.value]);
    }
  }
}

function extractInventory(text) {
  const found = [];

  for (const entry of inventoryMap) {
    if (matchesAny(text, entry.patterns)) {
      found.push(entry.value);
    }
  }

  return dedupeList(found);
}

function scoreDrink(drink, answers) {
  let score = 1;

  for (const mood of answers.moods) {
    if (drink.mood.includes(mood)) {
      score += 5;
    }
  }

  for (const tag of answers.tags) {
    if (drink.tags.includes(tag)) {
      score += 4;
    }
  }

  if (answers.alcoholic === false && drink.alcoholic === false) {
    score += 6;
  }

  if (answers.alcoholic === true && drink.alcoholic === true) {
    score += 3;
  }

  if (answers.intensity === "light") {
    if (drink.strength === "medium" || drink.strength === "zero") {
      score += 4;
    }
    if (drink.strength === "strong") {
      score -= 6;
    }
  }

  if (answers.intensity === "strong" && drink.strength === "strong") {
    score += 4;
  }

  if (answers.baseSpirit && answers.baseSpirit !== "any") {
    if (drink.baseSpirit === answers.baseSpirit) {
      score += 5;
    } else if (answers.baseSpirit === "none" && drink.alcoholic === false) {
      score += 5;
    } else {
      score -= 3;
    }
  }

  if (answers.tags.includes("сладкий") && drink.tags.includes("горький")) {
    score -= 2;
  }

  if (answers.moods.includes("спокойное") && drink.tags.includes("горький")) {
    score -= 1;
  }

  score += scoreInventoryFit(drink, answers);

  return score;
}

function scoreInventoryFit(drink, answers) {
  if (answers.stockMode !== "home") {
    return 0;
  }

  const inventory = answers.inventory || [];
  if (!inventory.length) {
    return -8;
  }

  const drinkText = `${drink.name} ${(drink.ingredients || []).join(" ")}`.toLowerCase();
  let matched = 0;
  let criticalMisses = 0;

  for (const item of inventory) {
    if (inventoryMentionMatchesDrink(item, drinkText)) {
      matched += 1;
    }
  }

  if (drink.alcoholic && drink.baseSpirit && drink.baseSpirit !== "none" && drink.baseSpirit !== "any") {
    if (!inventory.includes(drink.baseSpirit)) {
      criticalMisses += 1;
    }
  }

  if (drink.tags.includes("мята") && !inventory.includes("mint")) {
    criticalMisses += 1;
  }

  if ((drink.tags.includes("цитрусовый") || drink.tags.includes("лайм") || drink.tags.includes("грейпфрут")) &&
    !inventory.some((item) => ["lemon", "lime", "orange", "grapefruit"].includes(item))) {
    criticalMisses += 1;
  }

  return matched * 2 - criticalMisses * 4;
}

function inventoryMentionMatchesDrink(item, drinkText) {
  const entry = inventoryMap.find((candidate) => candidate.value === item);
  if (!entry) {
    return false;
  }

  return entry.aliases.some((alias) => drinkText.includes(alias.toLowerCase()));
}

function normalizeText(text) {
  return String(text).toLowerCase().replaceAll("ё", "е");
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
}

function takeUnique(list, count) {
  const result = [];

  for (const item of list) {
    if (!result.some((entry) => entry.drink.id === item.drink.id)) {
      result.push(item);
    }

    if (result.length === count) {
      break;
    }
  }

  return result;
}

function translateBaseSpirit(baseSpirit) {
  const map = {
    gin: "джин",
    whiskey: "виски",
    rum: "ром",
    tequila: "текилу",
    aperitif: "аперитивную основу",
    none: "безалкогольную основу",
    any: "любую основу",
  };

  return map[baseSpirit] || "любую основу";
}

function formatInventory(inventory) {
  return inventory
    .map((item) => inventoryLabel(item))
    .join(", ");
}

function inventoryLabel(item) {
  const map = {
    gin: "джин",
    whiskey: "виски",
    rum: "ром",
    tequila: "текила",
    aperol: "апероль",
    campari: "кампари",
    vermouth: "вермут",
    lemon: "лимон",
    lime: "лайм",
    orange: "апельсин",
    grapefruit: "грейпфрут",
    mint: "мята",
    tonic: "тоник",
    soda: "содовая",
    sparkling: "игристое",
    syrup: "сироп",
    sugar: "сахар",
    grenadine: "гренадин",
    berries: "ягоды",
    ginger: "имбирный акцент",
    tea: "чай",
    ice: "лед",
    bitters: "биттер",
    eggwhite: "белок",
  };

  return map[item] || item;
}

function dedupeList(list) {
  return [...new Set(list.map((item) => String(item).toLowerCase()))];
}
