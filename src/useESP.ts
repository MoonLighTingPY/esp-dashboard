import { useState, useRef } from "react";
import { z } from "zod";

export const dataSchema = z.object({
  thrust: z.number(),
  torque: z.number(),
  voltage: z.number(),
  current: z.number(),
});

type DateSchema = z.infer<typeof dataSchema>;

const initData = {
  labels: [] as string[],
  datasets: [
    {
      label: "Thrust",
      data: [] as DateSchema[],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.2)",
    },
    {
      label: "Torque",
      data: [] as DateSchema[],
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 0.2)",
    },
    {
      label: "Voltage",
      data: [] as DateSchema[],
      borderColor: "rgba(75, 192, 192, 1)",
      backgroundColor: "rgba(75, 192, 192, 0.2)",
    },
    {
      label: "Current",
      data: [] as DateSchema[],
      borderColor: "rgb(58, 201, 68)",
      backgroundColor: "rgba(77, 192, 75, 0.2)",
    },
  ],
};

export const useESP = () => {
  const [startSpeed, setStartSpeed] = useState(800);
  const [endSpeed, setEndSpeed] = useState(1000);
  const [duration, setDuration] = useState(5);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [espStateData, updateESPData] = useState(initData);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [speed, setSpeed] = useState(0); // Declare speed state

  const dataQueue = useRef<any[]>([]);

  const handleStartReadings = async () => {
    if (!socket || !startSpeed || !endSpeed || !duration) return;
  
    const durationMs = duration * 1000; // Duration in milliseconds
    const startTime = new Date().getTime(); // Start time
  
    const message = JSON.stringify({
      type: "start",
      duration: durationMs,
      speed: startSpeed
    });
    socket.send(message);
    setIsTestRunning(true);
  
    const updateSpeed = () => {
      const now = new Date().getTime();
      const elapsed = now - startTime;
      
      if (elapsed >= durationMs) {
        setSpeed(endSpeed); // Ensure final speed is exactly endSpeed
        const finalMessage = JSON.stringify({
          type: "speedUpdate",
          speed: endSpeed
        });
        socket.send(finalMessage);
        return; // Stop updating once the duration is complete
      }
  
      // Calculate the current speed based on elapsed time
      const progress = elapsed / durationMs; // Value between 0 and 1
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      setSpeed(currentSpeed);
  
      // Send the current speed to the server
      const speedMessage = JSON.stringify({
        type: "speedUpdate",
        speed: currentSpeed
      });
      socket.send(speedMessage);
  
      // Request the next frame update
      requestAnimationFrame(updateSpeed);
    };
  
    requestAnimationFrame(updateSpeed);
  };
  
  

  
  const handleStopReadings = () => {
    if (!socket) return;

    const message = JSON.stringify({ type: "stop" });
    socket.send(message);
    setIsTestRunning(false);
    setStartTime(null);
    setSpeed(0); // Reset speed state
  };

  const handleClearGraph = () => {
    updateESPData({
      labels: [],
      datasets: espStateData.datasets.map((dataset) => ({
        ...dataset,
        data: [],
      })),
    });
  };

  return {
    startSpeed,
    setStartSpeed,
    endSpeed,
    setEndSpeed,
    duration,
    setDuration,
    startTime,
    setStartTime,
    data: espStateData,
    setData: updateESPData,
    isTestRunning,
    setIsTestRunning,
    socket,
    setSocket,
    speed, // Return speed state
    dataQueue,
    handleStartReadings,
    handleStopReadings,
    handleClearGraph,
  };
};