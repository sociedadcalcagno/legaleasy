const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Método no permitido" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: "OPENAI_API_KEY no configurada" });
    return;
  }

  try {
    const body = normalizeBody(request.body);
    const message = cleanText(body.message, 5000);
    const documentContext = normalizeDocument(body.document);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const service = body.service === "auto" ? detectService(message, documentContext, history) : cleanText(body.service, 80);

    if (!message) {
      sendJson(response, 400, { error: "Escribe una consulta antes de enviar" });
      return;
    }

    if (!servicePrompts[service]) {
      sendJson(response, 400, { error: "Servicio no válido" });
      return;
    }

    const input = buildInput(service, message, documentContext, history);
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input,
        temperature: 0.35
      })
    });

    const data = await aiResponse.json();
    if (!aiResponse.ok) {
      sendJson(response, 502, { error: "No pude conectar con el modelo de IA" });
      return;
    }

    const answer = extractResponseText(data);
    if (!answer) {
      sendJson(response, 502, { error: "El modelo no devolvió una respuesta útil" });
      return;
    }

    sendJson(response, 200, { answer, service, provider: "openai" });
  } catch {
    sendJson(response, 500, { error: "Error interno del asistente" });
  }
};

function buildInput(service, message, documentContext, history) {
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
        "Tu objetivo es guiar al usuario como lo haría un asistente humano competente: escuchar, ordenar, preguntar y proponer el siguiente paso.",
        `Área de trabajo: ${serviceLabels[service]} (${servicePrompts[service]}).`,
        "No des sentencia definitiva, no inventes leyes, artículos ni plazos exactos si el usuario no los entrega.",
        "Haz máximo 1 a 3 preguntas concretas cuando falte información. No llenes de texto innecesario.",
        "Si detectas urgencia, documento formal, firma próxima, despido, demanda, deuda o plazo, recomienda derivar a asistente humano o agendar cita.",
        "Estructura la respuesta con: 1) entendí esto, 2) riesgo o punto clave, 3) próximos pasos, 4) pregunta de seguimiento.",
        "Usa español chileno neutro, claro y cercano. Evita sonar robótico.",
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
    {
      role: "user",
      content: message
    }
  ];
}

function normalizeBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

function normalizeDocument(document) {
  if (!document || typeof document !== "object") {
    return null;
  }

  const name = cleanText(document.name, 180) || "documento";
  const text = cleanText(document.text, 12000);
  return { name, text };
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

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}
