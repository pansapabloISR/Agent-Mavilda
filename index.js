// MAVILDA BOT - BACKEND REPLIT COMPLETO
const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());

// Base de datos en memoria (simulada para simplicidad)
const sessions = {};

// Función para obtener o crear sesión
function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      messages: 0,
      userName: null,
      userPhone: null,
      modelInterest: null,
      surfaceHA: null,
      captured: false,
      history: [],
    };
  }
  return sessions[sessionId];
}

// ENDPOINT PRINCIPAL - Procesar mensaje
app.post("/process", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        error: "Mensaje y sessionId son requeridos",
      });
    }

    // Obtener sesión
    const session = getSession(sessionId);
    session.messages++;
    session.history.push({ user: message, timestamp: new Date() });

    const msgLower = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // DETECCIÓN DE MODELO
    if (msgLower.includes("t25")) session.modelInterest = "T25P";
    else if (msgLower.includes("t50")) session.modelInterest = "T50";
    else if (msgLower.includes("t70")) session.modelInterest = "T70P";
    else if (msgLower.includes("t100")) session.modelInterest = "T100";
    else if (msgLower.includes("mavic")) session.modelInterest = "Mavic3M";

    // DETECCIÓN DE SUPERFICIE
    const surfaceMatch = message.match(/(\d+)\s*(ha|hectarea)/i);
    if (surfaceMatch) {
      session.surfaceHA = parseInt(surfaceMatch[1]);
    }

    // DETECCIÓN DE TELÉFONO
    const phoneMatch = message.match(/[\d\s\-\+\(\)]{10,15}/);
    if (phoneMatch && !session.userPhone) {
      session.userPhone = phoneMatch[0].replace(/\D/g, "");
    }

    // DETECCIÓN DE NOMBRE (mensaje 2)
    if (session.messages === 2 && !session.userName && message.length < 30) {
      session.userName = message.trim();
    }

    // DETECTAR INTENCIÓN
    let intent = "general";
    if (
      msgLower.includes("precio") ||
      msgLower.includes("costo") ||
      msgLower.includes("cuanto")
    ) {
      intent = "price";
    } else if (msgLower.includes("demo") || msgLower.includes("prueba")) {
      intent = "demo";
    } else if (
      msgLower.includes("rinde") ||
      msgLower.includes("rendimiento") ||
      msgLower.includes("especificacion")
    ) {
      intent = "performance";
    } else if (msgLower.includes("financ")) {
      intent = "financing";
    }

    // GENERAR RESPUESTA
    let response = "";
    const name = session.userName || "";
    const model = session.modelInterest;

    // FLUJO DE CONVERSACIÓN
    if (session.messages === 1) {
      response =
        "¡Hola! 👋 Soy Mavilda, tu asesora de drones agrícolas DJI de Seragro.\n\n¿Con quién tengo el gusto de hablar?";
    } else if (session.messages === 2) {
      if (!session.userName) {
        session.userName = message.trim();
      }
      response = `¡Mucho gusto ${session.userName}! 🚁\n\n¿Qué superficie necesitás cubrir con el drone? (ej: 100 ha)`;
    } else if (session.messages === 3 && !model) {
      response =
        `${name}, tenemos estos modelos disponibles:\n\n` +
        `🚁 T25P - Ideal para 100-300 ha\n` +
        `🚁 T50 - Para 300-500 ha\n` +
        `🚁 T70P - Para 500-800 ha\n` +
        `🚁 T100 - Para más de 800 ha\n` +
        `📷 Mavic3M - Mapeo y monitoreo\n\n` +
        `¿Cuál te interesa conocer?`;
    } else if (intent === "price") {
      if (!model) {
        response =
          `${name}, ¿de qué modelo querés saber el precio?\n\n` +
          `• T25P\n• T50\n• T70P\n• T100\n• Mavic3M`;
      } else {
        response = "__NEEDS_SHEETS__";
      }
    } else if (intent === "performance" && model) {
      response = "__NEEDS_PINECONE__";
    } else if (intent === "demo") {
      response =
        `¡Excelente ${name}! Para coordinar una demo necesito:\n\n` +
        `📍 Ubicación de tu campo\n` +
        `📏 Superficie (${session.surfaceHA ? session.surfaceHA + " ha ✓" : "pendiente"})\n` +
        `📱 Teléfono de contacto\n\n` +
        `¿Me pasás estos datos?`;
    } else if (intent === "financing") {
      response =
        `${name}, tenemos excelentes planes de financiación:\n\n` +
        `💳 Hasta 12 cuotas sin interés\n` +
        `🏦 Leasing a 24-36 meses\n` +
        `📊 Planes a medida según tu flujo\n\n` +
        `¿Te gustaría que un asesor te contacte?`;
    } else {
      if (model) {
        response =
          `Excelente elección el ${model}! ¿Qué te gustaría saber?\n\n` +
          `• Precio y financiación\n` +
          `• Especificaciones técnicas\n` +
          `• Solicitar una demo\n` +
          `• Rendimiento por hectárea`;
      } else {
        response = `${name}, ¿qué modelo de drone te interesa conocer?`;
      }
    }

    // Solicitar teléfono si no lo tenemos
    if (session.messages >= 4 && !session.userPhone && model) {
      response += "\n\n📱 Por favor, dejame tu celular para enviarte más info.";
    }

    // Verificar si tenemos lead completo
    const hasCompleteLead = !!(
      session.userName &&
      session.userPhone &&
      session.modelInterest
    );

    // Marcar como capturado si es lead completo
    if (hasCompleteLead && !session.captured) {
      session.captured = true;
    }

    // Responder
    res.json({
      response,
      session,
      needs: {
        sheets: response === "__NEEDS_SHEETS__",
        pinecone: response === "__NEEDS_PINECONE__",
        saveLead: hasCompleteLead && session.captured,
      },
      intent,
      model,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Error procesando mensaje",
      details: error.message,
    });
  }
});

// ENDPOINT DE PRUEBA
app.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Mavilda Bot</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 50px auto;
          padding: 20px;
        }
        h2 { color: #2c3e50; }
        #chat {
          border: 1px solid #ddd;
          height: 400px;
          overflow-y: auto;
          padding: 15px;
          margin-bottom: 10px;
          background: #f9f9f9;
        }
        .message {
          margin: 10px 0;
          padding: 8px 12px;
          border-radius: 8px;
        }
        .user {
          background: #007bff;
          color: white;
          text-align: right;
          margin-left: 20%;
        }
        .bot {
          background: white;
          color: #333;
          margin-right: 20%;
          border: 1px solid #ddd;
        }
        #msg {
          width: 70%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        button {
          width: 25%;
          padding: 10px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover { background: #218838; }
      </style>
    </head>
    <body>
      <h2>🚁 Test Mavilda Bot - Seragro</h2>
      <div id="chat"></div>
      <div>
        <input id="msg" placeholder="Escribí tu mensaje..." onkeypress="if(event.key=='Enter') send()">
        <button onclick="send()">Enviar</button>
      </div>
      <script>
        const sessionId = 'test_' + Date.now();
        const chat = document.getElementById('chat');

        async function send() {
          const input = document.getElementById('msg');
          const msg = input.value.trim();
          if (!msg) return;

          // Mostrar mensaje del usuario
          chat.innerHTML += '<div class="message user">' + msg + '</div>';
          input.value = '';
          chat.scrollTop = chat.scrollHeight;

          try {
            const resp = await fetch('/process', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({message: msg, sessionId: sessionId})
            });

            const data = await resp.json();

            // Mostrar respuesta del bot
            const botMsg = data.response.replace(/\\n/g, '<br>');
            chat.innerHTML += '<div class="message bot">' + botMsg + '</div>';
            chat.scrollTop = chat.scrollHeight;

            // Log para debug
            console.log('Session:', data.session);
            console.log('Needs:', data.needs);
          } catch (error) {
            chat.innerHTML += '<div class="message bot">Error: ' + error.message + '</div>';
          }
        }

        // Mensaje inicial
        window.onload = () => {
          send();
        };
      </script>
    </body>
    </html>
  `);
});

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    name: "Mavilda Bot - Seragro",
    version: "2.0",
    endpoints: ["/process", "/test"],
    timestamp: new Date(),
  });
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Mavilda Bot running on port ${PORT}`);
  console.log(`🔗 Test interface: http://localhost:${PORT}/test`);
});
