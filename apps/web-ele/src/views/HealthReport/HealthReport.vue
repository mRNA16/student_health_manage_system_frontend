<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ElMessage } from 'element-plus';

import { $t } from '#/locales';

import { getMealRecords } from '../../api/diet';
import { getSleepRecords } from '../../api/sleep';
import { getRecordList } from '../../api/sport';

dayjs.extend(isBetween);
// 类型定义
interface SleepRecord {
  date: string;
  sleep_time: string;
  wake_time: string;
  duration?: number;
}

interface SportRecord {
  date: string;
  duration: number;
  calories: number;
  sport: number;
}

interface DietRecord {
  date: string;
  items: {
    estimated_calories: number;
    food: number;
    quantity_in_grams: number;
  }[];
  meal: string;
}

// 状态管理
const timeRange = ref<'7d' | '30d' | '90d'>('7d');

// 原始数据
const sleepRecords = ref<SleepRecord[]>([]);
const sportRecords = ref<SportRecord[]>([]);
const dietRecords = ref<DietRecord[]>([]);

// 图表配置
const sleepChartOption = ref({});
const sportChartOption = ref({});
const dietChartOption = ref({});

// 健康评分
const sleepScore = ref(0);
const sportScore = ref(0);
const dietScore = ref(0);
const overallHealthScore = computed(() => {
  // 计算综合评分，各维度权重不同
  return (
    Math.round(
      (sleepScore.value * 0.4 +
        sportScore.value * 0.3 +
        dietScore.value * 0.3) /
        10,
    ) * 10
  );
});

// 健康分析和建议
const healthAnalysis = ref<Array<{ content: string[]; title: string }>>([]);
const keyRecommendations = ref<string[]>([]);

// 获取时间范围
const getTimeRangeDates = () => {
  const today = dayjs();
  let start;
  const end = today.endOf('day');

  switch (timeRange.value) {
    case '7d': {
      start = today.subtract(6, 'd').startOf('day');
      break;
    }
    case '30d': {
      start = today.subtract(29, 'd').startOf('day');
      break;
    }
    case '90d': {
      start = today.subtract(89, 'd').startOf('day');
      break;
    }
  }

  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
  };
};

// 格式化日期为简短形式
const formatDate = (dateStr: string) => {
  return dayjs(dateStr).format('MM-DD');
};

// 获取所有数据
const fetchAllData = async () => {
  try {
    const { start, end } = getTimeRangeDates();

    // 并行获取所有数据
    const [sleepRes, sportRes, dietRes] = await Promise.all([
      getSleepRecords({
        start_date: start,
        end_date: end,
      }),
      getRecordList(),
      getMealRecords(),
    ]);

    // 处理睡眠数据
    sleepRecords.value = (sleepRes || []).map((record: any) => ({
      ...record,
      duration: calculateSleepDuration(record.sleep_time, record.wake_time),
    }));

    // 处理运动数据（过滤时间范围内的数据）
    sportRecords.value = (sportRes || []).filter((record: any) => {
      return dayjs(record.date).isBetween(start, end, null, '[]');
    });

    // 处理饮食数据（过滤时间范围内的数据）
    dietRecords.value = (dietRes || []).filter((record: any) => {
      return dayjs(record.date).isBetween(start, end, null, '[]');
    });

    // 处理数据并生成报告
    processDataAndGenerateReport();
  } catch (error) {
    ElMessage.error('获取健康数据失败');
    console.error(error);
  }
};

// 计算睡眠时长（小时）
const calculateSleepDuration = (sleepTime: string, wakeTime: string) => {
  const sleep = dayjs(sleepTime, 'HH:mm:ss');
  let wake = dayjs(wakeTime, 'HH:mm:ss');

  // 处理跨天情况
  if (wake.isBefore(sleep)) {
    wake = wake.add(1, 'day');
  }

  return (wake.diff(sleep, 'minute') / 60).toFixed(1) as unknown as number;
};

// 处理数据并生成报告
const processDataAndGenerateReport = () => {
  // 分析睡眠数据
  analyzeSleepData();

  // 分析运动数据
  analyzeSportData();

  // 分析饮食数据
  analyzeDietData();

  // 生成健康分析
  generateHealthAnalysis();

  // 生成关键建议
  generateRecommendations();

  // 更新图表
  updateCharts();
};

// 分析睡眠数据并计算分数
const analyzeSleepData = () => {
  if (sleepRecords.value.length === 0) {
    sleepScore.value = 0;
    return;
  }

  // 计算平均睡眠时长
  const avgDuration =
    sleepRecords.value.reduce((sum, record) => {
      return sum + (record.duration || 0);
    }, 0) / sleepRecords.value.length;

  // 计算规律得分（基于入睡/起床时间标准差）
  const sleepTimes = sleepRecords.value.map(
    (r) =>
      dayjs(r.sleep_time, 'HH:mm:ss').hour() +
      dayjs(r.sleep_time, 'HH:mm:ss').minute() / 60,
  );
  const wakeTimes = sleepRecords.value.map(
    (r) =>
      dayjs(r.wake_time, 'HH:mm:ss').hour() +
      dayjs(r.wake_time, 'HH:mm:ss').minute() / 60,
  );

  const sleepStd = calculateStandardDeviation(sleepTimes);
  const wakeStd = calculateStandardDeviation(wakeTimes);
  const regularityScore = 100 - Math.min(80, (sleepStd + wakeStd) * 20);

  // 计算睡眠时长得分（7-9小时为最佳）
  let durationScore = 0;
  if (avgDuration >= 7 && avgDuration <= 9) {
    durationScore = 100;
  } else if (avgDuration >= 6 && avgDuration < 7) {
    durationScore = 70;
  } else if (avgDuration > 9 && avgDuration <= 10) {
    durationScore = 70;
  } else if (avgDuration >= 5 && avgDuration < 6) {
    durationScore = 40;
  } else if (avgDuration > 10 && avgDuration <= 11) {
    durationScore = 40;
  }

  // 综合睡眠得分
  sleepScore.value =
    Math.round((durationScore * 0.7 + regularityScore * 0.3) / 10) * 10;
};

// 分析运动数据并计算分数
const analyzeSportData = () => {
  if (sportRecords.value.length === 0) {
    sportScore.value = 0;
    return;
  }

  // 按日期分组统计
  const dailyData: Record<string, { calories: number; duration: number }> = {};

  sportRecords.value.forEach((record) => {
    if (!dailyData[record.date]) {
      dailyData[record.date] = { duration: 0, calories: 0 };
    }
    dailyData[record.date]!.duration += record.duration || 0;
    dailyData[record.date]!.calories += record.calories || 0;
  });

  // 计算平均每日运动时长和卡路里消耗
  const days = Object.keys(dailyData).length;
  const avgDailyDuration =
    Object.values(dailyData).reduce((sum, item) => sum + item.duration, 0) /
    days;
  const avgDailyCalories =
    Object.values(dailyData).reduce((sum, item) => sum + item.calories, 0) /
    days;

  // 计算运动频率得分（每周至少3天）
  const activeDaysPerWeek = (days / (getTimeRangeInDays() / 7)) * 100;
  const frequencyScore = Math.min(100, activeDaysPerWeek * 1.5);

  // 计算运动强度得分
  const durationScore = Math.min(100, avgDailyDuration * 60); // 目标30分钟/天
  const calorieScore = Math.min(100, avgDailyCalories / 30); // 目标300千卡/天

  // 综合运动得分
  sportScore.value =
    Math.round(
      (frequencyScore * 0.3 + durationScore * 0.35 + calorieScore * 0.35) / 10,
    ) * 10;
};

// 分析饮食数据并计算分数
const analyzeDietData = () => {
  if (dietRecords.value.length === 0) {
    dietScore.value = 0;
    return;
  }

  // 按日期分组统计卡路里
  const dailyCalories: Record<string, number> = {};
  const mealFrequency: Record<string, number> = {};

  dietRecords.value.forEach((record) => {
    if (!dailyCalories[record.date]) {
      dailyCalories[record.date] = 0;
      mealFrequency[record.date] = 0;
    }
    // 计算每日卡路里总和
    const mealCalories = record.items.reduce((sum, item) => {
      return sum + (item.estimated_calories || 0);
    }, 0);

    dailyCalories[record.date]! += mealCalories;
    mealFrequency[record.date]!++;
  });
  // 计算平均值
  const days = Object.keys(dailyCalories).length;
  const avgDailyCalories =
    Object.values(dailyCalories).reduce((sum, val) => sum + val, 0) / days;
  const avgMealsPerDay =
    Object.values(mealFrequency).reduce((sum, val) => sum + val, 0) / days;
  // 计算卡路里得分（目标1800-2500之间）
  let calorieScore = 0;
  if (avgDailyCalories >= 1800 && avgDailyCalories <= 2500) {
    calorieScore = 100;
  } else if (avgDailyCalories >= 1500 && avgDailyCalories < 1800) {
    calorieScore = 70;
  } else if (avgDailyCalories > 2500 && avgDailyCalories <= 2800) {
    calorieScore = 70;
  } else if (avgDailyCalories >= 1200 && avgDailyCalories < 1500) {
    calorieScore = 40;
  } else if (avgDailyCalories > 2800 && avgDailyCalories <= 3100) {
    calorieScore = 40;
  }
  // 计算饮食规律性得分（每天3餐）
  const regularityScore = Math.min(
    100,
    100 - Math.abs(avgMealsPerDay - 3) * 30,
  );

  // 综合饮食得分
  dietScore.value =
    Math.round((calorieScore * 0.6 + regularityScore * 0.4) / 10) * 10;
};

// 生成健康分析
const generateHealthAnalysis = () => {
  healthAnalysis.value = [];

  // 睡眠分析
  const sleepAnalysis = {
    title: $t('healthReport.sleepAnalysis'),
    content: [] as string[],
  };

  if (sleepScore.value >= 80) {
    sleepAnalysis.content.push($t('healthReport.goodSleepHabits'));
  } else if (sleepScore.value >= 60) {
    sleepAnalysis.content.push($t('healthReport.averageSleepHabits'));
  } else {
    sleepAnalysis.content.push($t('healthReport.poorSleepHabits'));
  }

  // 运动分析
  const sportAnalysis = {
    title: $t('healthReport.sportAnalysis'),
    content: [] as string[],
  };

  if (sportScore.value >= 80) {
    sportAnalysis.content.push($t('healthReport.goodSportHabits'));
  } else if (sportScore.value >= 60) {
    sportAnalysis.content.push($t('healthReport.averageSportHabits'));
  } else {
    sportAnalysis.content.push($t('healthReport.poorSportHabits'));
  }

  // 饮食分析
  const dietAnalysis = {
    title: $t('healthReport.dietAnalysis'),
    content: [] as string[],
  };

  if (dietScore.value >= 80) {
    dietAnalysis.content.push($t('healthReport.goodDietHabits'));
  } else if (dietScore.value >= 60) {
    dietAnalysis.content.push($t('healthReport.averageDietHabits'));
  } else {
    dietAnalysis.content.push($t('healthReport.poorDietHabits'));
  }

  healthAnalysis.value.push(sleepAnalysis, sportAnalysis, dietAnalysis);
};

// 生成关键建议
const generateRecommendations = () => {
  keyRecommendations.value = [];

  // 根据各维度得分生成针对性建议
  if (sleepScore.value < 60) {
    keyRecommendations.value.push(
      $t('healthReport.sleepRecommendation1'),
      $t('healthReport.sleepRecommendation2'),
    );
  }

  if (sportScore.value < 60) {
    keyRecommendations.value.push(
      $t('healthReport.sportRecommendation1'),
      $t('healthReport.sportRecommendation2'),
    );
  }

  if (dietScore.value < 60) {
    keyRecommendations.value.push(
      $t('healthReport.dietRecommendation1'),
      $t('healthReport.dietRecommendation2'),
    );
  }

  // 如果所有维度都不错，给一些保持的建议
  if (
    sleepScore.value >= 80 &&
    sportScore.value >= 80 &&
    dietScore.value >= 80
  ) {
    keyRecommendations.value.push(
      $t('healthReport.excellentHabits'),
      $t('healthReport.continueMaintaining'),
    );
  }
};

// 更新图表数据
const updateCharts = () => {
  // 睡眠图表
  const sleepDates = sleepRecords.value.map((r) => formatDate(r.date));
  const sleepDurations = sleepRecords.value.map((r) => r.duration);

  sleepChartOption.value = {
    grid: {
      left: '1%',
      right: '4%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sleepDates,
      axisLabel: {
        rotate: 45,
        interval: 0,
      },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: $t('healthReport.hours'),
    },
    series: [
      {
        data: sleepDurations,
        type: 'line',
        name: $t('healthReport.sleepDuration'),
      },
    ],
  };

  // 运动图表
  const sportDates = [
    ...new Set(sportRecords.value.map((r) => formatDate(r.date))),
  ];
  const sportCalories = sportDates.map((date) => {
    return sportRecords.value
      .filter((r) => formatDate(r.date) === date)
      .reduce((sum, r) => sum + (r.calories || 0), 0);
  });

  sportChartOption.value = {
    grid: {
      left: '1%',
      right: '4%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sportDates,
      axisLabel: {
        rotate: 45,
        interval: 0,
      },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: $t('healthReport.kcal'),
    },
    series: [
      {
        data: sportCalories,
        type: 'bar',
        name: $t('healthReport.caloriesBurned'),
      },
    ],
  };

  // 饮食图表
  const dietDates = [
    ...new Set(dietRecords.value.map((r) => formatDate(r.date))),
  ];
  const dietCalories = dietDates.map((date) => {
    return dietRecords.value
      .filter((r) => formatDate(r.date) === date)
      .reduce((sum, r) => {
        return (
          sum +
          r.items.reduce(
            (mealSum, item) => mealSum + (item.estimated_calories || 0),
            0,
          )
        );
      }, 0);
  });

  dietChartOption.value = {
    grid: {
      left: '1%',
      right: '4%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dietDates,
      axisLabel: {
        rotate: 45,
        interval: 0, // 强制显示所有标签
      },
      // 关闭边界间隙，防止数据点被边缘截断
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: $t('healthReport.kcal'),
    },
    series: [
      {
        data: dietCalories,
        type: 'line',
        name: $t('healthReport.caloriesConsumed'),
      },
    ],
  };
};

// 辅助函数：计算标准差
const calculateStandardDeviation = (values: number[]) => {
  if (values.length <= 1) return 0;

  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map((value) => {
    const diff = value - avg;
    return diff * diff;
  });

  const avgSquareDiff =
    squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};

// 辅助函数：获取时间范围天数
const getTimeRangeInDays = () => {
  switch (timeRange.value) {
    case '7d': {
      return 7;
    }
    case '30d': {
      return 30;
    }
    case '90d': {
      return 90;
    }
    // eslint-disable-next-line unicorn/switch-case-braces
    default:
      return 7;
  }
};

// 获取评分描述
const getScoreDescription = (score: number) => {
  if (score >= 90) return $t('healthReport.excellent');
  if (score >= 80) return $t('healthReport.good');
  if (score >= 70) return $t('healthReport.average');
  if (score >= 60) return $t('healthReport.poor');
  return $t('healthReport.needsImprovement');
};

// 时间范围变更处理
const handleTimeRangeChange = (value: '7d' | '30d' | '90d') => {
  timeRange.value = value;
  fetchAllData();
};

// 页面加载时获取数据
onMounted(() => {
  fetchAllData();
});
</script>

<template>
  <div class="health-report">
    <el-card>
      <template #header>
        <span style="font-weight: bold">{{ $t('healthReport.title') }}</span>
      </template>

      <!-- 时间范围选择 -->
      <div style="margin-bottom: 16px">
        <span>{{ $t('healthReport.timeRange') }}：</span>
        <el-radio-group
          v-model="timeRange"
          @change="handleTimeRangeChange"
          style="margin-left: 8px"
        >
          <el-radio-button label="7d">
            {{ $t('healthReport.last7Days') }}
          </el-radio-button>
          <el-radio-button label="30d">
            {{ $t('healthReport.last30Days') }}
          </el-radio-button>
          <el-radio-button label="90d">
            {{ $t('healthReport.last3Months') }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 健康评分概览 -->
      <div class="health-score-container">
        <div class="score-card">
          <div class="score-label">{{ $t('healthReport.overallScore') }}</div>
          <div class="score-value">{{ overallHealthScore }}</div>
          <div class="score-desc">
            {{ getScoreDescription(overallHealthScore) }}
          </div>
          <div class="score-formula">
            {{ $t('healthReport.overallScoreFormula') }}
          </div>
        </div>

        <div class="dimension-scores">
          <div class="dimension-item">
            <div class="dimension-label">{{ $t('healthReport.sleep') }}</div>
            <div class="dimension-score">{{ sleepScore }}</div>
            <div class="dimension-desc">
              {{ getScoreDescription(sleepScore) }}
            </div>
            <div class="dimension-formula">
              {{ $t('healthReport.sleepScoreFormulaShort') }}
            </div>
          </div>
          <div class="dimension-item">
            <div class="dimension-label">{{ $t('healthReport.sport') }}</div>
            <div class="dimension-score">{{ sportScore }}</div>
            <div class="dimension-desc">
              {{ getScoreDescription(sportScore) }}
            </div>
            <div class="dimension-formula">
              {{ $t('healthReport.sportScoreFormulaShort') }}
            </div>
          </div>
          <div class="dimension-item">
            <div class="dimension-label">{{ $t('healthReport.diet') }}</div>
            <div class="dimension-score">{{ dietScore }}</div>
            <div class="dimension-desc">
              {{ getScoreDescription(dietScore) }}
            </div>
            <div class="dimension-formula">
              {{ $t('healthReport.dietScoreFormulaShort') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 各维度数据图表 -->
      <div class="charts-container">
        <el-card class="chart-card">
          <template #header>{{ $t('healthReport.sleepTrend') }}</template>
          <v-chart :option="sleepChartOption" style="height: 250px" />
        </el-card>

        <el-card class="chart-card">
          <template #header>{{ $t('healthReport.sportTrend') }}</template>
          <v-chart :option="sportChartOption" style="height: 250px" />
        </el-card>

        <el-card class="chart-card">
          <template #header>{{ $t('healthReport.calorieTrend') }}</template>
          <v-chart :option="dietChartOption" style="height: 250px" />
        </el-card>
      </div>

      <!-- 健康分析与建议 -->
      <el-card class="mt-4">
        <template #header>
          <span>{{ $t('healthReport.healthAnalysis') }}</span>
        </template>

        <div class="analysis-container">
          <div
            v-for="(item, index) in healthAnalysis"
            :key="index"
            class="analysis-item"
          >
            <div class="analysis-title">{{ item.title }}</div>
            <ul class="analysis-content">
              <li v-for="(point, i) in item.content" :key="i">{{ point }}</li>
            </ul>
          </div>
        </div>

        <div class="recommendations mt-4">
          <div class="section-title">
            {{ $t('healthReport.keyRecommendations') }}
          </div>
          <ul class="recommendations-list">
            <li v-for="(rec, index) in keyRecommendations" :key="index">
              {{ rec }}
            </li>
          </ul>
        </div>
      </el-card>
    </el-card>
  </div>
</template>

<style scoped>
.health-report {
  padding: 20px;
}

.health-score-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: stretch;
  margin: 20px 0;
}

.score-card {
  flex: 1;
  min-width: 200px;
  padding: 20px;
  padding-bottom: 25px;
  text-align: center;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.score-label {
  margin-bottom: 10px;
  font-size: 16px;
  color: #666;
}

.score-value {
  margin: 10px 0;
  font-size: 48px;
  font-weight: bold;
  color: #409eff;
}

.score-desc {
  margin-bottom: 10px;
  font-size: 18px;
  color: #333;
}

.score-formula {
  padding: 0 10px;
  font-size: 14px;
  line-height: 1.4;
  color: #666;
}

.dimension-scores {
  display: flex;
  flex: 2;
  gap: 10px;
  min-width: 300px;
}

.dimension-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  padding: 15px;
  padding-bottom: 20px;
  text-align: center;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.dimension-label {
  margin-bottom: 5px;
  font-size: 14px;
  color: #666;
}

.dimension-score {
  font-size: 28px;
  font-weight: bold;
}

.dimension-desc {
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
}

.dimension-formula {
  padding: 0 5px;
  margin-top: auto;
  font-size: 12px;
  line-height: 1.3;
  color: #666;
}

.charts-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 20px 0;
}

.chart-card {
  flex: 1;
  min-width: 300px;
}

.analysis-container {
  margin: 10px 0;
}

.analysis-item {
  margin-bottom: 15px;
}

.analysis-title {
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

.analysis-content {
  padding-left: 20px;
  color: #666;
}

.section-title {
  display: flex;
  align-items: center;
  margin: 10px 0;
  font-weight: bold;
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

.recommendations-list {
  padding-left: 20px;
  color: #666;
}

.recommendations-list li {
  margin-bottom: 5px;
}
</style>
