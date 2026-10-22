
(() => {
  const tg = window.Telegram?.WebApp;
  const greeting = document.querySelector("#greeting");
  const status = document.querySelector("#status");
  const inventory = document.querySelector("#inventory");
  const count = document.querySelector("#item-count");
  const select = document.querySelector("#item");
  const upgrade = document.querySelector("#upgrade");
  const result = document.querySelector("#result");

  const API_URL = "https://abum-upgrader-api.danielbabrajtis.workers.dev";

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const name = tg?.initDataUnsafe?.user?.first_name;
  greeting.textContent = name ? `Привет, ${name}!` : "Добро пожаловать!";

  select.disabled = true;
  upgrade.disabled = true;

  function showError(message) {
    status.textContent = message;
    inventory.innerHTML = '<div class="empty">Не удалось загрузить инвентарь.</div>';
    count.textContent = "0 предметов";
    select.innerHTML = "<option>Инвентарь недоступен</option>";
  }

  async function loadInventory() {
    if (!tg || !tg.initData) {
      showError("Открой приложение через Telegram, чтобы загрузить инвентарь.");
      return;
    }

    status.textContent = "Загружаем инвентарь…";

    try {
      const response = await fetch(`${API_URL}/api/inventory`, {
        method: "GET",
        headers: {
          "X-Telegram-Init-Data": tg.initData
        }
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Ошибка сервера");
      }

      const items = data.inventory || [];
      const total = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      count.textContent = `${total} предметов`;

      if (!items.length) {
        inventory.innerHTML =
          '<div class="empty">Инвентарь пока пуст.</div>';
      } else {
        inventory.replaceChildren();

        for (const item of items) {
          const card = document.createElement("div");
          card.className = "inventory-item";

          const title = document.createElement("div");
          title.textContent = item.gift_code;

          const quantity = document.createElement("div");
          quantity.textContent = `Количество: ${item.quantity}`;

          card.append(title, quantity);
          inventory.appendChild(card);
        }
      }

      select.replaceChildren();

      if (items.length) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Выбери предмет";
        select.appendChild(placeholder);

        for (const item of items) {
          if (Number(item.quantity) <= 0) continue;

          const option = document.createElement("option");
          option.value = item.gift_code;
          option.textContent = `${item.gift_code} × ${item.quantity}`;
          select.appendChild(option);
        }
      } else {
        select.innerHTML = "<option>Инвентарь пуст</option>";
      }

      status.textContent = "Инвентарь успешно загружен.";
      result.textContent =
        "Апгрейд пока отключён. Следующим шагом подключим механику обмена.";
    } catch (error) {
      console.error(error);
      showError(
        error.message === "Failed to fetch"
          ? "Не удалось связаться с сервером. Проверь настройки API."
          : error.message || "Ошибка загрузки инвентаря."
      );
    }
  }

  loadInventory();
})();
