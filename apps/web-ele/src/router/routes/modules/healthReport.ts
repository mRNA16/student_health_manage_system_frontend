import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:chart-line',
      order: 1004, // 排序号在睡眠(1001)之后，保持合理顺序
      title: $t('healthReport.title'),
    },
    name: 'HealthReportManager',
    path: '/health-report',
    component: () => import('#/views/HealthReport/HealthReport.vue'),
  },
];

export default routes;
