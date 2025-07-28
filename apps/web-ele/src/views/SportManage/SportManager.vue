<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

import {
  addRecord,
  deleteRecord,
  getCurrentUser,
  getRecordList,
  getSportList,
  updateRecord,
} from '../../api/sport';

export default defineComponent({
  name: 'SportManager',
  components: { EchartsUI },
  setup() {
    const sportList = ref();
    const metList = ref();
    const recordList = ref([]);
    const dialogVisible = ref(false);
    const user = ref<any>(null);
    const caloriesPreview = ref(0);

    // 图表相关引用
    const weekChartRef = ref(); // 周折线图引用
    const dayPieChartRef = ref(); // 日饼图引用
    const { renderEcharts: renderWeekChart } = useEcharts(weekChartRef); // 周图表渲染函数
    const { renderEcharts: renderDayPieChart } = useEcharts(dayPieChartRef); // 日图表渲染函数
    const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
    const timeRange = ref('7d'); // 默认近7天

    const form = ref({
      id: 0,
      date: '',
      sport: 0,
      begin_time: new Date(),
      end_time: new Date(),
      calories: 0,
    });
    const fetchUser = async () => {
      try {
        // 获取当前用户信息
        const userRes = await getCurrentUser();
        user.value = userRes;
      } catch {
        ElMessage.error('获取数据失败');
      }
    };

    const fetchSportList = async () => {
      const res = await getSportList();
      sportList.value = Array.isArray(res)
        ? res.filter((item) => 'name' in item).map((item) => item.name)
        : [];
      metList.value = Array.isArray(res)
        ? res.filter((item) => 'met' in item).map((item) => item.met)
        : [];
    };

    const fetchRecordList = async () => {
      const res = await getRecordList();
      recordList.value = res || [];

      renderWeekCaloriesChart();
      renderDailyPieChart();
    };

    const openAddDialog = () => {
      form.value = {
        id: 0,
        date: '',
        sport: 0,
        begin_time: new Date(1970, 0, 1, 0, 0, 0),
        end_time: new Date(1970, 0, 1, 0, 0, 0),
        calories: 0,
      };
      dialogVisible.value = true;
      fetchSportList();
    };

    const editRecord = (row: {
      begin_time: string;
      calories: number;
      date: string;
      end_time: string;
      id: number;
      sport: number;
    }) => {
      const dateStr = row.date;
      form.value = {
        id: row.id,
        date: row.date,
        sport: row.sport,
        begin_time: dayjs(
          `${dateStr} ${row.begin_time}`,
          'YYYY-MM-DD HH:mm:ss',
        ).toDate(),
        end_time: dayjs(
          `${dateStr} ${row.end_time}`,
          'YYYY-MM-DD HH:mm:ss',
        ).toDate(),
        calories: row.calories,
      };
      dialogVisible.value = true;
    };

    const submitForm = async () => {
      const payload = {
        id: form.value.id,
        date: dayjs(form.value.date).format('YYYY-MM-DD'),
        begin_time: dayjs(form.value.begin_time).format('HH:mm:ss'),
        end_time: dayjs(form.value.end_time).format('HH:mm:ss'),
        sport: form.value.sport,
      };
      await (form.value.id ? updateRecord(payload) : addRecord(payload));
      dialogVisible.value = false;
      fetchRecordList();
    };

    const deleteRecords = async (id: number) => {
      await deleteRecord(id);
      fetchRecordList();
    };

    const getCurrentMet = () => {
      const index = form.value.sport;
      if (Array.isArray(metList.value) && metList.value.length > index) {
        const sportItem = metList.value[index];
        return sportItem?.met || 1;
      }
      return 1;
    };

    const getUserWeight = () => user.value?.weight || 60;
    const getGenderFactor = () => (user.value?.gender === 'male' ? 3.5 : 3.1);
    const getDurationMinutes = () => {
      const start = form.value.begin_time;
      const end = form.value.end_time;
      let diff = (end.getTime() - start.getTime()) / 60_000;
      if (diff < 0) {
        diff += 1440;
      }
      return diff;
    };
    const updateCaloriesPreview = () => {
      const met = getCurrentMet();
      const weight = getUserWeight();
      const factor = getGenderFactor();
      const duration = getDurationMinutes();
      const cal = ((met * weight * factor) / 200) * duration;
      caloriesPreview.value = cal;
    };
    watch(
      () => [form.value.sport, form.value.begin_time, form.value.end_time],
      updateCaloriesPreview,
      { immediate: true },
    );

    const getCaloriesData = () => {
      const range = timeRange.value;
      let labels: string[] = []; // x轴标签
      let groupKey: (date: string) => string;

      // 根据时间范围生成标签和分组规则
      if (range === '7d') {
        labels = Array.from({ length: 7 }, (_, i) =>
          dayjs().subtract(i, 'day').format('MM-DD'),
        ).reverse();
        groupKey = (date) => dayjs(date).format('MM-DD');
      } else if (range === '30d') {
        labels = Array.from({ length: 30 }, (_, i) =>
          dayjs().subtract(i, 'day').format('MM-DD'),
        ).reverse();
        groupKey = (date) => dayjs(date).format('MM-DD');
      } else {
        labels = Array.from({ length: 12 }, (_, i) =>
          dayjs().subtract(i, 'month').format('YYYY-MM'),
        ).reverse();
        groupKey = (date) => dayjs(date).format('YYYY-MM');
      }

      const recordMap: Record<string, number> = {};
      labels.forEach((label) => {
        recordMap[label] = 0;
      });

      // 遍历记录，累加对应分组的卡路里
      (recordList.value as Array<{ calories: number; date: string }>).forEach(
        (record) => {
          const key = groupKey(record.date);
          if (Object.prototype.hasOwnProperty.call(recordMap, key)) {
            // 只统计在标签范围内的数据
            recordMap[key] = (recordMap[key] || 0) + (record.calories || 0);
          }
        },
      );

      const caloriesData = labels.map((label) => recordMap[label] || 0);

      return { labels, caloriesData };
    };

    // 一周卡路里折线图
    const renderWeekCaloriesChart = () => {
      const { labels, caloriesData } = getCaloriesData();
      const titleMap: Record<'1y' | '7d' | '30d', string> = {
        '7d': '近7天卡路里消耗趋势',
        '30d': '近30天卡路里消耗趋势',
        '1y': '近1年卡路里消耗趋势',
      };
      const timeRange = ref<'1y' | '7d' | '30d'>('7d');

      renderWeekChart({
        title: {
          text: titleMap[timeRange.value],
          left: 'center',
          textStyle: {
            fontSize: 16,
          },
        },
        tooltip: {
          trigger: 'axis',
          formatter: '{b}: {c} kcal', // 显示日期和对应卡路里
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: {
            rotate: timeRange.value === '1y' ? 30 : 0,
          },
        },
        yAxis: {
          type: 'value',
          name: '卡路里 (kcal)',
          min: 0, // 确保Y轴从0开始
          axisLabel: {
            formatter: '{value}',
          },
        },
        series: [
          {
            data: caloriesData,
            type: 'line',
            smooth: true, // 平滑曲线
            symbol: 'circle', // 数据点样式
            symbolSize: 8, // 数据点大小
            lineStyle: {
              width: 3,
              color: '#409eff',
            },
            itemStyle: {
              color: '#409eff',
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
                  { offset: 1, color: 'rgba(64, 158, 255, 0)' },
                ],
              },
            },
            emphasis: {
              scale: true, // 鼠标 hover 时放大数据点
            },
          },
        ],
      });
    };

    const handleTimeRangeChange = () => {
      // 范围变化时重新渲染折线图
      renderWeekCaloriesChart();
    };

    // 获取当天的运动类型卡路里数据
    const getSelectedDateSportData = () => {
      const targetDate = selectedDate.value;
      const targetRecords = (
        recordList.value as Array<{
          calories: number;
          date: string;
          sport: number;
        }>
      ).filter((record) => record.date === targetDate);

      if (targetRecords.length === 0) return null; // 无数据时返回null

      const sportMap: Record<string, number> = {};
      targetRecords.forEach((record) => {
        const sportName = sportList.value[record.sport] || '未知';
        if (!sportMap[sportName]) {
          sportMap[sportName] = 0;
        }
        sportMap[sportName] += record.calories || 0;
      });

      return Object.entries(sportMap).map(([name, value]) => ({ name, value }));
    };

    // 渲染当天运动类型饼图
    const renderDailyPieChart = () => {
      const sportData = getSelectedDateSportData();

      if (!sportData) {
        if (dayPieChartRef.value) {
          renderDayPieChart({}); // 清空图表
        }
        return;
      }

      // 饼图配置
      renderDayPieChart({
        title: {
          text: `${selectedDate.value} 运动卡路里分布`,
          left: 'center',
          textStyle: {
            fontSize: 16,
          },
        },
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} kcal ({d}%)',
        },
        legend: {
          orient: 'vertical',
          left: 10,
          data: sportData.map((item) => item.name),
          textStyle: {
            fontSize: 12,
          },
        },
        series: [
          {
            name: '卡路里消耗',
            type: 'pie',
            radius: ['40%', '70%'], // 环形饼图
            center: ['50%', '55%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 8,
              borderColor: '#fff',
              borderWidth: 2,
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
            data: sportData,
          },
        ],
        color: [
          '#409eff',
          '#67c23a',
          '#e6a23c',
          '#f56c6c',
          '#909399',
          '#c0c4cc',
          '#8e44ad',
          '#3498db',
          '#1abc9c',
          '#f1c40f',
        ],
      });
    };

    // 新增：计算是否显示当天饼图
    const showSelectedDatePieChart = computed(() => {
      return getSelectedDateSportData() !== null;
    });
    const handleDateChange = () => {
      // 日期变化时重新渲染饼图
      renderDailyPieChart();
    };

    onMounted(async () => {
      await fetchUser();
      await fetchSportList();
      await fetchRecordList();
      renderWeekCaloriesChart();
      watch(timeRange, handleTimeRangeChange, { immediate: true });
      renderDailyPieChart();
      watch(selectedDate, handleDateChange, { immediate: true });
    });

    return {
      sportList,
      recordList,
      dialogVisible,
      form,
      user,
      caloriesPreview,
      openAddDialog,
      editRecord,
      submitForm,
      deleteRecords,
      weekChartRef,
      dayPieChartRef,
      showSelectedDatePieChart,
      selectedDate,
      handleDateChange,
      timeRange,
      handleTimeRangeChange,
    };
  },
});
</script>

<template>
  <div class="sport-manager">
    <el-card>
      <template #header>
        <div class="clearfix">
          <span>运动记录管理</span>
          <el-button style="float: right" type="primary" @click="openAddDialog">
            新增记录
          </el-button>
        </div>
      </template>
      <el-table v-if="sportList?.length" :data="recordList" style="width: 100%">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="运动项目">
          <template #default="scope">
            {{ sportList[scope.row.sport] || '未知' }}
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="时长(小时)" width="120" />
        <el-table-column prop="calories" label="消耗卡路里(kCal)" width="120" />
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button size="default" @click="editRecord(scope.row)">
              编辑
            </el-button>
            <el-button
              size="default"
              type="danger"
              @click="deleteRecords(scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="mt-4">
      <template #header>
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
          "
        >
          <span>卡路里消耗趋势</span>
          <!-- 添加时间范围选择器 -->
          <el-select
            v-model="timeRange"
            placeholder="选择时间范围"
            @change="handleTimeRangeChange"
            style="width: 160px"
          >
            <el-option label="近7天" value="7d" />
            <el-option label="近30天" value="30d" />
            <el-option label="近1年" value="1y" />
          </el-select>
        </div>
      </template>
      <EchartsUI ref="weekChartRef" style="height: 300px" />
    </el-card>

    <el-card class="mt-4">
      <template #header>
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
          "
        >
          <span>运动卡路里分布</span>
          <el-date-picker
            v-model="selectedDate"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            @change="handleDateChange"
            style="width: 180px"
          />
        </div>
      </template>
      <EchartsUI
        ref="dayPieChartRef"
        style="height: 300px"
        v-if="showSelectedDatePieChart"
      />
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #666;
        "
        v-if="!showSelectedDatePieChart"
      >
        该日期无运动记录
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" title="运动记录">
      <el-form :model="form">
        <el-form-item label="日期">
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="运动项目">
          <el-select v-model="form.sport" placeholder="请选择运动项目">
            <el-option
              v-for="(item, index) in sportList"
              :key="index"
              :label="item"
              :value="index"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="form.begin_time"
            placeholder="开始时间"
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="form.end_time"
            placeholder="结束时间"
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="预计消耗卡路里">
          <div style="font-weight: bold; color: #409eff">
            {{ caloriesPreview }} kcal
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="submitForm">确 定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sport-manager {
  padding: 20px;
}

.mt-4 {
  margin-top: 16px;
}

::v-deep .el-select {
  width: 160px;
}
</style>
