// MAVILDA BOT - VERSIÓN PROFESIONAL COMPLETA
const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());

// Base de datos de sesiones en memoria
const sessions = {};

// Análisis inteligente de mensaje
function analyzeMessage(message) {
  const msgLower = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return {
    // Detección de modelo
    model: msgLower.includes("t25")
      ? "T25P"
      : msgLower.includes("t50")
        ? "T50"
        : msgLower.includes("t70")
          ? "T70P"
          : msgLower.includes("t100")
            ? "T100"
            : msgLower.includes("mavic")
              ? "Mavic3M"
              : null,

    // Detección de superficie
    surface: message.match(/(\d+)\s*(ha|hectarea)/i)?.[1],

    // Detección de contacto
    phone: message.match(/[\d\s\-\+\(\)]{10,15}/)?.[0]?.replace(/\D/g, ""),
    email: message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0],

    // Detección de intención
    intent:
      msgLower.includes("precio") ||
      msgLower.includes("costo") ||
      msgLower.includes("cuanto") ||
      msgLower.includes("vale")
        ? "price"
        : msgLower.includes("demo") ||
            msgLower.includes("prueba") ||
            msgLower.includes("verlo")
          ? "demo"
          : msgLower.includes("financ") ||
              msgLower.includes("cuota") ||
              msgLower.includes("pago")
            ? "financing"
            : msgLower.includes("especific") ||
                msgLower.includes("tecnic") ||
                msgLower.includes("rendimiento")
              ? "specs"
              : msgLower.includes("compar") || msgLower.includes("diferencia")
                ? "compare"
                : "general",

    // Palabras clave del agro
    agroTerms: {
      hasLote: msgLower.includes("lote"),
      hasCampaña: msgLower.includes("campaña") || msgLower.includes("campana"),
      hasCultivo:
        msgLower.includes("soja") ||
        msgLower.includes("maiz") ||
        msgLower.includes("trigo"),
      hasFumigacion: msgLower.includes("fumig") || msgLower.includes("pulveri"),
      hasProblema:
        msgLower.includes("maleza") ||
        msgLower.includes("plaga") ||
        msgLower.includes("problem"),
    },
  };
}

// Obtener o crear sesión
function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      stage: "greeting",
      messages: 0,
      userName: null,
      userPhone: null,
      userEmail: null,
      modelInterest: null,
      surfaceHA: null,
      cultivos: null,
      challenges: [],
      captured: false,
      history: [],
      context: {},
    };
  }
  return sessions[sessionId];
}

// Generador de respuestas contextual
function generateResponse(session, analysis, message) {
  const { stage, userName, modelInterest, surfaceHA, messages } = session;
  const { intent, model, surface, phone, email, agroTerms } = analysis;

  // Actualizar datos de sesión si se detectaron
  if (model && !modelInterest) session.modelInterest = model;
  if (surface) session.surfaceHA = parseInt(surface);
  if (phone && !session.userPhone) session.userPhone = phone;
  if (email && !session.userEmail) session.userEmail = email;

  // ETAPA: SALUDO INICIAL
  if (messages === 1) {
    session.stage = "greeting";
    return (
      "¡Hola! 👋 Soy Mavilda de Seragro, especialista en drones agrícolas DJI.\n\n" +
      "Me encantaría ayudarte a mejorar la eficiencia de tu campo.\n" +
      "¿Con quién tengo el gusto de hablar?"
    );
  }

  // CAPTURA DE NOMBRE
  if (messages === 2 && !userName && message.length < 30) {
    session.userName = message.trim();
    session.stage = "diagnosis";

    const respuestas = [
      `¡Mucho gusto ${session.userName}! Contame, ¿qué desafío tenés hoy en tu campo que te gustaría resolver?`,
      `¡Qué bueno conocerte ${session.userName}! ¿En qué te puedo ayudar con la tecnología de drones?`,
      `¡Hola ${session.userName}! Me alegra que te intereses por modernizar tu operación. ¿Qué necesidad específica tenés?`,
    ];
    return respuestas[Math.floor(Math.random() * respuestas.length)];
  }

  const name = userName || "che";

  // RESPUESTAS POR INTENCIÓN
  switch (intent) {
    case "price":
      if (!modelInterest) {
        return (
          `${name}, para darte un precio exacto, ¿qué modelo te interesa?\n\n` +
          `Te cuento las opciones:\n` +
          `• T25P - Ideal para empezar (100-300 ha)\n` +
          `• T50 - El más equilibrado (300-500 ha)\n` +
          `• T70P - Alta performance (500-800 ha)\n` +
          `• T100 - Máxima capacidad (+800 ha)\n` +
          `• Mavic3M - Para mapeo y monitoreo`
        );
      }
      session.stage = "proposal";
      return "__NEEDS_SHEETS__";

    case "demo":
      session.stage = "capture";
      return (
        `¡Excelente ${name}! Ver el drone en acción en tu propio campo es la mejor decisión.\n\n` +
        `Para coordinar la demo necesito:\n` +
        `📍 Ubicación de tu campo\n` +
        `📏 ${surfaceHA ? `Superficie: ${surfaceHA} ha ✓` : "Superficie aproximada"}\n` +
        `📱 ${session.userPhone ? "Teléfono: ✓" : "Un teléfono de contacto"}\n\n` +
        `¿Me pasás estos datos?`
      );

    case "specs":
      if (!modelInterest) {
        return `${name}, ¿de qué modelo querés conocer las especificaciones técnicas?`;
      }
      return "__NEEDS_PINECONE__";

    case "financing":
      session.stage = "proposal";
      return (
        `${name}, tenemos excelentes opciones de financiación:\n\n` +
        `💳 **Planes disponibles:**\n` +
        `• Hasta 12 cuotas sin interés con tarjetas bancarias\n` +
        `• Leasing agrícola a 24-36 meses\n` +
        `• Financiación directa adaptada a tu ciclo de cosecha\n` +
        `• Posibilidad de pago en granos\n\n` +
        `¿Qué opción te resulta más conveniente para tu operación?`
      );

    case "compare":
      return (
        `${name}, cada modelo tiene sus ventajas según tu necesidad:\n\n` +
        `**Para campos chicos-medianos (hasta 300 ha):**\n` +
        `→ T25P: Más económico, fácil de operar, ideal para empezar\n\n` +
        `**Para operaciones medianas (300-500 ha):**\n` +
        `→ T50: Mejor relación inversión/rendimiento\n\n` +
        `**Para grandes superficies (+500 ha):**\n` +
        `→ T70P o T100: Máxima eficiencia, menor costo por hectárea\n\n` +
        `¿Cuántas hectáreas trabajás habitualmente?`
      );
  }

  // FLUJO CONVERSACIONAL NATURAL
  if (stage === "diagnosis" && !surfaceHA) {
    return (
      `${name}, para recomendarte la mejor opción, ¿cuántas hectáreas necesitás cubrir ` +
      `en tu campaña típica? También contame qué cultivos trabajás principalmente.`
    );
  }

  if (stage === "diagnosis" && surfaceHA && !modelInterest) {
    session.stage = "proposal";

    // Recomendación inteligente basada en superficie
    let recomendacion = "";
    if (surfaceHA <= 300) {
      recomendacion =
        `Para tus ${surfaceHA} hectáreas, el T25P es perfecto. ` +
        `Es el más vendido para productores que arrancan con drones.\n\n` +
        `✅ Ventajas para tu campo:\n` +
        `• 25L de tanque, ideal para lotes medianos\n` +
        `• Fácil de operar, aprendés en un día\n` +
        `• Retorno de inversión en 1-2 campañas`;
    } else if (surfaceHA <= 500) {
      recomendacion =
        `Con ${surfaceHA} hectáreas, te recomiendo el T50.\n\n` +
        `✅ Por qué es ideal para vos:\n` +
        `• 50L de tanque, menos recargas\n` +
        `• Cubre 40 ha/hora a full\n` +
        `• El más elegido por contratistas`;
    } else {
      recomendacion =
        `Para ${surfaceHA} hectáreas necesitás alta capacidad.\n` +
        `Te recomiendo el T70P o T100.\n\n` +
        `✅ Beneficios para operaciones grandes:\n` +
        `• Hasta 42 ha/hora de rendimiento\n` +
        `• Autonomía para jornadas largas\n` +
        `• Menor costo operativo por hectárea`;
    }

    return (
      recomendacion +
      `\n\n¿Te gustaría saber precios o preferís ver una demo primero?`
    );
  }

  // SOLICITUD NATURAL DE CONTACTO
  if (
    messages >= 5 &&
    !session.userPhone &&
    modelInterest &&
    intent !== "demo"
  ) {
    return (
      `${name}, te puedo mandar videos del ${modelInterest} trabajando en campos ` +
      `de la zona y un informe de rendimiento.\n\n` +
      `¿Me pasás tu celu para enviártelos por WhatsApp?`
    );
  }

  // RESPUESTA DEFAULT CONTEXTUAL
  if (modelInterest) {
    const opciones = [
      `¿Qué más te gustaría saber del ${modelInterest}?`,
      `El ${modelInterest} es excelente elección. ¿Querés conocer precios o especificaciones?`,
      `¿Te interesa ver el ${modelInterest} funcionando en tu campo?`,
    ];
    return opciones[Math.floor(Math.random() * opciones.length)];
  }

  return (
    `${name}, ¿en qué más te puedo ayudar? Puedo contarte sobre modelos, ` +
    `precios, financiación o coordinar una demostración en tu campo.`
  );
}

// ENDPOINT PRINCIPAL
app.post("/process", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: "Mensaje y sessionId requeridos" });
    }

    // Obtener sesión y analizar mensaje
    const session = getSession(sessionId);
    session.messages++;
    session.history.push({
      user: message,
      timestamp: new Date(),
      analysis: analyzeMessage(message),
    });

    const analysis = analyzeMessage(message);

    // Generar respuesta inteligente
    const response = generateResponse(session, analysis, message);

    // Verificar si tenemos lead completo
    const hasCompleteLead = !!(
      session.userName &&
      (session.userPhone || session.userEmail) &&
      session.modelInterest
    );

    if (hasCompleteLead && !session.captured) {
      session.captured = true;
    }

    // LOG PARA DEBUG
    console.log("📥 Recibido:", { message, sessionId });
    console.log("🧠 Análisis:", analysis);
    console.log("💬 Respuesta:", response);
    console.log("📊 Sesión:", session);

    // Responder con toda la información necesaria para N8N
    res.json({
      response,
      session: {
        id: session.id,
        userName: session.userName,
        userPhone: session.userPhone,
        userEmail: session.userEmail,
        modelInterest: session.modelInterest,
        surfaceHA: session.surfaceHA,
        messages: session.messages,
        stage: session.stage,
      },
      needs: {
        sheets: response === "__NEEDS_SHEETS__",
        pinecone: response === "__NEEDS_PINECONE__",
        saveLead: hasCompleteLead && session.captured,
      },
      intent: analysis.intent,
      model: session.modelInterest,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      error: "Error procesando mensaje",
      details: error.message,
    });
  }
});

// INTERFAZ DE PRUEBA MEJORADA
app.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <title>Test Mavilda Bot - Seragro</title>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          width: 100%;
          max-width: 500px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
          color: white;
          padding: 25px;
          text-align: center;
        }
        .header h1 {
          font-size: 24px;
          margin-bottom: 5px;
        }
        .header p {
          opacity: 0.9;
          font-size: 14px;
        }
        #chat {
          height: 450px;
          overflow-y: auto;
          padding: 20px;
          background: #f8f9fa;
        }
        .message {
          margin-bottom: 15px;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .user {
          text-align: right;
        }
        .user .bubble {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: inline-block;
          padding: 12px 18px;
          border-radius: 20px 20px 5px 20px;
          max-width: 80%;
          text-align: left;
        }
        .bot .bubble {
          background: white;
          color: #333;
          display: inline-block;
          padding: 12px 18px;
          border-radius: 20px 20px 20px 5px;
          max-width: 80%;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .input-area {
          padding: 20px;
          background: white;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 10px;
        }
        #msg {
          flex: 1;
          padding: 12px 18px;
          border: 2px solid #e0e0e0;
          border-radius: 25px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.3s;
        }
        #msg:focus {
          border-color: #667eea;
        }
        button {
          padding: 12px 25px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 25px;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s;
        }
        button:hover {
          transform: scale(1.05);
        }
        button:active {
          transform: scale(0.95);
        }
        .typing {
          display: inline-block;
          padding: 15px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .typing span {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          margin-right: 3px;
          animation: bounce 1.4s infinite ease-in-out;
        }
        .typing span:nth-child(1) { animation-delay: -0.32s; }
        .typing span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
        .status {
          padding: 10px;
          background: #e8f5e9;
          color: #2e7d32;
          text-align: center;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚁 Mavilda Bot - Seragro</h1>
          <p>Asesora en Drones Agrícolas DJI</p>
        </div>
        <div class="status" id="status">Conectado - Sesión de prueba</div>
        <div id="chat"></div>
        <div class="input-area">
          <input id="msg" placeholder="Escribí tu mensaje..." autocomplete="off">
          <button onclick="send()">Enviar</button>
        </div>
      </div>

      <script>
        const sessionId = 'test_' + Date.now();
        const chat = document.getElementById('chat');
        const input = document.getElementById('msg');
        let messageCount = 0;

        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') send();
        });

        async function send() {
          const msg = input.value.trim();
          if (!msg) return;

          // Mostrar mensaje del usuario
          chat.innerHTML += '<div class="message user"><div class="bubble">' + msg + '</div></div>';
          input.value = '';
          chat.scrollTop = chat.scrollHeight;

          // Mostrar indicador de escritura
          const typingId = 'typing_' + Date.now();
          chat.innerHTML += '<div class="message bot" id="' + typingId + '"><div class="typing"><span></span><span></span><span></span></div></div>';
          chat.scrollTop = chat.scrollHeight;

          try {
            const resp = await fetch('/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: msg, sessionId: sessionId })
            });

            const data = await resp.json();

            // Quitar indicador de escritura
            document.getElementById(typingId).remove();

            // Mostrar respuesta del bot
            const botMsg = data.response.replace(/\\n/g, '<br>');
            chat.innerHTML += '<div class="message bot"><div class="bubble">' + botMsg + '</div></div>';
            chat.scrollTop = chat.scrollHeight;

            // Actualizar estado
            messageCount++;
            document.getElementById('status').innerHTML = 
              'Mensajes: ' + messageCount + 
              (data.session.userName ? ' | Usuario: ' + data.session.userName : '') +
              (data.session.modelInterest ? ' | Interés: ' + data.session.modelInterest : '');

            // Log para debug
            console.log('Sesión:', data.session);
            console.log('Necesidades:', data.needs);
            console.log('Intención:', data.intent);

          } catch (error) {
            document.getElementById(typingId).remove();
            chat.innerHTML += '<div class="message bot"><div class="bubble">❌ Error: ' + error.message + '</div></div>';
          }
        }

        // Mensaje inicial automático
        window.onload = () => {
          setTimeout(() => {
            chat.innerHTML = '<div class="message bot"><div class="bubble">¡Hola! 👋 Soy Mavilda de Seragro, especialista en drones agrícolas DJI.<br><br>Me encantaría ayudarte a mejorar la eficiencia de tu campo.<br>¿Con quién tengo el gusto de hablar?</div></div>';
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
});

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    status: "✅ Operativo",
    name: "Mavilda Bot - Seragro",
    version: "3.0 Professional",
    endpoints: {
      process: "/process - Procesar mensajes",
      test: "/test - Interfaz de prueba",
    },
    features: [
      "Análisis inteligente de mensajes",
      "Detección de intenciones",
      "Respuestas contextuales",
      "Personalidad argentina natural",
      "Integración N8N completa",
    ],
    timestamp: new Date().toLocaleString("es-AR"),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Mavilda Bot corriendo en puerto ${PORT}`);
  console.log(`🔗 Interfaz de prueba: http://localhost:${PORT}/test`);
  console.log(`📊 Estado del sistema: http://localhost:${PORT}/`);
});
