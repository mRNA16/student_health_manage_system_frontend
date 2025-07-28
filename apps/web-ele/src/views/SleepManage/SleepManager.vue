<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

import {
  addSleepRecord,
  getCurrentUser,
  getSleepRecords,
} from '../../api/sleep';

interface SleepRecord {
  date: string;
  sleep_time: string;
  wake_time: string;
  duration?: number;
  [key: string]: any;
}

const form = ref<{
  date: Date | null;
  sleep_time: Date | null;
  wake_time: Date | null;
}>({
  date: null,
  sleep_time: null,
  wake_time: null,
});
const records = ref<SleepRecord[]>([]);
const chartOption = ref({});
const user = ref<any>(null);

// 睡眠指标
const averageTST = ref(0); // 平均睡眠时长
const stdSleepTime = ref(0); // 入睡时间标准差
const stdWakeTime = ref(0); // 醒来时间标准差
const stdDuration = ref(0); // 睡眠时长标准差
const avgSleepMidpoint = ref(''); // 平均睡眠中点

// 睡眠问题和建议
const sleepIssues = ref<string[]>([]); // 检测到的睡眠问题
const coreAdvice = ref<string[]>([]); // 核心建议
const specificAdvice = ref<string[]>([]); // 针对性建议
const sleepTips = ref<string[]>([]); // 睡眠小贴士

// 健康标准值（替代用户自定义目标）
const HEALTHY_SLEEP_DURATION = 7; // 健康睡眠时长最低7小时
const HEALTHY_BEDTIME = 23.5; // 健康入睡时间（23:30，以小时为单位）
const HEALTHY_WAKETIME = 6.5; // 健康起床时间（06:30，以小时为单位）

const fetchUserAndRecords = async () => {
  try {
    // 获取当前用户信息
    const userRes = await getCurrentUser();
    user.value = userRes;

    // 获取最近7天睡眠记录
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
    const res = await getSleepRecords({ start_date: start, end_date: end });
    records.value = (res || []) as SleepRecord[];
    records.value.sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

    // 生成图表数据
    chartOption.value = {
      title: { text: '最近一周睡眠时长' },
      tooltip: {},
      xAxis: { type: 'category', data: records.value.map((r) => r.date) },
      yAxis: { type: 'value', name: '小时' },
      series: [
        {
          data: records.value.map((r) => r.duration),
          type: 'bar',
          name: '睡眠时长',
        },
      ],
    };
    calculateSleepMetrics(); // 计算睡眠指标
    detectSleepIssues(); // 检测睡眠问题
    generateSleepAdvice(); // 生成睡眠建议
  } catch {
    ElMessage.error('获取数据失败');
  }
};

const addRecord = async () => {
  if (!form.value.date || !form.value.sleep_time || !form.value.wake_time) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  // 格式化日期和时间，转换成字符串
  const payload = {
    date: dayjs(form.value.date).format('YYYY-MM-DD'),
    sleep_time: dayjs(form.value.sleep_time).format('HH:mm:ss'),
    wake_time: dayjs(form.value.wake_time).format('HH:mm:ss'),
  };

  try {
    await addSleepRecord(payload);
    ElMessage.success('添加成功');
    form.value = { date: null, sleep_time: null, wake_time: null };
    fetchUserAndRecords();
  } catch {
    ElMessage.error('添加失败');
  }
};

const sortField = ref<string>(''); // 当前排序字段
const sortOrder = ref<'ascending' | 'descending' | null>(null); // 当前排序顺序

const handleSortChange = (sort: {
  order: 'ascending' | 'descending' | null;
  prop: string;
}) => {
  sortField.value = sort.prop;
  sortOrder.value = sort.order;
};

const sortedRecords = computed(() => {
  if (!sortField.value || !sortOrder.value) return records.value;

  return [...records.value].sort((a, b) => {
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
// 计算标准差
const calculateStd = (values: number[]): number => {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => (val - avg) ** 2);
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
};

// 转换时间为小时数
const timeToHours = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours + minutes / 60;
};

// 计算睡眠核心指标
const calculateSleepMetrics = () => {
  if (records.value.length === 0) return;

  // 提取睡眠时长、入睡时间、起床时间数据
  const durations = records.value.map((r) => r.duration || 0);
  const sleepTimes = records.value.map((r) => timeToHours(r.sleep_time));
  const wakeTimes = records.value.map((r) => timeToHours(r.wake_time));

  // 计算平均值和标准差
  averageTST.value =
    durations.reduce((sum, val) => sum + val, 0) / durations.length;
  stdSleepTime.value = calculateStd(sleepTimes);
  stdWakeTime.value = calculateStd(wakeTimes);
  stdDuration.value = calculateStd(durations);

  // 计算平均睡眠中点（入睡时间 + 睡眠时长/2）
  const midpoints = records.value.map((_, i) => {
    const sleepHour = sleepTimes[i] ?? 0;
    const duration = durations[i] ?? 0;
    return (sleepHour + duration / 2) % 24; // 取模24处理跨天
  });
  const avgMidpoint =
    midpoints.reduce((sum, val) => sum + val, 0) / midpoints.length;
  // 转换为时间格式（如 2.5 → 02:30）
  const midpointHours = Math.floor(avgMidpoint);
  const midpointMinutes = Math.round((avgMidpoint - midpointHours) * 60);
  avgSleepMidpoint.value = `${midpointHours.toString().padStart(2, '0')}:${midpointMinutes.toString().padStart(2, '0')}`;
};

const detectSleepIssues = () => {
  const issues: string[] = [];

  // 检测睡眠时长不足
  if (averageTST.value < HEALTHY_SLEEP_DURATION) {
    issues.push(
      `睡眠时长不足（平均${averageTST.value.toFixed(1)}小时，建议至少7小时）`,
    );
  }

  // 检测入睡/起床时间不规律（标准差>1.5小时）
  if (stdSleepTime.value > 1.5) {
    issues.push('入睡时间不规律（波动较大）');
  }
  if (stdWakeTime.value > 1.5) {
    issues.push('起床时间不规律（波动较大）');
  }

  // 检测睡眠时长稳定性（标准差>1.5小时）
  if (stdDuration.value > 1.5) {
    issues.push('睡眠时长不稳定（可能存在睡眠中断）');
  }

  // 检测入睡过晚或起床过早（基于最近一条记录）
  const latestRecord = records.value[records.value.length - 1];
  if (latestRecord) {
    const latestSleepHour = timeToHours(latestRecord.sleep_time);
    if (latestSleepHour > HEALTHY_BEDTIME) {
      issues.push('入睡时间较晚（建议不晚于23:30）');
    }

    const latestWakeHour = timeToHours(latestRecord.wake_time);
    if (latestWakeHour < HEALTHY_WAKETIME) {
      issues.push('起床时间较早（建议不早于06:00）');
    }
  }

  sleepIssues.value = issues;
};

const generateSleepAdvice = () => {
  // 核心建议（固定显示）
  coreAdvice.value = [
    '1. 锚定起床时间：无论前晚睡多久，每天（包括周末）固定同一时间起床，这是调节生物钟最有效的方法。',
    '2. 循序渐进调整：若需提前入睡，每天比前一天提前15分钟，而非突然大幅调整，更容易坚持。',
    '3. 建立睡前仪式：睡前1小时进行固定放松活动（如阅读、听轻音乐），让身体形成入睡条件反射。',
  ];

  // 针对性建议（根据检测到的问题）
  const targeted: string[] = [];

  // 针对睡眠时长不足
  if (averageTST.value < HEALTHY_SLEEP_DURATION) {
    targeted.push(
      '• 逐步提前入睡时间，每次15分钟，直至达到目标睡眠时长。',
      '• 减少白天 naps 时间（若有），避免影响夜间睡眠时长。',
    );
  }

  // 针对作息不规律
  if (stdSleepTime.value > 1.5 || stdWakeTime.value > 1.5) {
    targeted.push(
      '• 设置“睡前提醒”闹钟，提前1小时提醒准备入睡。',
      '• 周末起床时间与工作日相差不超过1小时，减少生物钟紊乱。',
    );
  }

  // 针对睡眠不稳定
  if (stdDuration.value > 1.5) {
    targeted.push(
      '• 优化睡眠环境：保持卧室黑暗（可用遮光帘）、安静（可用白噪音）、温度适宜（18-22℃）。',
      '• 睡前避免饮用咖啡、茶和酒精，它们可能导致夜间易醒。',
    );
  }

  // 针对入睡过晚
  const latestRecord = records.value[records.value.length - 1];
  if (latestRecord && timeToHours(latestRecord.sleep_time) > HEALTHY_BEDTIME) {
    targeted.push(
      '• 实施“电子宵禁”：睡前1小时远离手机、电脑等电子设备（蓝光会抑制褪黑素分泌）。',
      '• 睡前避免剧烈运动、讨论复杂问题或观看刺激内容，保持情绪平稳。',
    );
  }

  // 若没有针对性问题，显示通用建议
  if (targeted.length === 0) {
    targeted.push(
      '• 保持规律进餐：晚餐避免过饱或过饿，且睡前2-3小时完成进食。',
      '• 白天适度运动：每天30分钟中等强度运动（如快走、瑜伽），但避免睡前3小时内剧烈运动。',
      '• 控制卧室功能：尽量只在卧室睡觉，让身体形成“卧室=睡觉”的条件反射。',
    );
  }
  specificAdvice.value = targeted;

  // 随机睡眠小贴士（从预设列表选3条）
  const allTips = [
    '• 试试“478呼吸法”：吸气4秒→屏息7秒→呼气8秒，重复几次可帮助放松。',
    '• 白天晒10-15分钟太阳，有助于调节生物钟和提升夜间睡眠质量。',
    '• 卧室可放一小盆薰衣草（或使用薰衣草精油），其气味可能有助于放松入睡。',
    '• 若夜间醒来，不要看时间（避免焦虑），可闭眼进行缓慢深呼吸，等待再次入睡。',
    '• 选择舒适的寝具：床垫、枕头以支撑性好、贴合身体为宜，提升睡眠舒适度。',
  ];
  // 随机排序并取前3条
  sleepTips.value = [...allTips].sort(() => Math.random() - 0.5).slice(0, 3);
};

const showAdvice = computed(() => records.value.length > 0);

onMounted(fetchUserAndRecords);
</script>

<template>
  <div>
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
      </el-table>
    </el-card>
    <el-card class="mt-4">
      <v-chart :option="chartOption" style="height: 300px" />
    </el-card>
    <el-card class="mt-4" v-if="showAdvice">
      <template #header>
        <span style="font-weight: bold">睡眠健康分析与建议</span>
      </template>

      <!-- 睡眠指标概览 -->
      <div class="metrics-container">
        <div class="metric-item">
          <div class="metric-label">平均睡眠时长</div>
          <div class="metric-value">{{ averageTST.toFixed(1) }} 小时</div>
          <div
            class="metric-status"
            :class="averageTST >= 7 ? 'good' : 'warning'"
          >
            {{ averageTST >= 7 ? '正常' : '偏低' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">入睡规律性</div>
          <div class="metric-value">{{ stdSleepTime.toFixed(1) }} 小时波动</div>
          <div
            class="metric-status"
            :class="stdSleepTime <= 1.5 ? 'good' : 'warning'"
          >
            {{ stdSleepTime <= 1.5 ? '规律' : '不规律' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">起床规律性</div>
          <div class="metric-value">{{ stdWakeTime.toFixed(1) }} 小时波动</div>
          <div
            class="metric-status"
            :class="stdWakeTime <= 1.5 ? 'good' : 'warning'"
          >
            {{ stdWakeTime <= 1.5 ? '规律' : '不规律' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">睡眠稳定性</div>
          <div class="metric-value">{{ stdDuration.toFixed(1) }} 小时波动</div>
          <div
            class="metric-status"
            :class="stdDuration <= 1.5 ? 'good' : 'warning'"
          >
            {{ stdDuration <= 1.5 ? '稳定' : '波动大' }}
          </div>
        </div>
      </div>

      <!-- 睡眠问题标签 -->
      <div class="issues-container mt-4">
        <div class="section-title">检测到的睡眠问题</div>
        <div v-if="sleepIssues.length === 0" class="no-issues">
          未检测到明显睡眠问题，继续保持当前良好习惯！
        </div>
        <el-tag
          v-for="(issue, i) in sleepIssues"
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
          <li v-for="(item, i) in coreAdvice" :key="i">{{ item }}</li>
        </ul>

        <div class="section-title mt-3">针对性建议</div>
        <ul class="advice-list targeted-advice">
          <li v-for="(item, i) in specificAdvice" :key="i">{{ item }}</li>
        </ul>

        <div class="section-title mt-3">睡眠小贴士</div>
        <ul class="advice-list tips-advice">
          <li v-for="(item, i) in sleepTips" :key="i">{{ item }}</li>
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
