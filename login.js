// Авторизований користувач не повинен бачити сторінку логіну
if (!redirectIfLoggedIn()) {
  renderHeader();

  const form = document.getElementById("login-form");
  const formError = document.getElementById("form-error");

  // Посилання на реєстрацію зберігає сторінку, куди треба повернутися
  document.getElementById("register-link").href = `register.html${location.search}`;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    const data = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
      });
      const body = await response.json();

      showFieldErrors(form, body.details);
      if (!response.ok) {
        formError.textContent = body.details ? "" : body.error;
        return;
      }

      saveLogin(body);
      // Повертаємо на сторінку, з якої користувача перенаправило на логін
      location.replace(nextPage());
    } catch (error) {
      formError.textContent = "Сервер недоступний. Перевірте, чи запущений бекенд.";
    }
  });
}