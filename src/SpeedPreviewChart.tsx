import React from "react";
import { Line } from "react-chartjs-2";
import { Box, Modal, Typography } from "@mui/material";

interface SpeedPreviewChartProps {
  open: boolean;
  onClose: () => void;
  speedData: number[];
  duration: number; // Add duration prop
}

const SpeedPreviewChart: React.FC<SpeedPreviewChartProps> = ({ open, onClose, speedData, duration }) => {
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

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ width: 600, margin: "auto", marginTop: "10%", padding: 2, backgroundColor: "white", borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Speed Preview
        </Typography>
        <Line data={data} />
      </Box>
    </Modal>
  );
};

export default SpeedPreviewChart;