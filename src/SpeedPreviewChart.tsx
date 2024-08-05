import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Box, Modal, Typography, Button, TextField, Grid } from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import dragDataPlugin from 'chartjs-plugin-dragdata';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, dragDataPlugin);

interface SpeedPreviewChartProps {
  open: boolean;
  onClose: () => void;
  speedData: number[];
  onSave: (speedData: number[], startSpeed: number, endSpeed: number, duration: number) => void;
}

const SpeedPreviewChart: React.FC<SpeedPreviewChartProps> = ({ open, onClose, speedData: initialSpeedData, onSave }) => {
  const [startSpeed, setStartSpeed] = useState(0);
  const [endSpeed, setEndSpeed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedData, setSpeedData] = useState<number[]>(initialSpeedData);

  useEffect(() => {
    if (!startSpeed || !endSpeed || !duration) return;
    const durationMs = duration * 1000;
    const data = [];
    for (let elapsed = 0; elapsed <= durationMs; elapsed += 100) {
      const progress = elapsed / durationMs;
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      data.push(currentSpeed);
    }
    setSpeedData(data);
  }, [startSpeed, endSpeed, duration]);

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
        onDragEnd: (_e: any, _datasetIndex: number, index: number, value: number) => {
          const updatedSpeedData = [...speedData];
          updatedSpeedData[index] = value;
          setSpeedData(updatedSpeedData);
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
      <Box sx={{ width: 900, margin: "auto", marginTop: "10%", padding: 2, backgroundColor: "white", borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
          Speed Preview
        </Typography>
      <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                mt: 0,
              }}
            >
        
        <TextField
          label="Start Speed"
          type="number"
          value={startSpeed}
          onChange={(e) => setStartSpeed(Number(e.target.value))}
          fullWidth
          margin="normal"
        />
        <TextField
          label="End Speed"
          type="number"
          value={endSpeed}
          onChange={(e) => setEndSpeed(Number(e.target.value))}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Duration (seconds)"
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          fullWidth
          margin="normal"
        />
        </Box>
        <Line data={data} options={options as any} />
        <Button onClick={() => onSave(speedData, startSpeed, endSpeed, duration)} variant="contained" color="primary" sx={{ mt: 2 }}>
          Save
        </Button>
      </Box>
    </Modal>
  );
};

export default SpeedPreviewChart;