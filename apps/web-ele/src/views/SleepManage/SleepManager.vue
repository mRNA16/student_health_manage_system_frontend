<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ElMessage } from 'element-plus';

import {
  addSleepRecord,
  getCurrentUser,
  getSleepAnalysis,
  getSleepRecords,
} from '../../api/sleep';

dayjs.extend(isBetween);

// 健康标准常量
const HEALTHY_SLEEP_DURATION = 7;
const HEALTHY_BEDTIME = 23.5; // 23:30
const HEALTHY_WAKETIME = 6.5; // 06:30
const DEPRIVATION_THRESHOLD = 5;
const CONTINUOUS_DAYS_THRESHOLD = 4;

// 表单
const form = ref<{
  date: Date | null;
  sleep_time: Date | null;
  wake_time: Date | null;
}>({
  date: null,
  sleep_time: null,
  wake_time: null,
});

// 时间范围
const timeRange = ref<'1y' | '7d' | '30d'>('7d');
const tableTimeRange = ref<'7d' | '30d' | 'all'>('all');

// 睡眠分析数据
const analysisData = ref<any>({
  continuousSleepDeprivation: 0,
  sleepIssues: [],
  coreAdvice: [],
  specificAdvice: [],
  sleepTips: [],
  dailyData: [],
  yearlyData: [],
  HEALTHY_SLEEP_DURATION,
  DEPRIVATION_THRESHOLD,
  CONTINUOUS_DAYS_THRESHOLD,
});
const allRecords = ref<any[]>([]); // 仅用于表格展示
const user = ref<any>(null);

// 时间转换助手
const timeToHours = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(':').map(Number);
  return h + m / 60 + (s || 0) / 3600;
};

const getTimeRangeDates = () => {
  const today = dayjs();
  let end, start;
  switch (timeRange.value) {
    case '1y': {
      start = today.subtract(1, 'y').startOf('day');
      end = today.endOf('day');
      break;
    }
    case '7d': {
      start = today.subtract(6, 'd').startOf('day');
      end = today.endOf('day');
      break;
    }
    case '30d': {
      start = today.subtract(29, 'd').startOf('day');
      end = today.endOf('day');
      break;
    }
  }
  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
  };
};

const getTableTimeRangeDates = () => {
  const today = dayjs();
  if (tableTimeRange.value === '7d') {
    return {
      start: today.subtract(6, 'd').startOf('day').format('YYYY-MM-DD'),
      end: today.endOf('day').format('YYYY-MM-DD'),
    };
  } else if (tableTimeRange.value === '30d') {
    return {
      start: today.subtract(29, 'd').startOf('day').format('YYYY-MM-DD'),
      end: today.endOf('day').format('YYYY-MM-DD'),
    };
  } else {
    return {
      start: '1970-01-01',
      end: '2100-12-31',
    };
  }
};

// 基于后端传来的指标生成建议
const generateAdvice = (data: any) => {
  const issues: string[] = [];
  const averageTST = Number(data.averageTST || 0);
  const stdSleepTime = Number(data.stdSleepTime || 0);
  const stdWakeTime = Number(data.stdWakeTime || 0);
  const stdDuration = Number(data.stdDuration || 0);
  const continuousDays = Number(data.continuousSleepDeprivation || 0);

  // 1. 睡眠问题标签
  if (averageTST < HEALTHY_SLEEP_DURATION) {
    issues.push(
      `睡眠时长不足（平均${averageTST.toFixed(1)}小时，建议至少${HEALTHY_SLEEP_DURATION}小时）`,
    );
  }
  if (stdSleepTime > 1.5) issues.push('入睡时间不规律（波动较大）');
  if (stdWakeTime > 1.5) issues.push('起床时间不规律（波动较大）');
  if (stdDuration > 1.5) issues.push('睡眠时长不稳定（可能存在睡眠中断）');

  // 检查最新一条记录
  const latest = allRecords.value[allRecords.value.length - 1];
  if (latest) {
    const s = timeToHours(latest.sleep_time);
    const w = timeToHours(latest.wake_time);
    if (s > HEALTHY_BEDTIME || (s >= 0 && s < 4)) {
      issues.push('入睡时间较晚（建议不晚于23:30）');
    }
    if (w < HEALTHY_WAKETIME) {
      issues.push('起床时间较早（建议不早于06:00）');
    }
  }

  // 2. 核心建议
  const coreAdvice = [
    '1. 锚定起床时间：每天固定同一时间起床。',
    '2. 循序渐进调整：每天提前15分钟入睡。',
    '3. 建立睡前仪式：睡前1小时进行放松活动。',
  ];

  // 3. 针对性建议
  const specificAdvice: string[] = [];
  if (continuousDays >= CONTINUOUS_DAYS_THRESHOLD) {
    specificAdvice.push(
      `• 紧急调整：未来2天尽量保证至少${HEALTHY_SLEEP_DURATION}小时睡眠。`,
    );
  }
  if (averageTST < HEALTHY_SLEEP_DURATION) {
    specificAdvice.push(
      '• 逐步提前入睡时间，每次15分钟，直至达到目标睡眠时长。',
    );
  }
  if (stdSleepTime > 1.5 || stdWakeTime > 1.5) {
    specificAdvice.push('• 设置“睡前提醒”闹闹钟，提前1小时准备入睡。');
  }
  if (stdDuration > 1.5) {
    specificAdvice.push('• 优化睡眠环境，避免夜间易醒。');
  }
  if (latest) {
    const s = timeToHours(latest.sleep_time);
    if (s > HEALTHY_BEDTIME || (s >= 0 && s < 4)) {
      specificAdvice.push('• 睡前1小时远离电子设备。');
    }
  }
  if (specificAdvice.length === 0) {
    specificAdvice.push('• 保持规律进餐和适度运动。');
  }

  // 4. 睡眠小贴士
  const allTips = [
    '• 试试“478呼吸法”：吸气4秒→屏息7秒→呼气8秒。',
    '• 白天晒10-15分钟太阳，有助于调节生物钟。',
    '• 卧室可放薰衣草，有助于放松入睡。',
    '• 夜间醒来不要看时间，闭眼深呼吸。',
    '• 选择舒适寝具，提升睡眠质量。',
  ];
  const sleepTips = [...allTips].sort(() => 0.5 - Math.random()).slice(0, 3);

  return {
    ...data,
    sleepIssues: issues,
    coreAdvice,
    specificAdvice,
    sleepTips,
    HEALTHY_SLEEP_DURATION,
    DEPRIVATION_THRESHOLD,
    CONTINUOUS_DAYS_THRESHOLD,
  };
};

// 获取分析数据和全部记录
const fetchAll = async () => {
  try {
    // 用户信息
    user.value = await getCurrentUser();
    // 全部记录用于表格
    const allRes = await getSleepRecords({
      start_date: '1970-01-01',
      end_date: dayjs().format('YYYY-MM-DD'),
    });
    allRecords.value = allRes || [];

    // 获取后端分析数据
    const { start, end } = getTimeRangeDates();
    const res = await getSleepAnalysis({ start_date: start, end_date: end });

    // 在前端生成建议
    analysisData.value = generateAdvice(res);
  } catch {
    ElMessage.error('获取数据失败');
  }
};

const addRecord = async () => {
  if (!form.value.date || !form.value.sleep_time || !form.value.wake_time) {
    ElMessage.warning('请填写完整信息');
    return;
  }
  const payload = {
    date: dayjs(form.value.date).format('YYYY-MM-DD'),
    sleep_time: dayjs(form.value.sleep_time).format('HH:mm:ss'),
    wake_time: dayjs(form.value.wake_time).format('HH:mm:ss'),
  };
  try {
    await addSleepRecord(payload);
    ElMessage.success('添加成功');
    form.value = { date: null, sleep_time: null, wake_time: null };
    fetchAll();
  } catch {
    ElMessage.error('添加失败');
  }
};

const sortField = ref<string>('');
const sortOrder = ref<'ascending' | 'descending' | null>(null);
const filteredTableRecords = computed(() => {
  const { start, end } = getTableTimeRangeDates();
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  return allRecords.value.filter((record) => {
    const recordDate = dayjs(String(record.date));
    return recordDate.isBetween(startDate, endDate, null, '[]');
  });
});
const handleSortChange = (sort: {
  order: 'ascending' | 'descending' | null;
  prop: string;
}) => {
  sortField.value = sort.prop;
  sortOrder.value = sort.order;
};
const sortedRecords = computed(() => {
  if (!sortField.value || !sortOrder.value) return filteredTableRecords.value;
  return [...filteredTableRecords.value].sort((a, b) => {
    const valA = a[sortField.value];
    const valB = b[sortField.value];
    if (
      sortField.value === 'date' ||
      sortField.value === 'sleep_time' ||
      sortField.value === 'wake_time'
    ) {
      const timeA = dayjs(
        valA,
        sortField.value === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss',
      ).unix();
      const timeB = dayjs(
        valB,
        sortField.value === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss',
      ).unix();
      return sortOrder.value === 'ascending' ? timeA - timeB : timeB - timeA;
    }
    if (valA < valB) return sortOrder.value === 'ascending' ? -1 : 1;
    if (valA > valB) return sortOrder.value === 'ascending' ? 1 : -1;
    return 0;
  });
});

const handleTimeRangeChange = (value: '1y' | '7d' | '30d') => {
  timeRange.value = value;
  fetchAll(); // 切换范围时重新请求后端分析
};
const handleTableTimeRangeChange = (value: '7d' | '30d' | 'all') => {
  tableTimeRange.value = value;
};

const chartOption = computed(() => {
  const data = analysisData.value || {};
  let xAxisData: string[] = [];
  let chartData: any[] = [];
  let titleText = '';
  if (timeRange.value === '1y' && data.yearlyData) {
    xAxisData = data.yearlyData.map((item: any) => item.date);
    chartData = data.yearlyData.map((item: any) => ({
      value: item.avgDuration,
      itemStyle: { color: '#1890ff' },
    }));
    titleText = '近一年每月平均睡眠时长（小时/天）';
  } else if (data.dailyData) {
    xAxisData = data.dailyData.map((item: any) => item.date);
    chartData = data.dailyData.map((item: any) => ({
      value: item.totalDuration,
      itemStyle: {
        color:
          item.totalDuration < (data.DEPRIVATION_THRESHOLD || 5)
            ? '#f5222d'
            : item.totalDuration < (data.HEALTHY_SLEEP_DURATION || 7)
              ? '#faad14'
              : '#52c41a',
      },
    }));
    titleText =
      timeRange.value === '7d' ? '近7天每天睡眠总时长' : '近30天每天睡眠总时长';
  }
  return {
    title: { text: titleText },
    tooltip: { formatter: '{b}: {c} 小时' },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: { rotate: timeRange.value === '1y' ? 30 : 0 },
    },
    yAxis: { type: 'value', name: '小时' },
    series: [
      {
        data: chartData,
        type: 'bar',
        name: timeRange.value === '1y' ? '平均每天时长' : '睡眠时长',
      },
    ],
  };
});

const checkLowSleep = () => {
  if (
    analysisData.value.continuousSleepDeprivation >=
    (analysisData.value.CONTINUOUS_DAYS_THRESHOLD || 4)
  ) {
    ElMessage({
      message: `⚠️ 睡眠警告：您已连续${analysisData.value.continuousSleepDeprivation}天睡眠量过低（少于${analysisData.value.DEPRIVATION_THRESHOLD}小时）！`,
      type: 'warning',
      duration: 5000, // 5秒后自动关闭
      showClose: true, // 允许手动关闭
    });
  }
};

onMounted(async () => {
  await fetchAll();
  checkLowSleep();
});
</script>

<script lang="ts">
// 图表配置函数（放在<script setup>外部，避免响应式污染）
export function getChartOption() {
  const data = (window as any).analysisData?.value || {};
  const timeRange = (window as any).timeRange?.value || '7d';
  let xAxisData: string[] = [];
  let chartData: any[] = [];
  let titleText = '';
  if (timeRange === '1y' && data.yearlyData) {
    xAxisData = data.yearlyData.map((item: any) => item.date);
    chartData = data.yearlyData.map((item: any) => ({
      value: item.avgDuration,
      itemStyle: { color: '#1890ff' },
    }));
    titleText = '近一年每月平均睡眠时长（小时/天）';
  } else if (data.dailyData) {
    xAxisData = data.dailyData.map((item: any) => item.date);
    chartData = data.dailyData.map((item: any) => ({
      value: item.totalDuration,
      itemStyle: {
        color:
          item.totalDuration < (data.DEPRIVATION_THRESHOLD || 5)
            ? '#f5222d'
            : item.totalDuration < (data.HEALTHY_SLEEP_DURATION || 7)
              ? '#faad14'
              : '#52c41a',
      },
    }));
    titleText =
      timeRange === '7d' ? '近7天每天睡眠总时长' : '近30天每天睡眠总时长';
  }
  return {
    title: { text: titleText },
    tooltip: { formatter: '{b}: {c} 小时' },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: { rotate: timeRange === '1y' ? 30 : 0 },
    },
    yAxis: { type: 'value', name: '小时' },
    series: [
      {
        data: chartData,
        type: 'bar',
        name: timeRange === '1y' ? '平均每天时长' : '睡眠时长',
      },
    ],
  };
}
</script>

<template>
  <div>
    <el-card
      v-if="
        analysisData.continuousSleepDeprivation >=
        (analysisData.CONTINUOUS_DAYS_THRESHOLD || 4)
      "
      class="mt-4"
      shadow="always"
      style="border-left: 4px solid #f56c6c"
    >
      <div style="display: flex; align-items: center; color: #f56c6c">
        <el-icon style="margin-right: 8px"><WarningFilled /></el-icon>
        <div>
          <strong>健康警告：</strong>
          您已连续{{
            analysisData.continuousSleepDeprivation
          }}天睡眠不足（少于{{
            analysisData.DEPRIVATION_THRESHOLD
          }}小时），这可能导致注意力下降、免疫力降低等健康风险，请立即调整作息！
        </div>
      </div>
    </el-card>
    <el-card>
      <el-form :model="form" inline>
        <el-date-picker
          v-model="form.date"
          placeholder="日期"
          style="width: 150px"
        />
        <el-time-picker
          v-model="form.sleep_time"
          placeholder="入睡时间"
          style="width: 120px"
        />
        <el-time-picker
          v-model="form.wake_time"
          placeholder="起床时间"
          style="width: 120px"
        />
        <el-button type="primary" @click="addRecord">添加记录</el-button>
      </el-form>
    </el-card>
    <el-card class="mt-4">
      <template #header>
        <div class="clearfix">
          <span>睡眠记录</span>
          <div style="float: right">
            <span>时间范围：</span>
            <el-radio-group
              v-model="tableTimeRange"
              @change="handleTableTimeRangeChange"
              size="small"
              style="margin-left: 8px"
            >
              <el-radio-button label="7d">近7天</el-radio-button>
              <el-radio-button label="30d">近30天</el-radio-button>
              <el-radio-button label="all">全部</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>
      <el-table
        :data="sortedRecords"
        style="width: 100%"
        @sort-change="handleSortChange"
      >
        <el-table-column prop="date" label="日期" sortable="custom" />
        <el-table-column prop="sleep_time" label="入睡时间" sortable="custom" />
        <el-table-column prop="wake_time" label="起床时间" sortable="custom" />
        <el-table-column
          prop="duration"
          label="睡眠时长(小时)"
          sortable="custom"
        />
        <el-table-column label="状态">
          <template #default="scope">
            <el-tag
              v-if="
                scope.row.duration &&
                scope.row.duration < (analysisData.DEPRIVATION_THRESHOLD || 5)
              "
              type="danger"
              size="small"
            >
              睡眠不足
            </el-tag>
            <el-tag
              v-else-if="
                scope.row.duration &&
                scope.row.duration < (analysisData.HEALTHY_SLEEP_DURATION || 7)
              "
              type="warning"
              size="small"
            >
              时长偏低
            </el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card class="mt-4">
      <div style="margin-bottom: 16px">
        <span>时间范围：</span>
        <el-radio-group
          v-model="timeRange"
          @change="handleTimeRangeChange"
          style="margin-left: 8px"
        >
          <el-radio-button label="7d">近7天</el-radio-button>
          <el-radio-button label="30d">近30天</el-radio-button>
          <el-radio-button label="1y">近一年</el-radio-button>
        </el-radio-group>
      </div>
      <v-chart
        v-if="analysisData.dailyData || analysisData.yearlyData"
        :option="chartOption"
        style="height: 300px"
      />
    </el-card>
    <el-card class="mt-4" v-if="analysisData && analysisData.coreAdvice">
      <template #header>
        <span style="font-weight: bold">睡眠健康分析与建议</span>
      </template>
      <!-- 睡眠指标概览 -->
      <div class="metrics-container">
        <div class="metric-item">
          <div class="metric-label">平均睡眠时长</div>
          <div class="metric-value">{{ analysisData.averageTST }} 小时</div>
          <div
            class="metric-status"
            :class="
              analysisData.averageTST >=
              (analysisData.HEALTHY_SLEEP_DURATION || 7)
                ? 'good'
                : 'warning'
            "
          >
            {{
              analysisData.averageTST >=
              (analysisData.HEALTHY_SLEEP_DURATION || 7)
                ? '正常'
                : '偏低'
            }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">入睡规律性</div>
          <div class="metric-value">
            {{ analysisData.stdSleepTime }} 小时波动
          </div>
          <div
            class="metric-status"
            :class="analysisData.stdSleepTime <= 1.5 ? 'good' : 'warning'"
          >
            {{ analysisData.stdSleepTime <= 1.5 ? '规律' : '不规律' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">起床规律性</div>
          <div class="metric-value">
            {{ analysisData.stdWakeTime }} 小时波动
          </div>
          <div
            class="metric-status"
            :class="analysisData.stdWakeTime <= 1.5 ? 'good' : 'warning'"
          >
            {{ analysisData.stdWakeTime <= 1.5 ? '规律' : '不规律' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">睡眠稳定性</div>
          <div class="metric-value">
            {{ analysisData.stdDuration }} 小时波动
          </div>
          <div
            class="metric-status"
            :class="analysisData.stdDuration <= 1.5 ? 'good' : 'warning'"
          >
            {{ analysisData.stdDuration <= 1.5 ? '稳定' : '波动大' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">平均睡眠中点</div>
          <div class="metric-value">{{ analysisData.avgSleepMidpoint }}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">连续睡眠不足</div>
          <div class="metric-value">
            {{ analysisData.continuousSleepDeprivation }} 天
          </div>
          <div
            class="metric-status"
            :class="
              analysisData.continuousSleepDeprivation < 2
                ? 'good'
                : analysisData.continuousSleepDeprivation <
                    (analysisData.CONTINUOUS_DAYS_THRESHOLD || 4)
                  ? 'warning'
                  : 'danger'
            "
          >
            {{
              analysisData.continuousSleepDeprivation < 2
                ? '正常'
                : analysisData.continuousSleepDeprivation <
                    (analysisData.CONTINUOUS_DAYS_THRESHOLD || 4)
                  ? '需注意'
                  : '危险'
            }}
          </div>
        </div>
      </div>
      <!-- 睡眠问题标签 -->
      <div class="issues-container mt-4">
        <div class="section-title">检测到的睡眠问题</div>
        <div
          v-if="
            !analysisData.sleepIssues || analysisData.sleepIssues.length === 0
          "
          class="no-issues"
        >
          未检测到明显睡眠问题，继续保持当前良好习惯！
        </div>
        <el-tag
          v-for="(issue, i) in analysisData.sleepIssues"
          :key="i"
          type="warning"
          class="issue-tag"
        >
          {{ issue }}
        </el-tag>
      </div>
      <!-- 睡眠建议 -->
      <div class="advice-container mt-4">
        <div class="section-title">核心改善建议</div>
        <ul class="advice-list core-advice">
          <li v-for="(item, i) in analysisData.coreAdvice" :key="i">
            {{ item }}
          </li>
        </ul>
        <div class="section-title mt-3">针对性建议</div>
        <ul class="advice-list targeted-advice">
          <li v-for="(item, i) in analysisData.specificAdvice" :key="i">
            {{ item }}
          </li>
        </ul>
        <div class="section-title mt-3">睡眠小贴士</div>
        <ul class="advice-list tips-advice">
          <li v-for="(item, i) in analysisData.sleepTips" :key="i">
            {{ item }}
          </li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.mt-4 {
  margin-top: 16px;
}

.metrics-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 16px;
  margin-top: 16px;
  border-bottom: 1px dashed #eee;
}

.metric-item {
  flex: 1;
  min-width: 150px;
  padding: 12px;
  text-align: center;
  background-color: #f9f9f9;
  border-radius: 6px;
}

.metric-label {
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.metric-value {
  margin-bottom: 4px;
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.metric-status {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 12px;
}

.metric-status.good {
  color: #52c41a;
  background-color: #e1f3d8;
}

.metric-status.warning {
  color: #fa541c;
  background-color: #fff2e8;
}

.metric-status.danger {
  color: #f5222d;
  background-color: #fff1f0;
}

.issues-container {
  padding-bottom: 16px;
  margin-top: 16px;
  border-bottom: 1px dashed #eee;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.section-title::before {
  display: inline-block;
  width: 4px;
  height: 14px;
  margin-right: 6px;
  content: '';
  background-color: #409eff;
  border-radius: 2px;
}

.no-issues {
  padding: 8px 0;
  color: #666;
}

.issue-tag {
  margin: 4px 4px 4px 0;
}

.advice-container {
  margin-top: 16px;
}

.advice-list {
  padding-left: 20px;
  margin-top: 8px;
}

.advice-list li {
  margin-bottom: 4px;
  line-height: 1.6;
  color: #666;
}

.core-advice li {
  color: #389e0d;
}

.targeted-advice li {
  color: #1890ff;
}

.tips-advice li {
  color: #fa8c16;
}
</style>
