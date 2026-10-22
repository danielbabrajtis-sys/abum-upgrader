
(() => {
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

  function headers() {
    return {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": tg?.initData || ""
    };
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers(), ...(options.headers || {}) }
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Ошибка сервера");
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
    if (!source || !target || Number(target.value) <= Number(source.value)) {
      return 0;
    }

    return Math.max(
      1,
      Math.min(70, Number(source.value) / Number(target.value) * 70)
    );
  }

  function updateChance() {
    const source = findGift(sourceSelect.value);
    const target = findGift(targetSelect.value);
    const item = findInventory(sourceSelect.value);

    const chance = estimateChance(source, target);
    const valid = Boolean(
      item &&
      Number(item.quantity) > 0 &&
      source &&
      target &&
      target.value > source.value
    );

    chanceText.textContent = valid
      ? `Шанс успеха: ${chance.toFixed(2)}%`
      : "Шанс: выбери исходный и более дорогой подарок";

    upgrade.disabled = !valid || busy;
  }

  function renderInventory() {
    inventory.replaceChildren();

    const total = inventoryItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0), 0
    );

    count.textContent = `${total} предметов`;

    if (!inventoryItems.length) {
      inventory.innerHTML =
        '<div class="empty">Инвентарь пока пуст.</div>';
      return;
    }

    for (const item of inventoryItems) {
      const card = document.createElement("div");
      card.className = "inventory-item";

      const title = document.createElement("div");
      title.textContent = item.name || item.gift_code;

      const quantity = document.createElement("div");
      quantity.textContent = `Количество: ${item.quantity}`;

      const value = document.createElement("div");
      value.textContent = item.value != null
        ? `Стоимость: ${item.value}`
        : "";

      card.append(title, quantity, value);
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
      status.textContent =
        "Открой приложение через Telegram, чтобы загрузить данные.";
      inventory.innerHTML =
        '<div class="empty">Ожидается запуск из Telegram.</div>';
      return;
    }

    status.textContent = "Загружаем инвентарь и каталог…";

    try {
      const [inventoryData, giftsData] = await Promise.all([
        api("/api/inventory"),
        api("/api/gifts")
      ]);

      inventoryItems = inventoryData.inventory || [];
      gifts = giftsData.gifts || [];

      renderInventory();
      renderSelects();

      status.textContent = "Инвентарь и каталог загружены.";
      result.textContent = "Выбери подарок и цель улучшения.";
    } catch (error) {
      console.error(error);
      status.textContent = error.message;
    }
  }

  sourceSelect.addEventListener("change", updateChance);
  targetSelect.addEventListener("change", updateChance);

  upgrade.addEventListener("click", async () => {
    if (busy) return;

    const source = sourceSelect.value;
    const target = targetSelect.value;

    if (!source || !target) {
      result.textContent = "Сначала выбери оба подарка.";
      return;
    }

    if (!tg?.initData) {
      result.textContent = "Открой приложение через Telegram.";
      return;
    }

    busy = true;
    upgrade.disabled = true;
    result.textContent = "Выполняем апгрейд…";

    try {
      const data = await api("/api/upgrade", {
        method: "POST",
        body: JSON.stringify({ source, target })
      });

      result.textContent =
        `${data.message} Шанс: ${Number(data.chance).toFixed(2)}%.`;

      const inventoryData = await api("/api/inventory");
      inventoryItems = inventoryData.inventory || [];

      renderInventory();
      renderSelects();

      if (data.success && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
      } else if (!data.success && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("error");
      }
    } catch (error) {
      console.error(error);
      result.textContent = error.message || "Не удалось выполнить апгрейд.";
    } finally {
      busy = false;
      updateChance();
    }
  });

  load();
})();
