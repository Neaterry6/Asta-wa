import fs from 'fs';
import path from 'path';
import config from '../config.js';

export const QWEN_MODELS = [
  'Qwen3.6-Plus',
  'Qwen3.5-Plus',
  'Qwen3.5-Flash',
  'Qwen3.5-397B-A17B',
  'Qwen3.5-122B-A10B',
  'Qwen3.5-35B-A3B',
  'Qwen3.5-27B',
  'Qwen3-Max',
  'Qwen3-Coder',
  'Qwen3-Coder-Flash',
  'Qwen3-235B-A22B-2507',
  'Qwen3-30B-A3B-2507',
  'Qwen3-Omni-Flash',
  'Qwen3-VL-235B-A22B',
  'Qwen3-VL-32B',
  'Qwen3-VL-30B-A3B',
  'Qwen3-Next-80B-A3B',
  'Qwen2.5-Max',
  'Qwen2.5-Plus',
  'Qwen2.5-Turbo',
  'Qwen2.5-Coder-32B-Instruct',
  'Qwen2.5-VL-32B-Instruct',
  'Qwen2.5-Omni-7B',
  'Qwen-Deep-Research',
  'Qwen-Web-Dev',
  'Qwen-Full-Stack',
  'Qwen-Slides'
];

const QWEN_MODEL_FILE = path.resolve('data/qwen-model.json');

export function getDefaultQwenModel() {
  return config.qwen?.defaultModel || 'Qwen3.6-Plus';
}

export function getCurrentQwenModel() {
  try {
    const raw = JSON.parse(fs.readFileSync(QWEN_MODEL_FILE, 'utf-8'));
    return raw.model || getDefaultQwenModel();
  } catch {
    return getDefaultQwenModel();
  }
}

export function setCurrentQwenModel(model) {
  fs.mkdirSync(path.dirname(QWEN_MODEL_FILE), { recursive: true });
  fs.writeFileSync(QWEN_MODEL_FILE, JSON.stringify({ model }, null, 2));
}

export function getQwenConfig() {
  return {
    baseUrl: config.qwen?.baseUrl || 'https://qwen.aikit.club',
    apiKey: process.env.QWEN_API_KEY || config.qwen?.apiKey || '',
    assistantName: config.qwen?.assistantName || 'Terry'
  };
}
