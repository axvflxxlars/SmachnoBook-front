// Спільний код для всіх сторінок: адреса API, зберігання токенів,
// запити з автоматичним оновленням access-токена і шапка сайту.

const API_URL = "http://127.0.0.1:8000/api/v1";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "user";

// ---------- Зберігання токенів ----------

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveLogin(data) {
  localStorage.setItem(ACCESS_KEY, data.access);
  localStorage.setItem(REFRESH_KEY, data.refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

// Logout: просто видаляємо все, що зберегли під час логіну
function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

// Вважаємо користувача авторизованим, поки в нього є refresh-токен.
// Якщо refresh уже прострочений, це з'ясується під час першого запиту.
function isLoggedIn() {
  return getRefreshToken() !== null;
}

function displayName(user) {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  return fullName || user.username;
}

// ---------- Перенаправлення ----------

// Поточна сторінка разом з параметрами, наприклад "profile.html?tab=1"
function currentPage() {
  const page = location.pathname.split("/").pop() || "index.html";
  return page + location.search;
}

function goToLogin() {
  location.href = `login.html?next=${encodeURIComponent(currentPage())}`;
}

// Сторінка, на яку треба повернутися після логіну. Дозволяємо лише
// сторінки нашого сайту, щоб через ?next= не можна було перекинути
// користувача на чужий сайт.
function nextPage() {
  const next = new URLSearchParams(location.search).get("next");
  if (next && /^[\w-]+\.html(\?.*)?$/.test(next)) {
    return next;
  }
  return "index.html";
}

// Викликається на сторінках лише для авторизованих
function requireAuth() {
  if (!isLoggedIn()) {
    goToLogin();
    return false;
  }
  return true;
}

// Викликається на сторінках логіну й реєстрації
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    location.replace(nextPage());
    return true;
  }
  return false;
}

// ---------- Запити до API ----------

let refreshPromise = null;

// Отримує новий access-токен за refresh-токеном.
// Якщо одночасно кілька запитів отримали 401, оновлюємо токен лише один раз.
function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refresh: getRefreshToken()
        }),
      })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }
        const body = await response.json();
        localStorage.setItem(ACCESS_KEY, body.access);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function buildRequest(options) {
  const headers = {
    ...(options.headers || {})
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
}

// Обгортка над fetch. Якщо сервер відповів 401 (access-токен прострочений),
// оновлює токен і повторює запит. Якщо оновити не вдалося, refresh-токен
// теж прострочений: виходимо з акаунта і повторюємо запит уже без токена
// (публічні сторінки так і працюватимуть далі, а захищені отримають 401
// і перенаправлять на логін). Повертає { ok, status, body }.
async function apiFetch(path, options = {}) {
  let response = await fetch(`${API_URL}${path}`, buildRequest(options));

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearAuth();
      renderHeader();
    }
    response = await fetch(`${API_URL}${path}`, buildRequest(options));
  }

  const body = response.status === 204 ? null : await response.json();
  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

// ---------- Форми ----------

// Перетворює повідомлення з details (рядок, список або вкладений об'єкт)
// на звичайний текст
function formatMessages(value) {
  if (Array.isArray(value)) {
    return value.map(formatMessages).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatMessages(item)}`)
      .join(" ");
  }
  return value ? String(value) : "";
}

// Показує під кожним полем помилку з details відповіді 400
function showFieldErrors(form, details) {
  form.querySelectorAll(".field-error").forEach((element) => {
    const messages = details && details[element.dataset.for];
    element.textContent = formatMessages(messages);
  });
}

// ---------- Шапка сайту ----------

function renderHeader() {
  const nav = document.getElementById("nav");
  nav.replaceChildren();

  // На сторінках логіну й реєстрації зберігаємо вже наявний ?next=
  const page = location.pathname.split("/").pop();
  const isAuthPage = page === "login.html" || page === "register.html";
  const next = encodeURIComponent(isAuthPage ? nextPage() : currentPage());

  const links = [
    ["index.html", "Рецепти"],
    ["profile.html", "Мій кабінет"],
  ];
  for (const [href, text] of links) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = text;
    nav.append(link);
  }

  const account = document.createElement("div");
  account.className = "account";

  if (isLoggedIn()) {
    const name = document.createElement("span");
    const user = getUser();
    name.className = "user-name";
    name.textContent = user ? displayName(user) : "";

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.textContent = "Вийти";
    logoutButton.addEventListener("click", () => {
      clearAuth();
      location.href = "index.html";
    });

    account.append(name, logoutButton);
  } else {
    const loginLink = document.createElement("a");
    loginLink.className = "button";
    loginLink.href = `login.html?next=${next}`;
    loginLink.textContent = "Увійти";

    const registerLink = document.createElement("a");
    registerLink.href = `register.html?next=${next}`;
    registerLink.textContent = "Реєстрація";

    account.append(registerLink, loginLink);
  }

  nav.append(account);
}