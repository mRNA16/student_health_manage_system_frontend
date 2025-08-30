import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:brain',
      order: 1005,
      title: '数据分析',
    },
    name: 'DataAnalysisManager',
    path: '/data-analysis',
    component: () => import('#/views/DataAnalysis/DataAnalysis.vue'),
  },
];

export default routes;
