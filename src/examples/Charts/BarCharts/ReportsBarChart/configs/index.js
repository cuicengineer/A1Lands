/**
=========================================================
* Material Dashboard 2  React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

function configs(labels, datasets) {
  // Use custom colors if provided (array or single color), otherwise use default white
  const backgroundColor = datasets.backgroundColor
    ? datasets.backgroundColor
    : "rgba(255, 255, 255, 0.8)";

  return {
    data: {
      labels,
      datasets: [
        {
          label: datasets.label,
          tension: 0.4,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
          backgroundColor: backgroundColor,
          data: datasets.data,
          maxBarThickness: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
      scales: {
        y: {
          title: {
            display: true,
            color: "#000000",
            font: {
              size: 14,
              weight: 700,
              family: "Roboto",
            },
            padding: { top: 0, left: 0, right: 0, bottom: 10 },
          },
          grid: {
            drawBorder: false,
            display: true,
            drawOnChartArea: true,
            drawTicks: false,
            borderDash: [5, 5],
            color: "rgba(255, 255, 255, .2)",
          },
          ticks: {
            suggestedMin: 0,
            suggestedMax: 500,
            beginAtZero: true,
            padding: 10,
            font: {
              size: 14,
              weight: 300,
              family: "Roboto",
              style: "normal",
              lineHeight: 0.9,
            },
            color: "#fff",
            callback: function (value) {
              if (value >= 1000) {
                const millions = value / 1000000;
                // Show 1 decimal place for values >= 1M, 2 decimal places for values < 1M
                return millions.toFixed(millions >= 1 ? 1 : 2) + "M";
              }
              return value;
            },
          },
        },
        x: {
          title: {
            display: true,
            color: "#FFFFFF",
            font: {
              size: 14,
              weight: 700,
              family: "Roboto",
            },
            padding: { top: 10, left: 0, right: 0, bottom: 0 },
          },
          grid: {
            drawBorder: false,
            display: true,
            drawOnChartArea: true,
            drawTicks: false,
            borderDash: [5, 5],
            color: "rgba(255, 255, 255, .2)",
          },
          ticks: {
            display: true,
            color: "#f8f9fa",
            padding: 10,
            font: {
              size: 14,
              weight: 300,
              family: "Roboto",
              style: "normal",
              lineHeight: 0.9,
            },
          },
        },
      },
    },
  };
}

export default configs;
