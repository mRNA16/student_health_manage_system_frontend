<script setup lang="ts">
import type {
  AnalysisRequest,
  AnalysisResult,
  HealthSummary,
} from '../../api/analysis';

import { nextTick, onMounted, ref, watch } from 'vue';

import { Bicycle } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import { ElIcon, ElMessage, ElMessageBox } from 'element-plus';

import {
  analyzeHealthData,
  deleteAnalysisResult,
  getAnalysisDetail,
  getAnalysisResults,
  getHealthSummary,
} from '../../api/analysis';

// 响应式数据
const healthSummary = ref<HealthSummary>({
  sleep: { total_records: 0, avg_quality: 0, avg_duration: 0, best_day: null },
  sport: {
    total_records: 0,
    avg_duration: 0,
    total_calories: 0,
    active_days: 0,
  },
  diet: { total_records: 0, avg_calories: 0, avg_meals: 0, avg_variety: 0 },
  overall_score: 0,
});

const analysisForm = ref<AnalysisRequest>({
  analysis_type: 'sleep_prediction',
  time_range: '30d',
  include_predictions: true,
});

const analyzing = ref(false);
const currentAnalysis = ref<any>(null);
const analysisHistory = ref<AnalysisResult[]>([]);

// 图表引用
const sleepPredictionChart = ref<HTMLElement>();
const correlationChart = ref<HTMLElement>();
const trendChart = ref<HTMLElement>();

// 生命周期
onMounted(async () => {
  // 并行加载数据
  await Promise.all([loadHealthSummary(), loadAnalysisHistory()]);
});

// 切换自动清除分析结果
watch(
  () => analysisForm.value.analysis_type,
  (_newVal, _oldVal) => {
    currentAnalysis.value = null;
  },
);

// 方法
const loadHealthSummary = async () => {
  try {
    const response = await getHealthSummary('30d');
    if (response.success) {
      healthSummary.value = response.data;
    }
  } catch {
    ElMessage.error('加载健康摘要失败');
  }
};

const loadAnalysisHistory = async () => {
  try {
    const response = await getAnalysisResults({ limit: 10 });
    if (response.success) {
      analysisHistory.value = response.data;
    }
  } catch {
    ElMessage.error('加载分析历史失败');
  }
};

const runAnalysis = async () => {
  analyzing.value = true;
  try {
    const response = await analyzeHealthData(analysisForm.value);
    if (response.success) {
      currentAnalysis.value = { data: response.data };
      ElMessage.success('分析完成');
      await nextTick();
      renderChart();
      await loadAnalysisHistory();
    } else {
      ElMessage.error('分析失败1');
    }
  } catch {
    ElMessage.error('分析失败2');
  } finally {
    analyzing.value = false;
  }
};

const renderChart = () => {
  if (!currentAnalysis.value) return;
  switch (analysisForm.value.analysis_type) {
    case 'health_trend': {
      renderTrendChart();
      break;
    }
    case 'sleep_prediction': {
      renderSleepPredictionChart();
      break;
    }
    case 'sleep_sport_correlation': {
      renderCorrelationChart();
      break;
    }
  }
};

const renderSleepPredictionChart = () => {
  if (!sleepPredictionChart.value) return;

  const chart = echarts.init(sleepPredictionChart.value);
  const data = currentAnalysis.value.data;

  const option = {
    title: {
      text: '睡眠质量预测',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter(params: any) {
        const date = params[0].axisValue;
        let result = `${date}<br/>`;
        params.forEach((param: any) => {
          result += `${param.seriesName}: ${param.value}<br/>`;
        });
        return result;
      },
    },
    legend: {
      data: ['历史睡眠质量', '预测睡眠质量'],
      top: 30,
    },
    xAxis: {
      type: 'category',
      data: [...data.historical_trend.dates, ...data.prediction.dates],
    },
    yAxis: {
      type: 'value',
      name: '睡眠质量评分',
      min: 0,
      max: 100,
    },
    series: [
      {
        name: '历史睡眠质量',
        type: 'line',
        data: data.historical_trend.quality_scores,
        itemStyle: { color: '#409EFF' },
        lineStyle: { width: 3 },
      },
      {
        name: '预测睡眠质量',
        type: 'line',
        data: [
          ...Array.from({ length: data.historical_trend.dates.length }).fill(
            null,
          ),
          ...data.prediction.predicted_scores,
        ],
        itemStyle: { color: '#67C23A' },
        lineStyle: {
          width: 3,
          type: 'dashed',
          color: '#67C23A',
        },
      },
    ],
  };

  chart.setOption(option);
};

const renderCorrelationChart = () => {
  if (!correlationChart.value) return;

  const chart = echarts.init(correlationChart.value);
  const data = currentAnalysis.value.data;

  const option = {
    title: {
      text: '运动时长与睡眠质量关联性',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter(params: any) {
        return `${params.name}<br/>平均睡眠质量: ${params.value.toFixed(1)}`;
      },
    },
    series: [
      {
        name: '运动分组',
        type: 'pie',
        radius: '50%',
        data: Object.entries(data.group_analysis).map(([name, value]) => ({
          name,
          value: value || 0,
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  chart.setOption(option);
};

const renderTrendChart = () => {
  if (!trendChart.value) return;
  const chart = echarts.init(trendChart.value);
  const data = currentAnalysis.value.data;

  const option = {
    title: {
      text: '健康趋势雷达图',
      left: 'center',
    },
    radar: {
      indicator: [
        { name: '睡眠质量', max: 100 },
        { name: '运动时长', max: 4 },
        { name: '饮食规律', max: 100 },
      ],
    },
    series: [
      {
        name: '当前状态',
        type: 'radar',
        data: [
          {
            value: [
              data.trends.sleep?.avg_score || 0,
              data.trends.sport?.avg_duration || 0,
              data.trends.diet?.avg_calories
                ? 100 - Math.abs(data.trends.diet.avg_calories - 2000) / 20
                : 0,
            ],
            name: '健康指标',
          },
        ],
      },
    ],
  };

  chart.setOption(option);
};

const viewAnalysis = async (analysis: AnalysisResult) => {
  try {
    const response = await getAnalysisDetail(analysis.id);
    if (response.success) {
      analysisForm.value.analysis_type = analysis.analysis_type as any;
      currentAnalysis.value = { data: response.data };
      await nextTick();
      setTimeout(() => {
        renderChart();
      }, 50);
      currentAnalysis.value = { data: response.data };
      await nextTick();
      setTimeout(() => {
        renderChart();
      }, 50);
    }
  } catch {
    ElMessage.error('查看分析结果失败');
  }
};

const deleteAnalysis = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这个分析结果吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });

    const response = await deleteAnalysisResult(id);
    if (response.success) {
      ElMessage.success('删除成功');
      await loadAnalysisHistory();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

// 工具方法
const formatDate = (dateStr: string) => {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
};

const getConfidenceType = (confidence: number) => {
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'danger';
};

const getCorrelationType = (correlation: number) => {
  const absCorr = Math.abs(correlation);
  if (absCorr >= 0.7) return 'success';
  if (absCorr >= 0.4) return 'warning';
  return 'info';
};

const getPredictionTrend = (predictions: number[]) => {
  if (predictions.length < 2) return '数据不足';
  const first = predictions[0];
  const last = predictions[predictions.length - 1];
  if (first === undefined || last === undefined) return '数据不足';
  const trend = last - first;
  if (trend > 5) return '上升趋势';
  if (trend < -5) return '下降趋势';
  return '稳定';
};

const getCorrelationDescription = (correlation: number) => {
  const absCorr = Math.abs(correlation);
  if (absCorr >= 0.7) return '运动与睡眠质量有很强的关联性';
  if (absCorr >= 0.4) return '运动与睡眠质量有一定关联性';
  if (absCorr >= 0.2) return '运动与睡眠质量关联性较弱';
  return '运动与睡眠质量无明显关联';
};

const getDimensionName = (dimension: unknown) => {
  const dim = dimension as string;
  const names: Record<string, string> = {
    sleep: '睡眠',
    sport: '运动',
    diet: '饮食',
  };
  return names[dim] || dim;
};

const getTrendDescription = (dimension: unknown, trend: any) => {
  switch (dimension) {
    case 'diet': {
      return `平均卡路里: ${trend.avg_calories.toFixed(0)}千卡`;
    }
    case 'sleep': {
      return `平均评分: ${trend.avg_score.toFixed(1)}`;
    }
    case 'sport': {
      return `平均时长: ${trend.avg_duration.toFixed(1)}小时`;
    }
    default: {
      return '';
    }
  }
};
</script>

<template>
  <div class="data-analysis-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>健康数据分析</h1>
      <p>基于机器学习算法的多维度健康数据分析与预测</p>
    </div>

    <!-- 健康摘要卡片 -->
    <el-row :gutter="20" class="summary-cards">
      <el-col :span="6">
        <el-card class="summary-card">
          <div class="summary-item">
            <div class="summary-icon sleep-icon">
              <ElIcon><Moon /></ElIcon>
            </div>
            <div class="summary-content">
              <div class="summary-title">睡眠质量</div>
              <div class="summary-value">
                {{ healthSummary.sleep.avg_quality.toFixed(1) }}
              </div>
              <div class="summary-unit">/ 100</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card">
          <div class="summary-item">
            <div class="summary-icon sport-icon">
              <ElIcon><Bicycle /></ElIcon>
            </div>
            <div class="summary-content">
              <div class="summary-title">运动时长</div>
              <div class="summary-value">
                {{ healthSummary.sport.avg_duration.toFixed(1) }}
              </div>
              <div class="summary-unit">小时/天</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card">
          <div class="summary-item">
            <div class="summary-icon diet-icon">
              <ElIcon><Food /></ElIcon>
            </div>
            <div class="summary-content">
              <div class="summary-title">卡路里摄入</div>
              <div class="summary-value">
                {{ healthSummary.diet.avg_calories.toFixed(0) }}
              </div>
              <div class="summary-unit">千卡/天</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card">
          <div class="summary-item">
            <div class="summary-icon overall-icon">
              <ElIcon><TrendCharts /></ElIcon>
            </div>
            <div class="summary-content">
              <div class="summary-title">综合评分</div>
              <div class="summary-value">
                {{ healthSummary.overall_score.toFixed(1) }}
              </div>
              <div class="summary-unit">/ 100</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 分析控制面板 -->
    <el-card class="analysis-control-panel">
      <template #header>
        <div class="card-header">
          <span>数据分析控制</span>
        </div>
      </template>

      <el-form :model="analysisForm" label-width="120px" inline>
        <el-form-item label="分析类型">
          <el-select
            v-model="analysisForm.analysis_type"
            placeholder="选择分析类型"
            style="width: 200px"
          >
            <el-option label="睡眠质量预测" value="sleep_prediction" />
            <el-option label="睡眠运动关联性" value="sleep_sport_correlation" />
            <el-option label="健康趋势分析" value="health_trend" />
          </el-select>
        </el-form-item>

        <el-form-item label="时间范围">
          <el-select
            v-model="analysisForm.time_range"
            placeholder="选择时间范围"
            style="width: 200px"
          >
            <el-option label="最近7天" value="7d" />
            <el-option label="最近30天" value="30d" />
            <el-option label="最近90天" value="90d" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="runAnalysis" :loading="analyzing">
            开始分析
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 分析结果展示 -->
    <div v-if="currentAnalysis" class="analysis-results">
      <!-- 睡眠质量预测 -->
      <el-card
        v-if="analysisForm.analysis_type === 'sleep_prediction'"
        class="analysis-card"
      >
        <template #header>
          <div class="card-header">
            <span>睡眠质量预测分析</span>
            <el-tag
              :type="
                getConfidenceType(currentAnalysis.data.prediction.confidence)
              "
            >
              置信度:
              {{
                (currentAnalysis.data.prediction.confidence * 100).toFixed(1)
              }}%
            </el-tag>
          </div>
        </template>

        <div class="chart-container">
          <div ref="sleepPredictionChart" class="chart"></div>
        </div>

        <div class="analysis-insights">
          <h4>分析洞察</h4>
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="insight-item">
                <div class="insight-title">模型性能</div>
                <div class="insight-value">
                  R² =
                  {{
                    currentAnalysis.data.model_performance.r2_score.toFixed(3)
                  }}
                </div>
                <div class="insight-desc">决定系数，越接近1越好</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="insight-item">
                <div class="insight-title">预测趋势</div>
                <div class="insight-value">
                  {{
                    getPredictionTrend(
                      currentAnalysis.data.prediction.predicted_scores,
                    )
                  }}
                </div>
                <div class="insight-desc">未来7天睡眠质量变化</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="insight-item">
                <div class="insight-title">特征重要性</div>
                <div class="insight-value">睡眠时长 > 星期几 > 时间趋势</div>
                <div class="insight-desc">基于模型系数排序</div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div class="recommendations">
          <h4>个性化建议</h4>
          <el-alert
            v-for="(rec, index) in currentAnalysis.data.recommendations"
            :key="index"
            :title="rec"
            type="info"
            :closable="false"
            show-icon
            class="recommendation-item"
          />
        </div>
      </el-card>

      <!-- 睡眠运动关联性 -->
      <el-card
        v-if="analysisForm.analysis_type === 'sleep_sport_correlation'"
        class="analysis-card"
      >
        <template #header>
          <div class="card-header">
            <span>睡眠运动关联性分析</span>
            <el-tag
              :type="
                getCorrelationType(currentAnalysis.data.correlation_coefficient)
              "
            >
              相关系数:
              {{ currentAnalysis.data.correlation_coefficient.toFixed(3) }}
            </el-tag>
          </div>
        </template>

        <div class="chart-container">
          <div ref="correlationChart" class="chart"></div>
        </div>

        <div class="analysis-insights">
          <h4>关联性分析</h4>
          <el-row :gutter="20">
            <el-col :span="12">
              <div class="correlation-strength">
                <div class="strength-title">关联强度</div>
                <div class="strength-value">
                  {{ currentAnalysis.data.correlation_strength }}
                </div>
                <div class="strength-desc">
                  {{
                    getCorrelationDescription(
                      currentAnalysis.data.correlation_coefficient,
                    )
                  }}
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="group-analysis">
                <div class="group-title">分组分析</div>
                <div class="group-items">
                  <div
                    v-for="(score, group) in currentAnalysis.data
                      .group_analysis"
                    :key="group"
                    class="group-item"
                  >
                    <span class="group-name">{{ group }}</span>
                    <span class="group-score">{{
                      score?.toFixed(1) || 'N/A'
                    }}</span>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div class="recommendations">
          <h4>运动建议</h4>
          <el-alert
            v-for="(rec, index) in currentAnalysis.data.recommendations"
            :key="index"
            :title="rec"
            type="success"
            :closable="false"
            show-icon
            class="recommendation-item"
          />
        </div>
      </el-card>

      <!-- 健康趋势分析 -->
      <el-card
        v-if="analysisForm.analysis_type === 'health_trend'"
        class="analysis-card"
      >
        <template #header>
          <div class="card-header">
            <span>健康趋势分析</span>
            <el-tag type="primary">
              综合评分: {{ currentAnalysis.data.overall_score.toFixed(1) }}
            </el-tag>
          </div>
        </template>

        <div class="chart-container">
          <div ref="trendChart" class="chart"></div>
        </div>

        <div class="analysis-insights">
          <h4>趋势分析</h4>
          <el-row :gutter="20">
            <el-col
              :span="8"
              v-for="(trend, dimension) in currentAnalysis.data.trends"
              :key="dimension"
            >
              <div class="trend-item">
                <div class="trend-title">{{ getDimensionName(dimension) }}</div>
                <div
                  class="trend-value"
                  :class="{
                    improving: trend.improvement,
                    declining: !trend.improvement,
                  }"
                >
                  {{ trend.improvement ? '改善' : '下降' }}
                </div>
                <div class="trend-desc">
                  {{ getTrendDescription(dimension, trend) }}
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div class="recommendations">
          <h4>健康建议</h4>
          <el-alert
            v-for="(rec, index) in currentAnalysis.data.recommendations"
            :key="index"
            :title="rec"
            type="warning"
            :closable="false"
            show-icon
            class="recommendation-item"
          />
        </div>
      </el-card>
    </div>

    <!-- 历史分析结果 -->
    <el-card class="history-card">
      <template #header>
        <div class="card-header">
          <span>历史分析结果</span>
        </div>
      </template>

      <el-table :data="analysisHistory" style="width: 100%">
        <el-table-column
          prop="analysis_type_display"
          label="分析类型"
          width="180"
        />
        <el-table-column prop="updated_at" label="分析时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="viewAnalysis(scope.row)">
              查看
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="deleteAnalysis(scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.data-analysis-container {
  min-height: 100vh;
  padding: 20px;
  background-color: #f5f7fa;
}

.page-header {
  margin-bottom: 30px;
  text-align: center;
}

.page-header h1 {
  margin-bottom: 10px;
  color: #303133;
}

.page-header p {
  font-size: 14px;
  color: #909399;
}

.summary-cards {
  margin-bottom: 30px;
}

.summary-card {
  height: 120px;
}

.summary-item {
  display: flex;
  align-items: center;
  height: 100%;
}

.summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  margin-right: 15px;
  font-size: 24px;
  color: white;
  border-radius: 50%;
}

.sleep-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.sport-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.diet-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.overall-icon {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.summary-content {
  flex: 1;
}

.summary-title {
  margin-bottom: 5px;
  font-size: 14px;
  color: #909399;
}

.summary-value {
  font-size: 28px;
  font-weight: bold;
  line-height: 1;
  color: #303133;
}

.summary-unit {
  margin-top: 2px;
  font-size: 12px;
  color: #c0c4cc;
}

.analysis-control-panel {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.analysis-card {
  margin-bottom: 30px;
}

.chart-container {
  height: 400px;
  margin: 20px 0;
}

.chart {
  width: 100%;
  height: 100%;
}

.analysis-insights {
  margin: 30px 0;
}

.analysis-insights h4 {
  margin-bottom: 20px;
  color: #303133;
}

.insight-item,
.trend-item {
  padding: 20px;
  text-align: center;
  background: #f8f9fa;
  border-radius: 8px;
}

.insight-title,
.trend-title {
  margin-bottom: 10px;
  font-size: 14px;
  color: #909399;
}

.insight-value,
.trend-value {
  margin-bottom: 5px;
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.insight-desc,
.trend-desc {
  font-size: 12px;
  color: #c0c4cc;
}

.improving {
  color: #67c23a;
}

.declining {
  color: #f56c6c;
}

.correlation-strength,
.group-analysis {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.strength-title,
.group-title {
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.strength-value {
  margin-bottom: 10px;
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
}

.strength-desc {
  font-size: 14px;
  color: #606266;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.group-item:last-child {
  border-bottom: none;
}

.group-name {
  font-size: 14px;
  color: #606266;
}

.group-score {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.recommendations {
  margin-top: 30px;
}

.recommendations h4 {
  margin-bottom: 15px;
  color: #303133;
}

.recommendation-item {
  margin-bottom: 10px;
}

.history-card {
  margin-top: 30px;
}
</style>
