import type { User } from '../types/friend';

import { requestClient } from './request';

// 获取当前用户信息（复用即可）
export function getCurrentUserInfo() {
  return requestClient.get('/auth/user/info/');
}

/**
 * 获取好友列表
 * @returns 好友列表响应
 */
export const getFriendList = async (): Promise<
  {
    id: number;
    username: string;
  }[]
> => {
  return requestClient.get('/friend/friends/');
};

/**
 * 获取好友详情
 * @param friendId 好友ID
 * @returns 好友详情响应
 */
export const fetchFriendDetail = async (
  friendId: number,
): Promise<{
  activities: {
    content: string;
    timestamp: string;
    type: string;
  }[];
  friendId: number;
  friendName: string;
}> => {
  return requestClient.get(`/friend/${friendId}/`);
};

/**
 * 发送好友请求
 * @param userId 目标用户ID
 * @returns 响应结果
 */
export const sendFriendRequest = async (
  userId: number,
): Promise<{
  id: number;
  username: string;
}> => {
  return requestClient.post('/friend/send/', {
    to_user: userId,
  });
};

/**
 * 获取好友请求列表
 * @param type 请求类型：'sent' 发送的请求，'received' 收到的请求
 * @returns 好友请求列表响应
 */
export const getFriendRequests = async (
  type: 'received' | 'sent' = 'received',
): Promise<
  {
    created_at: string;
    from_user: User;
    id: number;
    status: 'accepted' | 'cancelled' | 'pending' | 'rejected';
    to_user: User;
  }[]
> => {
  return type === 'sent'
    ? requestClient.get('/friend/sent_requests/')
    : requestClient.get('/friend/received_requests/');
};

/**
 * 接受好友请求
 * @param requestId 请求ID
 * @returns 响应结果
 */
export const acceptFriendRequest = async (
  requestId: number,
): Promise<{
  created_at: string;
  from_user: User;
  id: number;
  status: 'accepted' | 'cancelled' | 'pending' | 'rejected';
  to_user: User;
}> => {
  return requestClient.post(`/friend/${requestId}/accept/`);
};

/**
 * 拒绝好友请求
 * @param requestId 请求ID
 * @returns 响应结果
 */
export const rejectFriendRequest = async (
  requestId: number,
): Promise<{
  created_at: string;
  from_user: User;
  id: number;
  status: 'accepted' | 'cancelled' | 'pending' | 'rejected';
  to_user: User;
}> => {
  return requestClient.post(`/friend/${requestId}/reject/`);
};

/**
 * 取消好友请求
 * @param requestId 请求ID
 * @returns 响应结果
 */
export const cancelFriendRequest = async (
  requestId: number,
): Promise<{
  created_at: string;
  from_user: User;
  id: number;
  status: 'accepted' | 'cancelled' | 'pending' | 'rejected';
  to_user: User;
}> => {
  return requestClient.delete(`/friend/${requestId}/cancel/`);
};

/**
 * 移除好友
 * @param friendId 好友ID
 * @returns 响应结果
 */
export const removeFriend = async (friendId: number) => {
  return requestClient.delete(`/friend/${friendId}/remove/`);
};

/**
 * 精确搜索用户
 * @param username 搜索关键词
 * @returns 用户列表响应
 */
export const searchUsers = async (
  username: string,
): Promise<
  {
    id: number;
    username: string;
  }[]
> => {
  return requestClient.get(`/auth/user/search/?search=${username}`);
};

/**
 * 加载某条记录的评论
 * @param activityType 活动类型：'sport' | 'sleep' | 'meal'
 * @param activityId 活动记录 ID
 * @returns 评论数组
 */
export const fetchComments = async (
  activityType: 'meal' | 'sleep' | 'sport',
  activityId: number,
): Promise<
  {
    content: string;
    created_at: string;
    id: number;
    user_id: number; // 这里返回的其实是UserId
    user_name: string;
  }[]
> => {
  return requestClient.get('/comments/', {
    params: {
      activity_type: activityType,
      activity_id: activityId,
    },
  });
};

/**
 * 提交评论
 * @param activityType 活动类型：'sport' | 'sleep' | 'meal'
 * @param activityId 活动记录 ID
 * @param content 评论内容
 * @returns 提交后的评论对象
 */
export const submitComment = async (
  activityType: 'meal' | 'sleep' | 'sport',
  activityId: number,
  content: string,
): Promise<{
  content: string;
  created_at: string;
  id: number;
  user: {
    id: number;
    username: string;
  };
}> => {
  return requestClient.post('/comments/', {
    content,
    activity_type: activityType,
    activity_id: activityId,
  });
};
