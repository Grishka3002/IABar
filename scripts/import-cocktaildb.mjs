import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const OUTPUT = resolve(ROOT, "src/data/cocktails.generated.js");

const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

const spiritMap = [
  { patterns: ["vodka"], value: "vodka" },
  { patterns: ["gin"], value: "gin" },
  { patterns: ["whiskey", "whisky", "bourbon", "scotch", "rye"], value: "whiskey" },
  { patterns: ["rum", "cachaca"], value: "rum" },
  { patterns: ["tequila", "mezcal"], value: "tequila" },
  { patterns: ["aperol", "campari", "vermouth", "prosecco", "champagne"], value: "aperitif" },
];

const tagMatchers = [
  { patterns: ["lemon", "lime", "orange", "grapefruit", "citrus"], tag: "цитрусовый" },
  { patterns: ["mint"], tag: "мята" },
  { patterns: ["berry", "raspberry", "cranberry", "blackberry", "strawberry"], tag: "ягодный" },
  { patterns: ["ginger", "pepper", "spice", "tabasco"], tag: "пряный" },
  { patterns: ["bitter", "campari"], tag: "горький" },
  { patterns: ["sugar", "syrup", "grenadine", "honey"], tag: "сладкий" },
  { patterns: ["tonic"], tag: "тоник" },
  { patterns: ["sparkling", "champagne", "prosecco"], tag: "игристый" },
  { patterns: ["dry"], tag: "сухой" },
  { patterns: ["tomato"], tag: "томатный" },
  { patterns: ["salt"], tag: "соленый" },
];

async function main() {
  const allDrinks = [];
  const seenIds = new Set();

  for (const letter of alphabet) {
    const url = `https://www.thecocktaildb.com/api/json/v1/1/search.php?f=${letter}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch "${url}": ${response.status}`);
    }

    const payload = await response.json();
    const drinks = Array.isArray(payload.drinks) ? payload.drinks : [];

    for (const drink of drinks) {
      if (!seenIds.has(drink.idDrink)) {
        seenIds.add(drink.idDrink);
        allDrinks.push(normalizeDrink(drink));
      }
    }
  }

  const content = `export const generatedCocktailBase = ${JSON.stringify(allDrinks, null, 2)};\n`;
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, content, "utf-8");
  console.log(`Saved ${allDrinks.length} cocktails to ${OUTPUT}`);
}

function normalizeDrink(drink) {
  const ingredients = extractIngredients(drink);
  const joinedIngredients = ingredients.join(" ").toLowerCase();
  const alcoholic = drink.strAlcoholic !== "Non alcoholic";
  const baseSpirit = alcoholic ? inferBaseSpirit(joinedIngredients) : "none";
  const tags = inferTags(joinedIngredients);

  return {
    id: `cocktaildb-${drink.idDrink}`,
    source: "cocktaildb",
    name: drink.strDrink,
    strength: inferStrength(baseSpirit, alcoholic, ingredients),
    alcoholic,
    baseSpirit,
    abv: inferAbv(baseSpirit, alcoholic),
    mood: inferMood(tags, alcoholic),
    tags,
    glass: normalizeGlass(drink.strGlass),
    description: buildDescription(drink, tags, alcoholic),
    ingredients,
    method: normalizeInstructions(drink.strInstructions),
  };
}

function extractIngredients(drink) {
  const result = [];

  for (let index = 1; index <= 15; index += 1) {
    const ingredient = drink[`strIngredient${index}`];
    const measure = drink[`strMeasure${index}`];

    if (!ingredient) {
      continue;
    }

    const normalizedIngredient = String(ingredient).trim();
    const normalizedMeasure = String(measure || "").trim();
    result.push(normalizedMeasure ? `${normalizedMeasure} ${normalizedIngredient}`.trim() : normalizedIngredient);
  }

  return result;
}

function inferBaseSpirit(text) {
  for (const entry of spiritMap) {
    if (entry.patterns.some((pattern) => text.includes(pattern))) {
      return entry.value;
    }
  }

  return "any";
}

function inferTags(text) {
  const result = [];

  for (const entry of tagMatchers) {
    if (entry.patterns.some((pattern) => text.includes(pattern))) {
      result.push(entry.tag);
    }
  }

  return result.length ? [...new Set(result)] : ["классика"];
}

function inferStrength(baseSpirit, alcoholic, ingredients) {
  if (!alcoholic) {
    return "zero";
  }

  const lower = ingredients.join(" ").toLowerCase();
  if (lower.includes("champagne") || lower.includes("prosecco") || lower.includes("sparkling") || lower.includes("tonic") || lower.includes("soda")) {
    return "medium";
  }

  if (["vodka", "gin", "whiskey", "rum", "tequila"].includes(baseSpirit)) {
    return ingredients.length <= 4 ? "strong" : "medium";
  }

  return "medium";
}

function inferAbv(baseSpirit, alcoholic) {
  if (!alcoholic) {
    return "0%";
  }

  if (baseSpirit === "aperitif") {
    return "9-12%";
  }

  return "12-22%";
}

function inferMood(tags, alcoholic) {
  const moods = [];

  if (tags.includes("цитрусовый") || tags.includes("игристый")) {
    moods.push("легкое");
  }

  if (tags.includes("пряный") || tags.includes("томатный")) {
    moods.push("яркое");
  }

  if (tags.includes("сладкий") || tags.includes("ягодный")) {
    moods.push("игривое");
  }

  if (tags.includes("горький") || tags.includes("сухой")) {
    moods.push("собранное");
  }

  if (!moods.length) {
    moods.push(alcoholic ? "вечернее" : "свежее");
  }

  return [...new Set(moods)];
}

function normalizeGlass(glass) {
  return glass ? String(glass).trim().toLowerCase() : "coupe";
}

function buildDescription(drink, tags, alcoholic) {
  const base = alcoholic ? "Алкогольный коктейль" : "Безалкогольный коктейль";
  const accent = tags.slice(0, 2).join(" и ");
  return accent ? `${base} с акцентом на ${accent}.` : `${base} на каждый вечер.`;
}

function normalizeInstructions(text) {
  const value = String(text || "").trim();
  if (!value) {
    return [
      "Собери ингредиенты и охлади бокал.",
      "Смешай коктейль по классической схеме для этого типа напитка.",
      "Подавай сразу после приготовления."
    ];
  }

  const parts = value
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  return parts.length ? parts : [value];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
