import React, { useMemo } from 'react';
import type * as echarts from 'echarts';
import type { StripItem } from '../types/api';
import { EChartCard } from './EChartCard';
import { formatDateLocale, type SupportedLanguage } from '../i18n';

interface FarmerTrendChartProps {
  stripData: StripItem[];
  lang: SupportedLanguage;
}

export const FarmerTrendChart: React.FC<FarmerTrendChartProps> = ({ stripData, lang }) => {
  const chartOption: echarts.EChartsOption = useMemo(() => {
    if (!stripData || stripData.length === 0) return {};

    const dates = stripData.map((d) => formatDateLocale(d.date, lang).split(' ')[0]);
    const maxTemps = stripData.map((d) => Math.round(d.temp_max?.value ?? d.temp_max?.prediction ?? d.temp_max?.uncertainty_interval?.p50 ?? 30));
    const minTemps = stripData.map((d) => Math.round(d.temp_min?.value ?? d.temp_min?.prediction ?? d.temp_min?.uncertainty_interval?.p50 ?? 20));
    const rainMm = stripData.map((d) => Number((d.rainfall?.rainfall_mm ?? d.rainfall?.value ?? 0).toFixed(1)));
    const rainProb = stripData.map((d) => Math.round((d.rainfall?.rain_probability ?? 0.1) * 100));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Max Temp (°C)', 'Min Temp (°C)', 'Rainfall (mm)', 'Rain Chance (%)'],
        top: 0,
        textStyle: { fontSize: 11, color: '#4B5563' }
      },
      grid: {
        top: 40,
        right: 48,
        bottom: 30,
        left: 40
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#9CA3AF' } },
        axisLabel: { fontSize: 12, fontWeight: 'bold' }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Temp (°C)',
          min: (val: any) => Math.floor(Math.min(val.min, 15) / 5) * 5,
          max: (val: any) => Math.ceil(Math.max(val.max, 40) / 5) * 5,
          axisLabel: { formatter: '{value}°C' },
          splitLine: { lineStyle: { type: 'dashed', color: '#E5E7EB' } }
        },
        {
          type: 'value',
          name: 'Rain (mm) / Prob (%)',
          min: 0,
          max: (val: any) => Math.max(val.max, 100),
          axisLabel: { formatter: '{value}' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Max Temp (°C)',
          type: 'line',
          data: maxTemps,
          smooth: true,
          lineStyle: { width: 3, color: '#DC2626' },
          itemStyle: { color: '#DC2626' },
          symbolSize: 8
        },
        {
          name: 'Min Temp (°C)',
          type: 'line',
          data: minTemps,
          smooth: true,
          lineStyle: { width: 3, color: '#2563EB' },
          itemStyle: { color: '#2563EB' },
          symbolSize: 8
        },
        {
          name: 'Rainfall (mm)',
          type: 'bar',
          yAxisIndex: 1,
          data: rainMm,
          itemStyle: {
            color: '#38BDF8',
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: '28%'
        },
        {
          name: 'Rain Chance (%)',
          type: 'line',
          yAxisIndex: 1,
          data: rainProb,
          smooth: true,
          lineStyle: { width: 2, type: 'dashed', color: '#0284C7' },
          itemStyle: { color: '#0284C7' },
          symbolSize: 6
        }
      ]
    };
  }, [stripData, lang]);

  const tableColumns = [
    { key: 'date', label: 'Date' },
    { key: 'tmax', label: 'Max Temp (°C)', align: 'right' as const },
    { key: 'tmin', label: 'Min Temp (°C)', align: 'right' as const },
    { key: 'rain', label: 'Rainfall (mm)', align: 'right' as const },
    { key: 'prob', label: 'Rain Prob (%)', align: 'right' as const }
  ];

  const tableData = useMemo(() => {
    return stripData.map((d) => ({
      date: formatDateLocale(d.date, lang),
      tmax: `${Math.round(d.temp_max?.value ?? d.temp_max?.prediction ?? 30)}°C`,
      tmin: `${Math.round(d.temp_min?.value ?? d.temp_min?.prediction ?? 20)}°C`,
      rain: `${(d.rainfall?.rainfall_mm ?? d.rainfall?.value ?? 0).toFixed(1)} mm`,
      prob: `${Math.round((d.rainfall?.rain_probability ?? 0.1) * 100)}%`
    }));
  }, [stripData, lang]);

  return (
    <EChartCard
      id="farmer-5day-trend"
      title="5-Day Agrometeorological Outlook"
      takeaway="Temperature range and expected precipitation window for field activities"
      option={chartOption}
      tableColumns={tableColumns}
      tableData={tableData}
      csvFilename="farmer-5day-trend.csv"
      dataModeBadge="Calibrated Local Outlook"
    />
  );
};
