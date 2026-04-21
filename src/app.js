import { quickTags } from "./data/cocktails.js";
import {
  addUserMessage,
  buildCompletionMessage,
  buildProbeQuestion,
  buildRecommendations,
  createInitialState,
  getQuickReplies,
  hasEnoughInfo,
  mergeExtractedPreferences,
  nextBartenderTurn
} from "./lib/chat.js";
import {
  createSignatureCocktail,
  getBartenderTurn,
  getRecommendationSet,
  loadSettings,
  rateSignatureCocktail
} from "./lib/ai.js";

const state = createInitialState();
const likedSignatureIds = new Set();
const dislikedSignatureIds = new Set();

const chatLog = document.querySelector("#chat-log");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const resultsGrid = document.querySelector("#results-grid");
const restartButton = document.querySelector("#restart-chat");
const chatSection = document.querySelector("#chat-section");
const resultsSection = document.querySelector("#results-section");
const quickTagsRoot = document.querySelector("#quick-tags");
const quickRepliesRoot = document.querySelector("#quick-replies");
const focusChatButton = document.querySelector("#focus-chat");
const recipeModal = document.querySelector("#recipe-modal");
const recipeBackdrop = document.querySelector("#recipe-backdrop");
const recipeClose = document.querySelector("#recipe-close");
const recipeContent = document.querySelector("#recipe-content");

let settings = loadSettings();

renderQuickTags();
renderMessages();
renderQuickReplies();
renderComposerState();
registerServiceWorker();

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();

  if (!text) {
    return;
  }

  chatInput.value = "";
  addUserMessage(state, text);
  state.answers = mergeExtractedPreferences(state.answers, text);
  renderMessages();
  renderQuickReplies();
  renderComposerState();
  const aiTurn = await getBartenderTurn({
    messages: state.messages,
    answers: state.answers,
    askedQuestions: state.askedQuestions,
  });

  if (aiTurn?.ok) {
    const nextAnswers = aiTurn.answers || {};
    const mergedBaseSpirit = nextAnswers.baseSpirit ?? state.answers.baseSpirit ?? null;
    const inferredAlcoholic =
      nextAnswers.alcoholic ??
      state.answers.alcoholic ??
      (mergedBaseSpirit === "none"
        ? false
        : ["gin", "whiskey", "rum", "tequila", "aperitif"].includes(mergedBaseSpirit)
          ? true
          : null);

    state.answers = {
      ...state.answers,
      stockMode: nextAnswers.stockMode ?? state.answers.stockMode ?? null,
      inventory: dedupeList([...(state.answers.inventory || []), ...((nextAnswers.inventory) || [])]),
      baseSpirit: mergedBaseSpirit,
      alcoholic: inferredAlcoholic,
      moods: dedupeList([...(state.answers.moods || []), ...((nextAnswers.moods) || [])]),
      tags: dedupeList([...(state.answers.tags || []), ...((nextAnswers.tags) || [])]),
      intensity: nextAnswers.intensity || state.answers.intensity || null,
    };
    if (aiTurn.asked_question) {
      state.askedQuestions += 1;
    }
    state.isComplete = Boolean(aiTurn.complete);
    const enoughInfo = hasEnoughInfo(state.answers);

    if (enoughInfo) {
      state.isComplete = true;
      state.messages.push({
        role: "bot",
        text: state.isComplete && aiTurn.complete
          ? aiTurn.assistant_message
          : buildCompletionMessage(state.answers),
      });
    } else {
      state.isComplete = false;
      state.messages.push({
        role: "bot",
        text: aiTurn.asked_question ? buildProbeQuestion(state.answers) : aiTurn.assistant_message,
      });
      if (aiTurn.complete) {
        state.askedQuestions = Math.min(state.askedQuestions + 1, 3);
      }
    }
  } else {
    nextBartenderTurn(state, text);
  }
  renderMessages();
  renderQuickReplies();
  renderComposerState();

  if (state.isComplete) {
    await renderRecommendations();
  }
});

restartButton.addEventListener("click", () => {
  const freshState = createInitialState();
  state.messages = freshState.messages;
  state.answers = freshState.answers;
  state.askedQuestions = freshState.askedQuestions;
  state.isComplete = freshState.isComplete;
  state.lastRecommendations = freshState.lastRecommendations;
  hideResults();
  resultsGrid.innerHTML = '<article class="placeholder-card"><p>Пока пусто. Напиши бармену, какое у тебя настроение.</p></article>';
  renderMessages();
  renderQuickReplies();
  renderComposerState();
  showChat();
  chatInput.focus();
});

focusChatButton?.addEventListener("click", () => {
  showChat();
  chatInput.focus();
  chatSection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

recipeBackdrop?.addEventListener("click", closeRecipeModal);
recipeClose?.addEventListener("click", closeRecipeModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeRecipeModal();
  }
});

function renderQuickTags() {
  quickTagsRoot.innerHTML = "";

  for (const tag of quickTags) {
    const button = document.createElement("button");
    button.className = "tag-chip";
    button.type = "button";
    button.textContent = tag;
    button.addEventListener("click", () => {
      chatInput.value = chatInput.value ? `${chatInput.value} ${tag}` : tag;
      chatInput.focus();
    });
    quickTagsRoot.append(button);
  }
}

function renderQuickReplies() {
  if (!quickRepliesRoot) {
    return;
  }

  const replies = getQuickReplies(state.answers);
  quickRepliesRoot.innerHTML = "";

  if (!replies.length || state.isComplete) {
    return;
  }

  for (const reply of replies) {
    const button = document.createElement("button");
    button.className = "tag-chip";
    button.type = "button";
    button.textContent = reply;
    button.addEventListener("click", () => {
      chatInput.value = reply;
      chatForm.requestSubmit();
    });
    quickRepliesRoot.append(button);
  }
}

function renderComposerState() {
  if (!chatInput) {
    return;
  }

  if (state.answers.stockMode === "home" && !(state.answers.inventory || []).length) {
    chatInput.placeholder = "Например: есть джин, лимон, тоник, мята и лед";
    return;
  }

  if (state.answers.baseSpirit === null && state.answers.stockMode !== null) {
    chatInput.placeholder = "Например: джин, виски, ром, текила или без привязки";
    return;
  }

  const alcoholResolved =
    state.answers.alcoholic !== null ||
    state.answers.baseSpirit === "none" ||
    ["gin", "whiskey", "rum", "tequila", "aperitif"].includes(state.answers.baseSpirit);

  if (!alcoholResolved && state.answers.baseSpirit !== null) {
    chatInput.placeholder = "Например: алкогольный или безалкогольный";
    return;
  }

  chatInput.placeholder = "Например: хочу что-то цитрусовое, бодрое и не очень крепкое";
}

function renderMessages() {
  chatLog.innerHTML = "";

  for (const message of state.messages) {
    const node = document.createElement("article");
    node.className = `message message--${message.role}`;
    node.innerHTML = `
      <span class="message__meta">${message.role === "bot" ? "Бармен" : "Ты"}</span>
      <p>${escapeHtml(message.text)}</p>
    `;
    chatLog.append(node);
  }

  chatLog.scrollTop = chatLog.scrollHeight;
}

async function renderRecommendations() {
  const aiSet = await getRecommendationSet({
    messages: state.messages,
    answers: state.answers,
    previousRecommendations: state.lastRecommendations,
  });

  if (aiSet?.ok && Array.isArray(aiSet.recommendations) && aiSet.recommendations.length) {
    state.lastRecommendations = aiSet.recommendations;
  } else {
    const picks = buildRecommendations(state.answers);
    const signature = await createSignatureCocktail({
      answers: state.answers,
      picks,
      settings
    });
    state.lastRecommendations = [...picks, signature];
  }

  showResults();
  resultsGrid.innerHTML = "";

  for (const drink of state.lastRecommendations) {
    resultsGrid.append(createDrinkCard(drink));
  }
}

function createDrinkCard(drink) {
  const article = document.createElement("article");
  article.className = "drink-card";

  const sourceLabel = drink.source === "ai" ? "Авторский рецепт" : "Из базы";
  const badgeClass = drink.source === "ai" ? "badge badge--ai" : "badge badge--base";
  const tags = (drink.tags || []).slice(0, 6).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const description = drink.description || "Описание уточняется.";
  const ingredients = drink.ingredients?.length ? drink.ingredients : [];

  article.innerHTML = `
    <div class="drink-card__top">
      <div>
        <h3>${escapeHtml(drink.name)}</h3>
        <p class="drink-card__meta">
          <span>Крепость: ${escapeHtml(drink.abv || drink.strength)}</span>
          <span>Бокал: ${escapeHtml(drink.glass || "на выбор бармена")}</span>
        </p>
      </div>
      <span class="${badgeClass}">${sourceLabel}</span>
    </div>
    <p class="drink-card__description"><strong>Описание:</strong> ${escapeHtml(description)}</p>
    <div class="drink-card__tags">${tags}</div>
  `;

  if (drink.source === "ai") {
    article.append(createSignatureActions(drink));
  }

  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", `Открыть рецепт ${drink.name}`);
  article.addEventListener("click", () => openRecipeModal(drink));
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRecipeModal(drink);
    }
  });

  return article;
}

function createSignatureActions(drink) {
  const actions = document.createElement("div");
  actions.className = "drink-card__actions";

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = "reaction-button reaction-button--like";
  likeButton.textContent = likedSignatureIds.has(drink.id) ? "Сохранено в базу" : "Нравится";
  likeButton.disabled = likedSignatureIds.has(drink.id);
  likeButton.addEventListener("click", async (event) => {
    event.stopPropagation();

    const response = await rateSignatureCocktail({
      cocktail: drink,
      action: "like",
    });

    if (response?.ok) {
      likedSignatureIds.add(drink.id);
      dislikedSignatureIds.delete(drink.id);
      likeButton.textContent = response.saved ? "Сохранено в базу" : "Уже есть в базе";
      likeButton.disabled = true;
      dislikeButton.disabled = true;
    }
  });

  const dislikeButton = document.createElement("button");
  dislikeButton.type = "button";
  dislikeButton.className = "reaction-button reaction-button--dislike";
  dislikeButton.textContent = dislikedSignatureIds.has(drink.id) ? "Не сохраняем" : "Не нравится";
  dislikeButton.disabled = likedSignatureIds.has(drink.id);
  dislikeButton.addEventListener("click", async (event) => {
    event.stopPropagation();

    const response = await rateSignatureCocktail({
      cocktail: drink,
      action: "dislike",
    });

    if (response?.ok) {
      dislikedSignatureIds.add(drink.id);
      dislikeButton.textContent = "Не сохраняем";
      dislikeButton.disabled = true;
      likeButton.disabled = true;
    }
  });

  actions.append(likeButton, dislikeButton);
  return actions;
}

function pushBotMessage(text) {
  state.messages.push({ role: "bot", text });
  renderMessages();
}

function showChat() {
  chatSection?.classList.remove("is-hidden");
}

function showResults() {
  resultsSection?.classList.remove("is-hidden");
  resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideResults() {
  resultsSection?.classList.add("is-hidden");
}

function openRecipeModal(drink) {
  const ingredients = Array.isArray(drink.ingredients) && drink.ingredients.length
    ? drink.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Состав уточняется.</li>";
  const method = Array.isArray(drink.method) && drink.method.length
    ? drink.method.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Собери ингредиенты, охлади бокал и приготовь коктейль по классической схеме.</li>";

  recipeContent.innerHTML = `
    <div class="recipe-sheet__header">
      <div>
        <p class="recipe-sheet__eyebrow">${escapeHtml(drink.source === "ai" ? "Авторский рецепт" : "Рецепт из базы")}</p>
        <h3 id="recipe-title">${escapeHtml(drink.name)}</h3>
      </div>
      <p class="recipe-sheet__meta">Крепость: ${escapeHtml(drink.abv || "уточняется")} · Бокал: ${escapeHtml(drink.glass || "на выбор бармена")}</p>
    </div>
    <p class="recipe-sheet__description">${escapeHtml(drink.description || "Описание уточняется.")}</p>
    <section class="recipe-sheet__section">
      <h4>Состав</h4>
      <ul>${ingredients}</ul>
    </section>
    <section class="recipe-sheet__section">
      <h4>Как приготовить</h4>
      <ol>${method}</ol>
    </section>
  `;

  recipeModal?.classList.remove("is-hidden");
  recipeModal?.classList.add("is-active");
  recipeModal?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeRecipeModal() {
  recipeModal?.classList.remove("is-active");
  recipeModal?.classList.add("is-hidden");
  recipeModal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dedupeList(list) {
  return [...new Set(list.map((item) => String(item).toLowerCase()))];
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    pushBotMessage("PWA-режим не зарегистрировался, но само приложение все равно работает.");
  }
}
