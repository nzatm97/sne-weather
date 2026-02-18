let meteogramChart;

function colorToken(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function renderMeteogram(canvasId, hourly, spanHours = 48) {
  const labels = hourly.time.slice(0, spanHours).map((t) => new Date(t).toLocaleString([], { hour: 'numeric', weekday: 'short' }));
  const tempData = hourly.temperature_2m.slice(0, spanHours);
  const precipData = hourly.precipitation_probability.slice(0, spanHours);
  const windData = hourly.wind_speed_10m.slice(0, spanHours);

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (meteogramChart) meteogramChart.destroy();

  const tempLine = colorToken('--chart-temp-line', '#7fe8ff');
  const precipBar = colorToken('--chart-precip-bar', 'rgba(162, 132, 255, 0.52)');
  const windLine = colorToken('--chart-wind-line', '#ffcc66');
  const tickColor = colorToken('--color-text-muted', '#9db3d4');
  const gridColor = colorToken('--chart-grid', 'rgba(123,145,181,0.18)');
  const legendColor = colorToken('--color-text-primary', '#deebff');
  const tooltipBg = colorToken('--color-bg-1', 'rgba(8, 12, 24, 0.96)');
  const tooltipText = colorToken('--color-text-primary', '#f4f8ff');
  const tooltipBorder = colorToken('--color-border-strong', 'rgba(127,232,255,0.4)');
  const nowLine = colorToken('--chart-now-line', 'rgba(255, 204, 102, 0.75)');

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, colorToken('--chart-temp-fill-strong', 'rgba(93, 213, 255, 0.55)'));
  gradient.addColorStop(1, colorToken('--chart-temp-fill-soft', 'rgba(93, 213, 255, 0.02)'));

  const nowIndex = 0;

  meteogramChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Temp (°F)',
          data: tempData,
          borderColor: tempLine,
          backgroundColor: gradient,
          fill: true,
          borderWidth: 2.5,
          tension: 0.35,
          yAxisID: 'yTemp',
          pointRadius: 0
        },
        {
          type: 'bar',
          label: 'Precip Prob (%)',
          data: precipData,
          backgroundColor: precipBar,
          borderRadius: 4,
          yAxisID: 'yPrecip'
        },
        {
          type: 'line',
          label: 'Wind (mph)',
          data: windData,
          borderColor: windLine,
          borderWidth: 2,
          tension: 0.28,
          pointRadius: 0,
          yAxisID: 'yTemp'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: legendColor, boxWidth: 14 } },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          borderColor: tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: { ticks: { color: tickColor, autoSkip: true, maxTicksLimit: 8 }, grid: { color: gridColor } },
        yTemp: { position: 'left', ticks: { color: tickColor }, grid: { color: gridColor } },
        yPrecip: { position: 'right', min: 0, max: 100, ticks: { color: tickColor }, grid: { drawOnChartArea: false } }
      }
    },
    plugins: [{
      id: 'nowLine',
      afterDatasetsDraw(chart) {
        const { ctx: c, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(nowIndex);
        c.save();
        c.strokeStyle = nowLine;
        c.lineWidth = 1.2;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(x, chartArea.top);
        c.lineTo(x, chartArea.bottom);
        c.stroke();
        c.restore();
      }
    }]
  });
}
