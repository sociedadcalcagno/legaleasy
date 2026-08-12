const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnvFile();

const PORT = Number(process.env.PORT || 3001);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const rootDir = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
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

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/chat") {
      await handleChat(request, response);
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

  if (!servicePrompts[service]) {
    sendJson(response, 400, { error: "Servicio no valido" });
    return;
  }

  if (!message) {
    sendJson(response, 400, { error: "Escribe una pregunta antes de enviar" });
    return;
  }

  const ollamaAnswer = await tryOllama(service, message, enrichedDocumentContext, history);

  if (ollamaAnswer) {
    sendJson(response, 200, {
      answer: ollamaAnswer,
      provider: "ollama"
    });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(response, 200, {
      answer: buildFallbackAnswer(service, message, enrichedDocumentContext),
      fallback: true
    });
    return;
  }

  const input = [
    {
      role: "system",
      content: [
        "Eres el asistente de LegalEasy.",
        servicePrompts[service],
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
      answer: buildFallbackAnswer(service, message, enrichedDocumentContext),
      fallback: true
    });
    return;
  }

  const data = await apiResponse.json();

  if (!apiResponse.ok) {
    sendJson(response, 200, {
      answer: buildFallbackAnswer(service, message, enrichedDocumentContext),
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
      signal: AbortSignal.timeout(2500)
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

function buildFallbackAnswer(service, message, documentContext = null) {
  const normalizedMessage = String(message || "").toLowerCase();
  const intro = "Te dejo una orientacion inicial en lenguaje simple para ordenar tu consulta y avanzar con mayor claridad.";

  const fallbacks = {
    "consultas-legales": [
      "Empieza por ordenar los hechos: que paso, cuando paso y que documentos tienes.",
      "Reune contratos, mensajes, correos, recibos o notificaciones relacionadas.",
      "Identifica que decision necesitas tomar: reclamar, responder, firmar, negociar o esperar.",
      "Si hay plazos o amenazas de sancion, eso debe revisarse primero."
    ],
    "revision-contratos": [
      "Revisa obligaciones, plazos, penalidades y causales de terminacion.",
      "Verifica si hay renovacion automatica, exclusividad o multas desproporcionadas.",
      "Comprueba que lo prometido verbalmente si este escrito en el contrato.",
      "No firmes si hay clausulas ambiguas sobre pagos, responsabilidades o salidas."
    ],
    "apoyo-pymes": [
      "Define que documentos usa hoy tu negocio con clientes, proveedores y aliados.",
      "Revisa si tienes terminos claros de pago, entrega, responsabilidad y cancelacion.",
      "Ordena procesos repetitivos para reducir errores y conflictos futuros.",
      "Lo mas valioso aqui es prevenir antes de que el problema escale."
    ],
    "constitucion-empresas": [
      "Primero define quienes participan, como se reparten funciones y que actividad tendra el negocio.",
      "Luego revisa la estructura juridica que mejor encaja con el proyecto.",
      "Prepara la documentacion base y valida que el negocio pueda operar formalmente.",
      "Conviene dejar claras las reglas internas desde el inicio."
    ],
    "documentos-escritos": [
      "Antes de redactar, define objetivo, destinatario y resultado esperado.",
      "Incluye hechos, fechas, nombres y documentos de respaldo.",
      "Usa lenguaje claro y peticiones concretas, sin mezclar temas distintos.",
      "Revisa tono, precision y pruebas antes de enviarlo."
    ],
    "reclamaciones-defensa": [
      "No ignores un reclamo sin revisarlo primero.",
      "Analiza que te estan pidiendo, en que plazo y con que fundamentos.",
      "Ordena pruebas, comunicaciones previas y documentos relacionados.",
      "Responder con criterio suele ser mejor que improvisar o reaccionar en caliente."
    ],
    laboral: [
      "Aclara si consultas como trabajador o como empleador.",
      "Reune contrato, recibos, mensajes y comunicaciones laborales relevantes.",
      "Identifica si el problema es contratacion, funciones, pagos, sanciones o desvinculacion.",
      "Si existe plazo o notificacion formal, revisalo como prioridad."
    ],
    "proteccion-marca": [
      "Lo primero es validar si el nombre o identidad que usas puede generar conflicto con terceros.",
      "Tambien conviene revisar como estas usando logo, nombre comercial y activos digitales.",
      "Proteger la marca ayuda a evitar choques futuros y perdida de valor.",
      "Documentar uso y prioridad del nombre suele ser util desde etapas tempranas."
    ],
    "cumplimiento-prevencion": [
      "Revisa primero los procesos donde mas se repiten errores o reclamos.",
      "Haz una lista de documentos sensibles: contratos, autorizaciones, comunicaciones y politicas.",
      "La prevencion legal busca corregir antes de que el conflicto exista.",
      "Pequenos ajustes en procesos suelen evitar costos mayores despues."
    ]
  };

  const lines = fallbacks[service] || [
    "Reune el contexto principal del caso.",
    "Ordena los documentos importantes.",
    "Define que decision necesitas tomar y si existe urgencia o plazo."
  ];

  let tailored = "";

  if (normalizedMessage.includes("contrato") || normalizedMessage.includes("firm")) {
    tailored = "Por lo que preguntas, parece importante revisar obligaciones, pagos, penalidades, renovacion y salida del acuerdo antes de avanzar.";
  } else if (normalizedMessage.includes("despido") || normalizedMessage.includes("trabajo") || normalizedMessage.includes("labor")) {
    tailored = "Por el tipo de consulta, conviene ordenar fechas, comunicaciones y documentos laborales para evaluar riesgos y opciones.";
  } else if (normalizedMessage.includes("empresa") || normalizedMessage.includes("negocio") || normalizedMessage.includes("pyme")) {
    tailored = "Tu duda parece vinculada a operacion de negocio, asi que lo mas util es revisar estructura, documentos base y prevencion de riesgos.";
  }

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

  return [
    "Orientacion inicial",
    intro,
    documentSummary,
    tailored ? `Lectura del caso\n${tailored}` : "",
    `Puntos recomendados\n${lines.map((line) => `- ${line}`).join("\n")}`,
    "Importante\nEsta respuesta es orientativa y no reemplaza asesoria legal personalizada. Si hay plazos, montos relevantes o una notificacion formal, conviene revisarlo con un profesional antes de actuar."
  ].filter(Boolean).join("\n\n");
}
