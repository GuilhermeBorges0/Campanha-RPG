
// ==========================================
// NULL // INTERNAL ARCHIVE SYSTEM
// AUTHENTICATION + CHARACTER RECORDS + TERMINAL
// ==========================================

// CONFIGURAÇÃO DO SUPABASE

const SUPABASE_URL = "https://kmspdmjaygkjjdlulkmd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-Do8npRRSIRSqyMxEIcwig_cuKWcF1X";

const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

let supabaseClient = null;

if (isSupabaseConfigured && window.supabase) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
}


// ==========================================
// ESTADO DO SISTEMA
// ==========================================

let authMode = "login";
let currentUser = null;
let characters = [];

const $ = (id) => document.getElementById(id);


// ==========================================
// ELEMENTOS
// ==========================================

const authView = $("auth-view");
const dashboardView = $("dashboard-view");
const authForm = $("auth-form");
const authMessage = $("auth-message");

const characterDialog = $("character-dialog");
const characterForm = $("character-form");


// ==========================================
// RELÓGIO
// ==========================================

$("year").textContent = new Date().getFullYear();

function updateClock() {
  const clock = $("clock");

  if (clock) {
    clock.textContent = new Date().toLocaleTimeString("pt-BR", {
      hour12: false
    });
  }
}

updateClock();
setInterval(updateClock, 1000);


// ==========================================
// AUTENTICAÇÃO // ABAS
// ==========================================

document.querySelectorAll(".tab").forEach((tab => {

  tab.addEventListener("click", () => {

    authMode = tab.dataset.auth;

    document.querySelectorAll(".tab").forEach((t => {
      t.classList.toggle("active", t === tab);
    }));

    $("auth-submit").innerHTML =
      authMode === "login"
        ? 'VERIFICAR IDENTIDADE <span>→</span>'
        : 'REGISTRAR CREDENCIAIS <span>→</span>';

    $("password").autocomplete =
      authMode === "login"
        ? "current-password"
        : "new-password";

    authMessage.textContent = "";

  });

}));


// ==========================================
// LOGIN E REGISTRO
// ==========================================

authForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!supabaseClient) {
    authMessage.textContent =
      "ERRO DE CONFIGURAÇÃO // CREDENCIAIS DO SUPABASE INVÁLIDAS";
    return;
  }

  authMessage.textContent = "PROCESSANDO SOLICITAÇÃO...";

  const submitButton = $("auth-submit");
  submitButton.disabled = true;

  const email = $("email").value.trim();
  const password = $("password").value;

  try {

    let result;

    if (authMode === "login") {

      result = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    } else {

      result = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin + window.location.pathname
        }
      });

    }

    if (result.error) {
      authMessage.textContent =
        "FALHA NA AUTENTICAÇÃO // " + result.error.message;
      return;
    }

    // Cadastro sem sessão: aguardando confirmação por e-mail
    if (authMode === "signup" && !result.data.session) {

      authMessage.textContent =
        "REGISTRO INICIADO // VERIFIQUE SEU E-MAIL PARA CONFIRMAR AS CREDENCIAIS.";

      return;
    }

    authMessage.textContent = "";

    if (result.data.user) {
      currentUser = result.data.user;
      await showDashboard();
    }

  } catch (error) {

    authMessage.textContent =
      "ERRO DO SISTEMA // " + error.message;

  } finally {

    submitButton.disabled = false;

  }

});


// ==========================================
// ENCERRAR SESSÃO
// ==========================================

$("logout-btn").addEventListener("click", async () => {

  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  currentUser = null;
  characters = [];

  dashboardView.classList.add("hidden");
  authView.classList.remove("hidden");

  authMessage.textContent = "SESSÃO ENCERRADA.";

});


// ==========================================
// JANELA DE PERSONAGEM
// ==========================================

$("new-character-btn").addEventListener("click", () => {
  openCharacterDialog();
});

$("close-dialog").addEventListener("click", () => {
  characterDialog.close();
});

$("cancel-btn").addEventListener("click", () => {
  characterDialog.close();
});


// ==========================================
// PAINEL
// ==========================================

async function showDashboard() {

  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");

  await loadCharacters();

}


// ==========================================
// CARREGAR PERSONAGENS
// ==========================================

async function loadCharacters() {

  if (!supabaseClient || !currentUser) return;

  const { data, error } = await supabaseClient
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {

    console.error("ERRO NA LEITURA DO ARQUIVO:", error);

    return;

  }

  characters = data || [];

  $("character-count").textContent =
    String(characters.length).padStart(2, "0");

  renderCharacters();

}


// ==========================================
// EXIBIR PERSONAGENS
// ==========================================

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

    card.innerHTML = `
      <span class="card-id">
        ARQUIVO // ${String(index + 1).padStart(3, "0")}
      </span>

      <h4></h4>

      <p></p>
      <p></p>

      <div class="card-actions">
        <button type="button" data-action="edit">
          EDITAR REGISTRO
        </button>

        <button type="button" data-action="delete">
          EXCLUIR REGISTRO
        </button>
      </div>
    `;

    card.querySelector("h4").textContent =
      character.name;

    const paragraphs = card.querySelectorAll("p");

    paragraphs[0].textContent =
      data.role || "FUNÇÃO NÃO INFORMADA";

    paragraphs[1].textContent =
      data.origin || "ORIGEM NÃO INFORMADA";

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


// ==========================================
// ABRIR FORMULÁRIO
// ==========================================

function openCharacterDialog(character = null) {

  $("character-message").textContent = "";

  $("dialog-title").textContent = character
    ? "EDITAR REGISTRO"
    : "NOVO REGISTRO";

  $("character-id").value =
    character?.id || "";

  $("character-name").value =
    character?.name || "";

  $("character-role").value =
    character?.data?.role || "";

  $("character-origin").value =
    character?.data?.origin || "";

  $("character-notes").value =
    character?.data?.notes || "";

  characterDialog.showModal();

}


// ==========================================
// SALVAR PERSONAGEM
// ==========================================

characterForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!supabaseClient || !currentUser) {

    $("character-message").textContent =
      "SESSÃO INVÁLIDA // AUTENTICAÇÃO NECESSÁRIA";

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

  try {

    let result;

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
        "ERRO NO REGISTRO // " + result.error.message;

      return;

    }

    characterDialog.close();

    await loadCharacters();

  } catch (error) {

    $("character-message").textContent =
      "ERRO DO SISTEMA // " + error.message;

  }

});


// ==========================================
// EXCLUIR PERSONAGEM
// ==========================================

async function deleteCharacter(character) {

  const confirmation = confirm(
    `EXCLUIR PERMANENTEMENTE O REGISTRO "${character.name}"?`
  );

  if (!confirmation) return;

  const { error } = await supabaseClient
    .from("characters")
    .delete()
    .eq("id", character.id)
    .eq("owner_id", currentUser.id);

  if (error) {

    alert("FALHA NA EXCLUSÃO // " + error.message);

    return;

  }

  await loadCharacters();

}


// ==========================================
// TERMINAL // DESCOBERTAS
// ==========================================

const terminalOutput = $("terminal-output");
const terminalClock = $("terminal-clock");
const discoveryName = $("discovery-name");
const discoveryStatus = $("discovery-status");

const discoveryLogs = [

  { text: "Inicializando subsistemas...", type: "system" },
  { text: "Consultando arquivo de manifestações...", type: "muted" },
  { text: "Nenhuma correspondência encontrada.", type: "warning" },
  { text: "Reorganizando dados de observação...", type: "system" },
  { text: "Anomalia de leitura detectada.", type: "warning" },
  { text: "Criando novo registro temporário...", type: "system" },
  { text: "ENTIDADE // classificação pendente", type: "discovery" },
  { text: "Sincronização de dados concluída.", type: "muted" },
  { text: "Monitoramento contínuo iniciado.", type: "system" },
  { text: "Novo padrão registrado no banco de dados.", type: "discovery" },
  { text: "Origem não identificada.", type: "warning" },
  { text: "Aguardando novas informações...", type: "muted" },
  { text: "Integridade do arquivo: 98.7%", type: "system" },
  { text: "Leitura interrompida. Reiniciando processo...", type: "warning" },
  { text: "Verificando arquivos não catalogados...", type: "system" },
  { text: "Dados incompletos recebidos.", type: "warning" },
  { text: "Análise de padrões em andamento...", type: "muted" },
  { text: "Registro automático solicitado.", type: "discovery" },
  { text: "Processo de varredura reiniciado.", type: "system" }

];


const discoveredEntities = [

  {
    name: "ENTIDADE 0081 // VESPER",
    status: "Presença detectada em região sem registro."
  },

  {
    name: "ENTIDADE 0142 // MURMÚRIO",
    status: "Emissão de sinal sem origem identificada."
  },

  {
    name: "ENTIDADE 0207 // O OBSERVADOR",
    status: "Dados visuais incompletos. Análise pendente."
  },

  {
    name: "ENTIDADE 0319 // RAIZ",
    status: "Manifestação associada a alterações ambientais."
  },

  {
    name: "ENTIDADE 0440 // ECO",
    status: "Registro duplicado. A origem não corresponde."
  },

  {
    name: "ENTIDADE 0526 // NIX",
    status: "Padrão de atividade irregular. Monitoramento ativo."
  },

  {
    name: "ENTIDADE 0633 // VÉU",
    status: "Identificação parcial. Registro em observação."
  },

  {
    name: "ENTIDADE 0790 // LIMIAR",
    status: "Dados recebidos de arquivo não catalogado."
  }

];

let terminalIndex = 0;
let entityIndex = 0;


function addTerminalLine(text, type = "") {

  if (!terminalOutput) return;

  const line = document.createElement("div");

  line.className = "terminal-line " + type;

  line.textContent = "> " + text;

  terminalOutput.appendChild(line);

  while (terminalOutput.children.length > 45) {
    terminalOutput.removeChild(terminalOutput.firstChild);
  }

  terminalOutput.scrollTop =
    terminalOutput.scrollHeight;

}


function updateTerminalClock() {

  if (!terminalClock) return;

  terminalClock.textContent =
    new Date().toLocaleTimeString("pt-BR", {
      hour12: false
    });

}


function updateDiscovery() {

  const entity =
    discoveredEntities[entityIndex];

  if (discoveryName) {
    discoveryName.textContent = entity.name;
  }

  if (discoveryStatus) {
    discoveryStatus.textContent = entity.status;
  }

  addTerminalLine(
    "NOVO ARQUIVO DETECTADO",
    "discovery"
  );

  addTerminalLine(
    entity.name,
    "discovery"
  );

  addTerminalLine(
    entity.status,
    "warning"
  );

  entityIndex =
    (entityIndex + 1) % discoveredEntities.length;

}


function runTerminal() {

  if (!terminalOutput) return;

  const log = discoveryLogs[terminalIndex];

  addTerminalLine(log.text, log.type);

  terminalIndex =
    (terminalIndex + 1) % discoveryLogs.length;

}


// ==========================================
// INICIALIZAÇÃO DO TERMINAL
// ==========================================

updateTerminalClock();

setInterval(updateTerminalClock, 1000);

setTimeout(() => {

  addTerminalLine(
    "NULL SCANNER // ONLINE",
    "system"
  );

  addTerminalLine(
    "Monitoramento automático iniciado.",
    "system"
  );

}, 1000);


// Adiciona mensagens continuamente
setInterval(runTerminal, 2200);


// Descobre uma nova entidade periodicamente
setInterval(updateDiscovery, 18000);


// ==========================================
// INICIALIZAÇÃO / SESSÃO
// ==========================================

async function init() {

  if (!supabaseClient) {

    authMessage.textContent =
      "CONFIGURAÇÃO NECESSÁRIA // URL E CHAVE DO SUPABASE";

    return;

  }

  try {

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {

      console.error("ERRO DE SESSÃO:", error);

      return;

    }

    if (data.session) {

      currentUser = data.session.user;

      await showDashboard();

    }

  } catch (error) {

    console.error(
      "FALHA NA INICIALIZAÇÃO:",
      error
    );

  }

}

init();
