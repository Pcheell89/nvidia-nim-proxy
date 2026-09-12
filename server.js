// server.js - Простой прокси NVIDIA NIM для Janitor AI
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
  // === DeepSeek V4 Pro (лучшее качество) ===
  'gpt-4': 'deepseek-ai/deepseek-v4-pro-0813',
  'gpt-4o': 'deepseek-ai/deepseek-v4-pro-0813',
  'deepseek-v4-pro': 'deepseek-ai/deepseek-v4-pro-0813',
  'deepseek-v4-pro-0813': 'deepseek-ai/deepseek-v4-pro-0813',

  // === DeepSeek V4 Flash (быстрее) ===
  'gpt-4-turbo': 'deepseek-ai/deepseek-v4-flash',
  'deepseek-v4-flash': 'deepseek-ai/deepseek-v4-flash',

  // === MiniMax M3 ===
  'minimax': 'minimaxai/minimax-m3',
  'minimax-m3': 'minimaxai/minimax-m3',
  'gpt-4o-mini': 'minimaxai/minimax-m3',

  // === Kimi ===
  'kimi': 'moonshotai/kimi-k2.6',
  'kimi-k2.6': 'moonshotai/kimi-k2.6',

  // === GLM ===
  'glm': 'z-ai/glm-5.2',
  'glm-5.2': 'z-ai/glm-5.2',
  'gemini-pro': 'z-ai/glm-5.2',

  // === Gemma 4 31B ===
  'gemma': 'google/gemma-4-31b-it',
  'gemma-4': 'google/gemma-4-31b-it',
  'gemma-4-31b': 'google/gemma-4-31b-it',
  'gemma-4-31b-it': 'google/gemma-4-31b-it'
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
    let nimModel = MODEL_MAPPING[model] || 'deepseek-ai/deepseek-v4-pro-0813';

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
        timeout: 120000
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
  console.log(`NVIDIA NIM Proxy запущен на порту ${PORT}`);
});
