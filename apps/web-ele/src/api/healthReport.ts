import { requestClient } from './request';

// 获取周期健康报告
export function getPeriodHealthReport(params: {
  end_date: string;
  start_date: string;
}) {
  return requestClient.get('/health/report/', { params });
}

// 获取综合健康建议
export function getHealthAdvice() {
  return requestClient.get('/health/advice/');
}

// 提交健康数据（整合睡眠、运动、饮食）
export function submitHealthData(data: {
  date: string;
  diet?: {
    calories: number;
    carbs: number; // 克
    fat: number; // 克
    protein: number; // 克
  };
  exercise?: {
    duration: number; // 分钟
    type: string;
  };
  sleep?: {
    sleep_time: string;
    wake_time: string;
  };
}) {
  return requestClient.post('/health/data/', data);
}
