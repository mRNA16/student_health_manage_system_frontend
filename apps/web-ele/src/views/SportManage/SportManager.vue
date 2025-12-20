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
  getSportAnalysis,
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
    const analysisData = ref<any>(null);

    const continuousLowActivityDays = ref(0); // 连续低运动量天数
    const showActivityWarning = ref(false); // 是否显示运动警告

    // 图表相关引用
    const weekChartRef = ref(); // 周折线图引用
    const dayPieChartRef = ref(); // 日饼图引用
    const { renderEcharts: renderWeekChart } = useEcharts(weekChartRef); // 周图表渲染函数
    const { renderEcharts: renderDayPieChart } = useEcharts(dayPieChartRef); // 日图表渲染函数
    const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
    const timeRange = ref<'1y' | '7d' | '30d'>('7d'); // 默认近7天

    const LOW_ACTIVITY_THRESHOLD = 170; // 低运动量阈值（卡路里）
    const MONTHLY_LOW_ACTIVITY_THRESHOLD = LOW_ACTIVITY_THRESHOLD * 30;
    const CONTINUOUS_DAYS_THRESHOLD = 3; // 连续天数阈值
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

      await fetchAnalysis();
      renderWeekCaloriesChart();
      renderDailyPieChart();
    };

    const fetchAnalysis = async () => {
      try {
        const today = dayjs();
        let start;
        if (timeRange.value === '7d') {
          start = today.subtract(6, 'day').format('YYYY-MM-DD');
        } else if (timeRange.value === '30d') {
          start = today.subtract(29, 'day').format('YYYY-MM-DD');
        } else {
          start = today.subtract(1, 'year').format('YYYY-MM-DD');
        }
        const res = await getSportAnalysis({
          start_date: start,
          end_date: today.format('YYYY-MM-DD'),
        });
        analysisData.value = res;
        continuousLowActivityDays.value = res.continuousLowActivityDays || 0;

        // 如果达到预警阈值，显示警告
        if (continuousLowActivityDays.value >= CONTINUOUS_DAYS_THRESHOLD) {
          showActivityWarning.value = true;
          ElMessage({
            message: `⚠️ 运动警告：您已连续${continuousLowActivityDays.value}天运动量过低（少于${LOW_ACTIVITY_THRESHOLD}千卡）！`,
            type: 'warning',
            duration: 5000,
            showClose: true,
          });
        } else {
          showActivityWarning.value = false;
        }
      } catch (error) {
        console.error('Failed to fetch analysis:', error);
      }
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
      if (analysisData.value) {
        const data =
          timeRange.value === '1y'
            ? analysisData.value.yearlyData
            : analysisData.value.dailyData;
        if (data && data.length > 0) {
          const labels = data.map((item: any) =>
            timeRange.value === '1y'
              ? item.date
              : dayjs(item.date).format('MM-DD'),
          );
          const caloriesData = data.map(
            (item: any) => item.totalCalories || item.calories || 0,
          );
          return { labels, caloriesData };
        }
      }

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
      const currentRange = timeRange.value as keyof typeof titleMap;
      const currentThreshold =
        timeRange.value === '1y'
          ? MONTHLY_LOW_ACTIVITY_THRESHOLD
          : LOW_ACTIVITY_THRESHOLD;

      renderWeekChart({
        title: {
          text: titleMap[currentRange],
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
              color(params) {
                const value = Number(params.value);
                // 处理可能的NaN情况，默认为红色
                if (Number.isNaN(value)) {
                  return '#fa541c';
                }
                return value < currentThreshold ? '#fa541c' : '#67c23a';
              },
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
            markLine: {
              symbol: 'none',
              lineStyle: {
                type: 'dashed', // 虚线
                color: '#fa541c',
                width: 2, // 加粗
              },
              data: [
                {
                  yAxis: currentThreshold, // 使用定义的阈值
                  label: {
                    show: false, // 不显示标签
                  },
                },
              ],
            },
          },
        ],
      });
    };

    const handleTimeRangeChange = async (value: '1y' | '7d' | '30d') => {
      timeRange.value = value;
      await fetchAnalysis();
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

    // 计算是否显示当天饼图
    const showSelectedDatePieChart = computed(() => {
      return getSelectedDateSportData() !== null;
    });
    const handleDateChange = () => {
      // 日期变化时重新渲染饼图
      renderDailyPieChart();
    };

    const generateActivityAdvice = computed(() => {
      if (continuousLowActivityDays.value < CONTINUOUS_DAYS_THRESHOLD) {
        return [];
      }

      return [
        `• 您已连续${continuousLowActivityDays.value}天运动量不足，建议增加日常活动`,
        '• 可以尝试每天进行30分钟中等强度运动，如快走、慢跑或骑自行车',
        '• 工作间隙可进行简单伸展，每小时起身活动5分钟',
        `• 目标是每天消耗至少${LOW_ACTIVITY_THRESHOLD}千卡`,
      ];
    });

    const activityAnalysis = computed(() => {
      if (!analysisData.value) return null;

      const avgDailyCalories = Number(analysisData.value.avgDailyCalories || 0);
      const avgDailyDuration = Number(analysisData.value.avgDailyDuration || 0);
      const continuousDays = Number(
        analysisData.value.continuousLowActivityDays || 0,
      );

      const activityIssues: string[] = [];
      if (avgDailyDuration < 30) {
        activityIssues.push('平均每日运动时长不足（建议≥30分钟）');
      }
      if (avgDailyCalories < 300) {
        activityIssues.push('平均每日消耗热量偏低（建议≥300千卡）');
      }
      if (continuousDays >= CONTINUOUS_DAYS_THRESHOLD) {
        activityIssues.push(`连续${continuousDays}天运动量偏低`);
      }

      const coreAdvice = [
        '1. 每天坚持30分钟中等强度运动。',
        '2. 多样化运动类型，避免单一。',
        '3. 运动前做好热身，运动后拉伸。',
      ];

      const specificAdvice: string[] = [];
      if (avgDailyDuration < 30) {
        specificAdvice.push('• 增加每日运动时长，逐步达到30分钟。');
      }
      if (avgDailyCalories < 300) {
        specificAdvice.push('• 提高运动强度或延长运动时间。');
      }
      if (continuousDays >= CONTINUOUS_DAYS_THRESHOLD) {
        specificAdvice.push(
          `• 避免连续${CONTINUOUS_DAYS_THRESHOLD}天运动量过低，适当安排锻炼。`,
        );
      }
      if (specificAdvice.length === 0) {
        specificAdvice.push('• 保持良好运动习惯，继续加油！');
      }

      const allTips = [
        '• 运动时保持补水，避免脱水。',
        '• 选择适合自己的运动项目。',
        '• 运动后适当补充蛋白质。',
        '• 合理安排运动与休息，避免过度训练。',
        '• 运动时注意安全，量力而行。',
      ];
      const activityTips = [...allTips]
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      return {
        avgDailyCalories,
        avgDailyDuration,
        frequencyScore: analysisData.value.frequencyScore || 0,
        durationScore: analysisData.value.durationScore || 0,
        calorieScore: analysisData.value.calorieScore || 0,
        sportScore: analysisData.value.sportScore || 0,
        activityIssues,
        coreAdvice,
        specificAdvice,
        activityTips,
      };
    });

    onMounted(async () => {
      await fetchUser();
      await fetchSportList();
      await fetchRecordList();
      renderWeekCaloriesChart();
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
      continuousLowActivityDays,
      showActivityWarning,
      LOW_ACTIVITY_THRESHOLD,
      MONTHLY_LOW_ACTIVITY_THRESHOLD,
      CONTINUOUS_DAYS_THRESHOLD,
      generateActivityAdvice,
      activityAnalysis,
    };
  },
});
</script>

<template>
  <div class="sport-manager">
    <el-card
      v-if="showActivityWarning"
      class="mt-4"
      shadow="always"
      style="border-left: 4px solid #fa541c"
    >
      <div style="display: flex; align-items: center; color: #fa541c">
        <el-icon style="margin-right: 8px"><WarningFilled /></el-icon>
        <div>
          <strong>运动警告：</strong>
          您已连续{{ continuousLowActivityDays }}天运动量过低（少于{{
            LOW_ACTIVITY_THRESHOLD
          }}千卡），长期低活动量可能影响健康，请适当增加运动！
        </div>
      </div>

      <div style="padding-left: 24px; margin-top: 10px">
        <ul>
          <li
            v-for="(advice, index) in generateActivityAdvice"
            :key="index"
            style="margin: 5px 0; color: #666"
          >
            {{ advice }}
          </li>
        </ul>
      </div>
    </el-card>
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
        <el-table-column prop="duration" label="时长(分钟)" width="120" />
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
      <div
        style="
          margin-top: 8px;
          font-size: 12px;
          color: #fa541c;
          text-align: right;
        "
      >
        虚线为低运动量阈值（{{
          timeRange === '1y'
            ? MONTHLY_LOW_ACTIVITY_THRESHOLD
            : LOW_ACTIVITY_THRESHOLD
        }}千卡/{{ timeRange === '1y' ? '月' : '天' }}）
      </div>
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

    <el-card class="mt-4" v-if="activityAnalysis">
      <template #header>
        <span style="font-weight: bold">运动健康分析与建议</span>
      </template>
      <!-- 运动指标概览 -->
      <div class="metrics-container">
        <div class="metric-item">
          <div class="metric-label">平均每日热量消耗</div>
          <div class="metric-value">
            {{ activityAnalysis.avgDailyCalories.toFixed(1) }} kcal
          </div>
          <div
            class="metric-status"
            :class="
              activityAnalysis.avgDailyCalories >= 300 ? 'good' : 'warning'
            "
          >
            {{ activityAnalysis.avgDailyCalories >= 300 ? '正常' : '偏低' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">平均每日运动时长</div>
          <div class="metric-value">
            {{ activityAnalysis.avgDailyDuration.toFixed(1) }} 分钟
          </div>
          <div
            class="metric-status"
            :class="
              activityAnalysis.avgDailyDuration >= 30 ? 'good' : 'warning'
            "
          >
            {{ activityAnalysis.avgDailyDuration >= 30 ? '达标' : '不足' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">连续低运动量</div>
          <div class="metric-value">{{ continuousLowActivityDays }} 天</div>
          <div
            class="metric-status"
            :class="
              continuousLowActivityDays < CONTINUOUS_DAYS_THRESHOLD
                ? 'good'
                : 'danger'
            "
          >
            {{
              continuousLowActivityDays < CONTINUOUS_DAYS_THRESHOLD
                ? '正常'
                : '需警惕'
            }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">运动综合评分</div>
          <div class="metric-value">{{ activityAnalysis.sportScore }}</div>
          <div
            class="metric-status"
            :class="activityAnalysis.sportScore >= 60 ? 'good' : 'warning'"
          >
            {{
              activityAnalysis.sportScore >= 80
                ? '优秀'
                : activityAnalysis.sportScore >= 60
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
          <div class="metric-label">频率得分</div>
          <el-progress
            type="dashboard"
            :percentage="activityAnalysis.frequencyScore"
            :width="80"
          />
        </div>
        <div
          class="metric-item"
          style="background-color: transparent; border: 1px solid #eee"
        >
          <div class="metric-label">时长得分</div>
          <el-progress
            type="dashboard"
            :percentage="activityAnalysis.durationScore"
            :width="80"
          />
        </div>
        <div
          class="metric-item"
          style="background-color: transparent; border: 1px solid #eee"
        >
          <div class="metric-label">热量得分</div>
          <el-progress
            type="dashboard"
            :percentage="activityAnalysis.calorieScore"
            :width="80"
          />
        </div>
      </div>

      <!-- 运动问题标签 -->
      <div class="issues-container mt-4">
        <div class="section-title">检测到的运动问题</div>
        <div
          v-if="
            !activityAnalysis.activityIssues ||
            activityAnalysis.activityIssues.length === 0
          "
          class="no-issues"
        >
          未检测到明显运动问题，继续保持！
        </div>
        <el-tag
          v-for="(issue, i) in activityAnalysis.activityIssues"
          :key="i"
          type="warning"
          class="issue-tag"
        >
          {{ issue }}
        </el-tag>
      </div>

      <!-- 运动建议 -->
      <div class="advice-container mt-4">
        <div class="section-title">核心改善建议</div>
        <ul class="advice-list core-advice">
          <li v-for="(item, i) in activityAnalysis.coreAdvice" :key="i">
            {{ item }}
          </li>
        </ul>
        <div class="section-title mt-3">针对性建议</div>
        <ul class="advice-list targeted-advice">
          <li v-for="(item, i) in activityAnalysis.specificAdvice" :key="i">
            {{ item }}
          </li>
        </ul>
        <div class="section-title mt-3">运动小贴士</div>
        <ul class="advice-list tips-advice">
          <li v-for="(item, i) in activityAnalysis.activityTips" :key="i">
            {{ item }}
          </li>
        </ul>
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
        <el-form-item>
          <el-progress
            :percentage="
              Math.min(100, (caloriesPreview / LOW_ACTIVITY_THRESHOLD) * 100)
            "
            stroke-width="6"
          />
          <div style="margin-top: 5px; font-size: 12px; color: #666">
            今日建议运动量：{{ LOW_ACTIVITY_THRESHOLD }}千卡
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
