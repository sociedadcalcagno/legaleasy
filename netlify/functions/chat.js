const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const { buildKnowledgeContext, detectEscalation, getLegalArea } = require("./legal-knowledge");

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

    const shouldEscalate = detectEscalation(`${message} ${documentContext?.name || ""} ${documentContext?.text || ""}`);
    const conversationalAnswer = buildConversationalAnswer(service, message, documentContext, history, shouldEscalate);
    if (conversationalAnswer) {
      return json(200, { answer: conversationalAnswer, service, provider: "local-engine" });
    }

    const context = buildKnowledgeContext(service, message);
    const promptText = buildPromptText(service, message, documentContext, history, context);
    const geminiAnswer = normalizeAssistantAnswer(await tryGemini(promptText, documentContext));
    if (geminiAnswer) {
      return json(200, { answer: geminiAnswer, service, provider: "gemini-netlify" });
    }

    const openAiAnswer = normalizeAssistantAnswer(await tryOpenAi(service, message, documentContext, history, context));
    if (openAiAnswer) {
      return json(200, { answer: openAiAnswer, service, provider: "openai-netlify" });
    }

    return json(200, {
      answer: buildLocalFallback(service, message, documentContext, history, shouldEscalate),
      service,
      provider: "local-guide",
      fallback: true
    });
  } catch (error) {
    console.error("LegalEasy chat error", error);
    return json(200, {
      answer: buildLocalFallback("consultas-legales", "", null, [], false),
      service: "consultas-legales",
      provider: "local-guide",
      fallback: true
    });
  }
};

async function tryGemini(promptText, documentContext = null) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const parts = [{ text: promptText }];
    const imagePart = buildGeminiImagePart(documentContext);
    if (imagePart) {
      parts.push(imagePart);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
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
        "Actúa como un asistente humano competente: responde con empatía breve, ordena el problema y da un siguiente paso útil.",
        `Área de trabajo: ${serviceLabels[service]} (${servicePrompts[service]}).`,
        "No des sentencia definitiva, no inventes leyes, artículos ni plazos exactos si el usuario no los entrega.",
        "Haz máximo 1 pregunta concreta cuando falte información. Evita respuestas largas y robóticas.",
        "Si detectas urgencia, documento formal, firma próxima, despido, demanda, deuda o plazo, recomienda derivar a asistente humano o agendar cita.",
        "No uses plantilla rígida salvo que ayude. Responde en 2 a 4 párrafos breves, máximo 1200 caracteres.",
        "Primero reconoce la situación de forma natural; luego explica qué revisar; termina con una sola pregunta concreta.",
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
  const isImage = isImageDocument(documentContext);
  const documentText = documentContext?.text
    ? `Documento adjunto (${documentContext.name}): ${documentContext.text}`
    : documentContext?.name
      ? isImage
        ? `El usuario adjuntó una imagen (${documentContext.name}). Primero intenta leer visualmente texto visible y reconocer si parece contrato, carta, citación, boleta, factura, finiquito, reclamo u otro documento. Si la imagen no es legible, dilo.`
        : `El usuario adjuntó ${documentContext.name}, pero no hay texto extraído.`
      : "Sin documento adjunto.";

  return [
    "Eres el Agente LegalEasy, asistente legal conversacional chileno para atención inicial.",
    "Actúa como un asistente humano competente: responde con empatía breve, ordena el problema y da un siguiente paso útil.",
    `Área detectada: ${serviceLabels[service]} (${servicePrompts[service]}).`,
    "No inventes leyes, artículos ni plazos exactos. No des sentencia definitiva.",
    "Haz máximo 1 pregunta concreta cuando falte información.",
    detectEscalation(`${message} ${documentContext?.name || ""} ${documentContext?.text || ""}`)
      ? "Atención: esta consulta contiene señales de riesgo o escalamiento. Recomienda revisión profesional antes de una actuación formal."
      : "Si hay documento formal, firma próxima, despido, demanda, deuda, plazo o monto relevante, recomienda derivar a asistente humano o agendar cita.",
    "No uses plantilla rígida salvo que ayude. Responde en 2 a 4 párrafos breves, máximo 1200 caracteres.",
    "Primero reconoce la situación de forma natural; luego explica qué revisar; termina con una sola pregunta concreta.",
    "Si el usuario pregunta algo fuera del ámbito legal o sin contexto, redirígelo amablemente a explicar su caso legal concreto.",
    "No menciones leyes, artículos, instituciones, acciones judiciales específicas ni plazos si el usuario no entregó esos datos.",
    `Contexto LegalEasy:\n${context}`,
    historyText ? `Conversación previa:\n${historyText}` : "",
    documentText,
    `Consulta del usuario: ${message}`,
    "Respuesta:"
  ].filter(Boolean).join("\n\n");
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

function buildLocalFallback(service, message, documentContext, history = [], shouldEscalate = false) {
  const label = serviceLabels[service] || serviceLabels[detectService(message, documentContext)] || "Consulta legal";
  const area = getLegalArea(service);
  const hasDocument = Boolean(documentContext?.name);
  const combined = `${history.map((item) => item?.content || "").join(" ")} ${message || ""}`.toLowerCase();
  const isVague = tokenize(message).length <= 2 && !hasDocument;
  const hasUrgency = /plazo|mañana|manana|hoy|urgente|firmar|notific|demanda|carta|despido|finiquito|multa|deuda/.test(combined);
  const wantsHuman = /abogado|persona|humano|asesor|asistente|agendar|cita|llamada|contact/.test(combined);
  const conceptAnswer = buildConceptAnswer(message);

  if (conceptAnswer) {
    return conceptAnswer;
  }

  if (wantsHuman) {
    return [
      "Perfecto. Si quieres que una persona lo revise, lo mejor es derivar el caso con los antecedentes ordenados, no solo con una pregunta suelta.",
      "Presiona Derivar a asistente o Agendar cita y agrega tu contacto, el resumen del problema, el documento si existe y el bloque horario que prefieras.",
      "¿Hay algún plazo o documento que el equipo deba priorizar?"
    ].join("\n\n");
  }

  if (isVague) {
    return [
      "Te puedo ayudar, pero necesito ubicar primero el tipo de problema. No quiero darte una respuesta genérica si todavía no sabemos si es contrato, laboral, deuda, empresa, marca o documento.",
      "Cuéntame en una frase qué ocurrió, con quién es el problema y qué necesitas lograr.",
      "¿Hay algún documento o plazo involucrado?"
    ].join("\n\n");
  }

  if (service === "revision-contratos") {
    return [
      "Entiendo. Si hay un contrato de por medio, especialmente antes de firmar, conviene no mirarlo solo por encima.",
      hasDocument
        ? `Con el documento ${documentContext.name}, lo importante es revisar partes, objeto, precio, plazo, multas, renovación y término anticipado.`
        : "Sin ver la cláusula exacta solo puedo orientar, porque una multa o un plazo dependen mucho de cómo están redactados.",
      shouldEscalate || hasUrgency
        ? "Si debes firmar pronto o ya aparece una multa, sería prudente derivarlo para revisión humana antes de aceptar."
        : "Podemos partir marcando la cláusula que te preocupa y ordenando los riesgos principales.",
      "¿La preocupación principal es multa, plazo, pago, renovación o término anticipado?"
    ].join("\n\n");
  }

  if (service === "laboral") {
    return [
      "Entiendo. En temas laborales conviene avanzar con cuidado, sobre todo si hay carta, finiquito o una firma cercana.",
      "Lo primero es separar si consultas como trabajador o empleador, y revisar contrato, carta, liquidaciones, cotizaciones, fechas y cualquier comunicación escrita.",
      hasUrgency
        ? "Si debes firmar pronto, no conviene hacerlo apurado sin revisar los montos y la causal indicada."
        : "Con esos antecedentes se puede ordenar mejor el escenario y ver qué falta.",
      "¿Eres trabajador o empleador, y qué documento tienes a mano?"
    ].join("\n\n");
  }

  if (service === "reclamaciones-defensa") {
    return [
      "Entiendo. Si hay un reclamo, deuda o notificación, lo más importante es no responder en caliente ni dejar pasar un eventual plazo.",
      "Hay que ordenar quién reclama, qué exige, cómo te lo comunicó y qué respaldo tienes: contrato, pagos, correos, mensajes, boletas o comprobantes.",
      "¿Recibiste una notificación formal o todavía es una conversación informal?"
    ].join("\n\n");
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
    `Entiendo. Por lo que cuentas, esto parece relacionarse con ${label}.`,
    hasDocument
      ? `Veo que hay un documento asociado (${documentContext.name}). Para revisarlo bien necesito saber qué te preocupa: plazo, firma, multa, pago, despido, reclamo u otra cláusula.`
      : `Para orientarte mejor necesito ubicar algunos antecedentes clave: ${area.review?.slice(0, 5).join(", ") || "hechos, fechas y documentos"}.`,
    shouldEscalate || hasUrgency
      ? "Como hay señales de riesgo o plazo, conviene que estos antecedentes sean revisados antes de hacer una actuación formal."
      : area.rule || "Punto clave: mientras más específico sea el hecho y el documento, mejor se puede orientar el siguiente paso.",
    "¿Hay un plazo concreto o documento que debas firmar o responder?"
  ].join("\n\n");
}

function buildConversationalAnswer(service, message, documentContext, history = [], shouldEscalate = false) {
  const text = normalizeLoose(message);
  const facts = extractConversationFacts(message, history);

  const conceptAnswer = buildConceptAnswer(message);
  if (conceptAnswer) {
    return conceptAnswer;
  }

  if (documentContext?.name && /revisa|analiza|que dice|qué dice|documento|imagen|foto|archivo/.test(text)) {
    return null;
  }

  if (service === "laboral" || facts.area === "laboral") {
    const laborAnswer = buildLaborConversationalAnswer(text, facts, shouldEscalate);
    if (laborAnswer) {
      return laborAnswer;
    }
  }

  if (service === "revision-contratos" || facts.area === "contratos") {
    const contractAnswer = buildContractConversationalAnswer(text, facts, shouldEscalate);
    if (contractAnswer) {
      return contractAnswer;
    }
  }

  return null;
}

function extractConversationFacts(message, history = []) {
  const combined = normalizeLoose(`${history.map((item) => item?.content || "").join(" ")} ${message || ""}`);
  return {
    area: /despido|desped|desepd|finiquito|trabajador|empleador|sueldo|cotizacion|laboral|renuncia/.test(combined) ? "laboral" : /contrato|arriendo|multa|clausula|penalidad/.test(combined) ? "contratos" : "general",
    isWorker: /soy trabajador|trabajador|me despid|me echaron|mi empleador|mi jefe|trabajo en/.test(combined),
    isEmployer: /soy empleador|tengo trabajadores|mi trabajador|empresa despid/.test(combined),
    hasFiniquito: /finiquito/.test(combined),
    hasDismissalLetter: /carta de despido|carta despido|me entregaron carta|causal/.test(combined),
    mustSignSoon: /mañana|manana|hoy|ahora|urgente|firmar pronto|firmarlo mañana|firmarlo manana/.test(combined),
    alreadySigned: /ya firme|ya firmé|firme el finiquito|firmé el finiquito/.test(combined),
    asksConsequence: /que pasa si|qué pasa si|y si|puedo|debo|conviene|es malo|me perjudica/.test(normalizeLoose(message)),
    asksAmount: /monto|calculo|cálculo|calcular|indemnizacion|indemnización|vacaciones|sueldo|cotizaciones|pago|me deben/.test(normalizeLoose(message)),
    asksReserve: /reserva|reservar derechos|derechos/.test(normalizeLoose(message)),
    asksNotSign: /no firmo|no quiero firmar|si no firmo|negarme a firmar|rechazo firmar/.test(normalizeLoose(message)),
    asksSigned: /ya firme|ya firmé|despues de firmar|después de firmar/.test(normalizeLoose(message)),
    asksCotizaciones: /cotizacion|cotización|cotizaciones|afp|salud|fonasa|isapre/.test(normalizeLoose(message)),
    asksDismissalLetter: /carta|causal|motivo del despido|por que me despidieron|por qué me despidieron/.test(normalizeLoose(message)),
    asksHarassment: /acos|hostigamiento|ley karin|maltrato|violencia/.test(combined)
  };
}

function buildLaborConversationalAnswer(text, facts, shouldEscalate) {
  if (facts.asksHarassment) {
    return [
      "Entiendo. Si lo que describes puede ser acoso, hostigamiento o violencia en el trabajo, no conviene minimizarlo ni tratarlo como un simple conflicto interno.",
      "En simple, hay que ordenar qué ocurrió, cuándo, quién participó, si hay testigos, mensajes, correos o denuncias previas, y qué medidas tomó la empresa. En Chile existe regulación específica sobre prevención e investigación de estas situaciones, incluida la Ley Karin.",
      "¿Lo que ocurrió fue un hecho puntual o una conducta repetida en el tiempo?"
    ].join("\n\n");
  }

  if (facts.asksNotSign) {
    return [
      "Si no firmas el finiquito, normalmente no significa que pierdas automáticamente tus derechos. Lo importante es no firmar algo que no entiendes o con montos que no te cuadran.",
      "En simple: firmar puede cerrar o dificultar discusiones posteriores si no dejas observaciones o reservas cuando corresponde. Por eso, antes de firmar conviene revisar causal, fecha de término, sueldo base, vacaciones, indemnizaciones, descuentos y cotizaciones.",
      "¿Tienes el finiquito con los montos o solo te dijeron que debes ir a firmarlo?"
    ].join("\n\n");
  }

  if (facts.asksReserve) {
    return [
      "La reserva de derechos es una forma de dejar constancia de que firmas o recibes algo, pero no estás necesariamente conforme con todo.",
      "Dicho simple: puede servir cuando hay montos, causal, vacaciones, cotizaciones u otros puntos que quieres revisar después. No conviene escribirla al azar; debe relacionarse con lo que realmente estás observando.",
      "¿Qué punto del finiquito te genera duda: monto, causal, vacaciones, descuentos o cotizaciones?"
    ].join("\n\n");
  }

  if (facts.asksSigned) {
    return [
      "Si ya firmaste, todavía puede ser útil revisar qué firmaste exactamente, si dejaste reserva, cómo fue el pago y si había información correcta en el documento.",
      "No puedo decirte solo con eso si se puede reclamar o no, porque depende del contenido del finiquito, la forma de firma, los montos y los antecedentes del término laboral.",
      "¿Firmaste con alguna reserva u observación, o firmaste conforme sin agregar nada?"
    ].join("\n\n");
  }

  if (facts.asksCotizaciones) {
    return [
      "Las cotizaciones son relevantes porque el término de la relación laboral no se mira solo por la carta o el finiquito. También importa si AFP, salud y otros pagos previsionales están declarados y pagados según corresponda.",
      "Si hay cotizaciones impagas o inconsistentes, conviene revisarlo antes de firmar conforme o aceptar montos sin observación.",
      "¿Tu duda es porque viste una deuda de cotizaciones o porque no sabes cómo revisarlas?"
    ].join("\n\n");
  }

  if (facts.asksAmount) {
    return [
      "Para saber si un finiquito está bien calculado hay que mirar varios datos, no solo el total final.",
      "En simple, revisaría: sueldo base y variables, fecha de ingreso y término, causal indicada, vacaciones pendientes, indemnizaciones si corresponden, descuentos, anticipos y cotizaciones. Si falta alguno de esos datos, el cálculo puede verse correcto pero estar incompleto.",
      "¿Tienes a mano sueldo mensual, fecha de ingreso, fecha de término y causal de despido?"
    ].join("\n\n");
  }

  if (facts.asksDismissalLetter) {
    return [
      "La carta de despido es importante porque normalmente ahí el empleador indica la causal y los hechos que justificarían el término del contrato.",
      "En simple: no basta con que aparezca una causal. Hay que comparar lo que dice la carta con lo que realmente ocurrió y con los documentos disponibles. Sin esa carta es difícil evaluar bien el despido.",
      "¿Te entregaron carta de despido por escrito, y qué causal menciona?"
    ].join("\n\n");
  }

  if (facts.hasFiniquito || /finiquito|despido|desped|desepd/.test(text)) {
    return [
      "Entiendo. Si hay despido o finiquito, conviene avanzar con cuidado porque muchas veces el problema está en los detalles: causal, montos, vacaciones, descuentos o cotizaciones.",
      facts.mustSignSoon
        ? "Si debes firmar pronto, no conviene hacerlo apurado. Primero revisaría carta de despido, contrato, últimas liquidaciones y el borrador del finiquito."
        : "Lo primero es ordenar carta de despido, contrato, liquidaciones, fecha de ingreso, fecha de término y finiquito si ya existe.",
      facts.isWorker || !facts.isEmployer
        ? "¿Tienes ya la carta de despido y el finiquito, o solo te avisaron verbalmente?"
        : "¿La consulta es desde la empresa o desde la posición del trabajador?"
    ].join("\n\n");
  }

  return null;
}

function buildContractConversationalAnswer(text, facts, shouldEscalate) {
  if (/renovacion|renovación|automatic/.test(text)) {
    return [
      "La renovación automática puede ser delicada porque a veces mantiene vigente el contrato aunque una parte pensaba que terminaba solo.",
      "En simple: hay que revisar duración, aviso previo, forma de terminar, multas por término anticipado y si exige enviar una comunicación dentro de cierto plazo.",
      "¿El contrato ya está firmado o lo estás revisando antes de firmar?"
    ].join("\n\n");
  }

  if (/multa|penalidad|clausula penal/.test(text)) {
    return [
      "Una multa en un contrato no se revisa solo por el monto. Lo clave es qué hecho la activa y si la redacción es clara.",
      "Miraría especialmente: obligación incumplida, plazo, aviso previo, posibilidad de corregir, proporcionalidad del monto y relación con el valor total del contrato.",
      "¿La multa aparece por atraso, término anticipado, no pago u otra obligación?"
    ].join("\n\n");
  }

  return null;
}

function buildConceptAnswer(message) {
  const text = normalizeLoose(message);
  const asksMeaning = /\b(que es|q es|que significa|significa|defin(e|icion)|explicame|explícame|en simple)\b/.test(text);
  if (!asksMeaning) {
    return null;
  }

  if (/finiquito/.test(text)) {
    return [
      "Un finiquito es el documento que normalmente cierra una relación laboral cuando termina el contrato de trabajo.",
      "En simple: deja por escrito por qué terminó la relación, qué montos se pagan y si el trabajador queda conforme o deja alguna reserva. Por eso no conviene firmarlo sin revisar antes sueldo, vacaciones, indemnizaciones, descuentos, cotizaciones y causal de término.",
      "Si tienes uno a la vista, puedo ayudarte a ordenar qué puntos mirar primero. ¿Ya tienes el finiquito o solo te avisaron que debes firmarlo?"
    ].join("\n\n");
  }

  if (/despido|desped|desepd/.test(text)) {
    return [
      "Estar despedido significa que el empleador puso término al contrato de trabajo.",
      "En simple: no basta con que te digan verbalmente que no sigues. Lo importante es revisar si existe carta de despido, qué causal indica, qué hechos menciona, desde qué fecha rige y si luego te entregan finiquito. La causal debe mirarse contra los hechos y documentos disponibles; no se puede decir automáticamente si está bien o mal aplicada sin revisar eso.",
      "¿Te entregaron carta de despido o solo te lo comunicaron de palabra?"
    ].join("\n\n");
  }

  if (/contrato/.test(text)) {
    return [
      "Un contrato es un acuerdo que crea obligaciones para una o más partes.",
      "En simple: dice quiénes participan, qué se promete, cuánto se paga, por cuánto tiempo, qué pasa si alguien incumple y cómo se termina. Lo delicado suele estar en multas, renovación automática, garantías, término anticipado, exclusividad o responsabilidades poco claras.",
      "¿Quieres entender un contrato en general o revisar una cláusula específica?"
    ].join("\n\n");
  }

  if (/multa|penalidad|clausula penal|clausula de multa/.test(text)) {
    return [
      "Una multa contractual es una consecuencia económica que el contrato puede fijar si una parte incumple algo.",
      "En simple: no se mira solo el monto. Hay que revisar qué conducta activa la multa, si hubo aviso previo, si existe plazo para corregir, si el monto es proporcional y si la cláusula está redactada de forma clara.",
      "¿La multa aparece en un contrato que todavía no firmas o en uno que ya está vigente?"
    ].join("\n\n");
  }

  if (/marca|inapi|logo|nombre comercial/.test(text)) {
    return [
      "Una marca es un signo que permite distinguir productos o servicios en el mercado, como un nombre, logo o combinación de ambos.",
      "En simple: tener una sociedad o comprar un dominio web no significa automáticamente tener protegida la marca. La protección marcaria se revisa por la vía correspondiente, normalmente ante INAPI en Chile.",
      "¿Quieres proteger un nombre que ya usas o estás antes de lanzar el negocio?"
    ].join("\n\n");
  }

  if (/sociedad|spa|ltda|eirl|empresa/.test(text)) {
    return [
      "Una empresa puede organizarse de distintas formas jurídicas, como SpA, Ltda. o EIRL, según cómo se quiere administrar, quién participa y cómo crecerá.",
      "En simple: no hay una estructura mejor para todos. Antes de elegir conviene saber cuántos socios habrá, quién administra, si entrarán inversionistas, qué actividad tendrá y si quieres vender participaciones en el futuro.",
      "¿La empresa será solo tuya o tendrá socios?"
    ].join("\n\n");
  }

  return null;
}

function normalizeLoose(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

  const extension = cleanText(document.extension, 20).toLowerCase();
  const fileBase64 = cleanText(document.fileBase64, 6_000_000);

  return {
    name: cleanText(document.name, 180) || "documento",
    text: cleanText(document.text, 12000),
    extension,
    fileBase64,
    mimeType: cleanText(document.type, 80) || mimeTypeFromExtension(extension)
  };
}

function isImageDocument(documentContext) {
  return ["jpg", "jpeg", "png", "webp"].includes(String(documentContext?.extension || "").toLowerCase()) ||
    /^image\//i.test(String(documentContext?.mimeType || ""));
}

function mimeTypeFromExtension(extension) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}

function buildGeminiImagePart(documentContext) {
  if (!documentContext || !isImageDocument(documentContext) || !documentContext.fileBase64) {
    return null;
  }

  return {
    inline_data: {
      mime_type: documentContext.mimeType || mimeTypeFromExtension(documentContext.extension) || "image/jpeg",
      data: documentContext.fileBase64
    }
  };
}

function detectService(message, documentContext, history = []) {
  const historyText = history.map((item) => item?.content || "").join(" ");
  const text = `${message || ""} ${historyText} ${documentContext?.name || ""} ${documentContext?.text || ""}`.toLowerCase();
  const checks = [
    ["laboral", ["despido", "despid", "desped", "desepd", "finiquito", "trabajo", "trabajador", "empleador", "sueldo", "jornada", "laboral", "cotizacion", "cotización", "renuncia", "carta de despido", "necesidades de la empresa", "causal"]],
    ["revision-contratos", ["contrato", "cláusula", "clausula", "firmar", "arriendo", "multa", "penalidad", "renovación", "renovacion"]],
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
