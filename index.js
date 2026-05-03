import express from "express";
import mqtt from "mqtt";

const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || "8883";
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const MQTT_TOPIC = process.env.MQTT_TOPIC || "luminar/acceso";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const TOKEN_SECRETO = process.env.TOKEN_SECRETO;

const PORT = process.env.PORT || 3000;

if (!MQTT_HOST || !MQTT_USER || !MQTT_PASS || !GOOGLE_SCRIPT_URL || !TOKEN_SECRETO) {
  console.log("❌ Faltan variables de entorno");
  process.exit(1);
}

// --------------------
// Servidor HTTP (anti-sleep Render)
// --------------------
const app = express();

app.get("/", (req, res) => {
  res.send("Luminar MQTT Bridge OK");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🌐 HTTP server activo en puerto ${PORT}`);
});

// --------------------
// MQTT
// --------------------
const mqttUrl = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;
console.log("🔌 Conectando a MQTT:", mqttUrl);

const client = mqtt.connect(mqttUrl, {
  username: MQTT_USER,
  password: MQTT_PASS,
  reconnectPeriod: 5000,
  keepalive: 60
});

client.on("connect", () => {
  console.log("✅ Conectado a HiveMQ");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.log("❌ Error al suscribirse:", err);
    else console.log("📡 Suscripto al topic:", MQTT_TOPIC);
  });
});

function separarFechaHora(horaCompleta) {
  // Ej: "02/05/2026 21:11"
  if (!horaCompleta) return { fecha: "", hora: "" };

  const parts = horaCompleta.split(" ");
  if (parts.length < 2) return { fecha: horaCompleta, hora: "" };

  return {
    fecha: parts[0],
    hora: parts[1]
  };
}

client.on("message", async (topic, message) => {
  try {
    const msgStr = message.toString();
    console.log("📩 MQTT recibido:", msgStr);

    let data = JSON.parse(msgStr);

    // Separar fecha y hora desde el campo original
    const fh = separarFechaHora(data.hora);

    const payload = {
      token: TOKEN_SECRETO,
      fecha: fh.fecha,
      hora: fh.hora,
      uid: data.uid || "",
      nombre: data.nombre || "",
      resultado: data.resultado || "",
      topic: topic,
      server_time: new Date().toISOString(),
      raw: data
    };

    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("🟢 Sheets:", text);

  } catch (err) {
    console.log("❌ Error procesando mensaje:", err);
  }
});

client.on("error", (err) => {
  console.log("❌ MQTT error:", err);
});
