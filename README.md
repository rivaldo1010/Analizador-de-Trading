# Trading Analyzer Backend

Aplicación para análisis de gráficos de trading usando OpenAI Vision API.

## Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar API Key de OpenAI

Edita el archivo `.env` y reemplaza `tu-api-key-aqui` con tu API key real de OpenAI:

```env
OPENAI_API_KEY=sk-proj-tu-api-key-real
```

Para obtener tu API key:
1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Cópiala y pégala en el archivo `.env`

### 3. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo:

```bash
npm run dev
```

El servidor estará disponible en http://localhost:3002

## Uso

1. Abre tu navegador en http://localhost:3002
2. Haz clic en "Seleccionar archivo" y sube una captura de pantalla de un gráfico de trading
3. La IA analizará el gráfico y te dará una recomendación (SUBIR, BAJAR o NEUTRAL)

## Formatos soportados

- PNG
- JPG
- WEBP
- Tamaño máximo: 5MB

## Solución de problemas

### Error: "API key no configurada"
- Verifica que el archivo `.env` tenga la variable `OPENAI_API_KEY` con una API key válida

### Error: "API key inválida"
- Confirma que tu API key sea correcta y tenga créditos disponibles en tu cuenta de OpenAI

### Error: "Límite de API excedido"
- Has alcanzado el límite de tu plan de OpenAI. Espera unos minutos o actualiza tu plan

### La imagen no se analiza
- Verifica que la imagen sea de un gráfico de trading claro
- Asegúrate de que el tamaño no exceda 5MB
- Intenta con formato PNG o JPG si estás usando otro formato
