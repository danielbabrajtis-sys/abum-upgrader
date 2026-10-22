
(() => {
  const tg = window.Telegram?.WebApp;
  const greeting = document.querySelector("#greeting");
  const status = document.querySelector("#status");
  const inventory = document.querySelector("#inventory");
  const count = document.querySelector("#item-count");
  const select = document.querySelector("#item");
  const upgrade = document.querySelector("#upgrade");
  const result = document.querySelector("#result");

  if (tg) {
    tg.ready();
    tg.expand();

    const name = tg.initDataUnsafe?.user?.first_name;
    greeting.textContent = name
      ? `Привет, ${name}!`
      : "Добро пожаловать!";
  } else {
    greeting.textContent = "Добро пожаловать!";
  }

  // Пока сервер не подключён, используем безопасный
  // демонстрационный режим без реальных операций.
  status.textContent =
    "Интерфейс загружен. Сервер инвентаря ещё не подключён.";

  inventory.innerHTML =
    '<div class="empty">Инвентарь появится после подключения серверной части.</div>';

  count.textContent = "0 предметов";
  select.innerHTML = "<option>Сервер не подключён</option>";

  select.disabled = true;
  upgrade.disabled = true;

  upgrade.addEventListener("click", () => {
    result.textContent =
      "Апгрейд пока отключён: сначала подключите сервер и проверку Telegram.";
  });
})();
