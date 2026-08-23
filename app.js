const serviceData = {
  "consultas-legales": {
    title: "Consultas legales",
    questions: [
      {
        label: "Que incluye una consulta legal?",
        answer: "Una consulta legal sirve para entender tu situacion antes de actuar. El objetivo es darte claridad inicial, no llenarte de tecnicismos.",
        points: [
          "Escuchamos el caso y ordenamos los hechos importantes.",
          "Detectamos riesgos, urgencias y documentos que conviene revisar.",
          "Te explicamos opciones concretas y siguientes pasos recomendados."
        ]
      },
      {
        label: "En que casos me sirve?",
        answer: "Suele servir cuando no sabes si reclamar, responder, firmar, negociar o iniciar un tramite.",
        points: [
          "Problemas con contratos, pagos o deudas.",
          "Dudas laborales o comerciales.",
          "Revision inicial de notificaciones o documentos legales."
        ]
      },
      {
        label: "Que debo llevar a la consulta?",
        answer: "Mientras mas claro llegue el contexto, mejor puede orientarte el servicio desde el primer contacto.",
        points: [
          "Resumen breve de lo ocurrido.",
          "Fechas importantes y personas involucradas.",
          "Contratos, mensajes, correos o notificaciones relacionadas."
        ]
      }
    ]
  },
  "revision-contratos": {
    title: "Revision de contratos",
    questions: [
      {
        label: "Que revisan en un contrato?",
        answer: "Se revisa si el contrato realmente te protege y si lo que firmas coincide con lo que te prometieron.",
        points: [
          "Obligaciones, plazos y causales de incumplimiento.",
          "Penalidades, renovaciones automaticas y formas de terminacion.",
          "Clausulas ambiguas o riesgosas que conviene renegociar."
        ]
      },
      {
        label: "Sirve antes de firmar?",
        answer: "Si, idealmente se hace antes de firmar. Ahi es donde mas valor aporta porque todavia puedes negociar.",
        points: [
          "Evita aceptar obligaciones desproporcionadas.",
          "Permite pedir cambios con fundamento.",
          "Reduce conflictos futuros por interpretaciones confusas."
        ]
      }
    ]
  },
  "apoyo-pymes": {
    title: "Apoyo a pymes",
    questions: [
      {
        label: "Como ayuda a una pyme?",
        answer: "Ayuda a ordenar la parte legal del negocio para que opere con menos riesgo y mas claridad.",
        points: [
          "Documentos comerciales y relaciones con clientes o proveedores.",
          "Revision de procesos internos basicos.",
          "Prevencion de errores que luego se convierten en conflictos."
        ]
      },
      {
        label: "Es solo para empresas grandes?",
        answer: "No. De hecho, suele ser muy util para negocios pequenos que todavia no tienen soporte legal constante.",
        points: [
          "Emprendimientos en crecimiento.",
          "Negocios familiares.",
          "Profesionales independientes con operaciones recurrentes."
        ]
      }
    ]
  },
  "constitucion-empresas": {
    title: "Constitucion de empresas",
    questions: [
      {
        label: "Que resuelve este servicio?",
        answer: "Acompana el inicio formal de una actividad para que arranque con una base documental y legal mas ordenada.",
        points: [
          "Definicion inicial de estructura o modalidad.",
          "Preparacion de documentos base.",
          "Orientacion sobre pasos formales para iniciar operaciones."
        ]
      }
    ]
  },
  "documentos-escritos": {
    title: "Documentos y escritos",
    questions: [
      {
        label: "Que tipo de documentos pueden preparar?",
        answer: "Sirve para redactar o corregir documentos legales de uso frecuente con lenguaje claro y enfoque practico.",
        points: [
          "Cartas formales y solicitudes.",
          "Acuerdos, poderes y comunicaciones legales.",
          "Ajustes para mejorar claridad y respaldo del texto."
        ]
      }
    ]
  },
  "reclamaciones-defensa": {
    title: "Reclamaciones y defensa",
    questions: [
      {
        label: "Que pasa si me reclaman algo?",
        answer: "Lo primero es revisar el reclamo y responder con criterio, sin improvisar ni ignorarlo si tiene impacto legal.",
        points: [
          "Analisis del documento o intimacion recibida.",
          "Definicion de respuesta o estrategia inicial.",
          "Orden de pruebas y antecedentes utiles para defenderte."
        ]
      }
    ]
  },
  laboral: {
    title: "Laboral",
    questions: [
      {
        label: "Que tipo de dudas laborales cubre?",
        answer: "Puede orientar tanto a trabajadores como a empleadores en situaciones frecuentes del dia a dia laboral.",
        points: [
          "Contratacion, funciones y condiciones de trabajo.",
          "Despidos, acuerdos o incumplimientos.",
          "Documentacion y comunicaciones laborales relevantes."
        ]
      }
    ]
  },
  "proteccion-marca": {
    title: "Proteccion de marca y activos",
    questions: [
      {
        label: "Por que importa proteger la marca?",
        answer: "Porque el nombre y la identidad del negocio tambien son activos. Si no se cuidan, pueden generarse conflictos o perdida de valor.",
        points: [
          "Uso correcto del nombre comercial.",
          "Prevencion de conflictos con terceros.",
          "Cuidado basico de identidad y activos intangibles."
        ]
      }
    ]
  },
  "cumplimiento-prevencion": {
    title: "Cumplimiento y prevencion",
    questions: [
      {
        label: "Que significa prevencion legal?",
        answer: "Significa revisar antes de que aparezca el problema. Es una forma de evitar errores costosos y conflictos repetidos.",
        points: [
          "Revision de documentos y procesos sensibles.",
          "Deteccion anticipada de riesgos evitables.",
          "Mejoras practicas para operar con mas orden."
        ]
      }
    ]
  }
};

const serviceSelect = document.querySelector("#service-select");
const questionsContainer = document.querySelector("#assistant-questions");
const useQuestionButton = document.querySelector("#assistant-use-question-button");
const deriveButton = document.querySelector("#assistant-derive-button");
const scheduleButton = document.querySelector("#assistant-schedule-button");
const sendButton = document.querySelector("#assistant-send-button");
const messageInput = document.querySelector("#assistant-message");
const documentUpload = document.querySelector("#document-upload");
const documentPreview = document.querySelector("#document-preview");
const assistantStatus = document.querySelector("#assistant-status");
const titleNode = document.querySelector("#assistant-title");
const chatLog = document.querySelector("#chat-log");
const serviceCards = document.querySelectorAll(".service-card[data-service]");
const imageModal = document.querySelector("#image-modal");
const imageModalImg = document.querySelector("#image-modal-img");
const imageModalTitle = document.querySelector("#image-modal-title");
const modalImageButtons = document.querySelectorAll("[data-modal-image]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
const floatingAgentToggle = document.querySelector("#floating-agent-toggle");
const agentWidget = document.querySelector("#agent-widget");
const agentWidgetMinimize = document.querySelector("#agent-widget-minimize");
const agentWidgetSection = document.querySelector("#agent-widget-section");
const agentWidgetForm = document.querySelector("#agent-widget-form");
const agentWidgetInput = document.querySelector("#agent-widget-input");
const agentWidgetFile = document.querySelector("#agent-widget-file");
const agentWidgetFileStatus = document.querySelector("#agent-widget-file-status");
const agentWidgetBody = document.querySelector("#agent-widget-body");
const agentWidgetDerive = document.querySelector("#agent-widget-derive");
const leadModal = document.querySelector("#lead-modal");
const leadForm = document.querySelector("#lead-form");
const leadName = document.querySelector("#lead-name");
const leadEmail = document.querySelector("#lead-email");
const leadPhone = document.querySelector("#lead-phone");
const leadMessage = document.querySelector("#lead-message");
const leadWantsAppointment = document.querySelector("#lead-wants-appointment");
const leadAppointmentPreference = document.querySelector("#lead-appointment-preference");
const leadStatus = document.querySelector("#lead-status");
const leadSubmitButton = document.querySelector("#lead-submit-button");
const leadCloseButtons = document.querySelectorAll("[data-lead-close]");

let currentQuestionIndex = 0;
let documentContext = null;
let widgetDocumentContext = null;
let leadContext = null;
const conversationHistory = [];
const widgetHistory = [];

function renderQuestions(serviceKey) {
  const service = serviceData[serviceKey];
  currentQuestionIndex = 0;
  questionsContainer.innerHTML = "";

  service.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `question-chip${index === 0 ? " active" : ""}`;
    button.textContent = question.label;
    button.addEventListener("click", () => {
      currentQuestionIndex = index;
      renderActiveQuestion();
    });
    questionsContainer.appendChild(button);
  });

  renderSuggestion(serviceKey, currentQuestionIndex);
}

function renderActiveQuestion() {
  const chips = questionsContainer.querySelectorAll(".question-chip");
  chips.forEach((chip, index) => {
    chip.classList.toggle("active", index === currentQuestionIndex);
  });
}

function renderSuggestion(serviceKey, questionIndex) {
  const service = serviceData[serviceKey];
  const question = service.questions[questionIndex];

  titleNode.textContent = service.title;
  messageInput.placeholder = `Ejemplo: ${question.label}`;
  renderActiveQuestion();
  highlightServiceCard(serviceKey);
}

function addChatMessage(role, text) {
  const article = document.createElement("article");
  article.className = `chat-message ${role}`;

  const label = document.createElement("span");
  label.className = "chat-role";
  label.textContent = role === "assistant" ? "LegalEasy" : "Tu";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  article.appendChild(label);
  article.appendChild(paragraph);
  chatLog.appendChild(article);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setAssistantStatus(text) {
  assistantStatus.textContent = text;
}

function addTypingState() {
  const article = document.createElement("article");
  article.className = "chat-message assistant pending";
  article.id = "typing-message";

  const label = document.createElement("span");
  label.className = "chat-role";
  label.textContent = "LegalEasy";

  const paragraph = document.createElement("p");
  paragraph.textContent = "Pensando en una respuesta util...";

  article.appendChild(label);
  article.appendChild(paragraph);
  chatLog.appendChild(article);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function removeTypingState() {
  const typingNode = document.querySelector("#typing-message");
  if (typingNode) {
    typingNode.remove();
  }
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function buildClientFallbackAnswer(serviceKey, message, documentData = null) {
  const service = serviceData[serviceKey] || serviceData[detectClientService(message, documentData)] || serviceData["consultas-legales"];
  const documentLine = documentData?.name
    ? `Documento recibido: ${documentData.name}. Si quieres una revisión humana, usa el botón "Derivar a asistente" para que el equipo pueda revisar el caso.`
    : "Si tienes un documento, puedes subirlo o derivar el caso para revisión humana.";

  return [
    `Área detectada: ${service.title}`,
    "Puedo darte una orientación inicial mientras conectamos la atención humana.",
    documentLine,
    "Pasos recomendados:",
    "- Resume qué ocurrió y desde cuándo.",
    "- Identifica si hay contrato, carta, correo, notificación o plazo urgente.",
    "- No firmes ni respondas documentos importantes sin revisar el contexto completo.",
    "- Si necesitas atención real del equipo, presiona \"Derivar a asistente\" o \"Agendar cita\".",
    "Importante: esta respuesta es orientativa y no reemplaza asesoría legal personalizada."
  ].join("\n");
}

function detectClientService(message, documentData = null) {
  const text = `${message || ""} ${documentData?.name || ""} ${documentData?.text || ""}`.toLowerCase();
  const checks = [
    ["revision-contratos", ["contrato", "clausula", "firmar", "arriendo", "multa", "penalidad"]],
    ["laboral", ["despido", "finiquito", "trabajo", "sueldo", "empleador", "trabajador"]],
    ["reclamaciones-defensa", ["reclamo", "demanda", "notificacion", "deuda", "plazo", "defensa"]],
    ["constitucion-empresas", ["empresa", "sociedad", "constituir", "emprendimiento"]],
    ["proteccion-marca", ["marca", "logo", "dominio", "nombre comercial"]],
    ["cumplimiento-prevencion", ["cumplimiento", "prevencion", "riesgo", "politica"]],
    ["apoyo-pymes", ["pyme", "negocio", "cliente", "proveedor"]],
    ["documentos-escritos", ["carta", "solicitud", "escrito", "poder", "documento"]]
  ];

  let bestService = "consultas-legales";
  let bestScore = 0;
  for (const [service, keywords] of checks) {
    const score = keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestService = service;
    }
  }
  return bestService;
}

function storePendingLead(payload) {
  const pendingLeads = JSON.parse(localStorage.getItem("legaleasyPendingLeads") || "[]");
  pendingLeads.push({ ...payload, createdAt: new Date().toISOString() });
  localStorage.setItem("legaleasyPendingLeads", JSON.stringify(pendingLeads.slice(-20)));
}

function openLeadWhatsApp(payload) {
  const text = [
    "Hola LegalEasy, quiero derivar este caso a un asistente.",
    `Nombre: ${payload.name}`,
    payload.phone ? `WhatsApp: ${payload.phone}` : "",
    payload.email ? `Email: ${payload.email}` : "",
    payload.wantsAppointment ? "Quiere agendar cita: si" : "",
    payload.appointmentPreference ? `Horario preferido: ${payload.appointmentPreference}` : "",
    `Caso: ${payload.message}`
  ].filter(Boolean).join("\n");

  window.open(`https://wa.me/56933553024?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) {
    messageInput.focus();
    return;
  }

  const service = serviceSelect.value;
  const requestHistory = conversationHistory.slice(-8);

  addChatMessage("user", message);
  conversationHistory.push({ role: "user", content: message, service });
  messageInput.value = "";
  sendButton.disabled = true;
  useQuestionButton.disabled = true;
  setAssistantStatus("Analizando");
  addTypingState();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        service,
        message,
        document: documentContext,
        history: requestHistory.map((item) => ({
          role: item.role,
          content: item.content
        }))
      })
    });

    const data = await readJsonSafe(response);
    removeTypingState();

    if (!response.ok) {
      const answer = buildClientFallbackAnswer(service, message, documentContext);
      addChatMessage("assistant", answer);
      setAssistantStatus("Orientación local");
      conversationHistory.push({ role: "assistant", content: answer, service });
      return;
    }

    addChatMessage("assistant", data.answer);
    setAssistantStatus(data.fallback ? "Orientacion inicial" : "IA activa");
    conversationHistory.push({ role: "assistant", content: data.answer, service });
  } catch {
    removeTypingState();
    const answer = buildClientFallbackAnswer(service, message, documentContext);
    addChatMessage("assistant", answer);
    setAssistantStatus("Orientación local");
    conversationHistory.push({ role: "assistant", content: answer, service });
  } finally {
    sendButton.disabled = false;
    useQuestionButton.disabled = false;
    if (assistantStatus.textContent === "Analizando") {
      setAssistantStatus("Listo");
    }
  }
}

documentUpload.addEventListener("change", async () => {
  const file = documentUpload.files?.[0];

  if (!file) {
    documentContext = null;
    documentPreview.innerHTML = "<span>Sin documento cargado</span>";
    return;
  }

  const allowedExtensions = ["txt", "md", "csv", "json", "html", "htm"];
  const uploadExtensions = ["pdf", "doc", "docx"];
  const extension = file.name.split(".").pop().toLowerCase();

  if (uploadExtensions.includes(extension)) {
    const base64 = await readFileAsBase64(file);
    documentContext = {
      name: file.name,
      type: file.type || extension,
      text: "",
      fileBase64: base64,
      extension,
      readable: false
    };
    documentPreview.innerHTML = `<strong>${file.name}</strong><span>Documento recibido. Intentare extraer texto desde el servidor al enviar tu pregunta.</span>`;
    setAssistantStatus("Documento recibido");
    addChatMessage("assistant", `Recibi ${file.name}. Escribe tu pregunta y revisare el documento con el mejor metodo disponible localmente.`);
    return;
  }

  if (!allowedExtensions.includes(extension)) {
    documentContext = null;
    documentPreview.innerHTML = `<strong>${file.name}</strong><span>Formato no soportado por ahora. Usa PDF, DOCX o texto plano.</span>`;
    addChatMessage("assistant", "Ese formato no esta soportado todavia. Puedes subir PDF, DOCX o un archivo TXT con el contenido del documento.");
    return;
  }

  const text = await file.text();
  const cleanedText = text.replace(/\s+/g, " ").trim().slice(0, 12000);

  documentContext = {
    name: file.name,
    type: file.type || extension,
    text: cleanedText,
    readable: true
  };

  documentPreview.innerHTML = `<strong>${file.name}</strong><span>${cleanedText.length} caracteres listos para analizar</span>`;
  setAssistantStatus("Documento listo");
  addChatMessage("assistant", `Documento cargado: ${file.name}. Ahora preguntame que quieres revisar, resumir o detectar.`);
});

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function highlightServiceCard(serviceKey) {
  serviceCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.service === serviceKey);
  });
}

serviceSelect.addEventListener("change", (event) => {
  renderQuestions(event.target.value);
});

useQuestionButton.addEventListener("click", () => {
  const service = serviceData[serviceSelect.value];
  const question = service.questions[currentQuestionIndex];
  messageInput.value = question.label;
  messageInput.focus();
});

sendButton.addEventListener("click", () => {
  sendMessage();
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

serviceCards.forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-image]")) {
      return;
    }

    const { service } = card.dataset;
    serviceSelect.value = service;
    renderQuestions(service);
    document.querySelector("#asistente").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

modalImageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    imageModalImg.src = button.dataset.modalImage;
    imageModalImg.alt = button.querySelector("img")?.alt || "Imagen ampliada";
    imageModalTitle.textContent = button.dataset.modalTitle || "Imagen";
    imageModal.classList.add("is-open");
    imageModal.setAttribute("aria-hidden", "false");
  });
});

modalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeImageModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeImageModal();
  }
});

function closeImageModal() {
  imageModal.classList.remove("is-open");
  imageModal.setAttribute("aria-hidden", "true");
  imageModalImg.src = "";
}

function openAgentWidget() {
  agentWidget.classList.add("is-open");
  agentWidget.setAttribute("aria-hidden", "false");
  floatingAgentToggle.setAttribute("aria-expanded", "true");
  agentWidgetInput.focus();
}

function minimizeAgentWidget() {
  agentWidget.classList.remove("is-open");
  agentWidget.setAttribute("aria-hidden", "true");
  floatingAgentToggle.setAttribute("aria-expanded", "false");
}

function addWidgetMessage(role, text) {
  const article = document.createElement("article");
  article.className = `agent-widget-message ${role}`;
  const label = document.createElement("strong");
  label.textContent = role === "assistant" ? "LegalEasy" : "Tu";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.appendChild(label);
  article.appendChild(paragraph);
  agentWidgetBody.appendChild(article);
  agentWidgetBody.scrollTop = agentWidgetBody.scrollHeight;
}

function buildLeadSummary(source) {
  const history = source === "widget" ? widgetHistory : conversationHistory;
  const documentData = source === "widget" ? widgetDocumentContext : documentContext;
  const lastUserMessage = [...history].reverse().find((item) => item.role === "user")?.content || "";
  const lastAssistantMessage = [...history].reverse().find((item) => item.role === "assistant")?.content || "";
  const service = source === "widget" ? "auto" : serviceSelect.value;
  const documentLine = documentData?.name ? `Documento adjunto: ${documentData.name}.` : "Sin documento adjunto en el agente.";

  return {
    source,
    service,
    documentName: documentData?.name || "",
    documentReadable: Boolean(documentData?.readable),
    history,
    message: [
      documentLine,
      lastUserMessage ? `Consulta del usuario: ${lastUserMessage}` : "Consulta del usuario: pendiente de completar.",
      lastAssistantMessage ? `Respuesta previa del agente: ${lastAssistantMessage.slice(0, 1200)}` : ""
    ].filter(Boolean).join("\n\n")
  };
}

function openLeadModal(source = "assistant", wantsAppointment = false) {
  leadContext = buildLeadSummary(source);
  leadMessage.value = leadContext.message;
  leadWantsAppointment.checked = wantsAppointment;
  leadStatus.textContent = "";
  leadSubmitButton.disabled = false;
  leadModal.classList.add("is-open");
  leadModal.setAttribute("aria-hidden", "false");
  leadName.focus();
}

function closeLeadModal() {
  leadModal.classList.remove("is-open");
  leadModal.setAttribute("aria-hidden", "true");
}

async function submitLead(event) {
  event.preventDefault();
  const name = leadName.value.trim();
  const email = leadEmail.value.trim();
  const phone = leadPhone.value.trim();
  const message = leadMessage.value.trim();

  if (!name || (!email && !phone) || !message) {
    leadStatus.textContent = "Indica tu nombre, email o WhatsApp, y un resumen del caso.";
    return;
  }

  leadSubmitButton.disabled = true;
  leadStatus.textContent = "Enviando caso...";

  try {
    const payload = {
      ...leadContext,
      name,
      email,
      phone,
      message,
      wantsAppointment: leadWantsAppointment.checked,
      appointmentPreference: leadAppointmentPreference.value.trim()
    };
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJsonSafe(response);

    if (!response.ok) {
      storePendingLead(payload);
      openLeadWhatsApp(payload);
      leadStatus.textContent = "No hay API activa en este dominio. Guardé el caso en este navegador y abrí WhatsApp para enviarlo al equipo.";
      setTimeout(closeLeadModal, 2600);
      return;
    }

    leadStatus.textContent = `Caso recibido (${data.id}). Un asistente podrá revisar tu consulta.`;
    if (data.appointmentUrl) {
      window.open(data.appointmentUrl, "_blank", "noopener,noreferrer");
    }
    leadForm.reset();
    setTimeout(closeLeadModal, 1800);
  } catch {
    const payload = {
      ...leadContext,
      name,
      email,
      phone,
      message,
      wantsAppointment: leadWantsAppointment.checked,
      appointmentPreference: leadAppointmentPreference.value.trim()
    };
    storePendingLead(payload);
    openLeadWhatsApp(payload);
    leadStatus.textContent = "No hay API activa en este dominio. Guardé el caso en este navegador y abrí WhatsApp para enviarlo al equipo.";
    setTimeout(closeLeadModal, 2600);
  }
}

async function sendWidgetMessage(message) {
  addWidgetMessage("user", message);
  const requestHistory = widgetHistory.slice(-8);
  widgetHistory.push({ role: "user", content: message });
  addWidgetMessage("assistant", "Estoy revisando tu consulta...");
  const pendingMessage = agentWidgetBody.lastElementChild;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "auto",
        message,
        document: widgetDocumentContext,
        history: requestHistory
      })
    });
    const data = await readJsonSafe(response);
    pendingMessage.remove();
    const answer = response.ok ? data.answer : buildClientFallbackAnswer("auto", message, widgetDocumentContext);
    addWidgetMessage("assistant", answer);
    widgetHistory.push({ role: "assistant", content: answer });
  } catch {
    pendingMessage.remove();
    const answer = buildClientFallbackAnswer("auto", message, widgetDocumentContext);
    addWidgetMessage("assistant", answer);
    widgetHistory.push({ role: "assistant", content: answer });
  }
}

async function loadWidgetDocument(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const textExtensions = ["txt", "md", "csv", "json", "html", "htm"];
  const binaryExtensions = ["pdf", "doc", "docx"];

  if (textExtensions.includes(extension)) {
    const text = await file.text();
    const cleanedText = text.replace(/\s+/g, " ").trim().slice(0, 12000);
    widgetDocumentContext = {
      name: file.name,
      type: file.type || extension,
      text: cleanedText,
      extension,
      readable: true
    };
    agentWidgetFileStatus.textContent = `${file.name} listo para analizar.`;
    addWidgetMessage("assistant", `Documento cargado: ${file.name}. Puedes preguntarme por riesgos, resumen o pasos recomendados.`);
    return;
  }

  if (binaryExtensions.includes(extension)) {
    const base64 = await readFileAsBase64(file);
    widgetDocumentContext = {
      name: file.name,
      type: file.type || extension,
      text: "",
      fileBase64: base64,
      extension,
      readable: false
    };
    agentWidgetFileStatus.textContent = `${file.name} recibido. Intentare extraer texto al consultar.`;
    addWidgetMessage("assistant", `Recibi ${file.name}. Escribe que quieres revisar y detectare el area legal automaticamente.`);
    return;
  }

  widgetDocumentContext = null;
  agentWidgetFileStatus.textContent = "Formato no soportado. Usa PDF, DOCX o texto plano.";
}

agentWidgetFile.addEventListener("change", async () => {
  const file = agentWidgetFile.files?.[0];
  if (!file) {
    return;
  }
  await loadWidgetDocument(file);
});

deriveButton.addEventListener("click", () => openLeadModal("assistant", false));
scheduleButton.addEventListener("click", () => openLeadModal("assistant", true));
agentWidgetDerive.addEventListener("click", () => openLeadModal("widget", false));
leadForm.addEventListener("submit", submitLead);
leadCloseButtons.forEach((button) => {
  button.addEventListener("click", closeLeadModal);
});

let isDraggingAgent = false;
let dragStartX = 0;
let dragStartY = 0;
let widgetStartRight = 0;
let widgetStartBottom = 0;

document.querySelector(".agent-widget-header").addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) {
    return;
  }
  isDraggingAgent = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  const rect = agentWidget.getBoundingClientRect();
  widgetStartRight = window.innerWidth - rect.right;
  widgetStartBottom = window.innerHeight - rect.bottom;
  agentWidget.setPointerCapture(event.pointerId);
});

document.querySelector(".agent-widget-header").addEventListener("pointermove", (event) => {
  if (!isDraggingAgent) {
    return;
  }
  const nextRight = Math.max(8, widgetStartRight - (event.clientX - dragStartX));
  const nextBottom = Math.max(8, widgetStartBottom - (event.clientY - dragStartY));
  agentWidget.style.right = `${nextRight}px`;
  agentWidget.style.bottom = `${nextBottom}px`;
});

document.querySelector(".agent-widget-header").addEventListener("pointerup", (event) => {
  isDraggingAgent = false;
  agentWidget.releasePointerCapture(event.pointerId);
});

floatingAgentToggle.addEventListener("click", () => {
  if (agentWidget.classList.contains("is-open")) {
    minimizeAgentWidget();
  } else {
    openAgentWidget();
  }
});

floatingAgentToggle.addEventListener("dblclick", minimizeAgentWidget);
agentWidgetMinimize.addEventListener("click", minimizeAgentWidget);
agentWidgetSection.addEventListener("click", () => {
  minimizeAgentWidget();
  document.querySelector("#asistente").scrollIntoView({ behavior: "smooth", block: "start" });
});

agentWidgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = agentWidgetInput.value.trim();
  if (!message) {
    agentWidgetInput.focus();
    return;
  }
  agentWidgetInput.value = "";
  sendWidgetMessage(message);
});

agentWidgetInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    agentWidgetForm.requestSubmit();
  }
});

renderQuestions(serviceSelect.value);
