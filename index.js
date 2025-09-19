// MAVILDA BOT - VERSIÓN PROFESIONAL COMPLETA CON PROMPT
const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());

// PROMPT PROFESIONAL COMPLETO
const MAVILDA_PROMPT = `
Sos Mavilda, asesora comercial especializada en drones agrícolas DJI de Seragro.
Tu personalidad: profesional pero cercana, con modismos del campo santafesino, empática y orientada a resolver problemas reales del productor agropecuario.

ESTILO DE COMUNICACIÓN:
- Usá voseo argentino natural: "vos", "tenés", "podés"
- Incluí modismos del campo cuando sea apropiado: "a full", "de fierro", "bárbaro"
- Sé cálida pero profesional, como un asesor de confianza del pueblo
- No uses lenguaje técnico excesivo al principio, adaptate al nivel del cliente
- Evitá repeticiones robóticas, variá tus respuestas

PRODUCTOS Y CARACTERÍSTICAS:
- T25P: Ideal arranque, 25L, 100-300 ha, USD 12.999
- T50: Equilibrado, 50L, 300-500 ha, USD 24.999
- T70P: Alta performance, 70L, 500-800 ha, USD 32.999
- T100: Máxima capacidad, 100L, +800 ha, USD 45.999
- Mavic3M: Mapeo y monitoreo multiespectral, USD 4.999

DICCIONARIO AGRO SANTAFESINO:
- "Lote" en vez de parcela
- "Pulverizar" o "fumigar" para aplicaciones
- "Campaña" para temporada
- "Rinde" para rendimiento
- "A campo" para trabajo en terreno

Recordá: Tu objetivo es AYUDAR al productor a mejorar su operación,
la venta viene como consecuencia natural de brindar valor real.
`;

// Base de datos de sesiones en memoria
const sessions = {};

// Función para obtener o crear sesión
function getSession(sessionId) {
  if (!sessions[sessionId]) {
    console.log(`🆕 Nueva sesión: ${sessionId}`);
    sessions[sessionId] = {
      id: sessionId,
      stage: "greeting",
      messageCount: 0, // CAMBIADO: usar messageCount en vez de messages
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
      waitingForName: false, // NUEVO: flag para saber si esperamos nombre
    };
  }
  return sessions[sessionId];
}

// Análisis inteligente de mensaje
function analyzeMessage(message) {
  const msgLower = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Detección de superficie mejorada
  let surface = null;
  const surfacePatterns = [
    /(\d+)\s*(ha|hectarea|hectareas)/i,
    /(\d+)\s*(?:de\s+)?(?:superficie|campo)/i,
    /(?:tengo|trabajo|cultivo)\s+(\d+)/i,
    /^(\d+)$/i, // NUEVO: solo números
  ];

  for (const pattern of surfacePatterns) {
    const match = message.match(pattern);
    if (match) {
      surface = match[1];
      break;
    }
  }

  return {
    // Detección de modelo
    model:
      msgLower.includes("t25") || msgLower.includes("25")
        ? "T25P"
        : msgLower.includes("t50") || msgLower.includes("50")
          ? "T50"
          : msgLower.includes("t70") || msgLower.includes("70")
            ? "T70P"
            : msgLower.includes("t100") || msgLower.includes("100")
              ? "T100"
              : msgLower.includes("mavic")
                ? "Mavic3M"
                : null,

    // Superficie detectada
    surface: surface,

    // Detección de contacto
    phone: message.match(/[\d\s\-\+\(\)]{10,15}/)?.[0]?.replace(/\D/g, ""),
    email: message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0],

    // Detección de intención
    intent:
      msgLower.includes("precio") ||
      msgLower.includes("costo") ||
      msgLower.includes("cuanto") ||
      msgLower.includes("vale") ||
      msgLower.includes("sale") ||
      msgLower.includes("$") ||
      msgLower.includes("usd")
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
                msgLower.includes("rendimiento") ||
                msgLower.includes("caracteristica")
              ? "specs"
              : msgLower.includes("compar") ||
                  msgLower.includes("diferencia") ||
                  msgLower.includes("versus")
                ? "compare"
                : "general",

    // Palabras clave del agro
    agroTerms: {
      hasLote: msgLower.includes("lote"),
      hasCampaña: msgLower.includes("campaña") || msgLower.includes("campana"),
      hasCultivo:
        msgLower.includes("soja") ||
        msgLower.includes("maiz") ||
        msgLower.includes("trigo") ||
        msgLower.includes("girasol") ||
        msgLower.includes("sorgo"),
      hasFumigacion:
        msgLower.includes("fumig") ||
        msgLower.includes("pulveri") ||
        msgLower.includes("aplicacion"),
      hasProblema:
        msgLower.includes("maleza") ||
        msgLower.includes("plaga") ||
        msgLower.includes("problem") ||
        msgLower.includes("yuyo") ||
        msgLower.includes("insecto"),
    },

    // Detección si es saludo
    isGreeting:
      msgLower.includes("hola") ||
      msgLower.includes("buen") ||
      msgLower.includes("hi") ||
      msgLower.includes("buenas") ||
      msgLower.includes("que tal"),

    // NUEVO: Detección si es un posible nombre
    couldBeName:
      !msgLower.includes("hola") &&
      !msgLower.includes("si") &&
      !msgLower.includes("no") &&
      message.length < 30 &&
      !message.match(/\d{3,}/), // No más de 2 dígitos seguidos
  };
}

// Generador de respuestas contextual mejorado
function generateResponse(session, analysis, message) {
  const {
    stage,
    userName,
    modelInterest,
    surfaceHA,
    messageCount,
    waitingForName,
  } = session;
  const {
    intent,
    model,
    surface,
    phone,
    email,
    agroTerms,
    isGreeting,
    couldBeName,
  } = analysis;

  // Actualizar datos de sesión si se detectaron
  if (model && !modelInterest) {
    session.modelInterest = model;
    console.log("✅ Modelo detectado:", model);
  }
  if (surface) {
    session.surfaceHA = parseInt(surface);
    console.log("✅ Superficie detectada:", surface + " ha");
  }
  if (phone && !session.userPhone) {
    session.userPhone = phone;
    console.log("✅ Teléfono detectado:", phone);
  }
  if (email && !session.userEmail) {
    session.userEmail = email;
    console.log("✅ Email detectado:", email);
  }

  // ETAPA 1: SALUDO INICIAL
  if (messageCount === 1) {
    session.stage = "greeting";
    session.waitingForName = true; // NUEVO: Esperamos nombre
    return (
      "¡Hola! 👋 Soy Mavilda de Seragro, especialista en drones agrícolas DJI.\n\n" +
      "Me encantaría ayudarte a mejorar la eficiencia de tu campo.\n" +
      "¿Con quién tengo el gusto de hablar?"
    );
  }

  // ETAPA 2: CAPTURA DE NOMBRE
  if (session.waitingForName && !userName && couldBeName) {
    // Capturar el nombre
    session.userName = message.trim();
    session.stage = "diagnosis";
    session.waitingForName = false;

    console.log("✅ Nombre capturado:", session.userName);

    const saludos = [
      `¡Mucho gusto ${session.userName}! 🚁\n\n¿Qué superficie necesitás cubrir con el drone? También contame qué cultivos trabajás principalmente.`,
      `¡Qué bueno conocerte ${session.userName}!\n\n¿Cuántas hectáreas tenés para trabajar con drones?`,
      `¡Hola ${session.userName}! Me alegra que te intereses por la tecnología de drones.\n\n¿Qué desafío específico querés resolver en tu campo?`,
    ];
    return saludos[Math.floor(Math.random() * saludos.length)];
  }

  // Si todavía esperamos el nombre y no lo detectamos
  if (session.waitingForName && !userName) {
    return "Disculpá, ¿me decís tu nombre así te puedo asesorar mejor?";
  }

  const name = userName || "che";

  // RESPUESTAS POR INTENCIÓN
  switch (intent) {
    case "price":
      if (!modelInterest) {
        return (
          `${name}, para darte un precio exacto, ¿qué modelo te interesa?\n\n` +
          `📊 Opciones según superficie:\n` +
          `• T25P (100-300 ha) - Ideal para empezar\n` +
          `• T50 (300-500 ha) - El más equilibrado\n` +
          `• T70P (500-800 ha) - Alta performance\n` +
          `• T100 (+800 ha) - Máxima capacidad\n` +
          `• Mavic3M - Mapeo y monitoreo`
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
        `• Hasta 12 cuotas sin interés con tarjetas\n` +
        `• Leasing agrícola a 24-36 meses\n` +
        `• Financiación directa adaptada a tu ciclo productivo\n` +
        `• Posibilidad de pago en granos\n\n` +
        `¿Qué opción se adapta mejor a tu flujo de caja?`
      );

    case "compare":
      return (
        `${name}, cada modelo tiene sus ventajas según tu operación:\n\n` +
        `**Para campos chicos-medianos (hasta 300 ha):**\n` +
        `→ T25P: Más económico, fácil de operar, retorno rápido\n\n` +
        `**Para operaciones medianas (300-500 ha):**\n` +
        `→ T50: Mejor relación inversión/rendimiento\n\n` +
        `**Para grandes superficies (+500 ha):**\n` +
        `→ T70P o T100: Máxima eficiencia operativa\n\n` +
        `¿Cuántas hectáreas trabajás vos?`
      );
  }

  // FLUJO CONVERSACIONAL NATURAL - Detectar superficie
  if (!surfaceHA && surface) {
    const ha = parseInt(surface);
    session.surfaceHA = ha;
    session.stage = "proposal";

    if (ha <= 300) {
      session.modelInterest = "T25P";
      return (
        `${name}, para tus ${ha} hectáreas, el T25P es perfecto. ` +
        `Es nuestro modelo más vendido para productores que arrancan con drones.\n\n` +
        `✅ Ventajas para tu campo:\n` +
        `• Tanque de 25L ideal para lotes medianos\n` +
        `• Fácil de operar, aprendés en un día\n` +
        `• Retorno de inversión en 1-2 campañas\n` +
        `• Precio: USD 12.999\n\n` +
        `¿Querés ver una demo o necesitás info de financiación?`
      );
    } else if (ha <= 500) {
      session.modelInterest = "T50";
      return (
        `Con ${ha} hectáreas, te recomiendo el T50, ${name}.\n\n` +
        `✅ Por qué es ideal para vos:\n` +
        `• Tanque de 50L, menos recargas\n` +
        `• Rinde 40 ha/hora a full\n` +
        `• El más elegido por contratistas\n` +
        `• Precio: USD 24.999\n\n` +
        `¿Te interesa coordinar una demo?`
      );
    } else {
      session.modelInterest = "T100";
      return (
        `Para ${ha} hectáreas necesitás potencia, ${name}.\n` +
        `Te recomiendo el T100.\n\n` +
        `✅ Beneficios para operaciones grandes:\n` +
        `• 100L de tanque, máxima autonomía\n` +
        `• Hasta 42 ha/hora de rendimiento\n` +
        `• Menor costo operativo por hectárea\n` +
        `• Precio: USD 45.999\n\n` +
        `¿Coordinamos una demo en tu campo?`
      );
    }
  }

  // Si no tenemos superficie, pedirla
  if (stage === "diagnosis" && !surfaceHA) {
    return (
      `${name}, para recomendarte la mejor opción, ¿cuántas hectáreas necesitás cubrir ` +
      `en tu campaña típica? También contame qué cultivos trabajás principalmente.`
    );
  }

  // SOLICITUD NATURAL DE CONTACTO
  if (
    messageCount >= 5 &&
    !session.userPhone &&
    modelInterest &&
    intent !== "demo"
  ) {
    return (
      `${name}, te puedo mandar videos del ${modelInterest} trabajando en campos ` +
      `de la zona y un informe de rendimiento.\n\n` +
      `📱 ¿Me pasás tu WhatsApp para enviártelo?`
    );
  }

  // RESPUESTA DEFAULT CONTEXTUAL
  if (modelInterest) {
    const opciones = [
      `¿Qué más te gustaría saber sobre el ${modelInterest}, ${name}?`,
      `El ${modelInterest} es excelente elección. ¿Querés conocer precios o ver especificaciones?`,
      `¿Te interesa ver el ${modelInterest} funcionando en tu campo, ${name}?`,
    ];
    return opciones[Math.floor(Math.random() * opciones.length)];
  }

  // Si tiene cultivos mencionados
  if (agroTerms.hasCultivo) {
    return (
      `${name}, excelente que trabajes con esos cultivos. ` +
      `Los drones DJI son ideales para aplicaciones precisas. ` +
      `¿Cuántas hectáreas manejás en total?`
    );
  }

  // Si menciona problemas
  if (agroTerms.hasProblema) {
    return (
      `${name}, los drones son la solución perfecta para esos problemas. ` +
      `Aplicación precisa, sin compactación de suelo. ` +
      `¿Qué superficie necesitás tratar?`
    );
  }

  return (
    `${name}, ¿en qué te puedo ayudar? Puedo contarte sobre modelos, ` +
    `precios, financiación o coordinar una demostración en tu campo.`
  );
}

// ENDPOINT PRINCIPAL
app.post("/process", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    console.log("\n=================");
    console.log("📥 MENSAJE:", message);
    console.log("🔑 SESSION:", sessionId);

    if (!message || !sessionId) {
      return res.status(400).json({ error: "Mensaje y sessionId requeridos" });
    }

    // Obtener sesión y actualizar contador
    const session = getSession(sessionId);
    session.messageCount++; // CAMBIADO: incrementar messageCount
    session.history.push({
      user: message,
      timestamp: new Date(),
    });

    console.log("📊 ESTADO ANTES:", {
      mensaje: session.messageCount,
      nombre: session.userName,
      modelo: session.modelInterest,
      hectareas: session.surfaceHA,
      esperandoNombre: session.waitingForName,
    });

    // Analizar mensaje
    const analysis = analyzeMessage(message);
    console.log("🔍 ANÁLISIS:", analysis);

    // Generar respuesta
    const response = generateResponse(session, analysis, message);

    // Verificar lead completo
    const hasCompleteLead = !!(
      session.userName &&
      (session.userPhone || session.userEmail) &&
      session.modelInterest
    );

    if (hasCompleteLead && !session.captured) {
      session.captured = true;
      console.log("✅ LEAD CAPTURADO!");
    }

    console.log("💬 RESPUESTA:", response.substring(0, 100) + "...");
    console.log("📊 ESTADO DESPUÉS:", {
      mensaje: session.messageCount,
      nombre: session.userName,
      modelo: session.modelInterest,
      hectareas: session.surfaceHA,
    });

    // Responder
    res.json({
      response,
      session: {
        id: session.id,
        userName: session.userName,
        userPhone: session.userPhone,
        userEmail: session.userEmail,
        modelInterest: session.modelInterest,
        surfaceHA: session.surfaceHA,
        messages: session.messageCount, // CAMBIADO
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
    console.error("❌ ERROR:", error);
    res.status(500).json({
      error: "Error procesando mensaje",
      details: error.message,
    });
  }
});

// ENDPOINT PARA LIMPIAR SESIONES
app.get("/clear", (req, res) => {
  const count = Object.keys(sessions).length;
  Object.keys(sessions).forEach((key) => delete sessions[key]);
  res.json({
    mensaje: "✅ Sesiones limpiadas",
    eliminadas: count,
    timestamp: new Date().toISOString(),
  });
});

// INTERFAZ DE PRUEBA
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
        <div class="status" id="status">Sesión de prueba activa</div>
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

          chat.innerHTML += '<div class="message user"><div class="bubble">' + msg + '</div></div>';
          input.value = '';
          chat.scrollTop = chat.scrollHeight;

          try {
            const resp = await fetch('/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: msg, sessionId: sessionId })
            });

            const data = await resp.json();
            messageCount++;

            const botMsg = data.response.replace(/\\n/g, '<br>');
            chat.innerHTML += '<div class="message bot"><div class="bubble">' + botMsg + '</div></div>';
            chat.scrollTop = chat.scrollHeight;

            document.getElementById('status').innerHTML = 
              'Sesión: ' + sessionId.slice(-6) + 
              ' | Mensajes: ' + messageCount +
              (data.session.userName ? ' | Usuario: ' + data.session.userName : '') +
              (data.session.modelInterest ? ' | Modelo: ' + data.session.modelInterest : '') +
              (data.session.surfaceHA ? ' | Hectáreas: ' + data.session.surfaceHA : '');

            console.log('Sesión:', data.session);
            console.log('Análisis:', data);

          } catch (error) {
            chat.innerHTML += '<div class="message bot"><div class="bubble">❌ Error: ' + error.message + '</div></div>';
          }
        }

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
  const sessionCount = Object.keys(sessions).length;
  res.json({
    status: "✅ Operativo",
    name: "Mavilda Bot - Seragro",
    version: "5.1 Professional FIXED",
    sesionesActivas: sessionCount,
    detalles: {
      sesiones: Object.keys(sessions),
      memoria: process.memoryUsage(),
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
  });
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Mavilda Bot PROFESIONAL corriendo en puerto ${PORT}`);
  console.log(`🔗 Interfaz de prueba: http://localhost:${PORT}/test`);
  console.log(`📊 Estado del sistema: http://localhost:${PORT}/`);
  console.log(`🗑️ Limpiar sesiones: http://localhost:${PORT}/clear`);
  console.log(`💬 Prompt cargado: ${MAVILDA_PROMPT.substring(0, 50)}...`);
});
