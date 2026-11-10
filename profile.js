// Сторінка лише для авторизованих користувачів

const statusElement = document.getElementById("status");
const content = document.getElementById("content");
const recipeForm = document.getElementById("recipe-form");
const recipeMessage = document.getElementById("recipe-message");
const categorySelect = document.getElementById("category-select");
const ingredientRows = document.getElementById("ingredient-rows");
const myRecipes = document.getElementById("my-recipes");
const myStatus = document.getElementById("my-status");

let ingredients = [];
let currentUser = null;

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function fillSelect(select, items, placeholder) {
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.replaceChildren(empty);
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.append(option);
  }
}

// ---------- Інгредієнти у формі рецепта ----------

function addIngredientRow() {
  const row = document.createElement("div");
  row.className = "row ingredient-row";

  const select = document.createElement("select");
  select.className = "ingredient-id";
  fillSelect(select, ingredients, "Оберіть інгредієнт");

  const amount = document.createElement("input");
  amount.className = "ingredient-amount";
  amount.type = "number";
  amount.min = "0.01";
  amount.step = "0.01";
  amount.placeholder = "Кількість";

  const unit = document.createElement("input");
  unit.className = "ingredient-unit";
  unit.maxLength = 20;
  unit.placeholder = "г, шт, мл";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "✕";
  remove.title = "Прибрати";
  remove.addEventListener("click", () => row.remove());

  row.append(select, amount, unit, remove);
  ingredientRows.append(row);
}

function collectIngredients() {
  return [...ingredientRows.querySelectorAll(".ingredient-row")].map((row) => ({
    ingredient_id: Number(row.querySelector(".ingredient-id").value) || null,
    amount: row.querySelector(".ingredient-amount").value,
    unit: row.querySelector(".ingredient-unit").value.trim(),
  }));
}

// ---------- Завантаження даних ----------

async function loadOptions() {
  const [categoriesResponse, ingredientsResponse] = await Promise.all([
    apiFetch("/categories"),
    apiFetch("/ingredients?limit=100"),
  ]);
  fillSelect(categorySelect, categoriesResponse.body.data, "Оберіть категорію");
  ingredients = ingredientsResponse.body.data;
  ingredientRows.replaceChildren();
  addIngredientRow();
}

function createMyRecipeItem(recipe) {
  const item = document.createElement("li");
  item.className = "recipe";

  const title = document.createElement("h3");
  title.textContent = recipe.title;

  const info = document.createElement("p");
  info.textContent = `${recipe.category.name} · ${recipe.cooking_time} хв`;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "Видалити";
  deleteButton.addEventListener("click", async () => {
    if (!confirm(`Видалити рецепт «${recipe.title}»?`)) {
      return;
    }
    const {
      ok,
      status,
      body
    } = await apiFetch(`/recipes/${recipe.id}`, {
      method: "DELETE",
    });
    if (status === 401) {
      goToLogin();
      return;
    }
    if (!ok) {
      alert(body.error);
      return;
    }
    loadMyRecipes();
  });

  item.append(title, info, deleteButton);
  return item;
}

async function loadMyRecipes() {
  myRecipes.replaceChildren();
  const {
    ok,
    body
  } = await apiFetch(`/users/${currentUser.id}/recipes?limit=100`);
  if (!ok) {
    myStatus.textContent = body.error;
    return;
  }
  myStatus.textContent = body.total ? `Усього: ${body.total}` : "У вас ще немає рецептів.";
  myRecipes.append(...body.data.map(createMyRecipeItem));
}

async function loadPage() {
  try {
    // Перевіряємо токен на сервері й отримуємо актуальні дані користувача
    const {
      ok,
      status,
      body
    } = await apiFetch("/users/me");
    if (status === 401) {
      goToLogin();
      return;
    }
    if (!ok) {
      statusElement.textContent = body.error;
      return;
    }

    currentUser = body;
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    renderHeader();

    setText("profile-name", displayName(currentUser));
    setText("profile-username", currentUser.username);
    setText("profile-email", currentUser.email);
    setText("profile-role", currentUser.is_staff ? "Адміністратор" : "Користувач");
    document.getElementById("admin-section").hidden = !currentUser.is_staff;

    statusElement.hidden = true;
    content.hidden = false;

    await Promise.all([loadOptions(), loadMyRecipes()]);
  } catch (error) {
    statusElement.textContent = "Сервер недоступний. Перевірте, чи запущений бекенд.";
  }
}

// ---------- Обробники форм ----------

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  recipeMessage.textContent = "";
  recipeMessage.classList.remove("error");

  const data = Object.fromEntries(new FormData(recipeForm));
  const recipe = {
    ...data,
    cooking_time: Number(data.cooking_time) || null,
    servings: Number(data.servings) || null,
    category_id: Number(data.category_id) || null,
    ingredients: collectIngredients(),
  };

  const {
    ok,
    status,
    body
  } = await apiFetch("/recipes", {
    method: "POST",
    body: recipe,
  });
  if (status === 401) {
    goToLogin();
    return;
  }

  showFieldErrors(recipeForm, body && body.details);
  if (!ok) {
    recipeMessage.textContent = body.error;
    recipeMessage.classList.add("error");
    return;
  }

  recipeMessage.textContent = `Рецепт «${body.title}» додано.`;
  recipeForm.reset();
  ingredientRows.replaceChildren();
  addIngredientRow();
  loadMyRecipes();
});

document.getElementById("add-ingredient").addEventListener("click", addIngredientRow);

document.getElementById("category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const message = document.getElementById("category-message");
  const error = document.getElementById("category-error");
  message.textContent = "";
  error.textContent = "";

  const {
    ok,
    status,
    body
  } = await apiFetch("/categories", {
    method: "POST",
    body: {
      name: form.elements.name.value.trim()
    },
  });
  if (status === 401) {
    goToLogin();
    return;
  }
  if (!ok) {
    error.textContent = formatMessages(body.details ? body.details.name : body.error);
    return;
  }

  message.textContent = `Категорію «${body.name}» додано.`;
  form.reset();
  loadOptions();
});

// Неавторизованого користувача одразу перенаправляємо на логін
if (requireAuth()) {
  renderHeader();
  loadPage();
}