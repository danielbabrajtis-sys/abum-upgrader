
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const tg = window.Telegram?.WebApp;
  const API_URL = "https://abum-upgrader-api.danielbabrajtis.workers.dev";

  const greeting = $("#greeting");
  const status = $("#status");
  const inventory = $("#inventory");
  const count = $("#item-count");
  const sourceSelect = $("#item");
  const targetSelect = $("#target");
  const upgrade = $("#upgrade");
  const result = $("#result");
  const chanceText = $("#chance");

  let gifts = [];
  let inventoryItems = [];
  let busy = false;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setResult(message) {
    if (result) result.textContent = message;
  }

  function showEmpty(message) {
    if (!inventory) return;
    inventory.replaceChildren();

    const element = document.createElement("div");
    element.className = "empty";
    element.textContent = message;
    inventory.appendChild(element);
  }

  function showError(message) {
    setStatus(`Ошибка: ${message}`);
    setResult("Апгрейд временно недоступен.");
    console.error("ABUM Upgrader:", message);
  }

  // Проверяем, что все нужные элементы существуют в HTML.
  if (
    !greeting || !status || !inventory || !count ||
    !sourceSelect || !targetSelect || !upgrade ||
    !result || !chanceText
  ) {
    console.error("ABUM Upgrader: не найдены элементы HTML.");
    setStatus("Ошибка интерфейса. Проверь index.html.");
    return;
  }

  setStatus("Скрипт запущен. Проверяем подключение к Telegram…");

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const user = tg?.initDataUnsafe?.user;
  greeting.textContent = user?.first_name
    ? `Привет, ${user.first_name}!`
    : "Добро пожаловать!";

  sourceSelect.disabled = true;
  targetSelect.disabled = true;
  upgrade.disabled = true;

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": tg?.initData || ""
    };
  }

  async function api(path, options = {}) {
    let response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...authHeaders(),
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error(
        "Нет соединения с API. Проверь адрес сервера и настройки доступа."
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(`Сервер вернул некорректный ответ. HTTP ${response.status}.`);
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `Ошибка сервера HTTP ${response.status}.`);
    }

    return data;
  }

  function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function getGift(code) {
    return gifts.find(gift => gift.code === code);
  }

  function getInventoryItem(code) {
    return inventoryItems.find(item => item.gift_code === code);
  }

  function calculateChance(source, target) {
    const sourceValue = Number(source?.value);
    const targetValue = Number(target?.value);

    if (
      !Number.isFinite(sourceValue) ||
      !Number.isFinite(targetValue) ||
      sourceValue <= 0 ||
      targetValue <= sourceValue
    ) {
      return 0;
    }

    return Math.max(1, Math.min(70, sourceValue / targetValue * 70));
  }

  function updateChance() {
    const source = getGift(sourceSelect.value);
    const target = getGift(targetSelect.value);
    const owned = getInventoryItem(sourceSelect.value);

    const valid = Boolean(
      source &&
      target &&
      owned &&
      Number(owned.quantity) > 0 &&
      Number(target.value) > Number(source.value)
    );

    chanceText.textContent = valid
      ? `Предварительный шанс: ${calculateChance(source, target).toFixed(2)}%`
      : "Выбери исходный подарок и более дорогой целевой подарок.";

    upgrade.disabled = !valid || busy;
  }

  function renderInventory() {
    inventory.replaceChildren();

    const total = inventoryItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
      0
    );

    count.textContent = `${total} предметов`;

    if (inventoryItems.length === 0) {
      showEmpty("Инвентарь пуст. Подарки пока не добавлены.");
      return;
    }

    for (const item of inventoryItems) {
      const card = document.createElement("div");
      card.className = "item";

      const name = document.createElement("strong");
      name.textContent = item.name || item.gift_code || "Подарок";

      const quantity = document.createElement("small");
      quantity.textContent = `Количество: ${item.quantity}`;

      card.append(name, quantity);

      if (item.value != null) {
        const value = document.createElement("small");
        value.textContent = `Стоимость: ${item.value}`;
        card.appendChild(value);
      }

      inventory.appendChild(card);
    }
  }

  function renderSelects() {
    sourceSelect.replaceChildren();
    targetSelect.replaceChildren();

    addOption(sourceSelect, "", "Выбери исходный подарок");
    addOption(targetSelect, "", "Выбери целевой подарок");

    for (const item of inventoryItems) {
      if (Number(item.quantity) <= 0) continue;

      const gift = getGift(item.gift_code);
      if (!gift) continue;

      addOption(
        sourceSelect,
        gift.code,
        `${gift.name} × ${item.quantity}`
      );
    }

    for (const gift of gifts) {
      addOption(
        targetSelect,
        gift.code,
        `${gift.name} · ${gift.value} · ${gift.rarity}`
      );
    }

    sourceSelect.disabled = false;
    targetSelect.disabled = false;
    updateChance();
  }

  async function load() {
    if (!tg?.initData) {
      showEmpty("Открой Mini App через кнопку в Telegram.");
      count.textContent = "0 предметов";
      setStatus(
        "Telegram не передал данные авторизации. Открой приложение через бота."
      );
      return;
    }

    setStatus("Подключаемся к серверу…");

    try {
      const giftsData = await api("/api/gifts");

      if (!Array.isArray(giftsData.gifts)) {
        throw new Error("Сервер не вернул каталог подарков.");
      }

      gifts = giftsData.gifts;
      setStatus("Каталог загружен. Получаем инвентарь…");

      const inventoryData = await api("/api/inventory");

      if (!Array.isArray(inventoryData.inventory)) {
        throw new Error("Сервер не вернул список инвентаря.");
      }

      inventoryItems = inventoryData.inventory;
      renderInventory();
      renderSelects();

      setStatus("Каталог и инвентарь загружены.");
      setResult(
        inventoryItems.length
          ? "Выбери исходный и целевой подарки."
          : "Инвентарь пуст. Сначала добавь тестовый подарок."
      );
    } catch (error) {
      console.error("Ошибка загрузки ABUM Upgrader:", error);
      showError(error?.message || "Неизвестная ошибка загрузки.");
      showEmpty("Не удалось загрузить инвентарь.");
      count.textContent = "0 предметов";
      sourceSelect.disabled = true;
      targetSelect.disabled = true;
      upgrade.disabled = true;
    }
  }

  sourceSelect.addEventListener("change", updateChance);
  targetSelect.addEventListener("change", updateChance);

  upgrade.addEventListener("click", async () => {
    if (busy) return;

    const source = sourceSelect.value;
    const target = targetSelect.value;

    if (!source || !target) {
      setResult("Выбери оба подарка.");
      return;
    }

    const sourceGift = getGift(source);
    const targetGift = getGift(target);

    if (
      !sourceGift ||
      !targetGift ||
      Number(targetGift.value) <= Number(sourceGift.value)
    ) {
      setResult("Целевой подарок должен быть дороже исходного.");
      return;
    }

    if (!tg?.initData) {
      setResult("Открой приложение через Telegram.");
      return;
    }

    busy = true;
    upgrade.disabled = true;
    sourceSelect.disabled = true;
    targetSelect.disabled = true;
    setResult("Отправляем запрос серверу…");

    try {
      const data = await api("/api/upgrade", {
        method: "POST",
        body: JSON.stringify({ source, target })
      });

      setResult(
        data.message ||
        `Ответ получен. Шанс: ${data.chance ?? "не указан"}%.`
      );

      const updated = await api("/api/inventory");
      inventoryItems = Array.isArray(updated.inventory)
        ? updated.inventory
        : [];

      renderInventory();
      renderSelects();

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(
          data.success ? "success" : "error"
        );
      }
    } catch (error) {
      setResult(error?.message || "Не удалось выполнить запрос.");
    } finally {
      busy = false;
      sourceSelect.disabled = false;
      targetSelect.disabled = false;
      updateChance();
    }
  });

  load();
})();
