const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnvFile();

const PORT = Number(process.env.PORT || 3001);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const APPOINTMENT_URL = process.env.APPOINTMENT_URL || "https://wa.me/56933553024?text=Hola%20LegalEasy%2C%20quiero%20agendar%20una%20orientacion%20legal";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const leadsPath = path.join(dataDir, "leads.jsonl");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const servicePrompts = {
  "consultas-legales": "Responde como un orientador legal inicial. Explica en espanol claro, didactico y breve. No cites leyes inventadas ni prometas resultados. Enfocate en aclarar el problema, los documentos utiles, riesgos comunes y siguientes pasos.",
  "revision-contratos": "Responde como un asistente de revision contractual. Explica en espanol claro que clausulas, riesgos, obligaciones, penalidades o vacios conviene revisar. No des seguridad absoluta ni inventes normativa.",
  "apoyo-pymes": "Responde como un asistente legal para pequenas empresas. Explica con enfoque practico procesos, documentos, prevencion y orden legal del negocio.",
  "constitucion-empresas": "Responde como un asistente de inicio de negocio. Explica de forma general y didactica los pasos, decisiones iniciales y documentos comunes para constituir una empresa.",
  "documentos-escritos": "Responde como un asistente de documentos legales. Explica que informacion reunir, que estructura basica usar y que riesgos evitar al redactar escritos o solicitudes.",
  "reclamaciones-defensa": "Responde como un asistente de orientacion frente a reclamos o intimaciones. Explica en lenguaje claro como revisar el reclamo, ordenar antecedentes y definir una respuesta inicial prudente.",
  laboral: "Responde como un asistente de orientacion laboral general. Explica de manera equilibrada para empleadores y trabajadores, con cautela y sin sustituir asesoria profesional.",
  "proteccion-marca": "Responde como un asistente inicial de marca y activos intangibles. Explica por que importa proteger el nombre comercial, revisar disponibilidad y cuidar la identidad del negocio.",
  "cumplimiento-prevencion": "Responde como un asistente de prevencion legal. Explica como identificar riesgos, ordenar procesos y revisar documentos antes de que aparezcan conflictos."
};

const serviceLabels = {
  "consultas-legales": "Consultas legales",
  "revision-contratos": "Revision de contratos",
  "apoyo-pymes": "Apoyo a pymes",
  "constitucion-empresas": "Constitucion de empresas",
  "documentos-escritos": "Documentos y escritos",
  "reclamaciones-defensa": "Reclamaciones y defensa",
  laboral: "Laboral",
  "proteccion-marca": "Proteccion de marca y activos",
  "cumplimiento-prevencion": "Cumplimiento y prevencion"
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/chat") {
      await handleChat(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/leads") {
      await handleCreateLead(request, response);
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/api/leads")) {
      await handleListLeads(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response);
      return;
    }

    sendJson(response, 405, { error: "Metodo no permitido" });
  } catch (error) {
    sendJson(response, 500, { error: "Error interno del servidor" });
  }
});

server.listen(PORT, () => {
  console.log(`LegalEasy disponible en http://localhost:${PORT}`);
});

async function handleChat(request, response) {
  const body = await readJsonBody(request);
  const service = body.service;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const documentContext = normalizeDocumentContext(body.document);
  const enrichedDocumentContext = await enrichDocumentContext(documentContext);

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  const detectedService = service === "auto" ? detectService(message, documentContext, history) : service;

  if (!servicePrompts[detectedService]) {
    sendJson(response, 400, { error: "Servicio no valido" });
    return;
  }

  if (!message) {
    sendJson(response, 400, { error: "Escribe una pregunta antes de enviar" });
    return;
  }

  const ollamaAnswer = await tryOllama(detectedService, message, enrichedDocumentContext, history);

  if (ollamaAnswer) {
    sendJson(response, 200, {
      answer: ollamaAnswer,
      provider: "ollama"
    });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(response, 200, {
      answer: buildFallbackAnswer(detectedService, message, enrichedDocumentContext, history),
      fallback: true
    });
    return;
  }

  const input = [
    {
      role: "system",
      content: [
        "Eres el asistente de LegalEasy.",
        servicePrompts[detectedService],
        "Aclara que tu respuesta es orientativa y no reemplaza asesoria legal personalizada.",
        "Si falta contexto, indica de forma amable que datos o documentos ayudarian.",
        "Si recibes un documento, resume primero lo relevante, luego riesgos, puntos dudosos y pasos recomendados.",
        "Responde con lenguaje simple, ordenado y util para una persona no abogada.",
        "No menciones que eres una IA salvo que el usuario lo pregunte.",
        enrichedDocumentContext?.text ? `Documento adjunto (${enrichedDocumentContext.name}): ${enrichedDocumentContext.text}` : ""
      ].join(" ")
    },
    ...history.flatMap((item) => {
      if (!item || typeof item.role !== "string" || typeof item.content !== "string") {
        return [];
      }

      return [{
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content.slice(0, 2000)
      }];
    }),
    {
      role: "user",
      content: message.slice(0, 4000)
    }
  ];

  let apiResponse;

  try {
    apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input
      })
    });
  } catch {
    sendJson(response, 200, {
      answer: buildFallbackAnswer(detectedService, message, enrichedDocumentContext, history),
      fallback: true
    });
    return;
  }

  const data = await apiResponse.json();

  if (!apiResponse.ok) {
    sendJson(response, 200, {
      answer: buildFallbackAnswer(detectedService, message, enrichedDocumentContext, history),
      fallback: true
    });
    return;
  }

  const text = extractResponseText(data);

  if (!text) {
    sendJson(response, 502, { error: "El modelo no devolvio texto util" });
    return;
  }

  sendJson(response, 200, { answer: text });
}

async function handleCreateLead(request, response) {
  const body = await readJsonBody(request);
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 180);
  const phone = cleanText(body.phone, 60);
  const service = cleanText(body.service, 80) || "auto";
  const message = cleanText(body.message, 3000);
  const source = cleanText(body.source, 80) || "web";
  const appointmentPreference = cleanText(body.appointmentPreference, 240);
  const wantsAppointment = Boolean(body.wantsAppointment);
  const documentName = cleanText(body.documentName, 180);
  const documentReadable = Boolean(body.documentReadable);
  const history = Array.isArray(body.history) ? body.history.slice(-10).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: cleanText(item?.content, 1600)
  })).filter((item) => item.content) : [];

  if (!name || (!email && !phone) || !message) {
    sendJson(response, 400, {
      error: "Indica nombre, email o WhatsApp, y una descripcion breve del caso."
    });
    return;
  }

  const lead = {
    id: createLeadId(),
    createdAt: new Date().toISOString(),
    status: "nuevo",
    source,
    service,
    name,
    email,
    phone,
    message,
    wantsAppointment,
    appointmentPreference,
    documentName,
    documentReadable,
    history
  };

  await fs.promises.mkdir(dataDir, { recursive: true });
  await fs.promises.appendFile(leadsPath, `${JSON.stringify(lead)}\n`, "utf8");

  sendJson(response, 201, {
    ok: true,
    id: lead.id,
    appointmentUrl: wantsAppointment ? APPOINTMENT_URL : ""
  });
}

async function handleListLeads(request, response) {
  if (!ADMIN_TOKEN) {
    sendJson(response, 403, { error: "Bandeja no configurada. Define ADMIN_TOKEN en .env." });
    return;
  }

  const url = new URL(request.url, `http://localhost:${PORT}`);
  if (url.searchParams.get("token") !== ADMIN_TOKEN) {
    sendJson(response, 403, { error: "Acceso denegado" });
    return;
  }

  try {
    const content = await fs.promises.readFile(leadsPath, "utf8");
    const leads = content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).reverse();
    sendJson(response, 200, { leads });
  } catch {
    sendJson(response, 200, { leads: [] });
  }
}

async function serveStatic(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: "Acceso denegado" });
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      sendJson(response, 403, { error: "Ruta no valida" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.promises.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Archivo no encontrado" });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function createLeadId() {
  return `LE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 12_000_000) {
        request.destroy();
        reject(new Error("Body demasiado grande"));
      }
    });

    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return "";
  }

  const parts = [];

  for (const item of data.output) {
    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        parts.push(contentItem.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeDocumentContext(document) {
  if (!document || typeof document !== "object") {
    return null;
  }

  const name = typeof document.name === "string" ? document.name.slice(0, 160) : "documento";
  const text = typeof document.text === "string" ? document.text.replace(/\s+/g, " ").trim().slice(0, 12000) : "";
  const fileBase64 = typeof document.fileBase64 === "string" ? document.fileBase64 : "";
  const extension = typeof document.extension === "string" ? document.extension.toLowerCase() : path.extname(name).slice(1).toLowerCase();
  const readable = document.readable !== false && Boolean(text);

  if (!text && document.readable === false) {
    return { name, text: "", readable: false, fileBase64, extension };
  }

  if (!text && document.readable !== false) {
    return null;
  }

  return { name, text, readable, fileBase64, extension };
}

async function enrichDocumentContext(documentContext) {
  if (!documentContext || documentContext.readable || !documentContext.fileBase64) {
    return documentContext;
  }

  const buffer = Buffer.from(documentContext.fileBase64, "base64");
  let extractedText = "";

  if (documentContext.extension === "pdf") {
    extractedText = extractTextFromPdfBuffer(buffer);
  } else if (documentContext.extension === "docx") {
    extractedText = extractTextFromDocxBuffer(buffer);
  }

  if (!extractedText) {
    return documentContext;
  }

  return {
    ...documentContext,
    text: extractedText.slice(0, 12000),
    readable: true
  };
}

function extractTextFromPdfBuffer(buffer) {
  const raw = buffer.toString("latin1");
  const matches = raw.match(/\((?:\\.|[^\\)]){8,}\)/g) || [];
  const text = matches
    .map((item) => item.slice(1, -1))
    .map((item) => item.replace(/\\\)/g, ")").replace(/\\\(/g, "(").replace(/\\n/g, " ").replace(/\\r/g, " "))
    .join(" ")
    .replace(/[^\x20-\x7E\u00C0-\u017F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 80 ? text : "";
}

function extractTextFromDocxBuffer(buffer) {
  const raw = buffer.toString("utf8");
  const matches = raw.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
  const text = matches
    .map((item) => item.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 40 ? text : "";
}

async function tryOllama(service, message, documentContext, history) {
  const prompt = [
    "Eres el Agente LegalEasy.",
    servicePrompts[service],
    "Responde en espanol chileno neutro, claro y simple.",
    "No des una sentencia definitiva: orienta, resume riesgos y propone siguientes pasos.",
    "No cites articulos, codigos, numeros de ley ni nombres normativos especificos si el usuario no los entrega. No inventes leyes.",
    "Si falta informacion, haz preguntas concretas antes de concluir.",
    "No menciones limitaciones tecnicas ni proveedores de IA.",
    documentContext?.text ? `Documento adjunto (${documentContext.name}):\n${documentContext.text}` : "",
    history.map((item) => `${item.role === "assistant" ? "Agente" : "Usuario"}: ${item.content}`).join("\n"),
    `Usuario: ${message}`,
    "Respuesta del agente:"
  ].filter(Boolean).join("\n\n");

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.25,
          num_predict: 900
        }
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    return typeof data.response === "string" ? data.response.trim() : "";
  } catch {
    return "";
  }
}

function detectService(message, documentContext, history = []) {
  const historyText = history.map((item) => item?.content || "").join(" ");
  const text = `${message || ""} ${historyText} ${documentContext?.name || ""} ${documentContext?.text || ""}`.toLowerCase();
  const checks = [
    ["revision-contratos", ["contrato", "clausula", "firmar", "arriendo", "compraventa", "servicio", "penalidad", "multa", "renovacion"]],
    ["laboral", ["despido", "finiquito", "trabajo", "trabajador", "empleador", "sueldo", "jornada", "laboral", "contratacion"]],
    ["reclamaciones-defensa", ["reclamo", "intimacion", "notificacion", "demanda", "defensa", "responder", "plazo", "deuda"]],
    ["constitucion-empresas", ["constituir", "empresa", "sociedad", "rut empresa", "inicio de actividades", "emprendimiento"]],
    ["documentos-escritos", ["carta", "solicitud", "escrito", "poder", "acuerdo", "redactar", "documento"]],
    ["apoyo-pymes", ["pyme", "negocio", "proveedor", "cliente", "facturacion", "operacion", "comercial"]],
    ["proteccion-marca", ["marca", "logo", "dominio", "nombre comercial", "registro", "propiedad intelectual"]],
    ["cumplimiento-prevencion", ["cumplimiento", "prevencion", "riesgo", "politica", "normativa", "sancion", "control"]]
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

function buildFallbackAnswer(service, message, documentContext = null, history = []) {
  const normalizedMessage = String(message || "").toLowerCase();
  const previousUserMessages = history.filter((item) => item?.role === "user").map((item) => item.content).join(" ").toLowerCase();
  const isFollowUp = previousUserMessages.length > 0;
  const intentResponse = buildIntentResponse(service, normalizedMessage, previousUserMessages, isFollowUp);

  const documentSummary = documentContext?.readable === false ? [
    "Documento adjunto",
    `Documento recibido: ${documentContext.name}.`,
    "No tengo el texto interno extraido en esta vista, por lo que no seria serio afirmar que lei cada clausula.",
    "Para una revision mas precisa, copia aqui las clausulas principales o sube una version en TXT.",
    "Mientras tanto, estos son los puntos minimos que conviene revisar:",
    "- Partes que firman y datos de identificacion.",
    "- Obligaciones, pagos, plazos y condiciones de termino.",
    "- Multas, renovaciones automaticas, garantias y responsabilidades.",
    "- Fechas limite para responder, reclamar o desistir."
  ].join("\n") : documentContext ? [
    "Documento adjunto",
    `Documento recibido: ${documentContext.name}.`,
    `Lectura inicial: revise el texto disponible y lo usare como base para una orientacion preliminar.`,
    "Puntos utiles para analizar el documento:",
    "- Identificar partes, fechas, obligaciones y montos.",
    "- Revisar plazos, multas, renovaciones y causales de termino.",
    "- Detectar clausulas ambiguas o responsabilidades desproporcionadas.",
    "- Confirmar que lo acordado verbalmente aparezca escrito."
  ].join("\n") : "";

  const followUpQuestion = buildFollowUpQuestion(service, normalizedMessage, Boolean(documentContext));

  return [
    intentResponse.title,
    `Area detectada\n${serviceLabels[service] || "Consulta general"}`,
    intentResponse.answer,
    documentSummary,
    `Acciones concretas\n${intentResponse.actions.map((line) => `- ${line}`).join("\n")}`,
    followUpQuestion ? `Para afinar la respuesta\n${followUpQuestion}` : "",
    "Importante\nEsta respuesta es orientativa y no reemplaza asesoria legal personalizada. Si hay plazos, montos relevantes o una notificacion formal, conviene revisarlo con un profesional antes de actuar."
  ].filter(Boolean).join("\n\n");
}

function buildIntentResponse(service, normalizedMessage, previousUserMessages, isFollowUp) {
  const combined = `${previousUserMessages} ${normalizedMessage}`;

  if (service === "laboral") {
    if (combined.includes("finiquito")) {
      return {
        title: "Revision de finiquito",
        answer: isFollowUp ? "Sigamos con el finiquito. Antes de firmar, lo importante es comparar lo que te ofrecen con tu contrato, remuneraciones, fecha de termino y causal indicada." : "Si el tema es un finiquito, no conviene firmar apurado. Primero hay que revisar si los montos, causal, vacaciones, indemnizaciones y descuentos estan bien calculados.",
        actions: ["Pide copia del finiquito antes de firmar.", "Revisa causal de termino, fecha exacta y anos de servicio.", "Compara sueldo base, variables, vacaciones pendientes e indemnizaciones.", "Si algo no cuadra, consulta antes de firmar o firma con reserva si corresponde segun el caso."]
      };
    }
    if (combined.includes("despido")) {
      return {
        title: "Orientacion por despido",
        answer: "Para un despido, lo primero es revisar la carta o comunicacion formal. La causal, los hechos descritos y las fechas son los puntos que normalmente definen si hay base para reclamar o negociar.",
        actions: ["Guarda carta de despido, contrato, liquidaciones y mensajes relevantes.", "Anota fecha de aviso y fecha real de termino.", "Identifica la causal usada por el empleador.", "No borres conversaciones ni firmes documentos sin leerlos completos."]
      };
    }
  }

  if (service === "revision-contratos") {
    if (combined.includes("multa") || combined.includes("penalidad")) {
      return {
        title: "Revision de multa contractual",
        answer: "Una multa contractual no se mira sola: hay que revisar que hecho la activa, si el monto es proporcional, si hay aviso previo y si existe forma razonable de terminar o corregir el incumplimiento.",
        actions: ["Ubica la clausula exacta de multa o penalidad.", "Revisa si aplica por atraso, termino anticipado, incumplimiento o exclusividad.", "Busca si hay plazo de aviso o posibilidad de subsanar.", "Compara la multa con el valor total del contrato."]
      };
    }
    return {
      title: "Revision de contrato antes de firmar",
      answer: "Antes de firmar, el foco debe estar en obligaciones, pagos, plazos, salida del contrato y responsabilidades. Un contrato puede verse simple, pero una clausula de renovacion, multa o termino puede cambiar todo.",
      actions: ["Revisa partes, objeto, precio y plazo.", "Marca clausulas de renovacion, termino anticipado y multas.", "Verifica obligaciones tuyas y de la otra parte.", "Pide que promesas verbales queden escritas."]
    };
  }

  if (service === "reclamaciones-defensa") {
    return {
      title: "Respuesta a reclamo o notificacion",
      answer: "Si recibiste un reclamo, lo peor es responder en caliente o ignorarlo. Primero hay que entender que piden, que plazo existe y con que documentos puedes respaldar tu posicion.",
      actions: ["Identifica quien reclama y que exige exactamente.", "Revisa plazo para responder.", "Ordena pruebas: contratos, correos, pagos, mensajes y entregas.", "Prepara una respuesta breve, clara y respaldada."]
    };
  }

  if (service === "proteccion-marca") {
    return {
      title: "Proteccion de marca y activos",
      answer: "La marca no es solo el nombre: tambien incluye logo, dominio, redes, reputacion y uso comercial. Mientras antes ordenes eso, menos riesgo de conflictos o copias.",
      actions: ["Define nombre exacto, logo y rubro de uso.", "Revisa si ya existe una marca similar.", "Guarda evidencia de uso: publicaciones, boletas, web o propuestas.", "Ordena dominio, redes y autorizaciones de diseno."]
    };
  }

  if (service === "constitucion-empresas") {
    return {
      title: "Formalizacion de empresa",
      answer: "Para constituir una empresa, la decision clave no es solo crearla: es definir socios, roles, aportes, administracion y reglas para evitar conflictos despues.",
      actions: ["Define quienes seran socios y que aportara cada uno.", "Aclara quien administra y firma por la empresa.", "Define giro, domicilio y forma de repartir utilidades.", "Prepara documentos iniciales y obligaciones posteriores."]
    };
  }

  if (service === "documentos-escritos") {
    return {
      title: "Preparacion de documento legal",
      answer: "Un buen escrito debe ser claro, ordenado y pedir algo concreto. Si mezcla muchos temas o no acompana respaldo, pierde fuerza.",
      actions: ["Define objetivo del escrito.", "Ordena hechos por fecha.", "Agrega documentos que respalden lo que dices.", "Cierra con una solicitud concreta y plazo razonable."]
    };
  }

  if (service === "apoyo-pymes") {
    return {
      title: "Apoyo legal para negocio",
      answer: "En una pyme, el valor legal esta en prevenir problemas repetidos: pagos, proveedores, clientes, responsabilidades, documentos y condiciones claras.",
      actions: ["Revisa contratos o terminos con clientes.", "Ordena condiciones de pago y entrega.", "Define responsables internos de cada proceso.", "Documenta acuerdos importantes por escrito."]
    };
  }

  if (service === "cumplimiento-prevencion") {
    return {
      title: "Prevencion legal",
      answer: "Cumplir no es solo evitar sanciones. Tambien es tener procesos claros, evidencia y reglas internas que protejan el negocio si aparece un conflicto.",
      actions: ["Lista procesos sensibles.", "Revisa documentos que usas todos los meses.", "Define controles basicos y responsables.", "Guarda evidencia de decisiones, aprobaciones y comunicaciones."]
    };
  }

  return {
    title: "Orientacion inicial",
    answer: isFollowUp ? "Con lo que ya me comentaste, puedo ayudarte a ordenar el siguiente paso. Necesito precisar si buscas revisar un documento, responder a alguien, reclamar o prevenir un problema." : "Para ayudarte bien, primero hay que identificar el tipo de problema legal, si hay documentos involucrados y si existe algun plazo urgente.",
    actions: ["Cuenta brevemente que paso.", "Indica si hay documento, correo, contrato o notificacion.", "Aclara que resultado buscas.", "Menciona si hay plazo o urgencia."]
  };
}

function buildFollowUpQuestion(service, normalizedMessage, hasDocument) {
  if (hasDocument) {
    return "Quieres que lo revise enfocado en riesgos, resumen simple, obligaciones principales o puntos para negociar?";
  }

  if (service === "laboral") {
    return "Eres trabajador o empleador, y ya existe una carta, finiquito o aviso formal?";
  }

  if (service === "revision-contratos") {
    return "Que tipo de contrato es y que clausula te preocupa mas: pago, plazo, multa, termino o renovacion?";
  }

  if (service === "reclamaciones-defensa") {
    return "Recibiste una notificacion formal? Si es asi, que plazo te dieron para responder?";
  }

  if (normalizedMessage.includes("marca")) {
    return "Ya usas esa marca publicamente o estas evaluando registrarla antes de lanzarla?";
  }

  return "Quieres que te ayude a ordenar antecedentes, revisar un documento o definir el siguiente paso?";
}
