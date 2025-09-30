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
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// Función para analizar imagen con OpenAI
async function analyzeImageWithOpenAI(imageBuffer) {
  try {
    // Convertir imagen a base64
    const base64Image = imageBuffer.toString('base64');
    
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
                Busca patrones de velas japonesas, tendencias alcistas/bajistas, niveles de soporte/resistencia.
                
                Responde ÚNICAMENTE con un JSON en este formato exacto:
                {
                  "recommendation": "SUBIR|BAJAR|NEUTRAL",
                  "confidence": 0.85,
                  "explanation": "Explicación detallada basada en los patrones detectados",
                  "patterns": ["patrón1", "patrón2"],
                  "timeframe": " timeframe detectado"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extraer y parsear el JSON de la respuesta
    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No se pudo parsear la respuesta de OpenAI');
    }
    
  } catch (error) {
    console.error('Error con OpenAI API:', error.response?.data || error.message);
    throw new Error('Error al analizar la imagen');
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

      const analysisResult = await analyzeImageWithOpenAI(req.file.buffer);

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