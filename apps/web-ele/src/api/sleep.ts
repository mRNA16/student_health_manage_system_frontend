import { requestClient } from './request';

// 获取当前用户信息
export function getCurrentUser() {
  return requestClient.get('/auth/user/profile/');
}

// 获取睡眠记录
export function getSleepRecords(params: {
  end_date?: string;
  start_date?: string;
}) {
  return requestClient.get('/sleep/', { params });
}

// 新增睡眠记录
export function addSleepRecord(data: {
  date: string;
  sleep_time: string;
  wake_time: string;
}) {
  return requestClient.post('/sleep/', data);
}

export function getSleepAnalysis(params: {
  end_date: string;
  start_date: string;
}) {
  return requestClient.get('/sleep/analysis/', { params });
}
