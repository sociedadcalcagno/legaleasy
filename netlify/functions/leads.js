exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido" });
  }

  const body = parseBody(event.body);
  const id = `LE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const appointmentUrl = process.env.APPOINTMENT_URL || "https://wa.me/56933553024?text=Hola%20LegalEasy%2C%20quiero%20agendar%20una%20orientacion%20legal";

  if (!cleanText(body.name, 120) || (!cleanText(body.email, 180) && !cleanText(body.phone, 60)) || !cleanText(body.message, 3000)) {
    return json(400, { error: "Indica nombre, email o WhatsApp, y una descripción breve del caso." });
  }

  return json(201, {
    ok: true,
    id,
    appointmentUrl: body.wantsAppointment ? appointmentUrl : "",
    note: "Caso recibido por función Netlify. Para bandeja persistente conecta base de datos o Netlify Forms."
  });
};

function parseBody(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  };
}
