import { useEffect, useRef, useState } from "react";
import { Button, Container, TextField, Box, Grid, Typography } from "@mui/material";
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
  {
    label: "+5s",
    value: 5,
  },
  {
    label: "+15s",
    value: 15,
  },
  {
    label: "+30s",
    value: 30,
  },
  {
    label: "+1m",
    value: 60,
  },
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
    const ws = new WebSocket("ws://esp32-enginetester:8080");
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
        averages[key].reduce((a: number, b: number) => a + b, 0) /
        averages[key].length;
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
    TOQUE Max: ${stats.torqueMax} Min: ${stats.torqueMin}
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

  return (
    <Container>
      <Box my={4}>
        <Typography variant="h6" align="center">
          THRUST Max: {stats.thrustMax} Min: {stats.thrustMin} | 
          TORQUE Max: {stats.torqueMax} Min: {stats.torqueMin} | 
          VOLTAGE Max: {stats.voltageMax} Min: {stats.voltageMin} | 
          CURRENT Max: {stats.currentMax} Min: {stats.currentMin}
        </Typography>
        <div ref={chartRef}>
          <Line data={data} options={{ animation: false }} />
        </div>
      </Box>
      <Box my={4}>
        <Grid container spacing={2} columns={12}>
          <Grid item xs={2}>
            <TextField
              label="Speed"
              variant="outlined"
              type="number"
              value={speed}
              onChange={(e) => setSpeed(+e.target.value)}
              fullWidth
              margin="normal"
              disabled={isTestRunning}
            />
          </Grid>
          <Grid item xs={2}>
            <TextField
              label="Duration (seconds)"
              variant="outlined"
              type="number"
              value={duration}
              onChange={(e) =>
                setDuration(+e.target.value >= 0 ? +e.target.value : 0)
              }
              fullWidth
              margin="normal"
              disabled={isTestRunning}
            />
          </Grid>
          <Grid item xs={3} spacing={2} container sx={{ pb: 3 }}>
            {timePresets.map((btn, index) => (
              <Button
                variant="text"
                disabled={isTestRunning}
                key={index}
                onClick={() => setDuration((prev) => (prev += btn.value))}
                sx={{
                  mt: 3,
                  height: "100%",
                }}
              >
                {btn.label}
              </Button>
            ))}
          </Grid>
          <Grid item xs={2.5}>
            <TextField
              label="Motor Model"
              variant="outlined"
              value={motorModel}
              onChange={(e) => setMotorModel(e.target.value)}
              fullWidth
              margin="normal"
            />
          </Grid>
          <Grid item xs={2.5}>
            <TextField
              label="Propeller Model"
              variant="outlined"
              value={propellerModel}
              onChange={(e) => setPropellerModel(e.target.value)}
              fullWidth
              margin="normal"
            />
          </Grid>
          
          <Grid item xs={3}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleStartReadings}
              disabled={!isValidInputs || isTestRunning}
              fullWidth
              sx={{
                mt: 2,
                mr: 1,
                bgcolor: isTestRunning ? "success.dark" : "primary.main",
              }}
            >
              {isTestRunning ? "Test (Active)" : "Test"}
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleStopReadings}
              fullWidth
              sx={{ mt: 2, mr: 1 }}
            >
              Stop
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button
              variant="contained"
              color="warning"
              onClick={handleClearGraph}
              fullWidth
              sx={{ mt: 2 }}
            >
              Clear Graph
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleSaveAsPDF}
              fullWidth
              sx={{ mt: 2 }}
            >
              Save as PDF
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default App;
