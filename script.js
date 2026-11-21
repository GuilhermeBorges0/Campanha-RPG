// ============================================
// NULL — INTERNAL TERMINAL
// SYSTEM CONFIGURATION
// ============================================

// COLOQUE SUAS CREDENCIAIS DO SUPABASE AQUI
const SUPABASE_URL = "https://kmspdmjaygkjjdlulkmd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-Do8npRRSIRSqyMxEIcwig_cuKWcF1X";

const isSupabaseConfigured =
  !SUPABASE_URL.startsWith("YOUR_") &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");

const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    )
  : null;


// ============================================
// SYSTEM STATE
// ============================================

let authMode = "login";
let currentUser = null;
let characters = [];


// ============================================
// DOM REFERENCES
// ============================================

const $ = (id) => document.getElementById(id);

const authView = $("auth-view");
const dashboardView = $("dashboard-view");

const authForm = $("auth-form");
const authMessage = $("auth-message");

const characterDialog = $("character-dialog");
const characterForm = $("character-form");


// ============================================
// SYSTEM CLOCK
// ============================================

$("year").textContent = new Date().getFullYear();

function updateClock() {
  $("clock").textContent = new Date().toLocaleTimeString(
    "pt-BR",
    { hour12: false }
  );
}

updateClock();
setInterval(updateClock, 1000);


// ============================================
// AUTHENTICATION TABS
// ============================================

document.querySelectorAll(".tab").forEach((tab => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.auth;

    document.querySelectorAll(".tab").forEach((t => {
      t.classList.toggle("active", t === tab);
    }));

    $("auth-submit").innerHTML =
      authMode === "login"
        ? 'VERIFY IDENTITY <span>→</span>'
        : 'REGISTER CREDENTIALS <span>→</span>';

    $("password").autocomplete =
      authMode === "login"
        ? "current-password"
        : "new-password";

    authMessage.textContent = "";
  });
}));


// ============================================
// LOGIN / REGISTER
// ============================================

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    authMessage.textContent =
      "SYSTEM CONFIGURATION REQUIRED // SUPABASE CREDENTIALS MISSING";
    return;
  }

  authMessage.textContent = "PROCESSING REQUEST...";

  const email = $("email").value.trim();
  const password = $("password").value;

  let result;

  try {
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
      authMessage.textContent =
        "AUTHENTICATION FAILED // " + result.error.message;
      return;
    }

    // Account created, email confirmation may be required.
    if (authMode === "signup" && !result.data.session) {
      authMessage.textContent =
        "REGISTRATION INITIATED // CHECK YOUR EMAIL TO CONFIRM CREDENTIALS";
      return;
    }

    authMessage.textContent = "";

    if (result.data.user) {
      currentUser = result.data.user;
      await showDashboard();
    }

  } catch (error) {
    authMessage.textContent =
      "SYSTEM ERROR // " + error.message;
  }
});


// ============================================
// LOGOUT
// ============================================

$("logout-btn").addEventListener("click", async () => {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  currentUser = null;
  characters = [];

  dashboardView.classList.add("hidden");
  authView.classList.remove("hidden");

  authMessage.textContent = "SESSION TERMINATED.";
});


// ============================================
// CHARACTER SYSTEM
// ============================================

$("new-character-btn").addEventListener("click", () => {
  openCharacterDialog();
});

$("close-dialog").addEventListener("click", () => {
  characterDialog.close();
});

$("cancel-btn").addEventListener("click", () => {
  characterDialog.close();
});


// ============================================
// DASHBOARD
// ============================================

async function showDashboard() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");

  await loadCharacters();
}


// ============================================
// LOAD CHARACTER RECORDS
// ============================================

async function loadCharacters() {
  if (!supabaseClient || !currentUser) return;

  const { data, error } = await supabaseClient
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("ARCHIVE RETRIEVAL ERROR:", error);
    return;
  }

  characters = data || [];

  $("character-count").textContent =
    String(characters.length).padStart(2, "0");

  renderCharacters();
}


// ============================================
// RENDER CHARACTER RECORDS
// ============================================

function renderCharacters() {
  const list = $("characters-list");

  list.innerHTML = "";

  $("empty-state").classList.toggle(
    "hidden",
    characters.length > 0
  );

  characters.forEach((character, index) => {
    const data = character.data || {};

    const card = document.createElement("article");
    card.className = "character-card";

    const role = data.role || "ROLE NOT SPECIFIED";
    const origin = data.origin || "ORIGIN NOT SPECIFIED";

    card.innerHTML = `
      <span class="card-id">
        FILE // ${String(index + 1).padStart(3, "0")}
      </span>

      <h4></h4>
      <p></p>
      <p></p>

      <div class="card-actions">
        <button data-action="edit">EDIT RECORD</button>
        <button data-action="delete">DELETE RECORD</button>
      </div>
    `;

    // Text is inserted safely without interpreting HTML.
    card.querySelector("h4").textContent = character.name;

    const paragraphs = card.querySelectorAll("p");
    paragraphs[0].textContent = role;
    paragraphs[1].textContent = origin;

    card.querySelector('[data-action="edit"]')
      .addEventListener("click", () => {
        openCharacterDialog(character);
      });

    card.querySelector('[data-action="delete"]')
      .addEventListener("click", () => {
        deleteCharacter(character);
      });

    list.appendChild(card);
  });
}


// ============================================
// CHARACTER DIALOG
// ============================================

function openCharacterDialog(character = null) {
  $("character-message").textContent = "";

  $("dialog-title").textContent =
    character ? "EDIT PERSONNEL RECORD" : "NEW PERSONNEL RECORD";

  $("character-id").value = character?.id || "";
  $("character-name").value = character?.name || "";
  $("character-role").value = character?.data?.role || "";
  $("character-origin").value = character?.data?.origin || "";
  $("character-notes").value = character?.data?.notes || "";

  characterDialog.showModal();
}


// ============================================
// SAVE CHARACTER
// ============================================

characterForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient || !currentUser) {
    $("character-message").textContent =
      "SESSION INVALID // AUTHENTICATION REQUIRED";
    return;
  }

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

  try {
    if (id) {
      result = await supabaseClient
        .from("characters")
        .update(payload)
        .eq("id", id)
        .eq("owner_id", currentUser.id);
    } else {
      result = await supabaseClient
        .from("characters")
        .insert(payload);
    }

    if (result.error) {
      $("character-message").textContent =
        "RECORD ERROR // " + result.error.message;
      return;
    }

    characterDialog.close();

    await loadCharacters();

  } catch (error) {
    $("character-message").textContent =
      "SYSTEM ERROR // " + error.message;
  }
});


// ============================================
// DELETE CHARACTER
// ============================================

async function deleteCharacter(character) {
  const confirmation = confirm(
    `PERMANENTLY DELETE RECORD "${character.name}"?`
  );

  if (!confirmation) return;

  const { error } = await supabaseClient
    .from("characters")
    .delete()
    .eq("id", character.id)
    .eq("owner_id", currentUser.id);

  if (error) {
    alert("DELETION FAILED // " + error.message);
    return;
  }

  await loadCharacters();
}


// ============================================
// SESSION INITIALIZATION
// ============================================

async function init() {
  if (!isSupabaseConfigured) {
    authMessage.textContent =
      "SYSTEM CONFIGURATION REQUIRED // SUPABASE URL AND PUBLISHABLE KEY MUST BE SET IN script.js";
    return;
  }

  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error("SESSION ERROR:", error);
      return;
    }

    if (data.session) {
      currentUser = data.session.user;
      await showDashboard();
    }

  } catch (error) {
    console.error("INITIALIZATION FAILURE:", error);
  }
}


// ============================================
// BOOT SYSTEM
// ============================================

init();