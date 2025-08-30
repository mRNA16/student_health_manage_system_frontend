import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:run',
      order: 1002,
      title: $t('sport.title'),
    },
    name: 'SportManager',
    path: '/sport',
    component: () => import('#/views/SportManage/SportManager.vue'),
  },
];

export default routes;
