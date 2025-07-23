import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:bed',
      order: 1001,
      title: $t('sleep.title'),
    },
    name: 'SleepManager',
    path: '/sleep',
    children: [
      {
        name: 'SleepManagerIndex',
        path: '',
        component: () => import('#/views/SleepManage/SleepManager.vue'),
        meta: {
          icon: 'mdi:bed',
          title: $t('sleep.title'),
        },
      },
    ],
  },
];

export default routes;
