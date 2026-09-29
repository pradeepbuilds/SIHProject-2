import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Download, Table, BarChart2 } from 'lucide-react';

interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (val: any) => string;
}

interface EChartCardProps {
  id: string;
  title: string;
  takeaway: string;
  option: echarts.EChartsOption | null;
  tableColumns?: TableColumn[];
  tableData?: any[];
  csvFilename?: string;
  loading?: boolean;
  dataModeBadge?: string;
}

export const EChartCard: React.FC<EChartCardProps> = ({
  id,
  title,
  takeaway,
  option,
  tableColumns = [],
  tableData = [],
  csvFilename = 'chart-data.csv',
  loading = false,
  dataModeBadge = 'Synthetic-world result'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  // Initialize and update ECharts
  useEffect(() => {
    if (!chartRef.current || viewMode !== 'chart') return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas'
      });
    }

    if (option) {
      chartInstance.current.setOption(option, true);
    }

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [option, viewMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  const handleExportCSV = () => {
    if (!tableColumns.length || !tableData.length) return;
    const headers = tableColumns.map((c) => `"${c.label}"`).join(',');
    const rows = tableData.map((row) =>
      tableColumns
        .map((col) => {
          const val = col.format ? col.format(row[col.key]) : row[col.key];
          return typeof val === 'number' ? val : `"${val}"`;
        })
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', csvFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="km-chart-card" id={id}>
      <div className="km-chart-header">
        <div className="km-chart-titles">
          <div className="km-chart-super">
            <span className="km-chart-category">{title}</span>
            {dataModeBadge && <span className="km-chip-caveat">{dataModeBadge}</span>}
          </div>
          <h4 className="km-chart-takeaway">{takeaway}</h4>
        </div>
        <div className="km-chart-actions">
          {tableColumns.length > 0 && tableData.length > 0 && (
            <button
              type="button"
              className="km-btn km-btn-xs km-btn-ghost"
              onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
              title={viewMode === 'chart' ? 'Switch to accessible table' : 'Switch to chart'}
            >
              {viewMode === 'chart' ? (
                <>
                  <Table size={14} />
                  <span>View as table</span>
                </>
              ) : (
                <>
                  <BarChart2 size={14} />
                  <span>View as chart</span>
                </>
              )}
            </button>
          )}

          {tableColumns.length > 0 && (
            <button
              type="button"
              className="km-btn km-btn-xs km-btn-ghost"
              onClick={handleExportCSV}
              title="Download CSV"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      <div className="km-chart-body">
        {loading ? (
          <div className="km-chart-loading">
            <div className="km-spinner"></div>
            <span>Loading analytics...</span>
          </div>
        ) : viewMode === 'table' && tableColumns.length > 0 ? (
          <div className="km-chart-table-container">
            <table className="km-table km-table-dense">
              <thead>
                <tr>
                  {tableColumns.map((c) => (
                    <th key={c.key} className={c.align === 'right' ? 'km-text-right' : ''}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {tableColumns.map((col) => (
                      <td
                        key={col.key}
                        className={col.align === 'right' ? 'km-text-right km-cell-num' : ''}
                      >
                        {col.format ? col.format(row[col.key]) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={chartRef} className="km-echart-dom" style={{ width: '100%', height: '320px' }} />
        )}
      </div>
    </div>
  );
};
