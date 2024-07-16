import './index.css'
import { useEffect, useRef, useState } from "react";
import { Button, TextField, Box, Grid, Typography } from "@mui/material";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { dataSchema, useESP } from "./useESP";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const addZero = (num: number) => (num < 10 ? `0${num}` : num);

const timePresets = [
  { label: "+5s", value: 5 },
  { label: "+15s", value: 15 },
  { label: "+30s", value: 30 },
  { label: "+1m", value: 60 },
];

const speedPresets = [
  { label: "+50", value: 50 },
  { label: "-50", value: -50 },
  { label: "+100", value: 100 },
  { label: "-100", value: -100 },
];

const App = () => {
  const chartRef = useRef(null);
  const [stats, setStats] = useState({
    
    thrustMax: 0,
    thrustMin: 0,
    torqueMax: 0,
    torqueMin: 0,
    voltageMax: 0,
    voltageMin: 0,
    currentMax: 0,
    currentMin: 0,
  });
  const [motorModel, setMotorModel] = useState("");
  const [propellerModel, setPropellerModel] = useState("");
  const [isValidInputs, setIsValidInputs] = useState(false);

  const {
    duration,
    socket,
    setSocket,
    dataQueue,
    speed,
    setData,
    startTime,
    setSpeed,
    setDuration,
    handleStartReadings,
    isTestRunning,
    handleStopReadings,
    handleClearGraph,
    data,
  } = useESP();


  // Connect to the WebSocket server
  useEffect(() => {
    const ws = new WebSocket("ws://esp32-motortester:8080");
    setSocket(ws);

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Listen for incoming messages from the WebSocket server
  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event) => {
      const newData = JSON.parse(event.data);

      const parsed = dataSchema.safeParse(newData);

      if (!parsed.success) {
        return alert("Fetched data in wrong format");
      }

      dataQueue.current.push(parsed.data);

      // Update the stats for max and min values
      setStats((prevStats) => ({
        thrustMax: Math.max(prevStats.thrustMax, parsed.data.thrust),
        thrustMin: Math.min(prevStats.thrustMin, parsed.data.thrust),
        torqueMax: Math.max(prevStats.torqueMax, parsed.data.torque),
        torqueMin: Math.min(prevStats.torqueMin, parsed.data.torque),
        voltageMax: Math.max(prevStats.voltageMax, parsed.data.voltage),
        voltageMin: Math.min(prevStats.voltageMin, parsed.data.voltage),
        currentMax: Math.max(prevStats.currentMax, parsed.data.current),
        currentMin: Math.min(prevStats.currentMin, parsed.data.current),
      }));
    };
  }, [socket]);

  // Refresh the graph data every 100ms
  useEffect(() => {
    const intervalId = setInterval(refreshGraphData, 100);

    return () => clearInterval(intervalId);
  }, [startTime]);

  
  useEffect(() => {
    setIsValidInputs(!!speed && !!duration && !!motorModel && !!propellerModel);
  }, [speed, duration, motorModel, propellerModel]);

  const refreshGraphData = () => {
    if (dataQueue.current.length <= 0) return;

    const batchData = dataQueue.current;
    dataQueue.current = [];

    const averages = batchData.reduce((acc, curr) => {
      Object.keys(curr).forEach((key) => {
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(curr[key]);
      });
      return acc;
    }, {});

    Object.keys(averages).forEach((key) => {
      averages[key] =
        averages[key].reduce((a: any, b: any) => a + b, 0) / averages[key].length;
    });

    const currentTime = new Date().getTime();

    const timeElapsedInSeconds = Math.floor(
      (currentTime - (startTime || currentTime)) / 1000
    );

    const minutes = addZero(Math.floor(timeElapsedInSeconds / 60));
    const seconds = addZero(timeElapsedInSeconds % 60);

    setData((prevData) => ({
      ...prevData,
      labels: [...prevData.labels, `${minutes}:${seconds}`],
      datasets: prevData.datasets.map((dataset, index) => ({
        ...dataset,
        data: [...dataset.data, averages[Object.keys(averages)[index]]],
      })),
    }));
  };

  const handleSaveAsPDF = async () => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const canvas = await html2canvas(chartElement);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // Add chart image to PDF
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    // Add stats to PDF
    const statsText = `THRUST Max: ${stats.thrustMax} Min: ${stats.thrustMin}
    TORQUE Max: ${stats.torqueMax} Min: ${stats.torqueMin}
    VOLTAGE Max: ${stats.voltageMax} Min: ${stats.voltageMin}
    CURRENT Max: ${stats.currentMax} Min: ${stats.currentMin}`;
    

    pdf.text(statsText, 10, pdfHeight + 10);

    // Add input values to PDF
    const inputsText = `
    Speed: ${speed}
    Motor Model: ${motorModel}
    Propeller Model: ${propellerModel}`;

    pdf.text(inputsText, 10, pdfHeight + 30);

    pdf.save("chart.pdf");
  };

  
  const handleConfigWifi = () => {
    window.location.href = "http://esp32-motortester/config";
  };
  const handleUpgradeOta = () => {
    window.location.href = "http://esp32-motortester/upgrade_ota";
  };

  const timeRemaining = Math.max(0, duration - Math.floor((Date.now() - startTime!) / 1000));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <Box sx={{ display: "flex", flexDirection: "row", flexGrow: 1 }}>
        
        {/* Chart */}
        <Box sx={{ flex: 3 }}>
        <div className="chart-container" ref={chartRef}>
    <Line 
      data={data} 
      options={{ 
        animation: false, 
        responsive: true, 
        maintainAspectRatio: false 
      }} 
    />
  </div>
          
        </Box>
        {/* Right side content: Statistics, buttons, and controls */}
        <Box sx={{ flex: 1, ml: 2, display: "flex", flexDirection: "column" }}>
          {/* Statistics */}
          <Box sx={{ mb: 2, overflowY: "auto" }}>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold", fontSize: "2em" }}>THRUST</span> Max: <span style={{ fontWeight: "bold" }}>{stats.thrustMax}</span> Min: <span style={{ fontWeight: "bold" }}>{stats.thrustMin}</span>
    </Typography>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold", fontSize: "2em" }}>TORQUE</span> Max: <span style={{ fontWeight: "bold" }}>{stats.torqueMax}</span> Min: <span style={{ fontWeight: "bold" }}>{stats.torqueMin}</span>
    </Typography>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold", fontSize: "2em" }}>VOLTAGE</span> Max: <span style={{ fontWeight: "bold" }}>{stats.voltageMax}</span> Min: <span style={{ fontWeight: "bold" }}>{stats.voltageMin}</span>
    </Typography>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold", fontSize: "2em" }}>CURRENT</span> Max: <span style={{ fontWeight: "bold" }}>{stats.currentMax}</span> Min: <span style={{ fontWeight: "bold" }}>{stats.currentMin}</span>
    </Typography>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold" }}>Speed:</span> <span style={{ fontWeight: "bold" }}>{speed}</span>
    </Typography>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold" }}>Motor Model:</span> {motorModel}
    </Typography>
    <Typography variant="body1">
      <span style={{ fontWeight: "bold" }}>Propeller Model:</span> {propellerModel}
    </Typography>
  </Box>
          {/* Save as PDF, Config Wi-Fi and OTA buttons */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Button
              variant="contained"
              color="info"
              onClick={handleSaveAsPDF}
              fullWidth
              size="small"
            >
              Save as PDF
            </Button>
            <Button
              variant="contained"
              color="info"
              onClick={handleConfigWifi}
              fullWidth
              size="small"
            >
              Config Wi-Fi
            </Button>
            <Button
              variant="contained"
              color="info"
              onClick={handleUpgradeOta}
              fullWidth
              size="small"
            >
              OTA upgrade
            </Button>
          </Box>
          {/* Clear Graph button and Duration Countdown */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Button
              variant="contained"
              color="warning"
              onClick={handleClearGraph}
              fullWidth
              size="small"
            >
              Clear Graph
            </Button>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {`Time remaining: ${Math.floor(timeRemaining / 60)}:${addZero(timeRemaining % 60)}`}
            </Typography>
          </Box>
          {/* Test Button */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleStartReadings}
              disabled={!isValidInputs || isTestRunning}
              fullWidth
              size="small"
            >
              {isTestRunning ? "Test (Active)" : "Test"}
            </Button>
          
          
          {/* Stop Button */}
          
            <Button
              variant="contained"
              color="error"
              onClick={handleStopReadings}
              fullWidth
              size="small"
            >
              Stop
            </Button>
          </Box>
        </Box>
        
      </Box>
      <Grid container spacing={1} alignItems="center" sx={{ marginBottom: 2 }}>
          {/* Motor Model Input */}
          <Grid item xs={2}>
            <TextField
              label="Motor Model"
              variant="outlined"
              value={motorModel}
              onChange={(e) => setMotorModel(e.target.value)}
              fullWidth
              size="small"
              margin="none"
              disabled={isTestRunning}
            />
          </Grid>
          {/* Speed Input and Presets */}
          
          <Grid item xs={1}>
            <TextField
              label="Speed"
              variant="outlined"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              fullWidth
              size="small"
              margin="none"
              disabled={isTestRunning}
            />
          </Grid>
          <Grid item xs={2.75} container alignItems="center">
            {speedPresets.map((btn, index) => (
              <Button
                key={index}
                variant="outlined"
                disabled={isTestRunning}
                onClick={() => setSpeed((prev) => prev + btn.value)}
                size="small"
              >
                {btn.label}
              </Button>
            ))}
          </Grid>
        </Grid>
        <Grid container spacing={1} alignItems="center">
          {/* Propeller Model Input */}
          <Grid item xs={2}>
            <TextField
              label="Propeller Model"
              variant="outlined"
              value={propellerModel}
              onChange={(e) => setPropellerModel(e.target.value)}
              fullWidth
              size="small"
              margin="none"
              disabled={isTestRunning}
            />
          </Grid>
          
          {/* Duration Input and Presets */}
          <Grid item xs={1}>
            <TextField
              label="Duration"
              variant="outlined"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              fullWidth
              size="small"
              margin="none"
              disabled={isTestRunning}
            />
          </Grid>
          <Grid item xs={2.75} container  alignItems="center">
            {timePresets.map((btn, index) => (
              <Button
                key={index}
                variant="outlined"
                disabled={isTestRunning}
                onClick={() => setDuration((prev) => prev + btn.value)}
                size="small"
              >
                {btn.label}
              </Button>
            ))}
          </Grid>
          
          
          
        </Grid>
      
    </Box>
  );
};

export default App;
