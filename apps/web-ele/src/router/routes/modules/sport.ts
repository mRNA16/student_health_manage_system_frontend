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
    children: [
      {
        name: 'SportManagerIndex',
        path: '',
        component: () => import('#/views/SportManage/SportManager.vue'),
        meta: {
          icon: 'mdi:run',
          title: $t('sport.title'),
        },
      },
    ],
  },
];

export default routes;
