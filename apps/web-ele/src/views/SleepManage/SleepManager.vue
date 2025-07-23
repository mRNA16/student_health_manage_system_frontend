<script setup lang="ts">
import { onMounted, ref } from 'vue';

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
  // 如果后端还有其他字段，也可以加上
  [key: string]: any;
}

const form = ref({ date: '', sleep_time: '', wake_time: '' });
const records = ref<any[]>([]);
const chartOption = ref({});
const user = ref<any>(null);
const fetchUserAndRecords = async () => {
  // 获取当前用户信息
  const userRes = await getCurrentUser();
  user.value = userRes.data;

  // 获取最近7天睡眠记录
  const end = dayjs().format('YYYY-MM-DD');
  const start = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
  const res = await getSleepRecords({ start_date: start, end_date: end });
  records.value = (res.data || []).map((r: SleepRecord) => ({
    ...r,
    duration: calcDuration(r.sleep_time, r.wake_time),
  }));

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
};

const addRecord = async () => {
  if (!form.value.date || !form.value.sleep_time || !form.value.wake_time) {
    ElMessage.warning('请填写完整信息');
    return;
  }
  await addSleepRecord({ ...form.value });
  form.value = { date: '', sleep_time: '', wake_time: '' };
  fetchUserAndRecords();
};

const calcDuration = (start: string, end: string) => {
  // 计算小时数
  const s = dayjs(`2020-01-01 ${start}`);
  const e = dayjs(`2020-01-01 ${end}`);
  let diff = e.diff(s, 'minute') / 60;
  if (diff < 0) diff += 24;
  return Number(diff.toFixed(1));
};

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
      <el-table :data="records" style="width: 100%">
        <el-table-column prop="date" label="日期" />
        <el-table-column prop="sleep_time" label="入睡时间" />
        <el-table-column prop="wake_time" label="起床时间" />
        <el-table-column prop="duration" label="睡眠时长(小时)" />
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
