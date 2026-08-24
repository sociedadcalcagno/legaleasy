exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido" });
  }

  const body = parseBody(event.body);
  const id = `LE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const appointmentUrl = process.env.APPOINTMENT_URL || "https://wa.me/56933553024?text=Hola%20LegalEasy%2C%20quiero%20agendar%20una%20orientacion%20legal";
  const toEmail = process.env.LEADS_TO_EMAIL || "sociedadcalcagno@gmail.com";
  const fromEmail = process.env.LEADS_FROM_EMAIL || "LegalEasy <onboarding@resend.dev>";

  if (!cleanText(body.name, 120) || (!cleanText(body.email, 180) && !cleanText(body.phone, 60)) || !cleanText(body.message, 3000)) {
    return json(400, { error: "Indica nombre, email o WhatsApp, y una descripción breve del caso." });
  }

  const emailResult = await sendLeadEmail({ id, body, toEmail, fromEmail });

  return json(201, {
    ok: true,
    id,
    delivery: emailResult.ok ? "email" : "stored-without-email",
    appointmentUrl: body.wantsAppointment ? appointmentUrl : "",
    note: emailResult.ok
      ? `Caso enviado por correo a ${toEmail}.`
      : "Caso recibido, pero no se pudo enviar correo. Revisa RESEND_API_KEY en Netlify."
  });
};

async function sendLeadEmail({ id, body, toEmail, fromEmail }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: "missing_resend_key" };
  }

  const subject = `[LegalEasy] Nuevo caso derivado ${id}`;
  const html = buildLeadEmailHtml(id, body);
  const text = buildLeadEmailText(id, body);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
        text,
        reply_to: cleanText(body.email, 180) || undefined
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("Resend error", { status: response.status, message: data?.message || data?.error || "Sin detalle" });
      return { ok: false, reason: "resend_error" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Resend fetch error", error);
    return { ok: false, reason: "resend_fetch_error" };
  }
}

function buildLeadEmailHtml(id, body) {
  const rows = buildLeadRows(id, body).map(([label, value]) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(value || "-")}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;"><h2>Nuevo caso derivado LegalEasy</h2><table style="border-collapse:collapse;width:100%;max-width:760px;">${rows}</table></div>`;
}

function buildLeadEmailText(id, body) {
  return buildLeadRows(id, body).map(([label, value]) => `${label}: ${value || "-"}`).join("\n");
}

function buildLeadRows(id, body) {
  const history = Array.isArray(body.history) ? body.history.slice(-8).map((item) => `${item?.role === "assistant" ? "LegalEasy" : "Usuario"}: ${cleanText(item?.content, 1000)}`).join("\n\n") : "";
  return [
    ["ID", id],
    ["Fecha", new Date().toISOString()],
    ["Nombre", cleanText(body.name, 120)],
    ["Email", cleanText(body.email, 180)],
    ["WhatsApp", cleanText(body.phone, 60)],
    ["Servicio", cleanText(body.service, 80)],
    ["Origen", cleanText(body.source, 80)],
    ["Quiere agendar", body.wantsAppointment ? "Sí" : "No"],
    ["Preferencia horario", cleanText(body.appointmentPreference, 240)],
    ["Documento", cleanText(body.documentName, 180)],
    ["Resumen", cleanText(body.message, 3000)],
    ["Historial", history]
  ];
}

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  };
}
