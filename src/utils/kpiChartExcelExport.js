import * as XLSX from "xlsx";

function slugFileName(title) {
  return String(title || "chart")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function downloadWorkbook(wb, title) {
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${slugFileName(title)}-${date}.xlsx`);
}

/** Grouped / stacked bar chart (Chart.js shape: labels + datasets[]). */
export function exportGroupedBarChartDataToExcel(title, chartData) {
  const labels = chartData?.labels || [];
  const datasets = chartData?.datasets || [];
  const headers = ["Category", ...datasets.map((d, i) => d.label || `Series ${i + 1}`)];
  const rows = labels.map((label, rowIndex) => {
    const row = { Category: label };
    datasets.forEach((ds, di) => {
      const col = ds.label || `Series ${di + 1}`;
      row[col] = Number(ds.data?.[rowIndex]) || 0;
    });
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  downloadWorkbook(wb, title);
}

/** Donut / pie chart (Chart.js shape: labels + datasets[0].data). */
export function exportDonutChartDataToExcel(title, chartData) {
  const labels = chartData?.labels || [];
  const values = chartData?.datasets?.[0]?.data || [];
  const sum = values.reduce((acc, v) => acc + (Number(v) || 0), 0) || 1;
  const rows = labels.map((label, i) => {
    const value = Number(values[i]) || 0;
    const pct = ((value / sum) * 100).toFixed(2);
    return {
      "Share Type": label,
      "Value (M)": value,
      "Percentage (%)": Number(pct),
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  downloadWorkbook(wb, title);
}

/** Single-series bar chart (ReportsBarChart shape: labels + datasets.label + datasets.data). */
export function exportSingleSeriesBarChartToExcel(title, chart) {
  const labels = chart?.labels || [];
  const seriesLabel = chart?.datasets?.label || "Value";
  const data = chart?.datasets?.data || [];
  const rows = labels.map((label, i) => ({
    Category: label,
    [seriesLabel]: Number(data[i]) || 0,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  downloadWorkbook(wb, title);
}
