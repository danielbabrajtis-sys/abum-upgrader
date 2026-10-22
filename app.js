```javascript
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

  status.textContent = "Подключаемся к серверу…";

  const headers = () => ({
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": tg?.initData || ""
  });

  async function api(path) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: headers()
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Ошибка сервера: ${response.status}`);
    }

    return data;
  }

  async function load() {
    if (!tg?.initData) {
      status.textContent = "Открой приложение через кнопку в Telegram.";
      inventory.textContent = "Ожидаем запуск через Telegram.";
      return;
    }

    try {
      const catalog = await api("/api/gifts");
      const owned = await api("/api/inventory");

      if (!Array.isArray(catalog.gifts) ||
          !Array.isArray(owned.inventory)) {
        throw new Error("Сервер вернул неверный формат данных.");
      }

      const gifts = catalog.gifts;
      const items = owned.inventory;

      inventory.replaceChildren();
      let total = 0;

      for (const item of items) {
        total += Number(item.quantity) || 0;

        const card = document.createElement("div");
        card.className = "item";

        const name = document.createElement("strong");
        name.textContent = item.name || item.gift_code;

        const quantity = document.createElement("small");
        quantity.textContent = `Количество: ${item.quantity}`;

        card.append(name, quantity);
        inventory.append(card);
      }

      count.textContent = `${total} предметов`;

      if (!items.length) {
        inventory.textContent = "Инвентарь пока пуст.";
      }

      sourceSelect.replaceChildren();
      targetSelect.replaceChildren();

      sourceSelect.add(new Option("Выбери исходный подарок", ""));
      targetSelect.add(new Option("Выбери целевой подарок", ""));

      for (const item of items) {
        const gift = gifts.find(g => g.code === item.gift_code);
        if (gift && Number(item.quantity) > 0) {
          sourceSelect.add(new Option(
            `${gift.name} × ${item.quantity}`, gift.code
          ));
        }
      }

      for (const gift of gifts) {
        targetSelect.add(new Option(
          `${gift.name} · ${gift.value} · ${gift.rarity}`, gift.code
        ));
      }

      sourceSelect.disabled = false;
      targetSelect.disabled = false;
      status.textContent = "Каталог и инвентарь загружены.";
      result.textContent = "Выбери подарки для апгрейда.";
    } catch (error) {
      console.error("ABUM Upgrader:", error);
      status.textContent = `Ошибка загрузки: ${error.message}`;
      inventory.textContent = "Не удалось загрузить инвентарь.";
    }
  }

  load();
})();
```
