import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Box, Modal, Typography, Button, TextField, Slider, useMediaQuery} from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SpeedPreviewChartProps {
  open: boolean;
  onClose: () => void;
  speedData: number[];
  // Saves the inputs for the App.tsx to use
  onSave: (speedData: number[], startSpeed: number, endSpeed: number, duration: number, motorModel: string, propellerModel: string) => void;
  acceleration: number;
  setAcceleration: (acceleration: number) => void;
}

// Props are passed from App.tsx
const SpeedPreviewChart: React.FC<SpeedPreviewChartProps> = ({ open, onClose, speedData: initialSpeedData, onSave, acceleration, setAcceleration}) => {
  const [startSpeed, setStartSpeed] = useState(1200);
  const [endSpeed, setEndSpeed] = useState(1400);
  const [duration, setDuration] = useState(5);
  const [speedData, setSpeedData] = useState<number[]>(initialSpeedData);
  const [motorModel, setMotorModel] = useState("");
  const [propellerModel, setPropellerModel] = useState("");


  const [isAccelerationOn, setIsAccelOn] = useState(false);

  // Tried to do adaptive design. Fucked up, didn't try again.
  const isSmallScreen = useMediaQuery('(max-width:600px)');

  // Dynamically calculates the speed for the preview chart depending on start/end speed and duration
  // Acceleration is used so the speed changes not lineary (optional)  
  useEffect(() => {
    if (!startSpeed || !endSpeed || !duration) return;
    const durationMs = duration * 1000;
    const data = [];
    for (let elapsed = 0; elapsed <= durationMs; elapsed += 100) {
      let progress;
      if (acceleration === 0) {
        progress = elapsed / durationMs;
      } else if (acceleration > 0) {
        progress = Math.pow(elapsed / durationMs, 1 / acceleration);
      } else {
        progress = Math.pow(elapsed / durationMs, -acceleration);
      }
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      data.push(currentSpeed);
    }
    setSpeedData(data);
    // I am an idiot and I don't know how to get the data from here to the useEPS hook
    // So it just sends that data to the local storage and later useESP hook parses it from there 
    localStorage.setItem('speedData', JSON.stringify(data));
  }, [startSpeed, endSpeed, duration, acceleration]);

  const labels = speedData.map((_, index) => {
    const elapsedTime = (index * duration) / speedData.length;
    const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsedTime % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
  
  // ChartJS data and options
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

    scales: {
      x: {
        type: 'category',
        labels: labels,
      },
      y: {
        beginAtZero: true,
      },
      maintainaspectratio: false,
    },
  };

  // Toggles acceleration slider visibility on/off
  const handleToggleAcceleration = () => {
    setIsAccelOn(!isAccelerationOn);
    if (isAccelerationOn) {
      setAcceleration(1);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="speed-preview-chart-container">
        <Box className="speed-preview-chart">

          <Typography variant="h4" gutterBottom mt={1} align="center" style={{ fontWeight: 'bold' }}>
            INPUTS
          </Typography>
          <Box>
            <Line data={data} options={options as any} />
          </Box>
          {isAccelerationOn && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
              <Slider
                sx={{ width: '95%' }} // Add margin top and bottom
                value={acceleration}
                onChange={(_, newValue) => setAcceleration(newValue as number)}
                min={0.02}
                max={5}
                step={0.01}
              />
            </Box>
          )}
          <Box
            sx={{
              display: "flex",
              flexDirection: isSmallScreen ? "column" : "row",
              alignItems: "center",
              mt: 0,
              boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
              padding: 1,
              borderRadius: 1,
              marginBottom: 1,
            }}
          >
            <Button
            onClick={() => {handleToggleAcceleration(); if (!isAccelerationOn) {
              setAcceleration(0.02);
            }}}
            variant="contained"
            size="small"
            sx={{
              mr: 2,
              mt: 1,
              borderRadius: 20,
              backgroundColor: isAccelerationOn ? 'green' : 'red',
              '&:hover': {
                backgroundColor: isAccelerationOn ? 'darkgreen' : 'darkred',
              },
            }}
          >
            Acceleration
          </Button>
            <TextField
              label="Start Speed"
              type="number"
              value={startSpeed}
              onChange={(e) => setStartSpeed(Number(e.target.value) === 0 ? 1 : Number(e.target.value))}
              fullWidth
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: isSmallScreen ? "100%" : "12%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <TextField
              label="End Speed"
              type="number"
              value={endSpeed}
              onChange={(e) => setEndSpeed(Number(e.target.value))}
              fullWidth
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: isSmallScreen ? "100%" : "12%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Duration (seconds)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              fullWidth
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: isSmallScreen ? "100%" : "12%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Motor Model"
              type="text"
              value={motorModel}
              onChange={(e) => setMotorModel(e.target.value)}
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: isSmallScreen ? "100%" : "22%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Propeller Model"
              type="text"
              value={propellerModel}
              onChange={(e) => setPropellerModel(e.target.value)}
              fullWidth
              margin="normal"
              size="small"
              sx={{ width: isSmallScreen ? "100%" : "22%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <div className="close-icon-container">
              <svg className="close-icon" viewBox="0 0 24 24" onClick={() => {onSave(speedData, startSpeed, endSpeed, duration, motorModel, propellerModel)} }>
                <polyline points="20 6 9 17 4 12" fill="none" style={{ strokeWidth: '4' }} />
              </svg>
            </div>
            
          </Box>
        </Box>
      </div>
    </Modal>
  );
};


export default SpeedPreviewChart;