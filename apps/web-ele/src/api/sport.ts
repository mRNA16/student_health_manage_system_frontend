import { requestClient } from './request';

// 获取当前用户信息
export function getCurrentUser() {
  return requestClient.get('/auth/user/profile/');
}

// 获取运动记录
export function getRecordList() {
  return requestClient.get('/sport/records/');
}

// 新增运动信息
export function addRecord(data: { 
  id:number;
  date: string; 
  sport: number; 
  begin_time: string;
  end_time: string;
}) {
  return requestClient.post('/sport/records/', data);
}

// 修改运动信息
export function updateRecord(data: {
  id:number;
  date: string;
  sport: number;
  begin_time: string;
  end_time: string;
}) {
  return requestClient.put(`/sport/records/${data.id}/`, data);
}

export function deleteRecord(id:number) {
  return requestClient.delete(`/sport/records/${id}/`);
}

export function getSportList() {
  return requestClient.get('/sport/list/');
}