<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

import {
  addMealRecord,
  deleteMealRecord,
  getCurrentUser,
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

/* 初始化 */
onMounted(async () => {
  user.value = await getCurrentUser();
  foodList.value = await getFoodList();
  fetchRecords();
});

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

/* 图表 */
const chartOption = computed(() => ({
  title: { text: '最近一周热量摄入' },
  tooltip: {},
  xAxis: {
    type: 'category',
    data: [...new Set(recordList.value.map((r) => r.date))].sort(),
  },
  yAxis: { type: 'value', name: '千卡' },
  series: [
    {
      type: 'bar',
      name: '总热量',
      data: [...new Set(recordList.value.map((r) => r.date))]
        .sort()
        .map((date) =>
          recordList.value
            .filter((r) => r.date === date)
            .reduce(
              (sum, r) =>
                sum + r.items.reduce((s, i) => s + i.estimated_calories, 0),
              0,
            ),
        ),
    },
  ],
}));
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
      <v-chart :option="chartOption" style="height: 300px" />
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
</style>
