
(() => {
  "use strict";

  const tg = window.Telegram?.WebApp;
  const $ = (selector) => document.querySelector(selector);

  const greeting = $("#greeting");
  const status = $("#status");
  const inventory = $("#inventory");
  const count = $("#item-count");
  const sourceSelect = $("#item");
  const targetSelect = $("#target");
  const upgrade = $("#upgrade");
  const result = $("#result");
  const chanceText = $("#chance");

  const API_URL = "https://abum-upgrader-api.danielbabrajtis.workers.dev";

  let inventoryItems = [];
  let gifts = [];
  let busy = false;

  if (!greeting || !status || !inventory || !count ||
      !sourceSelect || !targetSelect || !upgrade ||
      !result || !chanceText) {
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
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = message;
    inventory.appendChild(empty);
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": tg?.initData || ""
    };
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Сервер вернул некорректный ответ (${response.status}).`);
    }

    if (!response.ok || data.ok === false) {
      throw new Error(
        data.error || `Ошибка сервера: ${response.status}`
      );
    }

    return data;
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
    const sourceCode = sourceSelect.value;
    const targetCode = targetSelect.value;
    const source = findGift(sourceCode);
    const target = findGift(targetCode);
    const item = findInventory(sourceCode);

    const valid = Boolean(
      item &&
      Number(item.quantity) > 0 &&
      source &&
      target &&
      Number(target.value) > Number(source.value)
    );

    if (valid) {
      const chance = estimateChance(source, target);
      chanceText.textContent = `Шанс успеха: ${chance.toFixed(2)}%`;
    } else {
      chanceText.textContent =
        "Шанс появится после выбора исходного и более дорогого подарка.";
    }

    upgrade.disabled = !valid || busy;
  }

  function renderInventory() {
    inventory.replaceChildren();

    const total = inventoryItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
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
    if (!tg?.initData) {
      showStatus("Открой приложение через кнопку в Telegram.");
      showEmpty("Не удалось получить данные Telegram.");
      count.textContent = "0 предметов";
      return;
    }

    sourceSelect.disabled = true;
    targetSelect.disabled = true;
    upgrade.disabled = true;

    showStatus("Загружаем каталог подарков…");

    try {
      const giftsData = await api("/api/gifts");
      gifts = Array.isArray(giftsData.gifts)
        ? giftsData.gifts
        : [];

      showStatus("Каталог загружен. Загружаем инвентарь…");

      const inventoryData = await api("/api/inventory");
      inventoryItems = Array.isArray(inventoryData.inventory)
        ? inventoryData.inventory
        : [];

      renderInventory();
      renderSelects();

      showStatus("Каталог и инвентарь загружены.");
      result.textContent = inventoryItems.length
        ? "Выбери исходный и целевой подарки."
        : "Инвентарь пуст. Сначала добавь тестовый подарок.";
    } catch (error) {
      console.error("ABUM Upgrader load error:", error);

      showStatus(`Ошибка загрузки: ${error.message || "неизвестная ошибка"}`);
      showEmpty("Не удалось загрузить инвентарь.");
      count.textContent = "0 предметов";

      sourceSelect.disabled = true;
      targetSelect.disabled = true;
      upgrade.disabled = true;
      result.textContent = "Апгрейды отключены до устранения ошибки.";
    }
  }

  sourceSelect.addEventListener("change", updateChance);
  targetSelect.addEventListener("change", updateChance);

  upgrade.addEventListener("click", async () => {
    if (busy) return;

    const source = sourceSelect.value;
    const target = targetSelect.value;

    if (!source || !target) {
      result.textContent = "Выбери оба подарка.";
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
    result.textContent = "Проверяем данные и выполняем апгрейд…";

    try {
      const data = await api("/api/upgrade", {
        method: "POST",
        body: JSON.stringify({ source, target })
      });

      result.textContent =
        `${data.message} Шанс: ${Number(data.chance).toFixed(2)}%.`;

      const inventoryData = await api("/api/inventory");
      inventoryItems = Array.isArray(inventoryData.inventory)
        ? inventoryData.inventory
        : [];

      renderInventory();
      renderSelects();

      if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(
          data.success ? "success" : "error"
        );
      }
    } catch (error) {
      console.error("ABUM Upgrader upgrade error:", error);
      result.textContent =
        error.message || "Не удалось выполнить апгрейд.";
    } finally {
      busy = false;
      sourceSelect.disabled = false;
      targetSelect.disabled = false;
      updateChance();
    }
  });

  load();
})();
