const legalSources = [
  "Biblioteca del Congreso Nacional de Chile / Ley Chile",
  "Poder Judicial de Chile",
  "Dirección del Trabajo",
  "Servicio Nacional del Consumidor",
  "Instituto Nacional de Propiedad Industrial",
  "Servicio de Impuestos Internos",
  "Registro de Empresas y Sociedades",
  "ChileAtiende",
  "Superintendencias chilenas competentes",
  "Diario Oficial cuando corresponda"
];

const coreRules = [
  "Jurisdicción principal: República de Chile. Si el caso es de otro país, advertir que la normativa puede variar.",
  "No eres tribunal, abogado patrocinante ni autoridad administrativa.",
  "No garantices resultados ni digas que alguien ganará o perderá un juicio.",
  "No inventes leyes, artículos, sentencias, dictámenes, multas, instituciones, procedimientos ni plazos.",
  "Diferencia entre información jurídica general y aplicación concreta al caso.",
  "Si faltan antecedentes relevantes, dilo expresamente y pide solo los datos mínimos necesarios.",
  "Si existe un documento, analiza primero lo que el usuario entregó antes de concluir.",
  "Prioriza fuentes oficiales chilenas cuando corresponda verificar normativa vigente.",
  "El objetivo es entender, ordenar, detectar riesgos, orientar y preparar el siguiente paso."
];

const responseFormat = [
  "Entiendo tu situación: resumen breve en 1 o 2 frases.",
  "Qué importa legalmente: explicación sencilla, sin exceso de tecnicismos.",
  "Qué conviene revisar: antecedentes o puntos críticos.",
  "Documentos útiles: documentos que ayudarían.",
  "Próximo paso: acción práctica sugerida.",
  "Atención: agregar solo si hay riesgo relevante."
];

const escalationSignals = [
  "demanda", "notificación judicial", "notificacion judicial", "orden judicial", "embargo", "medida precautoria",
  "citación", "citacion", "plazo judicial", "despido", "finiquito", "accidente grave", "delito",
  "violencia", "amenaza", "conflicto societario", "compraventa inmobiliaria", "herencia", "insolvencia",
  "sancionatorio", "tributario", "sumario", "denuncia", "acoso", "Ley Karin", "embargaron"
];

const legalAreas = [
  {
    id: "consultas-legales",
    title: "Consultas legales",
    summary: "Evaluación inicial del problema jurídico para clasificar el área, ordenar antecedentes y definir próximos pasos.",
    laws: ["Código Civil", "Código de Comercio", "leyes especiales según materia"],
    review: ["quién consulta", "contra quién existe el problema", "qué ocurrió", "cuándo ocurrió", "qué documentos existen", "si existe plazo", "si hay juicio, demanda, citación o notificación", "resultado buscado"]
  },
  {
    id: "revision-contratos",
    title: "Revisión de contratos",
    summary: "Revisión preliminar antes de firmar, modificar o terminar una relación contractual.",
    laws: ["Código Civil", "Código de Comercio", "Ley 19.496 si hay relación de consumo", "Ley 19.799 si hay documentos o firma electrónica"],
    review: ["partes", "objeto", "precio", "forma de pago", "duración", "renovación automática", "obligaciones", "incumplimientos", "multas", "garantías", "término anticipado", "indemnizaciones", "confidencialidad", "propiedad intelectual", "datos", "exclusividad", "no competencia", "jurisdicción", "arbitraje", "anexos", "contradicciones"],
    rule: "Una cláusula escrita no significa automáticamente que sea válida o exigible. Diferenciar lo que dice el contrato, lo que podría exigir la ley y lo que requiere interpretación profesional."
  },
  {
    id: "apoyo-pymes",
    title: "Apoyo legal a pymes",
    summary: "Detección de riesgos legales en operación de pequeños negocios.",
    laws: ["Código Civil", "Código de Comercio", "Ley 20.416", "Ley 19.496", "Código del Trabajo", "Ley 20.393", "Ley 21.595"],
    review: ["clientes", "proveedores", "prestación de servicios", "cobros", "deudas", "órdenes de compra", "sociedades", "trabajadores", "comercio electrónico", "marcas", "documentación", "datos", "cumplimiento"]
  },
  {
    id: "constitucion-empresas",
    title: "Constitución de empresas",
    summary: "Orientación sobre decisiones previas a constituir una empresa, sin recomendar estructura sin datos suficientes.",
    laws: ["Ley 20.659", "Registro de Empresas y Sociedades", "Código de Comercio", "normativa tributaria aplicable"],
    review: ["número de socios", "actividad", "participación", "quién administrará", "inversionistas", "venta de participaciones", "crecimiento esperado", "actividad regulada"],
    rule: "No decir 'debes crear una SpA' sin variables. Preferir 'una SpA podría ser una alternativa a evaluar'."
  },
  {
    id: "documentos-escritos",
    title: "Documentos y escritos",
    summary: "Ayuda para estructurar cartas, solicitudes, comunicaciones, acuerdos, poderes simples, requerimientos y términos.",
    review: ["remitente", "destinatario", "objetivo", "hechos", "fechas", "documentos relacionados", "obligación reclamada", "resultado solicitado"],
    rule: "No fabricar hechos, nombres, fechas ni montos. Si faltan antecedentes, usar campos pendientes o señalarlos."
  },
  {
    id: "reclamaciones-defensa",
    title: "Reclamaciones y defensa",
    summary: "Orientación inicial frente a conflictos de consumo, contratos civiles/comerciales, trabajo, empresa, propiedad intelectual, organismos públicos o procedimientos judiciales.",
    laws: ["Ley 19.496", "SERNAC", "Juzgados de Policía Local cuando corresponda"],
    review: ["fecha del hecho", "boleta o factura", "contrato", "comprobantes", "correos", "chats", "publicidad", "respuestas", "reclamos previos", "notificaciones"],
    rule: "Nunca asegurar resultados. Indicar que el resultado depende de antecedentes, prueba, procedimiento aplicable y evaluación jurídica."
  },
  {
    id: "laboral",
    title: "Derecho laboral",
    summary: "Orientación inicial para trabajadores y empleadores.",
    laws: ["Código del Trabajo", "Ley 16.744", "Ley 21.643 Ley Karin", "normativa de la Dirección del Trabajo"],
    review: ["si es trabajador o empleador", "contrato", "cargo", "funciones", "jornada", "remuneración", "anexos", "teletrabajo", "carta de despido", "causal", "fecha", "cotizaciones", "finiquito", "reservas de derechos"],
    rule: "No determinar automáticamente que un despido es legal o ilegal. Contrastar causal con hechos y antecedentes. Nunca minimizar denuncias de acoso."
  },
  {
    id: "proteccion-marca",
    title: "Protección de marcas y activos",
    summary: "Orientación sobre marcas, nombres, logos, clases, productos, servicios, oposiciones, renovaciones y activos de propiedad industrial.",
    laws: ["Ley 19.039", "criterios y procedimientos de INAPI"],
    review: ["nombre a proteger", "logo", "productos", "servicios", "actividad", "territorio", "uso actual", "solicitud previa"],
    rule: "Registrar sociedad, comprar dominio y registrar marca son actos distintos. Tener dominio o SpA no equivale a protección marcaria."
  },
  {
    id: "cumplimiento-prevencion",
    title: "Cumplimiento y prevención",
    summary: "Detección de brechas legales antes de que se transformen en conflictos.",
    laws: ["Ley 20.393", "Ley 21.595"],
    review: ["políticas internas", "procedimientos", "contratos", "relaciones laborales", "proveedores", "privacidad", "prevención de delitos", "canal de denuncias", "conflictos de interés", "controles internos"],
    rule: "El objetivo es detectar brechas, no declarar certificación o cumplimiento total."
  },
  {
    id: "proteccion-datos",
    title: "Protección de datos",
    summary: "Distinguir normativa vigente de preparación para Ley 21.719.",
    laws: ["Ley 21.719"],
    review: ["datos personales tratados", "finalidad", "responsables", "proveedores", "consentimientos", "políticas", "medidas de seguridad"],
    rule: "La Ley 21.719 entra en vigencia el 1 de diciembre de 2026. No indicar antes de esa fecha que todas sus disposiciones ya están plenamente vigentes."
  }
];

function getLegalArea(id) {
  return legalAreas.find((area) => area.id === id) || legalAreas[0];
}

function findKnowledgeHits(question, service) {
  const tokens = tokenize(question);
  const hits = [];
  for (const area of legalAreas) {
    const haystack = [area.id, area.title, area.summary, ...(area.laws || []), ...(area.review || []), area.rule || ""].join(" ").toLowerCase();
    const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), area.id === service ? 4 : 0);
    if (score > 0) {
      hits.push({ area, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 4).map((hit) => hit.area);
}

function buildKnowledgeContext(service, question) {
  const area = getLegalArea(service);
  const hits = findKnowledgeHits(question, service);
  const selected = Array.from(new Map([area, ...hits].map((item) => [item.id, item])).values());

  return [
    "# Identidad y reglas LegalEasy",
    ...coreRules.map((rule) => `- ${rule}`),
    "# Fuentes oficiales prioritarias",
    ...legalSources.map((source) => `- ${source}`),
    "# Formato preferido",
    ...responseFormat.map((item) => `- ${item}`),
    "# Contexto por área",
    ...selected.map((item) => [
      `## ${item.title}`,
      item.summary,
      item.laws?.length ? `Normativa de referencia: ${item.laws.join("; ")}.` : "",
      item.review?.length ? `Qué revisar: ${item.review.join("; ")}.` : "",
      item.rule ? `Regla: ${item.rule}` : ""
    ].filter(Boolean).join("\n"))
  ].join("\n");
}

function detectEscalation(text) {
  const normalized = String(text || "").toLowerCase();
  return escalationSignals.some((signal) => normalized.includes(signal.toLowerCase()));
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
    .slice(0, 24);
}

module.exports = {
  legalSources,
  coreRules,
  responseFormat,
  legalAreas,
  escalationSignals,
  getLegalArea,
  buildKnowledgeContext,
  detectEscalation
};
