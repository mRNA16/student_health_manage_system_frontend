import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.dashboard.title'),
    },
    name: 'Dashboard',
    path: '/dashboard',
    component: () => import('#/views/dashboard/workspace/index.vue'),
  },
  {
    path: '/workspace',
    redirect: '/dashboard',
    meta: {
      title: '重定向',
      hideInMenu: true,
    },
  },
];

export default routes;
