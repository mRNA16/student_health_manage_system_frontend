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
  quantity_in_grams: number;
  estimated_calories: number;
  estimated_water: number;
}
interface MealRecord {
  id: number;
  date: string;
  meal: 'breakfast' | 'dinner' | 'lunch';
  source: 'ai' | 'manual';
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
  form.value = record
    ? { ...record }
    : {
        id: 0,
        date: dayjs().format('YYYY-MM-DD'),
        meal: 'breakfast',
        source: 'manual',
        items: [],
      };
  dialogVisible.value = true;
}

// 提交
async function submitForm() {
  if (form.value.items.length === 0) {
    ElMessage.warning('请至少添加一种食物');
    return;
  }
  try {
    form.value.id
      ? await updateMealRecord(form.value)
      : await addMealRecord(form.value);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await fetchRecords();
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

  // 遍历当天所有记录
  targetRecords.forEach((record) => {
    // 遍历记录中的每个食物
    record.items.forEach((item) => {
      // 查找食物名称
      const food = foodList.value.find((f) => f.id === item.food);
      if (food) {
        foodCalories.push({
          meal: record.meal,
          name: food.name, // 食物名称
          value: item.estimated_calories, // 单个食物的卡路里
          color: mealColors[record.meal], // 根据餐次获取颜色
        });
      }
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
              {{ foodList.find((f) => f.id === item.food)?.name }}
              {{ item.quantity_in_grams }}g<br />
            </span>
          </template>
        </el-table-column>
        <el-table-column label="总热量(kcal)">
          <template #default="scope">
            {{
              scope.row.items
                .reduce((s: number, i: MealItem) => s + i.estimated_calories, 0)
                .toFixed(0)
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
                    foodList[item.food].energy_get_kcal) /
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
                food: null,
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
</style>
