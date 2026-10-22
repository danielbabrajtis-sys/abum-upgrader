```javascript
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const tg = window.Telegram?.WebApp;

  const API_URL =
    "https://abum-upgrader-api.danielbabrajtis.workers.dev";

  const greeting = $("#greeting");
  const status = $("#status");
  const inventory = $("#inventory");
  const count = $("#item-count");
  const sourceSelect = $("#item");
  const targetSelect = $("#target");
  const upgrade = $("#upgrade");
  const result = $("#result");
  const chanceText = $("#chance");

  let inventoryItems = [];
  let gifts = [];
  let busy = false;
  let loaded = false;

  if (
    !greeting || !status || !inventory || !count ||
    !sourceSelect || !targetSelect || !upgrade ||
    !result || !chanceText
  ) {
    console.error("ABUM Upgrader: не найдены элементы HTML.");
    return;
  }

  if (tg) {
    tg.ready();
    tg.expand();
  }

  greeting.textContent = tg?.initDataUnsafe?.user?.first_name
    ? `Привет, ${tg.initDataUnsafe.user.first_name}!`
    : "Добро пожаловать!";

  sourceSelect.disabled = true;
  targetSelect.disabled = true;
  upgrade.disabled = true;

  function showStatus(message) {
    status.textContent = message;
  }

  function showEmpty(message) {
    inventory.replaceChildren();

    const element = document.createElement("div");
    element.className = "empty";
    element.textContent = message;

    inventory.appendChild(element);
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": tg?.initData || ""
    };
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...authHeaders(),
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Некорректный ответ сервера (${response.status}).`
        );
      }

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error || `Ошибка сервера: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Сервер не ответил за 10 секунд. Попробуй перезагрузить приложение."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Не удалось соединиться с сервером. Проверь интернет и настройки API."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function setOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function findInventory(code) {
    return inventoryItems.find(item => item.gift_code === code);
  }

  function findGift(code) {
    return gifts.find(gift => gift.code === code);
  }

  function estimateChance(source, target) {
    if (!source || !target) return 0;

    const sourceValue = Number(source.value);
    const targetValue = Number(target.value);

    if (
      !Number.isFinite(sourceValue) ||
      !Number.isFinite(targetValue) ||
      sourceValue <= 0 ||
      targetValue <= sourceValue
    ) {
      return 0;
    }

    return Math.max(
      1,
      Math.min(70, (sourceValue / targetValue) * 70)
    );
  }

  function updateChance() {
    const source = findGift(sourceSelect.value);
    const target = findGift(targetSelect.value);
    const item = findInventory(sourceSelect.value);

    const valid = Boolean(
      loaded &&
      item &&
      Number(item.quantity) > 0 &&
      source &&
      target &&
      Number(target.value) > Number(source.value)
    );

    if (valid) {
      chanceText.textContent =
        `Шанс успеха: ${estimateChance(source, target).toFixed(2)}%`;
    } else {
      chanceText.textContent =
        "Выбери исходный и более дорогой подарок.";
    }

    upgrade.disabled = !valid || busy;
  }

  function renderInventory() {
    inventory.replaceChildren();

    const total = inventoryItems.reduce(
      (sum, item) =>
        sum + Math.max(0, Number(item.quantity) || 0),
      0
    );

    count.textContent = `${total} предметов`;

    if (!inventoryItems.length) {
      showEmpty("Инвентарь пока пуст.");
      return;
    }

    for (const item of inventoryItems) {
      const card = document.createElement("div");
      card.className = "item";

      const title = document.createElement("strong");
      title.textContent = item.name || item.gift_code;

      const quantity = document.createElement("small");
      quantity.textContent = `Количество: ${item.quantity}`;

      card.append(title, quantity);

      if (item.value != null) {
        const value = document.createElement("small");
        value.textContent = ` · Стоимость: ${item.value}`;
        card.appendChild(value);
      }

      inventory.appendChild(card);
    }
  }

  function renderSelects() {
    sourceSelect.replaceChildren();
    targetSelect.replaceChildren();

    setOption(sourceSelect, "", "Выбери исходный подарок");
    setOption(targetSelect, "", "Выбери целевой подарок");

    for (const item of inventoryItems) {
      if (Number(item.quantity) <= 0) continue;

      const gift = findGift(item.gift_code);
      if (!gift) continue;

      setOption(
        sourceSelect,
        gift.code,
        `${gift.name} × ${item.quantity}`
      );
    }

    for (const gift of gifts) {
      setOption(
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
    loaded = false;
    sourceSelect.disabled = true;
    targetSelect.disabled = true;
    upgrade.disabled = true;

    if (!tg?.initData) {
      showStatus("Открой приложение через кнопку в Telegram.");
      showEmpty("Не удалось получить данные Telegram.");
      count.textContent = "0 предметов";
      return;
    }

    showStatus("Загружаем каталог подарков…");
    result.textContent = "Подключаемся к серверу…";

    try {
      const giftsData = await api("/api/gifts");

      if (!Array.isArray(giftsData.gifts)) {
        throw new Error("Сервер вернул неверный каталог подарков.");
      }

      gifts = giftsData.gifts;
      showStatus("Каталог загружен. Загружаем инвентарь…");

      const inventoryData = await api("/api/inventory");

      if (!Array.isArray(inventoryData.inventory)) {
        throw new Error("Сервер вернул неверный инвентарь.");
      }

      inventoryItems = inventoryData.inventory;

      renderInventory();
      loaded = true;
      renderSelects();

      showStatus("Каталог и инвентарь загружены.");
      result.textContent = inventoryItems.length
        ? "Выбери исходный и целевой подарки."
        : "Инвентарь пуст. Сначала добавь тестовый подарок.";
    } catch (error) {
      console.error("ABUM Upgrader load error:", error);

      showStatus(`Ошибка загрузки: ${error.message}`);
      showEmpty("Не удалось загрузить инвентарь.");
      count.textContent = "0 предметов";

      loaded = false;
      sourceSelect.disabled = true;
      targetSelect.disabled = true;
      upgrade.disabled = true;

      result.textContent = "Апгрейды временно недоступны.";
    }
  }

  sourceSelect.addEventListener("change", updateChance);
  targetSelect.addEventListener("change", updateChance);

  upgrade.addEventListener("click", async () => {
    if (busy || !loaded) return;

    const source = sourceSelect.value;
    const target = targetSelect.value;

    if (!source || !target) {
      result.textContent = "Выбери оба подарка.";
      return;
    }

    const sourceGift = findGift(source);
    const targetGift = findGift(target);
    const owned = findInventory(source);

    if (
      !owned ||
      Number(owned.quantity) < 1 ||
      !sourceGift ||
      !targetGift ||
      Number(targetGift.value) <= Number(sourceGift.value)
    ) {
      result.textContent =
        "Выбор некорректен. Обнови инвентарь и попробуй снова.";
      return;
    }

    if (!tg?.initData) {
      result.textContent = "Открой приложение через Telegram.";
      return;
    }

    busy = true;
    upgrade.disabled = true;
    sourceSelect.disabled = true;
    targetSelect.disabled = true;
    result.textContent = "Выполняем апгрейд…";

    try {
      const data = await api("/api/upgrade", {
        method: "POST",
        body: JSON.stringify({ source, target })
      });

      result.textContent =
        `${data.message} Шанс: ${Number(data.chance).toFixed(2)}%.`;

      const inventoryData = await api("/api/inventory");

      if (!Array.isArray(inventoryData.inventory)) {
        throw new Error("Апгрейд выполнен, но инвентарь не обновился.");
      }

      inventoryItems = inventoryData.inventory;
      renderInventory();
      renderSelects();

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(
          data.success ? "success" : "error"
        );
      }
    } catch (error) {
      console.error("ABUM Upgrader upgrade error:", error);
      result.textContent = error.message || "Ошибка апгрейда.";
    } finally {
      busy = false;

      sourceSelect.disabled = !loaded;
      targetSelect.disabled = !loaded;

      updateChance();
    }
  });

  load();
})();
```
