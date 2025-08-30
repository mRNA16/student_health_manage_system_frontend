import { requestClient } from './request';

export interface AnalysisRequest {
  analysis_type:
    | 'calorie_analysis'
    | 'health_trend'
    | 'sleep_prediction'
    | 'sleep_quality_score'
    | 'sleep_sport_correlation';
  time_range?: '7d' | '30d' | '90d';
  include_predictions?: boolean;
}

export interface AnalysisResult {
  id: number;
  analysis_type: string;
  analysis_type_display: string;
  result_data: any;
  created_at: string;
  updated_at: string;
}

export interface HealthSummary {
  sleep: {
    avg_duration: number;
    avg_quality: number;
    best_day: null | string;
    total_records: number;
  };
  sport: {
    active_days: number;
    avg_duration: number;
    total_calories: number;
    total_records: number;
  };
  diet: {
    avg_calories: number;
    avg_meals: number;
    avg_variety: number;
    total_records: number;
  };
  overall_score: number;
}

// 健康数据分析
export function analyzeHealthData(data: {
  analysis_type:
    | 'calorie_analysis'
    | 'health_trend'
    | 'sleep_prediction'
    | 'sleep_quality_score'
    | 'sleep_sport_correlation';
  include_predictions?: boolean;
  time_range?: '7d' | '30d' | '90d';
}) {
  return requestClient.post('/analysis/analyze/', data);
}

// 获取分析结果列表
export function getAnalysisResults(params?: {
  analysis_type?: string;
  limit?: number;
}) {
  return requestClient.get('/analysis/results/', { params });
}

// 获取分析结果详情
export function getAnalysisDetail(analysisId: number) {
  return requestClient.get(`/analysis/results/${analysisId}/`);
}

// 获取健康数据摘要
export function getHealthSummary(timeRange?: '7d' | '30d' | '90d') {
  return requestClient.get('/analysis/summary/', {
    params: timeRange ? { time_range: timeRange } : undefined,
  });
}

// 删除分析结果
export function deleteAnalysisResult(analysisId: number) {
  return requestClient.delete(`/analysis/results/${analysisId}/delete/`);
}
