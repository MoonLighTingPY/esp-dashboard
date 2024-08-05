// src/SpeedPreviewChart.tsx
import React from "react";
import { Line } from "react-chartjs-2";
import { Box, Modal, Typography, Button } from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import dragDataPlugin from "chartjs-plugin-dragdata";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, dragDataPlugin);

interface SpeedPreviewChartProps {
  open: boolean;
  onClose: () => void;
  speedData: number[];
  duration: number;
  onSave: (speedData: number[]) => void; // Add onSave prop
}

const SpeedPreviewChart: React.FC<SpeedPreviewChartProps> = ({ open, onClose, speedData, duration, onSave }) => {
  // Generate labels based on duration
  const labels = Array.from({ length: speedData.length }, (_, index) => {
    const elapsedTime = (index * duration) / speedData.length;
    const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsedTime % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Speed",
        data: speedData,
        borderColor: "rgba(255, 206, 86, 1)",
        backgroundColor: "rgba(255, 206, 86, 0.2)",
      },
    ],
  };

  const options = {
    plugins: {
      dragData: {
        round: 1,
        showTooltip: true,
        onDragEnd: (e: any, datasetIndex: number, index: number, value: number) => {
          speedData[index] = value;
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        labels: labels,
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ width: 600, margin: "auto", marginTop: "10%", padding: 2, backgroundColor: "white", borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Speed Preview
        </Typography>
        <Line data={data} options={options} />
        <Button onClick={() => onSave(speedData)} variant="contained" color="primary" sx={{ mt: 2 }}>
          Save
        </Button>
      </Box>
    </Modal>
  );
};

export default SpeedPreviewChart;