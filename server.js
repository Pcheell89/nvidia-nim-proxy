const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// NVIDIA NIM
const NIM_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

// Маппинг моделей
const MODEL_MAPPING = {
// === Gemma 4 31B ===
'gemma': 'google/gemma-4-31b-it',
'gemma-4': 'google/gemma-4-31b-it',
'gemma-4-31b': 'google/gemma-4-31b-it',
'gemma-4-31b-it': 'google/gemma-4-31b-it',

// === GLM-5.2 ===
'glm': 'z-ai/glm-5.2',
'glm-5.2': 'z-ai/glm-5.2',

// === DeepSeek Flash ===
'gpt-4-turbo': 'deepseek-ai/deepseek-v4-flash',
'deepseek-v4-flash': 'deepseek-ai/deepseek-v4-flash',

// === Nemotron 3 Ultra ===
'nemotron-ultra': 'nvidia/nemotron-3-ultra-550b-a55b',
'ultra': 'nvidia/nemotron-3-ultra-550b-a55b',
'nemotron-3-ultra': 'nvidia/nemotron-3-ultra-550b-a55b',

// === Nemotron 3 Super ===
'nemotron-super': 'nvidia/nemotron-3-super-120b-a12b',
'super': 'nvidia/nemotron-3-super-120b-a12b',
'nemotron-3-super': 'nvidia/nemotron-3-super-120b-a12b'
};

// Health check
app.get('/health', (req, res) => {
res.json({
status: 'ok',
service: 'NVIDIA NIM Proxy for Janitor AI',
models: Object.keys(MODEL_MAPPING),
key_configured: !!NIM_API_KEY
});
});

// Список моделей
app.get('/v1/models', (req, res) => {
res.json({
object: 'list',
data: Object.keys(MODEL_MAPPING).map(id => ({
id,
object: 'model',
created: Date.now(),
owned_by: 'nvidia-nim-proxy'
}))
});
});

// Главный эндпоинт
app.post('/v1/chat/completions', async (req, res) => {
try {
if (!NIM_API_KEY) {
return res.status(500).json({
error: { message: 'NIM_API_KEY не настроен. Добавь переменную окружения в Render.' }
});
}

const { model, messages, temperature, max_tokens, stream } = req.body;  

// Определяем модель  
let nimModel = MODEL_MAPPING[model] || 'nvidia/nemotron-3-ultra-550b-a55b';  

const response = await axios.post(  
  `${NIM_API_BASE}/chat/completions`,  
  {  
    model: nimModel,  
    messages,  
    temperature: temperature ?? 0.8,  
    max_tokens: max_tokens || 8192,  
    stream: !!stream  
  },  
  {  
    headers: {  
      'Authorization': `Bearer ${NIM_API_KEY}`,  
      'Content-Type': 'application/json'  
    },  
    responseType: stream ? 'stream' : 'json',  
    timeout: 180000  
  }  
);  

if (stream) {  
  res.setHeader('Content-Type', 'text/event-stream');  
  res.setHeader('Cache-Control', 'no-cache');  
  res.setHeader('Connection', 'keep-alive');  
  response.data.pipe(res);  
} else {  
  res.json(response.data);  
}

} catch (error) {
console.error('Ошибка:', error.response?.data || error.message);
res.status(error.response?.status || 500).json({
error: {
message: error.response?.data?.detail || error.message || 'Ошибка прокси',
type: 'proxy_error'
}
});
}
});

app.listen(PORT, () => {
console.log(NVIDIA NIM Proxy запущен на порту ${PORT});
});
