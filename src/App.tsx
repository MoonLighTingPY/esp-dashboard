import "./index.css";
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
import SpeedPreviewChart from "./SpeedPreviewChart";

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
  { label: "+", value: 5 },
  { label: "-", value: -5 },
];

const App = () => {
  const { speed } = useESP();
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
  const [speedPreview, setSpeedPreview] = useState<number[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    duration,
    socket,
    setSocket,
    dataQueue,
    startSpeed,
    endSpeed,
    setStartSpeed,
    setEndSpeed,
    setData,
    startTime,
    setDuration,
    handleStartReadings,
    isTestRunning,
    handleStopReadings,
    handleClearGraph,
    data,
  } = useESP();

  // Connect to the WebSocket server
  useEffect(() => {
    const ws = new WebSocket("ws://esp32-motortester.local:8080");
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
    }, {} as { [key: string]: number[] });
  
    Object.keys(averages).forEach((key) => {
      averages[key] = averages[key].reduce((a: number, b: number) => a + b, 0) / averages[key].length;
    });
  
    // Format elapsed time in mm:ss
    const elapsedTime = (new Date().getTime() - (startTime || 0)) / 1000;
    const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsedTime % 60).toString().padStart(2, '0');
    const timeLabel = `${minutes}:${seconds}`;
  
    // Update the graph data
    setData((prevData) => ({
      ...prevData,
      labels: [...prevData.labels, timeLabel],
      datasets: prevData.datasets.map((dataset) => ({
        ...dataset,
        data: [
          ...dataset.data,
          averages[dataset.label.toLowerCase()] ?? dataset.data[dataset.data.length - 1],
        ],
      })),
    }));
  };
  

  const handlePreviewSpeed = () => {
    if (!startSpeed || !endSpeed || !duration) return;
  
    const durationMs = duration * 1000;
    const previewData = [];
    for (let elapsed = 0; elapsed <= durationMs; elapsed += 100) {
      const progress = elapsed / durationMs;
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      previewData.push(currentSpeed);
    }
    setSpeedPreview(previewData);
    setIsPreviewOpen(true);
  };
  
  // In the return statement of the App component
  <SpeedPreviewChart
    open={isPreviewOpen}
    onClose={() => setIsPreviewOpen(false)}
    speedData={speedPreview}
    duration={duration} // Pass duration prop
  />

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
    const statsText = `
    Stats:

    THRUST Max: ${stats.thrustMax} Min: ${stats.thrustMin}
    TORQUE Max: ${stats.torqueMax} Min: ${stats.torqueMin}
    VOLTAGE Max: ${stats.voltageMax} Min: ${stats.voltageMin}
    CURRENT Max: ${stats.currentMax} Min: ${stats.currentMin}

    `;

    pdf.text(statsText, 120, pdfHeight + 10);

    // Add input values to PDF
    const inputsText = `
    Test info:

    Duration: ${Math.floor(duration / 60)} minutes ${addZero(
      duration % 60
    )} seconds
    Speed: ${speed}
    Motor Model: ${motorModel}
    Propeller Model: ${propellerModel}`;

    pdf.text(inputsText, 10, pdfHeight + 10);

    pdf.save("chart.pdf");
  };

  const handleConfigWifi = () => {
    window.location.href = "http://esp32-motortester.local/config";
  };

  const timeRemaining = Math.max(
    0,
    duration - Math.floor((Date.now() - startTime!) / 1000)
  );

  return (
    <div className="App">
      <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "row", flexGrow: 1 }}>
          {/* Chart */}
          <Box sx={{ flex: 3 }}>
            <div className="chart-container" ref={chartRef}>
              <div className="section-box">
                <Line
                  data={data}
                  options={{
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>
          </Box>

          {/* Right side content: Statistics, buttons, and controls */}
          <Box
            sx={{ flex: 1, ml: 2, display: "flex", flexDirection: "column" }}
          >
            {/* Statistics */}
            <div className="section-box">
              <Box sx={{ mb: 2, overflowY: "auto" }}>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "2em" }}>
                    THRUST
                  </span>{" "}
                  Max:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.thrustMax}</span>{" "}
                  Min:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.thrustMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "2em" }}>
                    TORQUE
                  </span>{" "}
                  Max:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.torqueMax}</span>{" "}
                  Min:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.torqueMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "2em" }}>
                    VOLTAGE
                  </span>{" "}
                  Max:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.voltageMax}</span>{" "}
                  Min:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.voltageMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "2em" }}>
                    CURRENT
                  </span>{" "}
                  Max:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.currentMax}</span>{" "}
                  Min:{" "}
                  <span style={{ fontWeight: "bold" }}>{stats.currentMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold" }}>Speed:</span>{" "}
                  <span style={{ fontWeight: "bold" }}>{speed}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold" }}> Duration:</span>{" "}
                  <span style={{ fontWeight: "bold" }}>{duration} seconds</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold" }}> Motor Model:</span>{" "}
                  {motorModel}
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold" }}> Propeller Model:</span>{" "}
                  {propellerModel}
                </Typography>
              </Box>
            </div>
            {/* Buttons */}
            <div className="section-box">
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <img
                  src="/images/play.ico"
                  alt="Test"
                  onClick={handleStartReadings}
                  style={{
                    cursor: "pointer",
                    width: "15%",
                    height: "auto",
                    marginLeft: "5",
                  }}
                />

                <img
                  src="/images/stop.ico"
                  alt="Stop"
                  onClick={handleStopReadings}
                  style={{ cursor: "pointer", width: "15%", height: "auto" }}
                />
                <img
                  src="/images/clear.ico"
                  alt="Clear Graph"
                  onClick={handleClearGraph}
                  style={{ cursor: "pointer", width: "15%", height: "auto" }}
                />
                <img
                  src="/images/pdf.ico"
                  alt="Save as PDF"
                  onClick={handleSaveAsPDF}
                  style={{ cursor: "pointer", width: "16%", height: "auto" }}
                />
                <img
                  src="/images/gear.ico"
                  alt="Configure WiFi"
                  onClick={handleConfigWifi}
                  style={{ cursor: "pointer", width: "15%", height: "auto" }}
                />
              </Box>
              <Typography
                variant="body1"
                sx={{
                  ml: 2,
                  fontWeight: "bold",
                  fontSize: "1.2em",
                  color: "#333",
                  textAlign: "center",
                }}
              >
                {`Time remaining: ${Math.floor(timeRemaining / 60)}:${addZero(
                  timeRemaining % 60
                )}`}
              </Typography>
            </div>
          </Box>
        </Box>

        <div className="section-box">
          <Grid
            container
            spacing={2}
            alignItems="center"
            sx={{ marginBottom: 2, ml: 4 }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                mt: 4.75,
              }}
            >
              {/* Motor Model Input */}
              <Grid item xs={12} sx={{ mr: 1 }}>
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
              {/* Propeller Model Input */}
              <Grid item xs={12}>
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
            </Box>
            <Button
                variant="contained"
                onClick={handlePreviewSpeed}
                disabled={isTestRunning}
              >
                Preview Speed
              </Button>
              <SpeedPreviewChart open={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} speedData={speedPreview} duration={duration} />
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                mt: 4.75,
                ml: 5,
              }}
            >
              {/* Speed Input and Presets */}
              <TextField
                label="Start Speed"
                variant="outlined"
                value={startSpeed}
                type="number"
                onChange={(e) => setStartSpeed(Number(e.target.value))}
                fullWidth
                size="small"
                margin="none"
                disabled={isTestRunning}
                style={{ width: "18ex", minWidth: "auto" }}
              />
              <TextField
                label="End Speed"
                variant="outlined"
                value={endSpeed}
                type="number"
                onChange={(e) => setEndSpeed(Number(e.target.value))}
                fullWidth
                size="small"
                margin="none"
                disabled={isTestRunning}
                style={{ width: "18ex", minWidth: "auto" }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                mt: 4.75,
                ml: 1,
              }}
            >
              {/* Duration Input and Presets */}
              <TextField
                label="Duration(seconds)"
                variant="outlined"
                value={duration}
                type="number"
                onChange={(e) => setDuration(Number(e.target.value))}
                fullWidth
                size="small"
                margin="none"
                disabled={isTestRunning}
                style={{ width: "18ex", minWidth: "auto" }}
              />

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                {timePresets.map((btn, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    disabled={isTestRunning}
                    onClick={() => setDuration((prev) => prev + btn.value)}
                    size="large"
                    style={{ width: "15px", minWidth: "auto" }}
                  >
                    {btn.label}
                  </Button>
                ))}
              </Box>
            </Box>
          </Grid>
        </div>
      </Box>
    </div>
  );
};

export default App;
