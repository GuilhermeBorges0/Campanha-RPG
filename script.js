
/* ==========================================
   THE PARALLEL — E.L.B.E.R.R.
   SUPABASE CONFIGURATION
========================================== */

const SUPABASE_URL = "kmspdmjaygkjjdlulkmd";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-Do8npRRSIRSqyMxEIcwig_cuKWcF1X";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let authMode = "login";
let currentUser = null;
let characters = [];

/* ==========================================
   DOM HELPERS
========================================== */

const $ = (id) => document.getElementById(id);

const authView = $("auth-view");
const dashboardView = $("dashboard-view");
const authForm = $("auth-form");
const authMessage = $("auth-message");
const characterDialog = $("character-dialog");
const characterForm = $("character-form");

/* ==========================================
   CLOCK / FOOTER
========================================== */

$("year").textContent = new Date().getFullYear();

function updateClock() {
  $("clock").textContent = new Date().toLocaleTimeString(
    "pt-BR",
    { hour12: false }
  );
}

updateClock();
setInterval(updateClock, 1000);

/* ==========================================
   LOGIN / SIGNUP SWITCH
========================================== */

document.querySelectorAll(".tab").forEach((tab => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.auth;

    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("active", t === tab);
    });

    $("auth-submit").innerHTML =
      authMode === "login"
        ? 'AUTENTICAR <span>→</span>'
        : 'CRIAR CREDENCIAL <span>→</span>';

    $("password").autocomplete =
      authMode === "login"
        ? "current-password"
        : "new-password";

    authMessage.textContent = "";
  });
}));

/* ==========================================
   AUTHENTICATION
========================================== */

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  authMessage.textContent = "PROCESSANDO...";

  const email = $("email").value.trim();
  const password = $("password").value;

  let result;

  if (authMode === "login") {
    result = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
  } else {
    result = await supabaseClient.auth.signUp({
      email,
      password
    });
  }

  if (result.error) {
    authMessage.textContent = result.error.message;
    return;
  }

  // Cadastro com confirmação de email ativada
  if (authMode === "signup" && !result.data.session) {
    authMessage.textContent =
      "Cadastro iniciado. Verifique seu email para confirmar a conta.";
    return;
  }

  authMessage.textContent = "";

  if (result.data.user) {
    currentUser = result.data.user;
    await showDashboard();
  }
});

/* ==========================================
   LOGOUT
========================================== */

$("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();

  currentUser = null;
  characters = [];

  dashboardView.classList.add("hidden");
  authView.classList.remove("hidden");
});

/* ==========================================
   CHARACTER DIALOG
========================================== */

$("new-character-btn").addEventListener("click", () => {
  openCharacterDialog();
});

$("close-dialog").addEventListener("click", () => {
  characterDialog.close();
});

$("cancel-btn").addEventListener("click", () => {
  characterDialog.close();
});

/* ==========================================
   DASHBOARD
========================================== */

async function showDashboard() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");

  await loadCharacters();
}

/* ==========================================
   LOAD CHARACTERS
========================================== */

async function loadCharacters() {
  const { data, error } = await supabaseClient
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  characters = data || [];

  $("character-count").textContent =
    String(characters.length).padStart(2, "0");

  renderCharacters();
}

/* ==========================================
   RENDER CHARACTER CARDS
========================================== */

function renderCharacters() {
  const list = $("characters-list");

  list.innerHTML = "";

  $("empty-state").classList.toggle(
    "hidden",
    characters.length > 0
  );

  characters.forEach((c, index) => {
    const data = c.data || {};

    const role = data.role || "OCUPAÇÃO NÃO INFORMADA";
    const origin = data.origin || "ORIGEM NÃO INFORMADA";

    const card = document.createElement("article");
    card.className = "character-card";

    card.innerHTML = `
      <span class="card-id">
        FILE // ${String(index + 1).padStart(3, "0")}
      </span>

      <h4></h4>
      <p></p>
      <p></p>

      <div class="card-actions">
        <button data-action="edit">EDITAR</button>
        <button data-action="delete">EXCLUIR</button>
      </div>
    `;

    // Usamos textContent para evitar inserir texto do usuário como HTML
    card.querySelector("h4").textContent = c.name;

    const paragraphs = card.querySelectorAll("p");

    paragraphs[0].textContent = role;
    paragraphs[1].textContent = origin;

    card
      .querySelector('[data-action="edit"]')
      .addEventListener("click", () => {
        openCharacterDialog(c);
      });

    card
      .querySelector('[data-action="delete"]')
      .addEventListener("click", () => {
        deleteCharacter(c);
      });

    list.appendChild(card);
  });
}

/* ==========================================
   OPEN CHARACTER EDITOR
========================================== */

function openCharacterDialog(character = null) {
  $("character-message").textContent = "";

  $("dialog-title").textContent = character
    ? "EDITAR REGISTRO"
    : "NOVO PERSONAGEM";

  $("character-id").value = character?.id || "";
  $("character-name").value = character?.name || "";
  $("character-role").value = character?.data?.role || "";
  $("character-origin").value = character?.data?.origin || "";
  $("character-notes").value = character?.data?.notes || "";

  characterDialog.showModal();
}

/* ==========================================
   SAVE CHARACTER
========================================== */

characterForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("character-id").value;

  const payload = {
    owner_id: currentUser.id,
    name: $("character-name").value.trim(),

    data: {
      role: $("character-role").value.trim(),
      origin: $("character-origin").value.trim(),
      notes: $("character-notes").value.trim()
    },

    updated_at: new Date().toISOString()
  };

  let result;

  if (id) {
    // Atualizar personagem existente
    result = await supabaseClient
      .from("characters")
      .update(payload)
      .eq("id", id)
      .eq("owner_id", currentUser.id);
  } else {
    // Criar personagem novo
    result = await supabaseClient
      .from("characters")
      .insert(payload);
  }

  if (result.error) {
    $("character-message").textContent =
      result.error.message;
    return;
  }

  characterDialog.close();

  await loadCharacters();
});

/* ==========================================
   DELETE CHARACTER
========================================== */

async function deleteCharacter(character) {
  const confirmed = confirm(
    `Excluir permanentemente o registro "${character.name}"?`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("characters")
    .delete()
    .eq("id", character.id)
    .eq("owner_id", currentUser.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadCharacters();
}

/* ==========================================
   INITIALIZATION
========================================== */

async function init() {
  // Evita tentar conectar enquanto os dados não estiverem configurados
  if (
    SUPABASE_URL.startsWith("YOUR_") ||
    SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
  ) {
    authMessage.textContent =
      "Configure a URL e a publishable key do Supabase no arquivo script.js.";
    return;
  }

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    await showDashboard();
  }
}

init();
