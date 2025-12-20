<script lang="ts" setup>
import type {
  WorkbenchQuickNavItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ElMessage } from 'element-plus';

import {
  WorkbenchHeader,
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
import { getCurrentUserProfile, updateCurrentUserProfile } from '../../../api/user';

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
const healthTips = ref([
  {
    completed: false,
    content: '每天坚持运动30分钟，可以显著提高心肺功能。',
    date: dayjs().format('YYYY-MM-DD'),
    title: '坚持运动',
  },
  {
    completed: false,
    content: '保证每天7-8小时的睡眠，有助于身体恢复和精神集中。',
    date: dayjs().format('YYYY-MM-DD'),
    title: '充足睡眠',
  },
  {
    completed: false,
    content: '多吃蔬菜水果，减少高糖高油食物的摄入。',
    date: dayjs().format('YYYY-MM-DD'),
    title: '均衡饮食',
  },
  {
    completed: false,
    content: '每小时起身活动5分钟，缓解久坐带来的身体压力。',
    date: dayjs().format('YYYY-MM-DD'),
    title: '避免久坐',
  },
]);

const healthGoals = ref({
  daily_calories_burn_goal: 300,
  daily_calories_intake_goal: 2000,
  daily_sleep_hours_goal: 8,
});

const todayStats = ref({
  calories_burned: 0,
  calories_intake: 0,
  sleep_hours: 0,
});

const editGoalsDialogVisible = ref(false);
const goalsForm = ref({ ...healthGoals.value });

const fetchHealthData = async () => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const [userProfile, sleepRes, dietRes, sportRes] = await Promise.all([
      getCurrentUserProfile(),
      getSleepRecords({ start_date: today, end_date: today }),
      getMealRecords(),
      getRecordList(),
    ]);

    // 更新目标
    if (userProfile) {
      healthGoals.value = {
        daily_calories_burn_goal: userProfile.daily_calories_burn_goal || 300,
        daily_calories_intake_goal: userProfile.daily_calories_intake_goal || 2000,
        daily_sleep_hours_goal: userProfile.daily_sleep_hours_goal || 8,
      };
      goalsForm.value = { ...healthGoals.value };
    }

    // 计算今日统计
    let todaySleep = 0;
    if (sleepRes && sleepRes.length > 0) {
      todaySleep = sleepRes.reduce((sum: number, r: any) => sum + (r.duration || 0), 0);
    }

    let todayIntake = 0;
    if (dietRes && dietRes.length > 0) {
      todayIntake = (dietRes as any[])
        .filter(r => r.date === today)
        .reduce((sum, r) => sum + r.items.reduce((s: number, i: any) => s + i.estimated_calories, 0), 0);
    }

    let todayBurned = 0;
    if (sportRes && sportRes.length > 0) {
      todayBurned = (sportRes as any[])
        .filter(r => r.date === today)
        .reduce((sum, r) => sum + (r.calories || r.calories_burned || 0), 0);
    }

    todayStats.value = {
      calories_burned: todayBurned,
      calories_intake: todayIntake,
      sleep_hours: todaySleep,
    };
  } catch (error) {
    console.error('获取健康数据失败:', error);
  }
};

const handleUpdateGoals = async () => {
  try {
    await updateCurrentUserProfile(goalsForm.value);
    healthGoals.value = { ...goalsForm.value };
    editGoalsDialogVisible.value = false;
    ElMessage.success('目标更新成功');
  } catch (error) {
    ElMessage.error('更新失败');
  }
};

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


const trendItems = ref<WorkbenchTrendItem[]>([]);

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
// This is a sample method, adjust according to the actual project requirements
function navTo(nav: WorkbenchQuickNavItem) {
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
  fetchHealthData();
});
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        您好, {{ userStore.userInfo?.realName }}，一起来记录健康生活吧！
      </template>
      <template #description>Smart Vital-您的健康生活助手</template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <el-card class="mb-5">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-bold">今日健康目标</span>
              <el-button type="primary" link @click="editGoalsDialogVisible = true">修改目标</el-button>
            </div>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <div class="flex flex-col items-center">
              <span class="text-gray-500 mb-2">睡眠时长</span>
              <el-progress 
                type="dashboard" 
                :percentage="Math.min(100, Math.round((todayStats.sleep_hours / healthGoals.daily_sleep_hours_goal) * 100))"
                :color="todayStats.sleep_hours >= healthGoals.daily_sleep_hours_goal ? '#67C23A' : '#409EFF'"
              />
              <span class="mt-2 text-sm">{{ todayStats.sleep_hours.toFixed(1) }} / {{ healthGoals.daily_sleep_hours_goal }} 小时</span>
            </div>
            <div class="flex flex-col items-center">
              <span class="text-gray-500 mb-2">卡路里摄入</span>
              <el-progress 
                type="dashboard" 
                :percentage="Math.min(100, Math.round((todayStats.calories_intake / healthGoals.daily_calories_intake_goal) * 100))"
                :color="todayStats.calories_intake > healthGoals.daily_calories_intake_goal ? '#F56C6C' : '#E6A23C'"
              />
              <span class="mt-2 text-sm">{{ todayStats.calories_intake.toFixed(0) }} / {{ healthGoals.daily_calories_intake_goal }} kcal</span>
            </div>
            <div class="flex flex-col items-center">
              <span class="text-gray-500 mb-2">卡路里消耗</span>
              <el-progress 
                type="dashboard" 
                :percentage="Math.min(100, Math.round((todayStats.calories_burned / healthGoals.daily_calories_burn_goal) * 100))"
                :color="todayStats.calories_burned >= healthGoals.daily_calories_burn_goal ? '#67C23A' : '#F56C6C'"
              />
              <span class="mt-2 text-sm">{{ todayStats.calories_burned.toFixed(0) }} / {{ healthGoals.daily_calories_burn_goal }} kcal</span>
            </div>
          </div>
        </el-card>
        <WorkbenchTrends
          :items="trendItems.slice(0, 4)"
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
        <WorkbenchTodo :items="healthTips" class="mt-5" title="健康贴士" />
      </div>
    </div>

    <!-- 修改目标对话框 -->
    <el-dialog v-model="editGoalsDialogVisible" title="修改健康目标" width="400px">
      <el-form :model="goalsForm" label-width="120px">
        <el-form-item label="睡眠目标 (小时)">
          <el-input-number v-model="goalsForm.daily_sleep_hours_goal" :min="1" :max="24" />
        </el-form-item>
        <el-form-item label="摄入目标 (kcal)">
          <el-input-number v-model="goalsForm.daily_calories_intake_goal" :min="500" :max="5000" :step="100" />
        </el-form-item>
        <el-form-item label="消耗目标 (kcal)">
          <el-input-number v-model="goalsForm.daily_calories_burn_goal" :min="100" :max="2000" :step="50" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editGoalsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateGoals">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
