import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:food',
      order: 1003,
      title: $t('diet.title'),
    },
    name: 'DietManager',
    path: '/diet',
    children: [
      {
        name: 'DietManagerIndex',
        path: '',
        component: () => import('#/views/DietManage/DietManager.vue'),
        meta: {
          icon: 'mdi:food',
          title: $t('diet.title'),
        },
      },
    ],
  },
];

export default routes;
