import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Box, Modal, Typography, Button, TextField, Slider } from "@mui/material";
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
  const [startSpeed, setStartSpeed] = useState(800);
  const [endSpeed, setEndSpeed] = useState(1000);
  const [duration, setDuration] = useState(5);
  const [acceleration, setAcceleration] = useState(1);
  const [speedData, setSpeedData] = useState<number[]>(initialSpeedData);
  const [isAccelerationVisible, setIsAccelerationVisible] = useState(true);

  useEffect(() => {
    if (!startSpeed || !endSpeed || !duration) return;
    const durationMs = duration * 1000;
    const data = [];
    for (let elapsed = 0; elapsed <= durationMs; elapsed += 100) {
      let progress;
      if (acceleration === 0) {
        progress = elapsed / durationMs;
      } else if (acceleration > 0) {
        progress = Math.pow(elapsed / durationMs, acceleration);
      } else {
        progress = 1 - Math.pow(1 - elapsed / durationMs, -acceleration);
      }
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      data.push(currentSpeed);
    }
    setSpeedData(data);
  }, [startSpeed, endSpeed, duration, acceleration]);

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

  const handleToggleAcceleration = () => {
    setIsAccelerationVisible((prev) => !prev);
    if (isAccelerationVisible) {
      setAcceleration(0);
    }
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
          <Button onClick={handleToggleAcceleration} variant="contained" color="secondary" sx={{ ml: 2 }}>
            {isAccelerationVisible ? "Accel: ON" : "Accel: OFF"}
          </Button>
        </Box>
        {isAccelerationVisible && (
          <Slider
            value={acceleration}
            onChange={(_, newValue) => setAcceleration(newValue as number)}
            min={-5}
            max={5}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ mt: 2 }}
          />
        )}
        <Line data={data} options={options as any} />
        <Button onClick={() => onSave(speedData, startSpeed, endSpeed, duration)} variant="contained" color="primary" sx={{ mt: 2 }}>
          Save
        </Button>
      </Box>
    </Modal>
  );
};

export default SpeedPreviewChart;