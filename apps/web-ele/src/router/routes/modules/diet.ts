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
    component: () => import('#/views/DietManage/DietManager.vue'),
  },
];

export default routes;
