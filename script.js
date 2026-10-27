const API_URL = "http://127.0.0.1:8000/api/v1";

const DIFFICULTY = {
  easy: "легко",
  medium: "середньо",
  hard: "складно",
};

const searchInput = document.getElementById("search");
const statusElement = document.getElementById("status");
const recipesList = document.getElementById("recipes");

function setStatus(text, isError = false) {
  statusElement.textContent = text;
  statusElement.classList.toggle("error", isError);
}

function createRecipeItem(recipe) {
  const item = document.createElement("li");
  item.className = "recipe";

  const title = document.createElement("h2");
  title.textContent = recipe.title;

  const info = document.createElement("p");
  info.textContent =
    `${recipe.category.name} · ${recipe.cooking_time} хв · ` +
    `${DIFFICULTY[recipe.difficulty]} · автор: ${recipe.author.name}`;

  item.append(title, info);
  return item;
}

async function loadRecipes(search = "") {
  setStatus("Завантаження...");
  recipesList.replaceChildren();

  const params = new URLSearchParams({ limit: "50" });
  if (search) {
    params.set("search", search);
  }

  try {
    const response = await fetch(`${API_URL}/recipes?${params}`);
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error || "Не вдалося отримати рецепти.", true);
      return;
    }

    if (body.data.length === 0) {
      setStatus("Рецептів не знайдено.");
      return;
    }

    setStatus(`Знайдено рецептів: ${body.total}`);
    recipesList.append(...body.data.map(createRecipeItem));
  } catch (error) {
    setStatus("Сервер недоступний. Перевірте, чи запущений бекенд.", true);
  }
}

searchInput.addEventListener("input", () => {
  loadRecipes(searchInput.value.trim());
});

loadRecipes();
