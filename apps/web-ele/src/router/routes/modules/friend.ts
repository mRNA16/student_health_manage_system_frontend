import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:account-multiple',
      order: 1006,
      title: $t('friend.title'),
    },
    name: 'FriendManager',
    path: '/friend',
    component: () => import('#/views/FriendManage/FriendManager.vue'),
  },
  {
    name: 'FriendDetail',
    path: '/friend/detail/:id',
    component: () => import('#/views/FriendManage/FriendDetail.vue'),
    meta: {
      title: $t('friend.detail'),
      icon: 'mdi:account-multiple',
      hideInMenu: true,
      activeMenu: '/friend',
    },
  },
];

export default routes;
