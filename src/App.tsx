import "./index.css";
import { useEffect, useRef, useState, useMemo } from "react";
import { Box, Typography } from "@mui/material";
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



const App = () => {
  const {} = useESP();
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
  const [motorModel, setMotorModel] = useState("Not set.");
  const [propellerModel, setPropellerModel] = useState("Not set.");
  const [, setSpeedPreview] = useState<number[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [savedSpeedData, setSavedSpeedData] = useState<number[]>([]); // Add state for saved speed data
  const [acceleration, setAcceleration] = useState(1);
  
  
  

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
    handleStopReadings,
    data,
  } = useESP();

  // Connect to the WebSocket server
  useEffect(() => {
    const ws = new WebSocket("ws://esp32-motortester.local:80/ws");
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
      console.log("Received data:", newData);
      

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
  
    const currentTime = new Date().getTime();

    // Format elapsed time in mm:ss
    const elapsedTime = (currentTime - (startTime || 0)) / 1000;
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
  

   // Memoize the preview data
   const previewData = useMemo(() => {
    if (!startSpeed || !endSpeed || !duration) return [];
    const durationMs = duration * 1000;
    const data = [];
    for (let elapsed = 0; elapsed <= durationMs; elapsed += 100) {
      const progress = elapsed / durationMs;
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      data.push(currentSpeed);
    }
    return data;
  }, [startSpeed, endSpeed, duration]);

  const handlePreviewSpeed = () => {
    setSpeedPreview(savedSpeedData.length > 0 ? savedSpeedData : previewData);
    setIsPreviewOpen(true);
  };
  

  const handleSavePreviewData = (speedData: number[], startSpeed: number, endSpeed: number, duration: number, motorModel: string, propellerModel: string) => {
    setSavedSpeedData(speedData);
    setStartSpeed(startSpeed);
    setEndSpeed(endSpeed);
    setDuration(duration);
    setMotorModel(motorModel);
    setPropellerModel(propellerModel);
    setIsPreviewOpen(false);
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
    const statsText = `
    Stats:

    Thrust Max: ${stats.thrustMax} Min: ${stats.thrustMin}
    Torque Max: ${stats.torqueMax} Min: ${stats.torqueMin}
    Voltage Max: ${stats.voltageMax} Min: ${stats.voltageMin}
    Current Max: ${stats.currentMax} Min: ${stats.currentMin}

    `;

    pdf.text(statsText, 120, pdfHeight);

    const accelerationState = acceleration === 1 ? "Off" : "On";
    // Add input values to PDF
    const inputsText = `
    Inputs:

    Duration: ${Math.floor(duration / 60)} minutes ${addZero(
      duration % 60
    )} seconds
    Start Speed: ${startSpeed}
    End Speed: ${endSpeed}
    Acceleration: ${accelerationState} (Factor: ${acceleration})
    Motor Model: ${motorModel}
    Propeller Model: ${propellerModel}`;

    pdf.text(inputsText, 10, pdfHeight);

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
                    
                    scales: {
                      y: {
                        
                          grid: {
                              color: 'rgba(0, 0, 0, 0)',  // Change axis line color
                                         // Change the border color (axis line)
                          },
                          ticks: {
                              color: '#baf202' // Change label color on y-axis
                          }
                      },
                      y1: {
                        
                          grid: {
                              color: 'rgba(0, 0, 0, 0)',  // Change axis line color
                                        // Change the border color (axis line)
                          },
                          ticks: {
                            callback: function(value) {
                              return Number(value).toFixed(2) + 'A'; // Customize the label
                            },
                              color: 'green' // Change label color on y-axis
                          }
                          
                      },
                      y2: {
                        
                          grid: {
                              color: 'rgba(0, 0, 0, 0)',  // Change axis line color
                                        // Change the border color (axis line)
                          },
                          ticks: {
                            callback: function(value) {
                              return Number(value).toFixed(2) + 'V'; // Customize the label
                          },
                              color: '#00d6b3' // Change label color on y-axis
                          }
                      },
                      y3: {
                        
                          grid: {
                              color: 'rgba(0, 0, 0, 0)',  // Change axis line color
                                        // Change the border color (axis line)
                          },
                          ticks: {
                            callback: function(value) {
                              return value + ' g.'; // Customize the label
                          },
                              color: 'blue' // Change label color on y-axis
                          }
                      },
                      y4: {
                        
                          grid: {
                              color: 'rgba(0, 0, 0, 0)',  // Change axis line color
                                        // Change the border color (axis line)
                          },
                          ticks: {
                            callback: function(value) {
                              return value + ' g.'; // Customize the label
                          },
                              color: 'red' // Change label color on y-axis
                          }
                      },
                      
                  }
                  }}
                />
              </div>
            </div>
          </Box>

          {/* Right side content: Statistics, buttons, and controls */}
          <Box sx={{ flex: 1, ml: 2, display: "flex", flexDirection: "column" }}>
            {/* Statistics */}
            <div className="section-box">
              <Box sx={{ mb: 2, overflowY: "auto" }}>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "1.2vw" }}>
                    THRUST
                  </span>{" "}
                  <span style={{ fontSize: "0.9vw" }}>Max: {stats.thrustMax} Min:{" "} {stats.thrustMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "1.2vw" }}>
                    TORQUE
                  </span>{" "}
                  <span style={{ fontSize: "0.9vw" }}>Max: {stats.torqueMax} Min:{" "} {stats.torqueMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "1.2vw" }}>
                    VOLTAGE
                  </span>{" "}
                  <span style={{ fontSize: "0.9vw" }}>Max: {stats.voltageMax} Min:{" "} {stats.voltageMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "1.2vw" }}>
                    CURRENT
                  </span>{" "}
                  <span style={{ fontSize: "0.9vw" }}>Max: {stats.currentMax} Min:{" "} {stats.currentMin}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "0.8vw" }}>
                    Start Speed:
                  </span>{" "}
                  <span style={{ fontSize: "0.8vw" }}>{startSpeed}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "0.8vw" }}>
                    End Speed:
                  </span>{" "}
                  <span style={{ fontSize: "0.8vw" }}>{endSpeed}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "0.8vw" }}>
                    Duration:
                  </span>{" "}
                  <span style={{ fontSize: "0.8vw" }}>{duration} seconds</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "0.8vw" }}>
                    Motor Model:
                  </span>{" "}
                  <span style={{ fontSize: "0.8vw" }}>{motorModel}</span>
                </Typography>
                <Typography variant="body1">
                  <span style={{ fontWeight: "bold", fontSize: "0.8vw" }}>
                    Propeller Model:
                  </span>{" "}
                  <span style={{ fontSize: "0.8vw" }}>{propellerModel}</span>
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
                  onClick={() => {
                    handleStartReadings();
                    
                  }}
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
                  src="/images/gear.ico"
                  alt="Inputs"
                  onClick={handlePreviewSpeed}
                  style={{ cursor: "pointer", width: "15%", height: "auto" }}
                />
                <SpeedPreviewChart
                  open={isPreviewOpen}
                  onClose={() => setIsPreviewOpen(false)}
                  acceleration={acceleration}
                  setAcceleration={setAcceleration}
                  speedData={
                    savedSpeedData.length > 0 ? savedSpeedData : previewData
                  }
                  onSave={handleSavePreviewData}
                />
                <img
                  src="/images/pdf.ico"
                  alt="Save as PDF"
                  onClick={handleSaveAsPDF}
                  style={{ cursor: "pointer", width: "16%", height: "auto" }}
                />
                <img
                  src="/images/wifi.ico"
                  alt="Configure WiFi"
                  onClick={handleConfigWifi}
                  style={{ cursor: "pointer", width: "15%", height: "auto" }}
                />
              </Box>
              <Typography
                variant="body1"
                sx={{
                  mt: 1,
                  ml: 2,
                  fontWeight: "bold",
                  fontSize: "1.2em",
                  color: "#333",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "1vw" }}>{`Time remaining: ${Math.floor(timeRemaining / 60)}:${addZero(
                  timeRemaining % 60
                )}`}</span>
              </Typography>
            </div>
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default App;
