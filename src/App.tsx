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
    thrustMin: Infinity,
    torqueMax: 0,
    torqueMin: Infinity,
    voltageMax: 0,
    voltageMin: Infinity,
    currentMax: 0,
    currentMin: Infinity,
  });

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
    const ws = new WebSocket("ws://192.168.0.150:8080");
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

    setData((prevData) => {
      return {
        ...prevData,
        labels: [...prevData.labels, `${minutes}:${seconds}`],
        datasets: prevData.datasets.map((dataset, index) => ({
          ...dataset,
          data: [...dataset.data, averages[Object.keys(averages)[index]]],
        })),
      };
    });
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

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    // Add text for all-time stats
    const statsText = `Thrust Max: ${stats.thrustMax} Min: ${stats.thrustMin}
    Torque Max: ${stats.torqueMax} Min: ${stats.torqueMin}
    Voltage Max: ${stats.voltageMax} Min: ${stats.voltageMin}
    Current Max: ${stats.currentMax} Min: ${stats.currentMin}`;

    pdf.text(statsText, 10, pdfHeight + 20);

    pdf.save("chart.pdf");
  };

  return (
    <Container>
      <Box my={4}>
        <Typography variant="h6" align="center" gutterBottom>
          Statistics
        </Typography>
        <Typography variant="body1" align="center" gutterBottom>
          Thrust Max: {stats.thrustMax} Min: {stats.thrustMin} |
          Torque Max: {stats.torqueMax} Min: {stats.torqueMin} |
          Voltage Max: {stats.voltageMax} Min: {stats.voltageMin} |
          Current Max: {stats.currentMax} Min: {stats.currentMin}
        </Typography>
        <div ref={chartRef}>
          <Line data={data} options={{ animation: false }} />
        </div>
      </Box>
      <Box my={4}>
        <Grid container spacing={2} columns={12}>
          <Grid item xs={4}>
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
          <Grid item xs={4}>
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
          <Grid item xs={4} spacing={1} container sx={{ pb: 3 }}>
            {timePresets.map((btn, index) => (
              <Button
                variant="text"
                disabled={isTestRunning}
                key={index}
                onClick={() => setDuration((prev) => (prev += btn.value))}
                sx={{
                  mt: 2,
                  height: "100%",
                }}
              >
                {btn.label}
              </Button>
            ))}
          </Grid>
        </Grid>
        <Grid container spacing={2} columns={4}>
          <Grid item xs={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleStartReadings}
              disabled={!speed || !duration || isTestRunning}
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
          <Grid item xs={1}>
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
          <Grid item xs={1}>
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
          <Grid item xs={1}>
            <Button
              variant="contained"
              color="success"
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
