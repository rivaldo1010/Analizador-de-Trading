const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
const allowedOrigin = process.env.CORS_ORIGIN || null;
app.use(cors({
  origin: allowedOrigin || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());
app.use(express.static('public'));

// Configuración de multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
    }
  }
});

// Función para analizar imagen con OpenAI
async function analyzeImageWithOpenAI(imageBuffer, mimeType) {
  try {
    const base64Image = imageBuffer.toString('base64');

    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza este gráfico de trading y determina la tendencia.
Busca patrones de velas japonesas, tendencias alcistas/bajistas, niveles de soporte/resistencia, volumen, indicadores técnicos (RSI, MACD, EMA, SMA).

Responde ÚNICAMENTE con un JSON válido en este formato exacto (sin texto adicional):
{
  "recommendation": "SUBIR" o "BAJAR" o "NEUTRAL",
  "confidence": 0.85,
  "explanation": "Explicación detallada de máximo 200 caracteres",
  "patterns": ["patrón1", "patrón2"],
  "timeframe": "timeframe detectado (1m, 5m, 1h, 4h, 1d, etc.)"
}`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.5
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content.trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('Respuesta de OpenAI sin JSON:', content);
      throw new Error('La respuesta de OpenAI no contiene un JSON válido');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.recommendation || !['SUBIR', 'BAJAR', 'NEUTRAL'].includes(parsed.recommendation.toUpperCase())) {
      throw new Error('Formato de recomendación inválido');
    }

    return {
      recommendation: parsed.recommendation.toUpperCase(),
      confidence: parseFloat(parsed.confidence) || 0.5,
      explanation: parsed.explanation || 'Sin explicación',
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      timeframe: parsed.timeframe || 'No detectado'
    };

  } catch (error) {
    if (error.response) {
      console.error('Error OpenAI API:', error.response.status, error.response.data);
      if (error.response.status === 401) {
        throw new Error('API key de OpenAI inválida o no configurada');
      } else if (error.response.status === 429) {
        throw new Error('Límite de API excedido. Intenta nuevamente en unos minutos');
      } else if (error.response.status === 400) {
        throw new Error('Imagen no válida o demasiado grande');
      }
      throw new Error(`Error de OpenAI: ${error.response.data?.error?.message || 'Error desconocido'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout: La petición tardó demasiado');
    }
    console.error('Error al analizar:', error.message);
    throw error;
  }
}

// Ruta para análisis de imágenes
app.post('/api/analyze', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'La imagen supera el límite de 5MB' });
        }
        return res.status(400).json({ error: err.message || 'Error al procesar la imagen' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó imagen' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'API key no configurada' });
      }

      const analysisResult = await analyzeImageWithOpenAI(req.file.buffer, req.file.mimetype);

      return res.json({
        success: true,
        ...analysisResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error en el análisis:', error.response?.data || error.message || error);
      const status = error.response?.status || 502;
      return res.status(status).json({
        error: 'Error al analizar la imagen',
        details: error.response?.data || error.message
      });
    }
  });
});

// Ruta de verificación de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({ error: 'Error del servidor', details: err.message });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});