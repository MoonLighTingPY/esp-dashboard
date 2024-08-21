import "./index.css";
import { useEffect, useRef, useState, useMemo } from "react";
import { Box, Typography, LinearProgress, Alert} from "@mui/material";
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
  const [savedSpeedData, setSavedSpeedData] = useState<number[]>([]);  // Speed data saved from the SpeedPreviewChart component to use in the main chart
  const [acceleration, setAcceleration] = useState(1);
  const [AlertDefaultInputs, setAlertDefaultInputs] = useState(true);
  const [showSaveSucess, setShowSaveSucess] = useState(false); // Alert state just like AlertDefaultInput, just too much to rename to "alertSaveSuccess"
  
  // useESP hook is used to send and receive the data from the ESP32 and handle the test start/stop logic 
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

  // Connection to the WebSocket server on esp32
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

      // Added this to prevent the test from starting if the data is not in the correct format
      if (!parsed.success) {
        return alert("Fetched data in wrong format!");
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

  // Show the success alert after saving the inputs for n seconds
  useEffect(() => {
    if (showSaveSucess) {
      const timeoutId = setTimeout(() => {
        setShowSaveSucess(false);
      }, 15000);

      return () => clearTimeout(timeoutId);
    }
  }, [showSaveSucess]);

  // Show an alert if default inputs are used
  useEffect(() => {
    if (showSaveSucess) {
      setAlertDefaultInputs(false);
    }
  } , [savedSpeedData]);      

  // Refresh the graph data
  useEffect(() => {
    const intervalId = setInterval(refreshGraphData, 100); // (Set the refresh interval here in milliseconds)

    return () => clearInterval(intervalId);
  }, [startTime]);

  const refreshGraphData = () => {
    if (dataQueue.current.length <= 0) return;
  
    const batchData = dataQueue.current;
    dataQueue.current = [];
  
    // Displaying all the data points the moment they arrive is not practical
    // as the page would lag + the graph would be unreadable
    // Instead, it calculates the average of all the data points recieved
    // during the set interval in a batch and only then displays it on the graph
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

    // Format elapsed time in mm:ss for a label
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
  

   // Memoize the preview data that's displayed in the speed preview chart
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

  // This function is called when the user clicks the preview speed(gear) button
  const handlePreviewSpeed = () => {
    setSpeedPreview(savedSpeedData.length > 0 ? savedSpeedData : previewData);
    setIsPreviewOpen(true);
  };
  
  // Save the preview data(speedData) to the state
  // It is called when the user clicks the save button in the SpeedPreviewChart component
  // This function is passed as a prop to the SpeedPreviewChart component
  const handleSavePreviewData = (speedData: number[], startSpeed: number, endSpeed: number, duration: number, motorModel: string, propellerModel: string) => {
    setShowSaveSucess(true);
    setSavedSpeedData(speedData);
    setStartSpeed(startSpeed);
    setEndSpeed(endSpeed);
    setDuration(duration);
    setMotorModel(motorModel);
    setPropellerModel(propellerModel);
    setIsPreviewOpen(false);
  };

  // Self-explanatory. Clears the stats
  const handleClearStats = () => {
    setStats({
      thrustMax: 0,
      thrustMin: 0,
      torqueMax: 0,
      torqueMin: 0,
      voltageMax: 0,
      voltageMin: 0,
      currentMax: 0,
      currentMin: 0,
    });
  }

  // Save the chart, min max values and Inputs as a PDF.
  // Chart is saved as an image and added to the PDF (no lib for chart.js to PDF)
  // This function is called when the user clicks the save as PDF button
  const handleSaveAsPDF = async () => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const canvas = await html2canvas(chartElement);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    const accelerationState = acceleration === 1 ? "Off" : "On";


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

    // Add input values to PDF
    const inputsText = `
      Inputs:

      Duration: ${Math.floor(duration / 60)} minutes ${addZero(
        duration % 60
      )} seconds
      Start Speed: ${startSpeed || 'Not set'}
      End Speed: ${endSpeed || 'Not set'}
      Acceleration: ${accelerationState} (Factor: ${acceleration})
      Motor Model: ${motorModel || 'Not set'}
      Propeller Model: ${propellerModel || 'Not set'}`;

    pdf.text(inputsText, 10, pdfHeight);

    pdf.save("chart.pdf");
  };

  // Redirect to the WiFi configuration page
  const handleConfigWifi = () => {
    window.location.href = "http://esp32-motortester.local/config";
  };

  // Calculate the time remaining for the test
  const timeRemaining = Math.max(
    0,
    duration - Math.floor((Date.now() - startTime!) / 1000)
  );


  return (
    // Main container. Lots of nested Box components. Sorry(
    <div className="App">
      <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "row", flexGrow: 1 }}>
          {/* Chart */}
          <Box sx={{ flex: 3 }}>
            
            <div className="chart-container" ref={chartRef}>
              <div className="section-box">
                <Line
                  data={data}
                  // This is the options for the chart.
                  // y1, y2, y3, y4 are defined so each dataset can have its own y-axis, so no need to normalize the data.
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
                              color: '#b7a038' // Change label color on y-axis
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
            {/* I suggest adding a table here for better readability. Tried to do it, but it was not working as expected */}
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
            {/* Actually just pictures with onClick events lol */}
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
                    // useESP hook has a function to handle the start of the test
                    // it also handles the test stop logic
                    handleStartReadings();
                    handleClearStats();
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
                {/* Called speed preview chart, but it's actually the inputs + speedpreview. Takes too long to rename everything so left it as is */}
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
              {/* Time remaining */}
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
                {/* Progress bar */}
                <LinearProgress
              variant="determinate"
              value={((duration - timeRemaining) / duration) * 100}
              sx={{
                marginTop: 2,
                height: 10, // Custom height
                backgroundColor: "#e0e0e0", // Background color
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "#3f51b5", // Bar color
                },
              }}
            />
              </Typography>
            </div>
            {/* Alerts (standart inputs and save success) */}
            {showSaveSucess && (
                <div className="alert-container">
                  <Alert severity="success" onClose={() => setShowSaveSucess(false)} sx={{ fontSize: "1.3em", }}>
                    Inputs saved successfully!
                  </Alert>
                </div>
                )}
            {AlertDefaultInputs && (
            <div className="alert-container">
              <Alert severity="info" onClose={() => setAlertDefaultInputs(false)} sx={{ fontSize: "1.3em",  }}>
                Using default inputs.<br />
                Click the gear icon to change them.
              </Alert>
            </div>
            )}
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default App;
