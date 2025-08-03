/**
 * 用户基本信息接口
 */
export interface User {
  id: number;
  username: string;
}
/**
 * 好友接口
 */
export interface Friend {
  id: number;
  username: string;
}

/**
 * 好友请求接口
 */
export interface FriendRequest {
  id: number;
  from_user: User;
  to_user: User;
  status: 'accepted' | 'cancelled' | 'pending' | 'rejected';
  created_at: string;
}
