<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AnalysisChartCard,
  WorkbenchHeader,
  WorkbenchProject,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { getMealRecords } from '../../../api/diet';
import { getSleepRecords } from '../../../api/sleep';
import { getRecordList } from '../../../api/sport';
import AnalyticsVisitsSource from '../analytics/analytics-visits-source.vue';

dayjs.extend(relativeTime);

interface SportRecord {
  id: number;
  date: string;
  sport_type: string;
  duration: number;
  calories_burned: number;
}

// 定义睡眠记录类型接口
interface SleepRecord {
  id: number;
  date: string;
  sleep_time: string;
  wake_time: string;
  duration: number;
}

// 定义饮食记录类型接口
interface DietRecord {
  id: number;
  date: string;
  meal: 'breakfast' | 'dinner' | 'lunch';
  items: {
    estimated_calories: number;
  }[];
}

const userStore = useUserStore();

// 这是一个示例数据，实际项目中需要根据实际情况进行调整
// url 也可以是内部路由，在 navTo 方法中识别处理，进行内部跳转
// 例如：url: /dashboard/workspace
const projectItems: WorkbenchProjectItem[] = [
  {
    color: '',
    content: '不要等待机会，而要创造机会。',
    date: '2021-04-01',
    group: '开源组',
    icon: 'carbon:logo-github',
    title: 'Github',
    url: 'https://github.com',
  },
  {
    color: '#3fb27f',
    content: '现在的你决定将来的你。',
    date: '2021-04-01',
    group: '算法组',
    icon: 'ion:logo-vue',
    title: 'Vue',
    url: 'https://vuejs.org',
  },
  {
    color: '#e18525',
    content: '没有什么才能比努力更重要。',
    date: '2021-04-01',
    group: '上班摸鱼',
    icon: 'ion:logo-html5',
    title: 'Html5',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTML',
  },
  {
    color: '#bf0c2c',
    content: '热情和欲望可以突破一切难关。',
    date: '2021-04-01',
    group: 'UI',
    icon: 'ion:logo-angular',
    title: 'Angular',
    url: 'https://angular.io',
  },
  {
    color: '#00d8ff',
    content: '健康的身体是实现目标的基石。',
    date: '2021-04-01',
    group: '技术牛',
    icon: 'bx:bxl-react',
    title: 'React',
    url: 'https://reactjs.org',
  },
  {
    color: '#EBD94E',
    content: '路是走出来的，而不是空想出来的。',
    date: '2021-04-01',
    group: '架构组',
    icon: 'ion:logo-javascript',
    title: 'Js',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript',
  },
];

// 同样，这里的 url 也可以使用以 http 开头的外部链接
const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#1fdaca',
    icon: 'mdi:bed',
    title: '睡眠管理',
    url: '/sleep',
  },
  {
    color: '#4daf1bc9',
    icon: 'mdi:run',
    title: '运动管理',
    url: '/sport',
  },
  {
    color: '#e18525',
    icon: 'mdi:food',
    title: '饮食管理',
    url: '/diet',
  },
  {
    color: '#bf0c2c',
    icon: 'mdi:account-multiple',
    title: '好友管理',
    url: '/friend', // 这里的 URL 是示例，实际项目中需要根据实际情况进行调整
  },
  {
    color: '#3fb27f',
    icon: 'mdi:chart-line',
    title: '健康报告',
    url: '/health-report',
  },
  {
    color: '#00d8ff',
    icon: 'ion:bar-chart-outline',
    title: '数据分析',
    url: '/data-analysis',
  },
];

const fetchUserActivities = async () => {
  try {
    // 获取各类记录
    const [sleepRes, dietRes, sportRes] = await Promise.all([
      getSleepRecords({
        start_date: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        end_date: dayjs().format('YYYY-MM-DD'),
      }),
      getMealRecords(),
      getRecordList(),
    ]);

    const activities: WorkbenchTrendItem[] = [];

    // 处理睡眠记录
    if (sleepRes && sleepRes.length > 0) {
      (sleepRes as SleepRecord[]).forEach((record) => {
        activities.push({
          avatar: `svg:avatar-${userStore.userInfo?.id || 1}`,
          title: userStore.userInfo?.realName || '我',
          content: `记录了睡眠数据，从 ${record.sleep_time} 到 ${record.wake_time}，时长 ${record.duration} 小时`,
          date: dayjs(record.date).fromNow(),
        });
      });
    }

    // 处理饮食记录
    if (dietRes && dietRes.length > 0) {
      (dietRes as DietRecord[]).forEach((record) => {
        const mealMap = {
          breakfast: '早餐',
          lunch: '午餐',
          dinner: '晚餐',
        };
        activities.push({
          avatar: `svg:avatar-${userStore.userInfo?.id || 1}`,
          title: userStore.userInfo?.realName || '我',
          content: `记录了${mealMap[record.meal]}，共摄入 ${record.items.reduce((sum, item) => sum + item.estimated_calories, 0)} 千卡`,
          date: dayjs(record.date).fromNow(),
        });
      });
    }

    // 处理运动记录
    if (sportRes && sportRes.length > 0) {
      (sportRes as SportRecord[]).forEach((record) => {
        activities.push({
          avatar: `svg:avatar-${userStore.userInfo?.id || 1}`,
          title: userStore.userInfo?.realName || '我',
          content: `进行了${record.sport_type}运动，时长${record.duration}分钟，消耗${record.calories_burned}千卡`,
          date: dayjs(record.date).fromNow(),
        });
      });
    }

    // 按时间排序，最新的在前
    trendItems.value = activities.sort((a, b) => {
      return dayjs(b.date).valueOf() - dayjs(a.date).valueOf();
    });
  } catch (error) {
    console.error('获取用户动态失败:', error);
  }
};

const todoItems = ref<WorkbenchTodoItem[]>([
  {
    completed: false,
    content: `审查最近提交到Git仓库的前端代码，确保代码质量和规范。`,
    date: '2024-07-30 11:00:00',
    title: '审查前端代码提交',
  },
  {
    completed: true,
    content: `检查并优化系统性能，降低CPU使用率。`,
    date: '2024-07-30 11:00:00',
    title: '系统性能优化',
  },
  {
    completed: false,
    content: `进行系统安全检查，确保没有安全漏洞或未授权的访问。 `,
    date: '2024-07-30 11:00:00',
    title: '安全检查',
  },
  {
    completed: false,
    content: `更新项目中的所有npm依赖包，确保使用最新版本。`,
    date: '2024-07-30 11:00:00',
    title: '更新项目依赖',
  },
  {
    completed: false,
    content: `修复用户报告的页面UI显示问题，确保在不同浏览器中显示一致。 `,
    date: '2024-07-30 11:00:00',
    title: '修复UI显示问题',
  },
]);

const trendItems = ref<WorkbenchTrendItem[]>([]);

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
// This is a sample method, adjust according to the actual project requirements
function navTo(nav: WorkbenchProjectItem | WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  } else {
    console.warn(`Unknown URL for navigation item: ${nav.title} -> ${nav.url}`);
  }
}

onMounted(() => {
  fetchUserActivities();
});
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        早安, {{ userStore.userInfo?.realName }}, 开始您一天的工作吧！
      </template>
      <template #description> 今日晴，20℃ - 32℃！ </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <WorkbenchProject :items="projectItems" title="项目" @click="navTo" />
        <WorkbenchTrends
          :items="trendItems.slice(0, 10)"
          class="mt-5"
          title="最新动态"
        />
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5 lg:mt-0"
          title="快捷导航"
          @click="navTo"
        />
        <WorkbenchTodo :items="todoItems" class="mt-5" title="待办事项" />
        <AnalysisChartCard class="mt-5" title="访问来源">
          <AnalyticsVisitsSource />
        </AnalysisChartCard>
      </div>
    </div>
  </div>
</template>
