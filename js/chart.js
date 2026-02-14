let meteogramChart;

export function renderMeteogram(canvasId, hourly, spanHours = 48) {
  const labels = hourly.time.slice(0, spanHours).map((t) => new Date(t).toLocaleString([], { hour: 'numeric', weekday: 'short' }));
  const tempData = hourly.temperature_2m.slice(0, spanHours);
  const precipData = hourly.precipitation_probability.slice(0, spanHours);
  const windData = hourly.wind_speed_10m.slice(0, spanHours);

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (meteogramChart) meteogramChart.destroy();

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(93, 213, 255, 0.55)');
  gradient.addColorStop(1, 'rgba(93, 213, 255, 0.02)');

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
          borderColor: '#7fe8ff',
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
          backgroundColor: 'rgba(162, 132, 255, 0.52)',
          borderRadius: 4,
          yAxisID: 'yPrecip'
        },
        {
          type: 'line',
          label: 'Wind (mph)',
          data: windData,
          borderColor: '#ffcc66',
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
        legend: { labels: { color: '#deebff', boxWidth: 14 } },
        tooltip: {
          backgroundColor: 'rgba(8, 12, 24, 0.96)',
          titleColor: '#f4f8ff',
          bodyColor: '#d9e5ff',
          borderColor: 'rgba(127,232,255,0.4)',
          borderWidth: 1
        }
      },
      scales: {
        x: { ticks: { color: '#9db3d4', autoSkip: true, maxTicksLimit: 8 }, grid: { color: 'rgba(123,145,181,0.12)' } },
        yTemp: { position: 'left', ticks: { color: '#9db3d4' }, grid: { color: 'rgba(123,145,181,0.2)' } },
        yPrecip: { position: 'right', min: 0, max: 100, ticks: { color: '#9db3d4' }, grid: { drawOnChartArea: false } }
      }
    },
    plugins: [{
      id: 'nowLine',
      afterDatasetsDraw(chart) {
        const { ctx: c, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(nowIndex);
        c.save();
        c.strokeStyle = 'rgba(255, 204, 102, 0.75)';
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
