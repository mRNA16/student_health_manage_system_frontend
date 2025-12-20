<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

import {
  addMealRecord,
  deleteMealRecord,
  getCurrentUser,
  getDietAnalysis,
  getFoodList,
  getMealRecords,
  updateMealRecord,
} from '../../api/diet';

interface MealItem {
  id?: number;
  food: number;
  food_id?: number;
  food_name?: string;
  quantity_in_grams: number;
  estimated_calories: number;
  estimated_water: number;
}
interface MealRecord {
  id: number;
  date: string;
  meal: 'breakfast' | 'dinner' | 'lunch';
  source: 'ai' | 'manual';
  total_calories?: number;
  total_water?: number;
  items: MealItem[];
}
interface MealCalories {
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
}
interface FoodCalorie {
  meal: 'breakfast' | 'dinner' | 'lunch';
  name: string;
  value: number;
  color: string;
}
const CALORIE_RANGE = [1800, 2500];
const MEALS_TARGET = 3;
const analysisData = ref<any>({});
const user = ref<any>(null);
const foodList = ref<any[]>([]); // 常见食物
const recordList = ref<MealRecord[]>([]); // 饮食记录
const dialogVisible = ref(false);
const form = ref<any>({
  id: 0,
  date: dayjs().format('YYYY-MM-DD'),
  meal: 'breakfast',
  source: 'manual',
  items: [],
});

const chartType = ref<'line' | 'stackedBar'>('line');
const timeRange = ref<'1y' | '7d' | '30d'>('7d');
const selectedPieDate = ref(dayjs().format('YYYY-MM-DD'));

watch(timeRange, fetchDietAnalysis);

/* 初始化 */
onMounted(async () => {
  user.value = await getCurrentUser();
  foodList.value = await getFoodList();
  await fetchRecords();
  await fetchDietAnalysis();
  watch(selectedPieDate, () => {}, { immediate: true });
});

async function fetchDietAnalysis() {
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
  const res = await getDietAnalysis({
    start_date: start.format('YYYY-MM-DD'),
    end_date: end.format('YYYY-MM-DD'),
  });
  analysisData.value = res;
}

async function fetchRecords() {
  const res = await getMealRecords();
  recordList.value = res || [];
}

// 打开新增/编辑弹窗
function openDialog(record?: MealRecord) {
  if (record) {
    // 深拷贝并处理 food_id 映射到 food
    const cloned = JSON.parse(JSON.stringify(record));
    cloned.items.forEach((item: any) => {
      if (item.food_id && !item.food) {
        item.food = item.food_id;
      }
    });
    form.value = cloned;
  } else {
    form.value = {
      id: 0,
      date: dayjs().format('YYYY-MM-DD'),
      meal: 'breakfast',
      source: 'manual',
      items: [],
    };
  }
  dialogVisible.value = true;
}

// 提交
async function submitForm() {
  if (form.value.items.length === 0) {
    ElMessage.warning('请至少添加一种食物');
    return;
  }
  if (form.value.items.some((item: any) => !item.food)) {
    ElMessage.warning('请确保所有食物已选择');
    return;
  }
  try {
    form.value.id
      ? await updateMealRecord(form.value)
      : await addMealRecord(form.value);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await fetchRecords();
    await fetchDietAnalysis(); // 刷新分析数据和图表
  } catch {
    ElMessage.error('保存失败');
  }
}

// 删除
async function removeRecord(id: number) {
  try {
    await deleteMealRecord(id);
    ElMessage.success('删除成功');
    await fetchRecords();
    await fetchDietAnalysis(); // 刷新分析数据和图表
  } catch {
    ElMessage.error('删除失败');
  }
}

const getDateRange = computed(() => {
  const dates: string[] = [];
  const today = dayjs();

  if (timeRange.value === '7d') {
    // 近7天
    for (let i = 6; i >= 0; i--) {
      dates.push(today.subtract(i, 'day').format('YYYY-MM-DD'));
    }
  } else if (timeRange.value === '30d') {
    // 近30天
    for (let i = 29; i >= 0; i--) {
      dates.push(today.subtract(i, 'day').format('YYYY-MM-DD'));
    }
  } else {
    // 近一年（按月份）
    for (let i = 11; i >= 0; i--) {
      dates.push(today.subtract(i, 'month').format('YYYY-MM'));
    }
  }

  return dates;
});

// 根据时间范围和原始日期获取分组键
const getGroupKey = (date: string) => {
  if (timeRange.value === '1y') {
    return dayjs(date).format('YYYY-MM');
  }
  return date;
};

const getMealCaloriesByDate = computed(() => {
  const backend = analysisData.value?.dailyData;
  const dateRange = getDateRange.value;

  // 优先后端
  if (Array.isArray(backend) && backend.length > 0) {
    const result: Record<string, MealCalories> = {};
    dateRange.forEach((d) => {
      result[d] = { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
    });
    backend.forEach((day: any) => {
      const key = timeRange.value === '1y' ? day.date.slice(0, 7) : day.date;
      if (!result[key]) return;
      result[key].breakfast += day.breakfast || 0;
      result[key].lunch += day.lunch || 0;
      result[key].dinner += day.dinner || 0;
      result[key].total += day.total || 0;
    });

    return { dates: dateRange, data: result };
  }

  // 后端无数据时，回退到原有前端计算
  const result: Record<string, MealCalories> = {};
  dateRange.forEach((date) => {
    result[date] = { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
  });

  recordList.value.forEach((record) => {
    const groupKey = getGroupKey(record.date);
    if (!dateRange.includes(groupKey)) return;

    const calories = record.items.reduce(
      (sum, item) => sum + item.estimated_calories,
      0,
    );
    const dateData = result[groupKey];
    if (dateData) {
      dateData[record.meal] += calories;
      dateData.total = dateData.breakfast + dateData.lunch + dateData.dinner;
    }
  });

  return { dates: dateRange, data: result };
});

/* 图表 */
const trendChartOption = computed(() => {
  const { dates, data } = getMealCaloriesByDate.value;

  const titleMap = {
    '7d': '近7天卡路里摄入趋势图',
    '30d': '近30天卡路里摄入趋势图',
    '1y': '近一年卡路里摄入趋势图',
  };

  // 通用配置
  const baseOption = {
    title: { text: titleMap[timeRange.value] },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      data: ['早餐', '午餐', '晚餐', '总摄入'],
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        rotate: timeRange.value === '1y' ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      name: '千卡',
    },
  };

  // 折线图配置
  if (chartType.value === 'line') {
    return {
      ...baseOption,
      series: [
        {
          name: '早餐',
          type: 'line',
          // 使用?.和??确保即使data[date]不存在也会返回0
          data: dates.map((date) => data[date]?.breakfast ?? 0),
          lineStyle: { color: '#4E79A7' },
          itemStyle: { color: '#4E79A7' },
        },
        {
          name: '午餐',
          type: 'line',
          data: dates.map((date) => data[date]?.lunch ?? 0),
          lineStyle: { color: '#F28E2C' },
          itemStyle: { color: '#F28E2C' },
        },
        {
          name: '晚餐',
          type: 'line',
          data: dates.map((date) => data[date]?.dinner ?? 0),
          lineStyle: { color: '#E15759' },
          itemStyle: { color: '#E15759' },
        },
        {
          name: '总摄入',
          type: 'line',
          data: dates.map((date) => data[date]?.total ?? 0),
          lineStyle: { color: '#76B7B2', width: 2 },
          itemStyle: { color: '#76B7B2' },
          emphasis: { focus: 'series' },
        },
      ],
    };
  }

  // 堆叠柱状图配置
  return {
    ...baseOption,
    series: [
      {
        name: '早餐',
        type: 'bar',
        stack: 'total',
        data: dates.map((date) => data[date]?.breakfast ?? 0),
        itemStyle: { color: '#4E79A7' },
      },
      {
        name: '午餐',
        type: 'bar',
        stack: 'total',
        data: dates.map((date) => data[date]?.lunch ?? 0),
        itemStyle: { color: '#F28E2C' },
      },
      {
        name: '晚餐',
        type: 'bar',
        stack: 'total',
        data: dates.map((date) => data[date]?.dinner ?? 0),
        itemStyle: { color: '#E15759' },
      },
    ],
  };
});

const mealColors = {
  breakfast: '#4E79A7',
  lunch: '#F28E2C',
  dinner: '#E15759',
};
const selectedDateFoodCalories = computed<FoodCalorie[]>(() => {
  const targetDate = selectedPieDate.value;
  const targetRecords = recordList.value.filter((r) => r.date === targetDate);

  const foodCalories: FoodCalorie[] = [];

  targetRecords.forEach((record) => {
    record.items.forEach((item) => {
      // 优先使用后端返回的食物名称
      const name =
        item.food_name ||
        foodList.value.find((f) => f.id === (item.food || item.food_id))
          ?.name ||
        '未知食物';
      foodCalories.push({
        meal: record.meal,
        name,
        value: item.estimated_calories,
        color: mealColors[record.meal],
      });
    });
  });

  return foodCalories;
});

// 3. 生成饼图配置
const selectedDatePieChartOption = computed(() => {
  const data = selectedDateFoodCalories.value;
  const selectedDate = selectedPieDate.value;

  const mealLegendData = [
    { name: '早餐', color: mealColors.breakfast },
    { name: '午餐', color: mealColors.lunch },
    { name: '晚餐', color: mealColors.dinner },
  ];

  return {
    graphic: mealLegendData.map((item, index) => ({
      type: 'group',
      left: 20,
      top: 60 + index * 30, // 垂直方向排列，间隔30px
      children: [
        {
          type: 'rect',
          shape: { width: 12, height: 12 },
          style: { fill: item.color },
        },
        {
          type: 'text',
          left: 18,
          top: 'middle',
          style: {
            text: item.name,
            fontSize: 12,
            fill: '#333',
          },
        },
      ],
    })),
    title: {
      text: `${selectedDate} 卡路里摄入明细`,
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} 千卡 ({d}%)',
    },
    series: [
      {
        name: '食物',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
          // 根据数据中的颜色设置每个扇形
          color: (params: any) => {
            const item = data[params.dataIndex];
            return item ? item.color : '#ccc';
          },
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        // 饼图数据（每个食物单独一项）
        data: data.map((item) => ({
          name: item.name,
          value: item.value,
        })),
      },
    ],
  };
});

const hasSelectedDateData = computed(() => {
  return selectedDateFoodCalories.value.length > 0;
});

const dietAnalysis = computed(() => {
  if (!analysisData.value || !analysisData.value.avgDailyCalories) return null;

  const avgDailyCalories = Number(analysisData.value.avgDailyCalories || 0);
  const avgMealsPerDay = Number(analysisData.value.avgMealsPerDay || 0);

  // 饮食问题标签
  const dietIssues: string[] = [];
  if (
    avgDailyCalories < CALORIE_RANGE[0] ||
    avgDailyCalories > CALORIE_RANGE[1]
  ) {
    dietIssues.push(
      `平均每日热量不在推荐区间（${CALORIE_RANGE[0]}-${CALORIE_RANGE[1]}kcal）`,
    );
  }
  if (Math.abs(avgMealsPerDay - MEALS_TARGET) > 0.5) {
    dietIssues.push(`每日餐次不规律（建议每天${MEALS_TARGET}餐）`);
  }

  // 核心建议
  const coreAdvice = [
    '1. 保持三餐规律，避免暴饮暴食。',
    '2. 每餐均衡摄入主食、蛋白、蔬菜。',
    '3. 控制高油高糖食物摄入。',
  ];

  // 针对性建议
  const specificAdvice: string[] = [];
  if (avgDailyCalories < CALORIE_RANGE[0]) {
    specificAdvice.push('• 适当增加主食、蛋白质摄入，避免能量不足。');
  }
  if (avgDailyCalories > CALORIE_RANGE[1]) {
    specificAdvice.push('• 控制高热量食物摄入，减少油炸、甜食。');
  }
  if (Math.abs(avgMealsPerDay - MEALS_TARGET) > 0.5) {
    specificAdvice.push('• 规律用餐，尽量做到每天三餐定时定量。');
  }
  if (specificAdvice.length === 0) {
    specificAdvice.push('• 保持良好饮食习惯，继续加油！');
  }

  // 饮食小贴士
  const allTips = [
    '• 多喝水，少饮含糖饮料。',
    '• 每天至少吃400克蔬菜水果。',
    '• 细嚼慢咽，帮助消化。',
    '• 晚餐不宜过晚，避免影响睡眠。',
    '• 适量摄入坚果，有益心脑健康。',
  ];
  const dietTips = [...allTips].sort(() => 0.5 - Math.random()).slice(0, 3);

  return {
    avgDailyCalories,
    avgMealsPerDay,
    calorieScore: analysisData.value.calorieScore || 0,
    regularityScore: analysisData.value.regularityScore || 0,
    dietScore: analysisData.value.dietScore || 0,
    dietIssues,
    coreAdvice,
    specificAdvice,
    dietTips,
  };
});
</script>

<template>
  <div class="diet-manager">
    <el-card>
      <template #header>
        <div class="clearfix">
          <span>饮食记录</span>
          <el-button style="float: right" type="primary" @click="openDialog()">
            新增记录
          </el-button>
        </div>
      </template>

      <el-table :data="recordList" style="width: 100%">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="餐次">
          <template #default="scope">
            {{
              { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }[
                scope.row.meal as 'breakfast' | 'lunch' | 'dinner'
              ]
            }}
          </template>
        </el-table-column>
        <el-table-column label="食物">
          <template #default="scope">
            <span v-for="item in scope.row.items" :key="item.id">
              {{
                item.food_name ||
                foodList?.find((f: any) => f.id === (item.food || item.food_id))
                  ?.name
              }}
              {{ item.quantity_in_grams }}g<br />
            </span>
          </template>
        </el-table-column>
        <el-table-column label="总热量(kcal)">
          <template #default="scope">
            {{
              (
                scope.row.total_calories ||
                scope.row.items?.reduce(
                  (s: number, i: MealItem) => s + i.estimated_calories,
                  0,
                ) ||
                0
              ).toFixed(0)
            }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button size="small" @click="openDialog(scope.row)">
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="removeRecord(scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 图表 -->
    <el-card class="mt-4">
      <div
        class="chart-controls"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        "
      >
        <div>
          <span>时间范围：</span>
          <el-radio-group v-model="timeRange" size="small">
            <el-radio-button label="7d">近7天</el-radio-button>
            <el-radio-button label="30d">近30天</el-radio-button>
            <el-radio-button label="1y">近一年</el-radio-button>
          </el-radio-group>
        </div>
        <div>
          <span>图表类型：</span>
          <el-radio-group v-model="chartType" size="small">
            <el-radio-button label="line">折线图</el-radio-button>
            <el-radio-button label="stackedBar">堆叠柱状图</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      <v-chart :option="trendChartOption" style="height: 300px" />
    </el-card>

    <el-card class="mt-4">
      <div style="margin-bottom: 16px; text-align: right">
        <span>选择日期：</span>
        <el-date-picker
          v-model="selectedPieDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 180px"
        />
      </div>
      <v-chart
        :option="selectedDatePieChartOption"
        style="height: 400px"
        v-if="hasSelectedDateData"
      />
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: #666;
        "
        v-else
      >
        该日期暂无饮食记录
      </div>
    </el-card>

    <!-- 饮食健康分析与建议 -->
    <el-card class="mt-4" v-if="dietAnalysis">
      <template #header>
        <span style="font-weight: bold">饮食健康分析与建议</span>
      </template>

      <!-- 饮食指标概览 -->
      <div class="metrics-container">
        <div class="metric-item">
          <div class="metric-label">平均每日热量</div>
          <div class="metric-value">
            {{ dietAnalysis?.avgDailyCalories.toFixed(0) }} kcal
          </div>
          <div
            class="metric-status"
            :class="
              dietAnalysis &&
              dietAnalysis.avgDailyCalories >= CALORIE_RANGE[0] &&
              dietAnalysis.avgDailyCalories <= CALORIE_RANGE[1]
                ? 'good'
                : 'warning'
            "
          >
            {{
              dietAnalysis &&
              dietAnalysis.avgDailyCalories >= CALORIE_RANGE[0] &&
              dietAnalysis.avgDailyCalories <= CALORIE_RANGE[1]
                ? '正常'
                : '异常'
            }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">平均每日餐次</div>
          <div class="metric-value">
            {{ dietAnalysis?.avgMealsPerDay.toFixed(1) }} 次
          </div>
          <div
            class="metric-status"
            :class="
              dietAnalysis &&
              Math.abs(dietAnalysis.avgMealsPerDay - MEALS_TARGET) <= 0.5
                ? 'good'
                : 'warning'
            "
          >
            {{
              dietAnalysis &&
              Math.abs(dietAnalysis.avgMealsPerDay - MEALS_TARGET) <= 0.5
                ? '规律'
                : '不规律'
            }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">饮食综合评分</div>
          <div class="metric-value">{{ dietAnalysis?.dietScore }}</div>
          <div
            class="metric-status"
            :class="
              dietAnalysis && dietAnalysis.dietScore >= 60 ? 'good' : 'warning'
            "
          >
            {{
              dietAnalysis && dietAnalysis.dietScore >= 80
                ? '优秀'
                : dietAnalysis && dietAnalysis.dietScore >= 60
                  ? '良好'
                  : '需改进'
            }}
          </div>
        </div>
      </div>

      <!-- 评分详情 -->
      <div
        class="metrics-container mt-3"
        style="padding-bottom: 0; border-bottom: none"
      >
        <div
          class="metric-item"
          style="background-color: transparent; border: 1px solid #eee"
        >
          <div class="metric-label">热量得分</div>
          <el-progress
            type="dashboard"
            :percentage="dietAnalysis?.calorieScore || 0"
            :width="80"
          />
        </div>
        <div
          class="metric-item"
          style="background-color: transparent; border: 1px solid #eee"
        >
          <div class="metric-label">规律性得分</div>
          <el-progress
            type="dashboard"
            :percentage="dietAnalysis?.regularityScore || 0"
            :width="80"
          />
        </div>
      </div>

      <!-- 饮食问题标签 -->
      <div class="issues-container mt-4">
        <div class="section-title">检测到的饮食问题</div>
        <div
          v-if="
            !dietAnalysis?.dietIssues || dietAnalysis?.dietIssues.length === 0
          "
          class="no-issues"
        >
          未检测到明显饮食问题，继续保持！
        </div>
        <el-tag
          v-for="(issue, i) in dietAnalysis?.dietIssues"
          :key="i"
          type="warning"
          class="issue-tag"
        >
          {{ issue }}
        </el-tag>
      </div>

      <!-- 饮食建议 -->
      <div class="advice-container mt-4">
        <div class="section-title">核心改善建议</div>
        <ul class="advice-list core-advice">
          <li v-for="(item, i) in dietAnalysis?.coreAdvice" :key="i">
            {{ item }}
          </li>
        </ul>
        <div class="section-title mt-3">针对性建议</div>
        <ul class="advice-list targeted-advice">
          <li v-for="(item, i) in dietAnalysis?.specificAdvice" :key="i">
            {{ item }}
          </li>
        </ul>
        <div class="section-title mt-3">饮食小贴士</div>
        <ul class="advice-list tips-advice">
          <li v-for="(item, i) in dietAnalysis?.dietTips" :key="i">
            {{ item }}
          </li>
        </ul>
      </div>
    </el-card>

    <!-- 弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑记录' : '新增记录'"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="日期">
          <el-date-picker v-model="form.date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="餐次">
          <el-select v-model="form.meal">
            <el-option label="早餐" value="breakfast" />
            <el-option label="午餐" value="lunch" />
            <el-option label="晚餐" value="dinner" />
          </el-select>
        </el-form-item>

        <!-- 食物列表 -->
        <el-form-item label="食物">
          <div
            v-for="(item, idx) in form.items"
            :key="idx"
            style="display: flex; gap: 8px; margin-bottom: 8px"
          >
            <el-select
              v-model="item.food"
              placeholder="选择食物"
              style="width: 140px"
            >
              <el-option
                v-for="f in foodList"
                :key="f.id"
                :label="f.name"
                :value="f.id"
              />
            </el-select>
            <el-input-number
              v-model="item.quantity_in_grams"
              :min="1"
              style="width: 120px"
            />
            <div
              style="min-width: 100px"
              v-if="foodList.some((f) => f.id === item.food)"
            >
              约
              {{
                (
                  (item.quantity_in_grams *
                    (foodList.find((f) => f.id === item.food)
                      ?.energy_get_kcal || 0)) /
                  100
                ).toFixed(0)
              }}
              kcal
            </div>
            <el-button type="danger" @click="form.items.splice(idx, 1)">
              删除
            </el-button>
          </div>
          <el-button
            type="primary"
            @click="
              form.items.push({
                food: foodList[0]?.id || null,
                quantity_in_grams: 100,
                estimated_calories: 0,
                estimated_water: 0,
              })
            "
          >
            添加食物
          </el-button>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mt-4 {
  margin-top: 16px;
}

.chart-controls {
  margin-bottom: 16px;
}

.chart-controls > div {
  display: flex;
  gap: 10px;
  align-items: center;
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
