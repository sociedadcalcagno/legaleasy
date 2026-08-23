const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const serviceLabels = {
  "consultas-legales": "Consultas legales",
  "revision-contratos": "Revisión de contratos",
  "apoyo-pymes": "Apoyo a pymes",
  "constitucion-empresas": "Constitución de empresas",
  "documentos-escritos": "Documentos y escritos",
  "reclamaciones-defensa": "Reclamaciones y defensa",
  laboral: "Laboral",
  "proteccion-marca": "Protección de marca y activos",
  "cumplimiento-prevencion": "Cumplimiento y prevención"
};

const servicePrompts = {
  "consultas-legales": "orientación legal inicial general",
  "revision-contratos": "revisión contractual inicial, cláusulas, riesgos, plazos, multas y negociación",
  "apoyo-pymes": "apoyo legal práctico para pymes, clientes, proveedores, documentos y prevención",
  "constitucion-empresas": "constitución de empresas, socios, administración, giro, aportes y formalización",
  "documentos-escritos": "redacción y revisión de cartas, solicitudes, acuerdos, poderes y escritos",
  "reclamaciones-defensa": "reclamos, notificaciones, defensa inicial, plazos y antecedentes",
  laboral: "orientación laboral para trabajadores y empleadores",
  "proteccion-marca": "protección de marca, nombre comercial, logo, dominio y activos intangibles",
  "cumplimiento-prevencion": "cumplimiento, prevención legal, procesos, políticas internas y documentación"
};

const legalManuals = [
  {
    id: "consultas-legales",
    title: "Consultas legales",
    summary: "Primera orientación para ordenar hechos, documentos, riesgos y próximos pasos.",
    sections: [
      "Identificar qué ocurrió, desde cuándo, quiénes participan y qué resultado busca la persona.",
      "Preguntar si existe contrato, carta, correo, notificación, deuda, plazo o documento formal.",
      "Si hay plazo, firma próxima, demanda, despido o monto relevante, recomendar derivación humana o agenda."
    ]
  },
  {
    id: "revision-contratos",
    title: "Revisión de contratos",
    summary: "Revisión inicial de objeto, precio, plazo, multas, renovación, término anticipado y obligaciones.",
    sections: [
      "Antes de firmar: revisar partes, objeto, precio, plazo, forma de pago, multas, garantías y causales de término.",
      "Si el usuario menciona multa o penalidad, pedir cláusula exacta, monto, evento que activa la multa y posibilidad de subsanar.",
      "Si el contrato está adjunto, resumir primero lo visible, luego riesgos y preguntas de seguimiento."
    ]
  },
  {
    id: "laboral",
    title: "Laboral",
    summary: "Orientación inicial para trabajadores y empleadores sobre contrato, despido, finiquito, sueldo y jornada.",
    sections: [
      "Distinguir si la persona es trabajador o empleador.",
      "Para despido o finiquito: pedir carta, causal, fecha, contrato, liquidaciones, vacaciones e indemnizaciones.",
      "Si debe firmar pronto, recomendar revisión humana antes de firmar."
    ]
  },
  {
    id: "reclamaciones-defensa",
    title: "Reclamaciones y defensa",
    summary: "Ordenar reclamos, notificaciones, deudas, defensas y plazos de respuesta.",
    sections: [
      "Identificar quién reclama, qué exige, cómo notificó y qué plazo dio.",
      "Ordenar pruebas: contrato, pagos, correos, mensajes, boletas, entregas y fechas.",
      "No recomendar responder en caliente; sugerir respuesta breve, documentada y revisión humana si hay plazo formal."
    ]
  },
  {
    id: "apoyo-pymes",
    title: "Apoyo a pymes",
    summary: "Soporte legal práctico para clientes, proveedores, pagos, documentos y prevención.",
    sections: [
      "Clasificar si el problema es con cliente, proveedor, trabajador, socio o documento interno.",
      "Ordenar condiciones de pago, entregas, responsabilidades y evidencia.",
      "Proponer prevención: contratos simples, políticas internas, respaldo documental y agenda si hay conflicto activo."
    ]
  },
  {
    id: "proteccion-marca",
    title: "Protección de marca y activos",
    summary: "Cuidado de nombre comercial, logo, dominio, redes y activos intangibles.",
    sections: [
      "Preguntar si la marca ya está en uso o antes de lanzamiento.",
      "Reunir nombre exacto, logo, rubro, dominio, redes y evidencia de uso.",
      "Si hay conflicto o copia, derivar para revisión humana."
    ]
  }
];

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      service: "LegalEasy chat API",
      method: "POST",
      openaiModel: OPENAI_MODEL,
      geminiModel: GEMINI_MODEL,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido" });
  }

  try {
    const body = parseBody(event.body);
    const message = cleanText(body.message, 5000);
    const documentContext = normalizeDocument(body.document);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const service = body.service === "auto" ? detectService(message, documentContext, history) : cleanText(body.service, 80);

    if (!message) {
      return json(400, { error: "Escribe una consulta antes de enviar" });
    }

    if (!servicePrompts[service]) {
      return json(400, { error: "Servicio no válido" });
    }

    if (/^(hola|buenas|buenos dias|buenos días|buenas tardes|buenas noches)\b/i.test(message)) {
      return json(200, {
        answer: "Hola. Cuéntame brevemente qué necesitas revisar: contrato, despido/finiquito, reclamo, deuda, empresa, marca o documento. Si tienes un plazo o documento formal, dime cuál es para priorizarlo.",
        service,
        provider: "local-greeting"
      });
    }

    const context = buildLegalContext(service, message);
    const promptText = buildPromptText(service, message, documentContext, history, context);
    const geminiAnswer = normalizeAssistantAnswer(await tryGemini(promptText));
    if (geminiAnswer) {
      return json(200, { answer: geminiAnswer, service, provider: "gemini-netlify" });
    }

    const openAiAnswer = normalizeAssistantAnswer(await tryOpenAi(service, message, documentContext, history, context));
    if (openAiAnswer) {
      return json(200, { answer: openAiAnswer, service, provider: "openai-netlify" });
    }

    return json(200, {
      answer: buildLocalFallback(service, message, documentContext, history),
      service,
      provider: "local-guide",
      fallback: true
    });
  } catch (error) {
    console.error("LegalEasy chat error", error);
    return json(200, {
      answer: buildLocalFallback("consultas-legales", "", null, []),
      service: "consultas-legales",
      provider: "local-guide",
      fallback: true
    });
  }
};

async function tryGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 500
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini error", { status: response.status, message: data?.error?.message || "Sin detalle" });
      return null;
    }

    return extractGeminiText(data);
  } catch (error) {
    console.error("Gemini fetch error", error);
    return null;
  }
}

async function tryOpenAi(service, message, documentContext, history, context) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: buildMessages(service, message, documentContext, history, context),
        temperature: 0.35,
        max_tokens: 500
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI error", {
        status: response.status,
        type: data?.error?.type || "unknown",
        message: data?.error?.message || "Sin detalle del proveedor",
        model: OPENAI_MODEL
      });
      return null;
    }

    return extractResponseText(data);
  } catch (error) {
    console.error("OpenAI fetch error", error);
    return null;
  }
}

function buildMessages(service, message, documentContext, history, context = "") {
  const documentText = documentContext?.text
    ? `Documento adjunto (${documentContext.name}): ${documentContext.text}`
    : documentContext?.name
      ? `El usuario adjuntó un documento llamado ${documentContext.name}, pero no hay texto extraído disponible.`
      : "";

  return [
    {
      role: "system",
      content: [
        "Eres el Agente LegalEasy, un asistente legal conversacional chileno para atención inicial.",
        "Actúa como un asistente humano competente, pero mantente acotado: no divagues, no hagas clases largas y no salgas del problema legal planteado.",
        `Área de trabajo: ${serviceLabels[service]} (${servicePrompts[service]}).`,
        "No des sentencia definitiva, no inventes leyes, artículos ni plazos exactos si el usuario no los entrega.",
        "Haz máximo 1 pregunta concreta cuando falte información. Evita respuestas largas y robóticas.",
        "Si detectas urgencia, documento formal, firma próxima, despido, demanda, deuda o plazo, recomienda derivar a asistente humano o agendar cita.",
        "Entrega exactamente 4 líneas completas, una por cada etiqueta: Entendí esto:, Punto clave:, Siguiente paso:, Pregunta:. Máximo 1200 caracteres total.",
        "Si el usuario pregunta algo fuera del ámbito legal o sin contexto, redirígelo amablemente a explicar su caso legal concreto.",
        "No menciones leyes, artículos, instituciones, acciones judiciales específicas ni plazos si el usuario no entregó esos datos.",
        "Usa español chileno neutro, cercano y claro.",
        context ? `Contexto LegalEasy:
${context}` : "",
        documentText
      ].filter(Boolean).join(" ")
    },
    ...history.flatMap((item) => {
      if (!item || typeof item.content !== "string") {
        return [];
      }

      return [{
        role: item.role === "assistant" ? "assistant" : "user",
        content: cleanText(item.content, 2500)
      }];
    }),
    { role: "user", content: message }
  ];
}

function buildPromptText(service, message, documentContext, history, context) {
  const historyText = history
    .slice(-10)
    .map((item) => `${item.role === "assistant" ? "Asistente" : "Usuario"}: ${cleanText(item.content, 2500)}`)
    .join("\n");
  const documentText = documentContext?.text
    ? `Documento adjunto (${documentContext.name}): ${documentContext.text}`
    : documentContext?.name
      ? `El usuario adjuntó ${documentContext.name}, pero no hay texto extraído.`
      : "Sin documento adjunto.";

  return [
    "Eres el Agente LegalEasy, asistente legal conversacional chileno para atención inicial.",
    "Actúa como un asistente humano competente, pero mantente acotado: no divagues, no hagas clases largas y no salgas del problema legal planteado.",
    `Área detectada: ${serviceLabels[service]} (${servicePrompts[service]}).`,
    "No inventes leyes, artículos ni plazos exactos. No des sentencia definitiva.",
    "Haz máximo 1 pregunta concreta cuando falte información.",
    "Si hay documento formal, firma próxima, despido, demanda, deuda, plazo o monto relevante, recomienda derivar a asistente humano o agendar cita.",
    "Entrega exactamente 4 líneas completas, una por cada etiqueta: Entendí esto:, Punto clave:, Siguiente paso:, Pregunta:. Máximo 1200 caracteres total.",
    "Si el usuario pregunta algo fuera del ámbito legal o sin contexto, redirígelo amablemente a explicar su caso legal concreto.",
    "No menciones leyes, artículos, instituciones, acciones judiciales específicas ni plazos si el usuario no entregó esos datos.",
    `Contexto LegalEasy:\n${context}`,
    historyText ? `Conversación previa:\n${historyText}` : "",
    documentText,
    `Consulta del usuario: ${message}`,
    "Respuesta:"
  ].filter(Boolean).join("\n\n");
}

function buildLegalContext(service, question) {
  const selected = new Set([service, ...searchManuals(question).map((item) => item.id)]);
  return legalManuals
    .filter((manual) => selected.has(manual.id))
    .map((manual) => [
      `# ${manual.title}`,
      manual.summary,
      ...manual.sections.map((section) => `- ${section}`)
    ].join("\n"))
    .join("\n\n");
}

function searchManuals(question) {
  const tokens = tokenize(question);
  const hits = [];
  for (const manual of legalManuals) {
    const haystack = `${manual.title}\n${manual.summary}\n${manual.sections.join("\n")}`.toLowerCase();
    const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
    if (score > 0) {
      hits.push({ id: manual.id, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 3);
}

function tokenize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 16);
}

function buildLocalFallback(service, message, documentContext, history = []) {
  const label = serviceLabels[service] || serviceLabels[detectService(message, documentContext)] || "Consulta legal";
  const hasDocument = Boolean(documentContext?.name);
  const combined = `${history.map((item) => item?.content || "").join(" ")} ${message || ""}`.toLowerCase();
  const isVague = tokenize(message).length <= 2 && !hasDocument;
  const hasUrgency = /plazo|mañana|manana|hoy|urgente|firmar|notific|demanda|carta|despido|finiquito|multa|deuda/.test(combined);
  const wantsHuman = /abogado|persona|humano|asesor|asistente|agendar|cita|llamada|contact/.test(combined);

  if (wantsHuman) {
    return [
      "Entendí esto: quieres que una persona revise o tome el caso.",
      "Punto clave: para derivarlo bien necesito dejar el caso ordenado, no solo una consulta suelta.",
      "Siguiente paso: presiona Derivar a asistente o Agendar cita y agrega nombre, WhatsApp/email y un resumen breve.",
      "Pregunta: ¿hay un documento o plazo que debamos priorizar?"
    ].join("\n");
  }

  if (isVague) {
    return [
      "Entendí esto: quieres hacer una consulta, pero todavía falta el tema concreto.",
      "Punto clave: puedo ayudarte mejor si clasificamos el caso primero.",
      "Siguiente paso: dime si es contrato, laboral, reclamo/deuda, empresa, marca o documento.",
      "Pregunta: ¿qué ocurrió y qué necesitas lograr?"
    ].join("\n");
  }

  if (service === "revision-contratos") {
    return [
      "Entendí esto: la consulta apunta a revisar un contrato o una cláusula antes de avanzar.",
      hasDocument
        ? `Punto clave: hay un documento asociado (${documentContext.name}); conviene mirar objeto, precio, plazo, multas, renovación y término anticipado.`
        : "Punto clave: sin ver la cláusula exacta solo puedo orientar; la multa o el plazo dependen de cómo está redactado el contrato.",
      hasUrgency
        ? "Siguiente paso: si debes firmar pronto o hay multa, deriva el caso para revisión humana antes de aceptar."
        : "Siguiente paso: copia la cláusula que te preocupa o sube el contrato para ordenar riesgos.",
      "Pregunta: ¿la preocupación principal es multa, plazo, pago, renovación o término anticipado?"
    ].join("\n");
  }

  if (service === "laboral") {
    return [
      "Entendí esto: la consulta parece laboral.",
      "Punto clave: cambia mucho si eres trabajador o empleador, y si ya existe carta, finiquito, contrato o aviso formal.",
      hasUrgency
        ? "Siguiente paso: no firmes apurado; ordena carta, contrato, liquidaciones, fechas y mensajes antes de responder."
        : "Siguiente paso: identifica el documento principal y la fecha del hecho.",
      "Pregunta: ¿eres trabajador o empleador, y qué documento tienes a mano?"
    ].join("\n");
  }

  if (service === "reclamaciones-defensa") {
    return [
      "Entendí esto: hay un reclamo, deuda, notificación o posible defensa que ordenar.",
      "Punto clave: lo primero es saber quién reclama, qué exige, cómo notificó y si dio plazo.",
      "Siguiente paso: reúne contrato, pagos, correos, mensajes, boletas y fecha de recepción.",
      "Pregunta: ¿recibiste una notificación formal o todavía es una conversación informal?"
    ].join("\n");
  }

  if (service === "constitucion-empresas") {
    return [
      "Entendí esto: quieres ordenar un inicio o estructura de empresa.",
      "Punto clave: antes de crear documentos hay que definir socios, aportes, administración, giro y quién firma.",
      "Siguiente paso: separa qué decisiones ya están tomadas y cuáles faltan.",
      "Pregunta: ¿la empresa será solo tuya o tendrá socios?"
    ].join("\n");
  }

  if (service === "proteccion-marca") {
    return [
      "Entendí esto: quieres proteger marca, nombre, logo, dominio o identidad comercial.",
      "Punto clave: importa saber si la marca ya está en uso público o si todavía está antes del lanzamiento.",
      "Siguiente paso: reúne nombre exacto, rubro, logo, dominio, redes y evidencia de uso.",
      "Pregunta: ¿ya estás usando la marca públicamente?"
    ].join("\n");
  }

  if (service === "apoyo-pymes") {
    return [
      "Entendí esto: la consulta parece relacionada con un negocio o pyme.",
      "Punto clave: hay que ubicar si el problema es con cliente, proveedor, trabajador, socio, pago o documento.",
      "Siguiente paso: ordena fechas, acuerdos, pagos, mensajes y qué resultado buscas: cobrar, responder, negociar o prevenir.",
      "Pregunta: ¿el problema es con cliente, proveedor, trabajador, socio o contrato?"
    ].join("\n");
  }

  return [
    `Entendí que tu consulta se relaciona con ${label}.`,
    hasDocument
      ? `Veo que hay un documento asociado (${documentContext.name}). Para revisarlo bien necesito que me indiques qué te preocupa: plazo, firma, multa, pago, despido, reclamo u otra cláusula.`
      : "Para orientarte mejor necesito ubicar si hay contrato, carta, correo, notificación, deuda, plazo o documento formal.",
    hasUrgency
      ? "Punto clave: como mencionas algo sensible o urgente, conviene priorizar revisión humana antes de actuar."
      : "Punto clave: mientras más específico sea el hecho y el documento, mejor se puede orientar el siguiente paso.",
    "Siguiente paso: resume qué ocurrió, desde cuándo, qué documento existe y qué resultado buscas.",
    "Pregunta para seguir: ¿hay un plazo concreto o documento que debas firmar/responder?"
  ].join("\n");
}

function parseBody(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

function normalizeDocument(document) {
  if (!document || typeof document !== "object") {
    return null;
  }

  return {
    name: cleanText(document.name, 180) || "documento",
    text: cleanText(document.text, 12000)
  };
}

function detectService(message, documentContext, history = []) {
  const historyText = history.map((item) => item?.content || "").join(" ");
  const text = `${message || ""} ${historyText} ${documentContext?.name || ""} ${documentContext?.text || ""}`.toLowerCase();
  const checks = [
    ["revision-contratos", ["contrato", "cláusula", "clausula", "firmar", "arriendo", "multa", "penalidad", "renovación", "renovacion"]],
    ["laboral", ["despido", "finiquito", "trabajo", "trabajador", "empleador", "sueldo", "jornada", "laboral"]],
    ["reclamaciones-defensa", ["reclamo", "demanda", "notificación", "notificacion", "deuda", "plazo", "defensa"]],
    ["constitucion-empresas", ["empresa", "sociedad", "constituir", "emprendimiento", "socio"]],
    ["documentos-escritos", ["carta", "solicitud", "escrito", "poder", "documento", "redactar"]],
    ["apoyo-pymes", ["pyme", "negocio", "cliente", "proveedor", "factura", "comercial"]],
    ["proteccion-marca", ["marca", "logo", "dominio", "nombre comercial", "registro"]],
    ["cumplimiento-prevencion", ["cumplimiento", "prevención", "prevencion", "riesgo", "política", "politica"]]
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

function extractResponseText(data) {
  const chatText = data?.choices?.[0]?.message?.content;
  if (typeof chatText === "string" && chatText.trim()) {
    return chatText.trim();
  }

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return "";
  }

  return data.output.flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function extractGeminiText(data) {
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || "";
  return String(text || "").trim() || null;
}

function normalizeAssistantAnswer(answer) {
  const text = String(answer || "").replace(/\s+\n/g, "\n").trim();
  if (!text) {
    return null;
  }

  if (text.length < 120 || /\b(con|de|para|por|y|o|que|si)$/i.test(text)) {
    return null;
  }

  if (text.length <= 1400) {
    return text;
  }

  return `${text.slice(0, 1350).trim()}\n\nPara seguir sin irnos por las ramas: ¿cuál es el documento, plazo o problema concreto que necesitas revisar?`;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function getSafeProviderReason(status, type) {
  if (status === 401) {
    return "openai_auth";
  }

  if (status === 402 || status === 429 || type === "insufficient_quota") {
    return "openai_quota_or_billing";
  }

  if (status === 400) {
    return "openai_request_or_model";
  }

  return "openai_provider_error";
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  };
}
