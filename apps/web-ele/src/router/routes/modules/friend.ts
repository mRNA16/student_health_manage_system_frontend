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
    children: [
      {
        name: 'FriendManagerIndex',
        path: '',
        component: () => import('#/views/FriendManage/FriendManager.vue'),
        meta: {
          icon: 'mdi:account-multiple',
          title: $t('friend.title'),
        },
      },
      {
        name: 'FriendDetail',
        path: 'detail/:id',
        component: () => import('#/views/FriendManage/FriendDetail.vue'),
        meta: {
          icon: 'mdi:account-circle',
          title: $t('friend.detail'),
          hideInMenu: true,
        },
      },
    ],
  },
];

export default routes;
