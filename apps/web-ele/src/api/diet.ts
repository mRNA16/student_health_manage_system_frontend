import { requestClient } from './request';

// 获取当前用户信息（复用即可）
export function getCurrentUser() {
  return requestClient.get('/auth/user/profile/');
}

// 获取饮食记录
export function getMealRecords() {
  return requestClient.get('/diet/records/');
}

// 新增饮食记录
export function addMealRecord(data: {
  date: string;
  items: {
    food: number;
    quantity_in_grams: number;
  }[];
  meal: string;
  source: string;
}) {
  return requestClient.post('/diet/records/', data);
}

// 编辑饮食记录
export function updateMealRecord(data: {
  date: string;
  id: number;
  items: {
    food: number;
    quantity_in_grams: number;
  }[];
  meal: string;
  source: string;
}) {
  return requestClient.put(`/diet/records/${data.id}/`, data);
}

// 删除饮食记录
export function deleteMealRecord(id: number) {
  return requestClient.delete(`/diet/records/${id}/`);
}

let foodListCache: any = null;

// 获取常见食物列表
export async function getFoodList() {
  if (foodListCache) {
    return foodListCache;
  }

  // 尝试从 localStorage 获取
  const cached = localStorage.getItem('food_list_cache');
  if (cached) {
    try {
      foodListCache = JSON.parse(cached);
      return foodListCache;
    } catch (e) {
      console.error('Failed to parse food list cache', e);
    }
  }

  const res = await requestClient.get('/diet/list');
  foodListCache = res;
  try {
    localStorage.setItem('food_list_cache', JSON.stringify(res));
  } catch (e) {
    console.warn('Failed to save food list to localStorage', e);
  }
  return res;
}

export function getDietAnalysis(params: {
  end_date: string;
  start_date: string;
}) {
  return requestClient.get('/diet/records/analysis/', { params });
}
