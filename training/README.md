# Qwen Bartender Training Kit

Набор файлов для постепенного дообучения `Qwen/Qwen3-4B-Instruct-2507` под роль бармена для AiBar.

## Что внутри

- `data/source_dialogues.json`
  Редактируемый seed-датасет с многошаговыми диалогами.
- `scripts/export_unsloth_dataset.py`
  Проверяет диалоги и экспортирует JSONL для SFT.
- `finetune_qwen_bartender.py`
  Стартовый LoRA-скрипт для Unsloth.
- `requirements.txt`
  Минимальные зависимости для локального запуска или Colab.

## Почему выбран Qwen

Для MVP обучения выбран `Qwen/Qwen3-4B-Instruct-2507`:

- достаточно компактный для постепенной итерации;
- хорош в multi-turn диалогах;
- поддерживает instruct-режим;
- есть прямая поддержка в Unsloth и понятный путь экспорта в `vLLM`.

Полезные источники:

- Unsloth Qwen3 fine-tuning:
  https://docs.unsloth.ai/models/qwen3-how-to-run-and-fine-tune
- Unsloth chat templates:
  https://docs.unsloth.ai/basics/chat-templates
- Unsloth export to vLLM:
  https://docs.unsloth.ai/basics/saving-and-using-models/saving-to-vllm
- Qwen3-4B model card:
  https://huggingface.co/Qwen/Qwen3-4B
- Qwen3-4B-Instruct-2507 model card:
  https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507

## Принцип обучения

Мы не пытаемся сразу научить модель “всему барному делу”. Сначала учим ее:

1. общаться коротко и естественно;
2. задавать максимум 3 уточняющих вопроса;
3. в финале возвращать понятный текст + структурированный JSON;
4. придумывать один авторский коктейль в том же ответе.

Базовые коктейли при этом можно по-прежнему держать на стороне приложения, а модель учить на:

- тоне общения;
- логике вопросов;
- стиле авторского коктейля;
- формате финального ответа.

## Формат финального ответа в датасете

Финальный ответ бармена в seed-датасете устроен так:

1. 1-2 короткие фразы естественным языком;
2. строка `JSON:`;
3. JSON-объект.

Этот формат удобен, потому что:

- человек видит живой ответ;
- backend потом может выделять JSON и парсить его.

## Как расширять датасет

Каждый новый пример добавляй в `data/source_dialogues.json`.

Хорошие примеры должны покрывать:

- алкогольные и безалкогольные сценарии;
- спокойный, праздничный, уютный, яркий вечер;
- цитрус, горечь, мяту, ягоды, сладость, сухой профиль;
- разные стили авторских коктейлей.

## Экспорт датасета

```powershell
python .\training\scripts\export_unsloth_dataset.py
```

Скрипт создаст:

`training\data\bartender_unsloth.jsonl`

## Запуск обучения

Локально или в Colab:

```powershell
python .\training\finetune_qwen_bartender.py ^
  --dataset .\training\data\bartender_unsloth.jsonl ^
  --output-dir .\artifacts\qwen-bartender-lora
```

## Что делать после первой успешной тренировки

1. Прогнать локальные тестовые промпты.
2. Посмотреть, не задает ли модель больше 3 вопросов.
3. Проверить, насколько стабилен JSON в финале.
4. После этого уже экспортировать под `vLLM` и подключать к сайту.

## Рекомендуемый поэтапный путь

1. Seed SFT на 10-30 хороших диалогах.
2. Тест.
3. Добавить еще 50-150 реальных примеров.
4. Повторить SFT.
5. Только потом думать про RL / preference optimization.
