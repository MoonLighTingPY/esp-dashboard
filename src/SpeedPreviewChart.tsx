import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Box, Modal, Typography, Button, TextField, Slider, useMediaQuery, Autocomplete} from "@mui/material";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SpeedPreviewChartProps {
  open: boolean;
  onClose: () => void;
  speedData: number[];
  // Saves the inputs for the App.tsx to use
  onSave: (speedData: number[], startSpeed: number, endSpeed: number, duration: number, motorModel: string, propellerModel: string, escModel: string, componentsData: { motors: any[], propellers: any[], escs: any[] }, pdfComment: string) => void
  acceleration: number;
  setAcceleration: (acceleration: number) => void;
  socket: WebSocket | null;
}

// Props are passed from App.tsx
const SpeedPreviewChart: React.FC<SpeedPreviewChartProps> = ({ open, onClose, speedData: initialSpeedData, onSave, acceleration, setAcceleration, socket}) => {
  const [startSpeed, setStartSpeed] = useState(1200);
  const [endSpeed, setEndSpeed] = useState(1400);
  const [duration, setDuration] = useState(5);
  const [speedData, setSpeedData] = useState<number[]>(initialSpeedData);
  const [motorModel, setMotorModel] = useState("");
  const [propellerModel, setPropellerModel] = useState("");
  const [escModel, setEscModel] = useState("");
  const [pdfComment, setPdfComent] = useState("");
  const [isAccelerationOn, setIsAccelOn] = useState(false);
  const [componentsData, setComponentsData] = useState<{ motors: any[], propellers: any[], escs: any[] }>({ motors: [], propellers: [], escs: [] });

  // Autocomplete options from components_data.json(motors, propellers, escs)
  const [motorOptions, setMotorOptions] = useState(componentsData.motors || []);
  const [propellerOptions, setPropellerOptions] = useState(componentsData.propellers || []);
  const [escOptions, setEscOptions] = useState(componentsData.escs || []);


  // Tried to do adaptive design. Fucked up, didn't try again.
  const isSmallScreen = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://esp32-motortester.local/assets/components_data.json');
        if (!response.ok) {
          throw new Error('Failed to fetch components data');
        }
        const data = await response.json();
  
        // Remove duplicates
        const uniqueMotors = Array.from(new Set(data.motors.map((motor: any) => motor.model)))
          .map(model => data.motors.find((motor: any) => motor.model === model));
  
        const uniquePropellers = Array.from(new Set(data.propellers.map((propeller: any) => propeller.model)))
          .map(model => data.propellers.find((propeller: any) => propeller.model === model));
  
        const uniqueEscs = Array.from(new Set(data.escs.map((esc: any) => esc.model)))
          .map(model => data.escs.find((esc: any) => esc.model === model));
  
        const uniqueComponentsData = {
          motors: uniqueMotors,
          propellers: uniquePropellers,
          escs: uniqueEscs,
        };
        setComponentsData(uniqueComponentsData);
        console.log("Models DB fetched:", uniqueComponentsData);
        setMotorOptions(uniqueComponentsData.motors);
        setMotorModel('');
        setPropellerOptions(uniqueComponentsData.propellers);
        setEscOptions(uniqueComponentsData.escs);
      } catch (error) {
        console.error('Error fetching components data:', error);
        // Retry fetching after 5 seconds
        setTimeout(fetchData, 5000);
      }
    };
  
    fetchData();
  }, []);


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
    },
  };

  const fetchModels = () => {
    fetch('http://esp32-motortester.local/used_models.json')
      .then(response => response.json())
      .then(data => {
        const newMotors = data.motors.filter((model: string) => 
          !componentsData.motors.some(existingModel => existingModel.model === model)
        ).map((model: string) => ({ model }));

        const newPropellers = data.propellers.filter((model: string) => 
          !componentsData.propellers.some(existingModel => existingModel.model === model)
        ).map((model: string) => ({ model }));

        const newEscs = data.escs.filter((model: string) => 
          !componentsData.escs.some(existingModel => existingModel.model === model)
        ).map((model: string) => ({ model }));

        setComponentsData(prevData => ({
          motors: [...prevData.motors, ...newMotors],
          propellers: [...prevData.propellers, ...newPropellers],
          escs: [...prevData.escs, ...newEscs],
        }));
      })
      .catch(error => {
        console.error('Error fetching models:', error);
        // Retry after 1 second
        setTimeout(fetchModels, 1000);
      });
  };

  // Toggles acceleration slider visibility on/off
  const handleToggleAcceleration = () => {
    setIsAccelOn(!isAccelerationOn);
    if (isAccelerationOn) {
      setAcceleration(1);
    }
  };

  

  const handleSave = () => {
    const newModels: any = {};

    if (motorModel && !componentsData.motors.some(motor => motor.model === motorModel)) {
      newModels.motors = motorModel;
    }

    if (propellerModel && !componentsData.propellers.some(propeller => propeller.model === propellerModel)) {
      newModels.propellers = propellerModel;
    }

    if (escModel && !componentsData.escs.some(esc => esc.model === escModel)) {
      newModels.escs = escModel;
    }

    if (Object.keys(newModels).length > 0 && socket) {
      socket.send(JSON.stringify({
        type: "updateUsedModels",
        motors: newModels.motors, 
        propellers: newModels.propellers,
        escs: newModels.escs,
        
      }));
    }


    onSave(speedData, startSpeed, endSpeed, duration, motorModel, propellerModel, escModel, componentsData, pdfComment);
    setTimeout(fetchModels, 100);
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
            ACCEL
          </Button>
            <TextField
              label="Start RPM"
              type="number"
              value={startSpeed}
              onChange={(e) => setStartSpeed(Number(e.target.value) === 0 ? 1 : Number(e.target.value))}
              fullWidth
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: "13%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <TextField
              label="End RPM"
              type="number"
              value={endSpeed}
              onChange={(e) => setEndSpeed(Number(e.target.value))}
              fullWidth
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: "13%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Duration (sec.)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              fullWidth
              margin="normal"
              size="small"
              sx={{ marginRight: 2, width: "13%", "& .MuiInputBase-root": { borderRadius: 4 } }}
            />
            <Autocomplete
            className = "model-input"
            options={motorOptions.map(option => option.model)}
            freeSolo
            onInputChange={(_, newInputValue) => {
              setMotorOptions(componentsData.motors.filter(motor => motor.model.toLowerCase().includes(newInputValue.toLowerCase())));
              fetchModels();
            }}
            onChange={(_, newValue) => {
              setMotorModel(newValue as string);
              
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Motor Model"
                type="text"
                value={motorModel}
                onChange={(e) => setMotorModel(e.target.value)}
                margin="normal"
                size="small"
                sx={{ width: "100%", "& .MuiInputBase-root": { borderRadius: 4 } }}
              />
            )}
          />
          <Autocomplete
            className = "model-input"
            options={propellerOptions.map(option => option.model)}
            freeSolo
            onInputChange={(_, newInputValue) => {
              setPropellerOptions(componentsData.propellers.filter(propeller => propeller.model.toLowerCase().includes(newInputValue.toLowerCase())));
              fetchModels();
            }}
            onChange={(_, newValue) => {
              setPropellerModel(newValue as string);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Propeller Model"
                type="text"
                value={propellerModel}
                onChange={(e) => setPropellerModel(e.target.value)}
                fullWidth
                margin="normal"
                size="small"
                sx={{ width: "100%", "& .MuiInputBase-root": { borderRadius: 4 } }}
              />
            )}
          />
          <Autocomplete
            className = "model-input"
            options={escOptions.map(option => option.model)}
            freeSolo
            onInputChange={(_, newInputValue) => {
              setEscOptions(componentsData.escs.filter(esc => esc.model.toLowerCase().includes(newInputValue.toLowerCase())));
              fetchModels();
            }}
            onChange={(_,  newValue) => {
              setEscModel(newValue as string);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="ESC Model"
                type="text"
                value={escModel}
                onChange={(e) => setEscModel(e.target.value)}
                fullWidth
                margin="normal"
                size="small"
                sx={{ width: "100%", "& .MuiInputBase-root": { borderRadius: 4 } }}
              />
            )}
          />
              <TextField
                label="Report Comment"
                type="text"
                value={pdfComment}
                onChange={(e) => setPdfComent(e.target.value)}

                margin="normal"
                size="small"
                sx={{"& .MuiInputBase-root": { borderRadius: 4 } }}
              />

            <div className="close-icon-container">
              <svg className="close-icon" viewBox="0 0 24 24" onClick={handleSave}>
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