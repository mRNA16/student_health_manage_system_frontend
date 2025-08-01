import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    access: string;
    refresh: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }

  export interface RegisterParams {
    username: string;
    password: string;
    profile: {
      birthday: string;
      gender: string;
      height: number;
      weight: number;
    };
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const res = await requestClient.post<AuthApi.LoginResult>(
    '/auth/login/',
    data,
  );
  return res;
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh/', {
    withCredentials: true,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout/', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes/');
}

/**
 * 注册
 */
export async function registerApi(data: AuthApi.RegisterParams) {
  return requestClient.post('/auth/register/', data);
}
