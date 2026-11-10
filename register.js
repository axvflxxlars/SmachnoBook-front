// Авторизований користувач не повинен бачити сторінку реєстрації
if (!redirectIfLoggedIn()) {
  renderHeader();

  const form = document.getElementById("register-form");
  const formError = document.getElementById("form-error");

  document.getElementById("login-link").href = `login.html${location.search}`;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    const data = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
      });
      const body = await response.json();

      showFieldErrors(form, body.details);
      if (!response.ok) {
        formError.textContent = body.error;
        return;
      }

      // Після успішної реєстрації одразу входимо з тими самими даними
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password
        }),
      });
      if (!loginResponse.ok) {
        location.replace(`login.html${location.search}`);
        return;
      }

      saveLogin(await loginResponse.json());
      location.replace(nextPage());
    } catch (error) {
      formError.textContent = "Сервер недоступний. Перевірте, чи запущений бекенд.";
    }
  });
}