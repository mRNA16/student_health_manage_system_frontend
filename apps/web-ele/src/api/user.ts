import { requestClient } from './request';

export function getCurrentUserProfile() {
  return requestClient.get('/auth/user/profile/');
}

export function updateCurrentUserProfile(
  data: Partial<{
    birthday: string;
    daily_calories_burn_goal: number;
    daily_calories_intake_goal: number;
    daily_sleep_hours_goal: number;
    gender: 'female' | 'male';
    height: number;
    realName: string;
    roles: any[];
    weight: number;
  }>,
) {
  return requestClient.put('/auth/user/profile/', data);
}
