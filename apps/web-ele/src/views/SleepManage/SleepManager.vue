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
  </div>
</template>

<style scoped>
.mt-4 {
  margin-top: 16px;
}
</style>
